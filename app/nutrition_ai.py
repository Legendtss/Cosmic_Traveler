"""
Gemini-backed Nutrition AI compatibility layer.

This module preserves the legacy nutrition route contract (`detect_foods`,
`process_confirmed_foods`, `search_foods`) while using Gemini/local estimates.
All detection is powered by the shared Gemini avatar pipeline (with local
fallback handled inside `ai_avatar.process_avatar_message`).
"""

import re

from .ai_avatar import INDIAN_FOOD_ESTIMATES, process_avatar_message

VALID_MEAL_TYPES = {"breakfast", "lunch", "dinner", "snack", "other"}

UNIT_TO_GRAMS = {
    "g": 1.0,
    "gram": 1.0,
    "grams": 1.0,
    "kg": 1000.0,
    "ml": 1.0,
    "l": 1000.0,
    "cup": 240.0,
    "cups": 240.0,
    "tbsp": 15.0,
    "tablespoon": 15.0,
    "tsp": 5.0,
    "teaspoon": 5.0,
    "oz": 28.35,
    "lb": 453.6,
    "piece": 100.0,
    "pieces": 100.0,
    "serving": 100.0,
}


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_meal_type(value):
    meal_type = str(value or "other").strip().lower()
    return meal_type if meal_type in VALID_MEAL_TYPES else "other"


def _extract_weight_from_note(note):
    if not note:
        return 0.0
    match = re.search(r"~\s*(\d+(?:\.\d+)?)\s*g", str(note), flags=re.IGNORECASE)
    return _safe_float(match.group(1), 0.0) if match else 0.0


def _estimate_quantity_g(name, quantity, unit, note=""):
    qty = max(0.1, _safe_float(quantity, 1.0))
    unit_lower = str(unit or "serving").strip().lower()

    for key, grams_per_serving in UNIT_TO_GRAMS.items():
        if key in unit_lower:
            return round(qty * grams_per_serving, 1)

    # Try note-generated grams first (from local fallback hints)
    note_grams = _extract_weight_from_note(note)
    if note_grams > 0:
        return round(note_grams, 1)

    # Try local estimate DB by food name
    name_lower = str(name or "").strip().lower()
    for key in sorted(INDIAN_FOOD_ESTIMATES.keys(), key=len, reverse=True):
        if key in name_lower or name_lower in key:
            grams = _safe_float(INDIAN_FOOD_ESTIMATES[key].get("grams"), 100.0)
            return round(max(1.0, qty * grams), 1)

    # Last resort default
    return round(qty * 100.0, 1)


def _build_per_100g(calories, protein, carbs, fats, quantity_g):
    grams = max(1.0, _safe_float(quantity_g, 100.0))
    factor = 100.0 / grams
    return {
        "calories": round(max(0.0, _safe_float(calories, 0.0)) * factor, 1),
        "protein": round(max(0.0, _safe_float(protein, 0.0)) * factor, 1),
        "carbs": round(max(0.0, _safe_float(carbs, 0.0)) * factor, 1),
        "fats": round(max(0.0, _safe_float(fats, 0.0)) * factor, 1),
    }


def _to_legacy_item(entry, confidence):
    name = str(entry.get("name") or "Food").strip() or "Food"
    quantity = max(0.1, _safe_float(entry.get("quantity"), 1.0))
    unit = str(entry.get("unit") or "serving").strip() or "serving"
    note = str(entry.get("note") or "Gemini estimated").strip() or "Gemini estimated"

    calories = round(max(0.0, _safe_float(entry.get("calories"), 0.0)), 1)
    protein = round(max(0.0, _safe_float(entry.get("protein"), 0.0)), 1)
    carbs = round(max(0.0, _safe_float(entry.get("carbs"), 0.0)), 1)
    fats = round(max(0.0, _safe_float(entry.get("fats"), 0.0)), 1)

    quantity_g = _estimate_quantity_g(name, quantity, unit, note)
    per_100g = _build_per_100g(calories, protein, carbs, fats, quantity_g)

    return {
        "original_input": name,
        "matched_name": name,
        "fdc_id": None,
        "data_type": "Gemini Estimate",
        "confidence": confidence,
        "quantity": round(quantity, 2),
        "unit": unit,
        "quantity_g": quantity_g,
        "calories": calories,
        "protein": protein,
        "carbs": carbs,
        "fats": fats,
        "per_100g": per_100g,
        "note": note,
        "alternatives": [],
    }


