"""
FILE: app/api/nutrition_routes.py

Responsibility:
  Meals CRUD, AI-powered food detection (USDA 2-step flow),
  food search endpoint.

MUST NOT:
  - Handle tasks, workouts, or streak logic
  - Access points_engine

Depends on:
  - db.get_db(), mappers.map_meal, utils.*
  - nutrition_ai.detect_foods, process_confirmed_foods, search_foods
  - helpers.default_user_id()
"""


from datetime import datetime

from flask import Blueprint, jsonify, request

from ..middleware import rate_limit
from ..mappers import map_meal
from ..nutrition_ai import detect_foods, process_confirmed_foods, search_foods
from ..repositories.nutrition_repo import NutritionRepository
from ..utils import safe_float, safe_int, today_str
from .helpers import default_user_id

nutrition_bp = Blueprint("nutrition", __name__)
VALID_MEAL_TYPES = frozenset({"breakfast", "lunch", "dinner", "snack", "other"})


def _normalize_meal_type(value):
    meal_type = str(value or "other").strip().lower()
    return meal_type if meal_type in VALID_MEAL_TYPES else "other"


@nutrition_bp.route("/api/meals", methods=["GET"])
def get_meals():
    date_filter = request.args.get("date")
    rows = NutritionRepository.get_all(default_user_id(), date_filter)
    return jsonify([map_meal(r) for r in rows])


@nutrition_bp.route("/api/meals", methods=["POST"])
@rate_limit(max_requests=20, window_seconds=60)
def create_meal():
    req_data = request.get_json(silent=True) or {}
    uid = default_user_id()

    name = (req_data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Meal name is required"}), 400

    meal_type = _normalize_meal_type(req_data.get("meal_type", "other"))

    meal_id = NutritionRepository.create(
        uid,
        name=name,
        meal_type=meal_type,
        calories=max(0, safe_int(req_data.get("calories"), 0)),
        protein=max(0.0, safe_float(req_data.get("protein", 0), 0.0)),
        carbs=max(0.0, safe_float(req_data.get("carbs", 0), 0.0)),
        fats=max(0.0, safe_float(req_data.get("fats", 0), 0.0)),
        notes=req_data.get("notes", ""),
        date=req_data.get("date", today_str()),
        time=req_data.get("time", datetime.now().strftime("%H:%M")),
    )

    row = NutritionRepository.get_by_id(meal_id, uid)
    return jsonify(map_meal(row)), 201


@nutrition_bp.route("/api/meals/<int:meal_id>", methods=["PUT"])
def update_meal(meal_id):
    uid = default_user_id()
    row = NutritionRepository.get_by_id(meal_id, uid)
    if not row:
        return jsonify({"error": "Meal not found"}), 404

    req_data = request.get_json(silent=True) or {}
    meal_type = _normalize_meal_type(req_data.get("meal_type", row["meal_type"]))

    NutritionRepository.update(
        meal_id, uid,
        name=req_data.get("name", row["name"]),
        meal_type=meal_type,
        calories=max(0, safe_int(req_data.get("calories", row["calories"]), row["calories"])),
        protein=max(0.0, safe_float(req_data.get("protein", row["protein"]), row["protein"])),
        carbs=max(0.0, safe_float(req_data.get("carbs", row["carbs"]), row["carbs"])),
        fats=max(0.0, safe_float(req_data.get("fats", row["fats"]), row["fats"])),
        notes=req_data.get("notes", row["notes"]),
        date=req_data.get("date", row["date"]),
        time=req_data.get("time", row["time"]),
    )

    updated = NutritionRepository.get_by_id(meal_id, uid)
    return jsonify(map_meal(updated))


@nutrition_bp.route("/api/meals/<int:meal_id>", methods=["DELETE"])
def delete_meal(meal_id):
    deleted = NutritionRepository.delete(meal_id, default_user_id())
    if not deleted:
        return jsonify({"error": "Meal not found"}), 404
    return jsonify({"message": "Meal deleted successfully"}), 200


# ---------------------------------------------------------------------------
# AI Nutrition Agent (USDA-powered) — 2-Step Confirmation Flow
# ---------------------------------------------------------------------------

@nutrition_bp.route("/api/nutrition/ai-detect", methods=["POST"])
@rate_limit(max_requests=20, window_seconds=60)
def ai_detect_foods():
    default_user_id()  # Require auth
    req_data = request.get_json(silent=True) or {}
    user_input = (req_data.get("user_input") or "").strip()
    if not user_input:
        return jsonify({"error": "user_input is required"}), 400

    meal_type = _normalize_meal_type(req_data.get("meal_type", "other"))
    result = detect_foods(user_input, meal_type)

    if result.get("status") == "error":
        return jsonify(result), 400

    return jsonify(result), 200


@nutrition_bp.route("/api/nutrition/ai-log", methods=["POST"])
@rate_limit(max_requests=20, window_seconds=60)
def ai_log_meal():
    uid = default_user_id()  # Auth check first — before any external API calls
    req_data = request.get_json(silent=True) or {}
    confirmed_foods = req_data.get("foods", [])
    if not confirmed_foods:
        return jsonify({"error": "No confirmed foods to log"}), 400

    meal_type = _normalize_meal_type(req_data.get("meal_type", "other"))
    result = process_confirmed_foods(confirmed_foods, meal_type)

    meal_type_normalized = _normalize_meal_type(result.get("meal_type") or meal_type)
    log_date = req_data.get("date", today_str())
    log_time = req_data.get("time", datetime.now().strftime("%H:%M"))

    entries = []
    for food in result["foods"]:
        entries.append({
            "name": food["name"],
            "meal_type": meal_type_normalized,
            "calories": max(0, int(round(food.get("calories", 0)))),
            "protein": max(0.0, round(food.get("protein", 0), 1)),
            "carbs": max(0.0, round(food.get("carbs", 0), 1)),
            "fats": max(0.0, round(food.get("fats", 0), 1)),
            "notes": f"AI-logged | USDA FDC#{food.get('fdc_id', 'N/A')} ({food.get('data_type', '')})",
            "date": log_date,
            "time": log_time,
        })

    saved_ids = NutritionRepository.bulk_create(uid, entries)
    result["saved_entry_ids"] = saved_ids
    return jsonify(result), 201


@nutrition_bp.route("/api/nutrition/search", methods=["GET"])
def search_usda_foods():
    default_user_id()  # Require auth
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify([])

    limit = min(safe_int(request.args.get("limit"), 8), 25)
    results = search_foods(query, limit=limit)
    return jsonify(results)
