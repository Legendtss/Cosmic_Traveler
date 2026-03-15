"""
FILE: app/api/workouts_routes.py

Responsibility:
  Workout CRUD: GET/POST /api/workouts,
  PUT/DELETE /api/workouts/<id>, PATCH /api/workouts/<id>/toggle.

MUST NOT:
  - Handle tasks, nutrition, or streak logic
  - Access AI or points modules

Depends on:
  - repositories.workout_repo.WorkoutRepository
  - mappers.map_workout, utils.safe_int, utils.today_str
  - helpers.default_user_id()
"""


import json
from datetime import datetime

from flask import Blueprint, jsonify, request

from ..middleware import rate_limit
from ..mappers import map_workout, map_workout_template
from ..repositories.workout_template_repo import WorkoutTemplateRepository
from ..utils import safe_int, today_str
from ..repositories.workout_repo import WorkoutRepository
from .helpers import default_user_id

workouts_bp = Blueprint("workouts", __name__)
VALID_WORKOUT_TYPES = frozenset({"cardio", "strength", "flexibility", "sports", "other"})
VALID_INTENSITIES = frozenset({"low", "medium", "high"})


def _normalize_workout_type(value, fallback="other"):
    workout_type = str(value or fallback or "other").strip().lower()
    if workout_type in VALID_WORKOUT_TYPES:
        return workout_type
    fallback_type = str(fallback or "other").strip().lower()
    return fallback_type if fallback_type in VALID_WORKOUT_TYPES else "other"


def _normalize_intensity(value, fallback="medium"):
    intensity = str(value or fallback or "medium").strip().lower()
    return intensity if intensity in VALID_INTENSITIES else fallback


@workouts_bp.route("/api/workouts", methods=["GET"])
def get_workouts():
    date_filter = request.args.get("date")
    rows = WorkoutRepository.get_all(default_user_id(), date_filter=date_filter)
    return jsonify([map_workout(r) for r in rows])