def detect_foods(user_input, meal_type="other"):
    meal_type = _normalize_meal_type(meal_type)
    text = str(user_input or "").strip()
    if not text:
        return {"status": "error", "error": "user_input is required"}

    avatar_result = process_avatar_message(
        text,
        context={"current_page": "nutrition", "meal_type": meal_type},
        mode="nutrition",
    )

    if avatar_result.get("error"):
        return {"status": "error", "error": avatar_result.get("error", "AI service unavailable")}

    status = avatar_result.get("status")
    if status == "clarification_needed":
        return {
            "status": "clarify",
            "meal_type": meal_type.capitalize(),
            "items": [],
            "user_input": text,
            "clarifications": [
                {
                    "original_input": text,
                    "quantity": 1,
                    "unit": "serving",
                    "reason": avatar_result.get("message", "Could not identify foods. Please be more specific."),
                    "suggestions": [],
                }
            ],
        }

    details = avatar_result.get("details", {}) if isinstance(avatar_result, dict) else {}
    raw_items = details.get("items", []) if isinstance(details.get("items", []), list) else []
    confidence = str(avatar_result.get("confidence") or avatar_result.get("intent_confidence") or "medium").lower()
    if confidence not in ("high", "medium", "low"):
        confidence = "medium"

    items = [_to_legacy_item(entry, confidence) for entry in raw_items if isinstance(entry, dict)]
    if not items:
        return {
            "status": "clarify",
            "meal_type": meal_type.capitalize(),
            "items": [],
            "user_input": text,
            "clarifications": [
                {
                    "original_input": text,
                    "quantity": 1,
                    "unit": "serving",
                    "reason": "No foods detected. Please provide clearer item names.",
                    "suggestions": [],
                }
            ],
        }

    return {
        "status": "confirm",
        "meal_type": _normalize_meal_type(details.get("meal_type") or meal_type).capitalize(),
        "items": items,
        "user_input": text,
    }


def process_confirmed_foods(confirmed_items, meal_type="other"):
    if not isinstance(confirmed_items, list) or not confirmed_items:
        return {"status": "error", "error": "No confirmed foods provided"}

    resolved_meal_type = _normalize_meal_type(meal_type)
    foods = []

    for item in confirmed_items:
        if not isinstance(item, dict):
            continue

        name = str(item.get("name") or item.get("matched_name") or "Food").strip() or "Food"
        quantity_g = max(1.0, _safe_float(item.get("quantity_g"), 100.0))

        calories = _safe_float(item.get("calories"), None)
        protein = _safe_float(item.get("protein"), None)
        carbs = _safe_float(item.get("carbs"), None)
        fats = _safe_float(item.get("fats"), None)

        if calories is None or protein is None or carbs is None or fats is None:
            per_100g = item.get("per_100g", {}) if isinstance(item.get("per_100g"), dict) else {}
            factor = quantity_g / 100.0
            calories = _safe_float(per_100g.get("calories"), 0.0) * factor
            protein = _safe_float(per_100g.get("protein"), 0.0) * factor
            carbs = _safe_float(per_100g.get("carbs"), 0.0) * factor
            fats = _safe_float(per_100g.get("fats"), 0.0) * factor

        foods.append(
            {
                "name": name,
                "fdc_id": None,
                "data_type": "Gemini Estimate",
                "quantity_g": round(quantity_g, 1),
                "calories": round(max(0.0, calories), 1),
                "protein": round(max(0.0, protein), 1),
                "carbs": round(max(0.0, carbs), 1),
                "fats": round(max(0.0, fats), 1),
                "confidence": str(item.get("confidence") or "medium").lower(),
            }
        )

    totals = {
        "calories": round(sum(f.get("calories", 0.0) for f in foods), 1),
        "protein": round(sum(f.get("protein", 0.0) for f in foods), 1),
        "carbs": round(sum(f.get("carbs", 0.0) for f in foods), 1),
        "fats": round(sum(f.get("fats", 0.0) for f in foods), 1),
    }

    return {
        "status": "logged",
        "meal_type": resolved_meal_type,
        "foods": foods,
        "totals": totals,
    }


def search_foods(query, limit=8):
    text = str(query or "").strip().lower()
    if not text:
        return []

    scored = []
    for name, nutrition in INDIAN_FOOD_ESTIMATES.items():
        name_l = name.lower()
        if text in name_l:
            score = 100 - abs(len(name_l) - len(text))
        else:
            words = text.split()
            overlap = sum(1 for w in words if w and w in name_l)
            if overlap == 0:
                continue
            score = overlap * 10

        grams = max(1.0, _safe_float(nutrition.get("grams"), 100.0))
        calories = _safe_float(nutrition.get("calories"), 0.0)
        protein = _safe_float(nutrition.get("protein"), 0.0)
        carbs = _safe_float(nutrition.get("carbs"), 0.0)
        fats = _safe_float(nutrition.get("fats"), 0.0)
        factor = 100.0 / grams

        scored.append(
            (
                score,
                {
                    "fdc_id": None,
                    "description": name.title(),
                    "data_type": "Gemini Estimate",
                    "serving": str(nutrition.get("serving") or "1 serving"),
                    "per_100g": {
                        "calories": round(calories * factor, 1),
                        "protein": round(protein * factor, 1),
                        "carbs": round(carbs * factor, 1),
                        "fats": round(fats * factor, 1),
                    },
                },
            )
        )

    scored.sort(key=lambda row: row[0], reverse=True)
    return [row[1] for row in scored[: max(1, int(limit or 8))]]