@workouts_bp.route("/api/workouts", methods=["POST"])
@rate_limit(max_requests=20, window_seconds=60)
def create_workout():
    req_data = request.get_json(silent=True) or {}

    name = (req_data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Workout name is required"}), 400

    intensity = _normalize_intensity(req_data.get("intensity", "medium"), "medium")

    exercises = req_data.get("exercises", [])
    if not isinstance(exercises, list):
        exercises = []

    workout_type = _normalize_workout_type(req_data.get("type"), "other")

    row = WorkoutRepository.create(
        default_user_id(),
        name=name,
        workout_type=workout_type,
        duration=req_data.get("duration", 0),
        calories_burned=req_data.get("calories_burned", 0),
        exercises=exercises,
        notes=req_data.get("notes", ""),
        intensity=intensity,
        date=req_data.get("date", today_str()),
        time=req_data.get("time", datetime.now().strftime("%H:%M")),
    )
    return jsonify(map_workout(row)), 201


@workouts_bp.route("/api/workouts/<int:workout_id>", methods=["PUT"])
def update_workout(workout_id):
    uid = default_user_id()
    row = WorkoutRepository.get_by_id(workout_id, uid)
    if not row:
        return jsonify({"error": "Workout not found"}), 404

    req_data = request.get_json(silent=True) or {}

    intensity = _normalize_intensity(req_data.get("intensity", row["intensity"]), row["intensity"])

    exercises = req_data.get("exercises")
    if exercises is None:
        try:
            exercises = json.loads(row["exercises_json"] or "[]")
        except (TypeError, ValueError):
            exercises = []
    if not isinstance(exercises, list):
        exercises = []

    workout_type = _normalize_workout_type(req_data.get("type"), row["type"] or "other")

    updated = WorkoutRepository.update(
        workout_id, uid,
        name=req_data.get("name", row["name"]),
        workout_type=workout_type,
        duration=req_data.get("duration", row["duration"]),
        calories_burned=req_data.get("calories_burned", row["calories_burned"]),
        exercises=exercises,
        notes=req_data.get("notes", row["notes"]),
        intensity=intensity,
        date=req_data.get("date", row["date"]),
        time=req_data.get("time", row["time"]),
    )
    return jsonify(map_workout(updated))


@workouts_bp.route("/api/workouts/<int:workout_id>", methods=["DELETE"])
def delete_workout(workout_id):
    deleted = WorkoutRepository.delete(workout_id, default_user_id())
    if not deleted:
        return jsonify({"error": "Workout not found"}), 404
    return jsonify({"message": "Workout deleted successfully"}), 200


@workouts_bp.route("/api/workouts/<int:workout_id>/toggle", methods=["PATCH"])
def toggle_workout(workout_id):
    updated = WorkoutRepository.toggle_completed(workout_id, default_user_id())
    if not updated:
        return jsonify({"error": "Workout not found"}), 404
    return jsonify(map_workout(updated))


@workouts_bp.route("/api/workout-templates", methods=["GET"])
def get_workout_templates():
    rows = WorkoutTemplateRepository.get_all(default_user_id())
    return jsonify([map_workout_template(r) for r in rows])


@workouts_bp.route("/api/workout-templates", methods=["POST"])
@rate_limit(max_requests=20, window_seconds=60)
def create_workout_template():
    req_data = request.get_json(silent=True) or {}
    uid = default_user_id()

    name = (req_data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Template name is required"}), 400

    exercises = req_data.get("exercises", [])
    if not isinstance(exercises, list):
        exercises = []

    template = WorkoutTemplateRepository.create(
        uid,
        name=name,
        workout_type=_normalize_workout_type(req_data.get("type"), "other"),
        duration=req_data.get("duration", 0),
        calories_burned=req_data.get("calories_burned", 0),
        exercises=exercises,
        notes=req_data.get("notes", ""),
        intensity=_normalize_intensity(req_data.get("intensity", "medium"), "medium"),
    )
    return jsonify(map_workout_template(template)), 201


@workouts_bp.route("/api/workout-templates/<int:template_id>", methods=["PUT"])
def update_workout_template(template_id):
    uid = default_user_id()
    row = WorkoutTemplateRepository.get_by_id(template_id, uid)
    if not row:
        return jsonify({"error": "Workout template not found"}), 404

    req_data = request.get_json(silent=True) or {}
    name = (req_data.get("name", row["name"]) or "").strip()
    if not name:
        return jsonify({"error": "Template name is required"}), 400
    exercises = req_data.get("exercises")
    if exercises is None:
        try:
            exercises = json.loads(row["exercises_json"] or "[]")
        except (TypeError, ValueError):
            exercises = []
    if not isinstance(exercises, list):
        exercises = []

    updated = WorkoutTemplateRepository.update(
        template_id,
        uid,
        name=name,
        workout_type=_normalize_workout_type(req_data.get("type"), row["type"] or "other"),
        duration=req_data.get("duration", row["duration"]),
        calories_burned=req_data.get("calories_burned", row["calories_burned"]),
        exercises=exercises,
        notes=req_data.get("notes", row["notes"]),
        intensity=_normalize_intensity(req_data.get("intensity", row["intensity"]), row["intensity"]),
    )
    return jsonify(map_workout_template(updated))


@workouts_bp.route("/api/workout-templates/<int:template_id>", methods=["DELETE"])
def delete_workout_template(template_id):
    deleted = WorkoutTemplateRepository.delete(template_id, default_user_id())
    if not deleted:
        return jsonify({"error": "Workout template not found"}), 404
    return jsonify({"message": "Workout template deleted successfully"}), 200


@workouts_bp.route("/api/workout-templates/<int:template_id>/use", methods=["POST"])
@rate_limit(max_requests=20, window_seconds=60)
def use_workout_template(template_id):
    uid = default_user_id()
    req_data = request.get_json(silent=True) or {}

    row = WorkoutTemplateRepository.use_template(
        template_id,
        uid,
        date=req_data.get("date", today_str()),
        time=req_data.get("time", datetime.now().strftime("%H:%M")),
    )
    if not row:
        return jsonify({"error": "Workout template not found"}), 404
    return jsonify(map_workout(row)), 201
