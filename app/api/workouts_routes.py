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

from ..mappers import map_workout
from ..utils import safe_int, today_str
from ..repositories.workout_repo import WorkoutRepository
from .helpers import default_user_id

workouts_bp = Blueprint("workouts", __name__)


@workouts_bp.route("/api/workouts", methods=["GET"])
def get_workouts():
    date_filter = request.args.get("date")
    rows = WorkoutRepository.get_all(default_user_id(), date_filter=date_filter)
    return jsonify([map_workout(r) for r in rows])


@workouts_bp.route("/api/workouts", methods=["POST"])
def create_workout():
    req_data = request.get_json(silent=True) or {}

    name = (req_data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Workout name is required"}), 400

    intensity = req_data.get("intensity", "medium")
    if intensity not in ("low", "medium", "high"):
        intensity = "medium"

    exercises = req_data.get("exercises", [])
    if not isinstance(exercises, list):
        exercises = []

    workout_type = (req_data.get("type") or "other").strip().lower()
    if workout_type not in ("cardio", "strength", "flexibility", "sports", "other"):
        workout_type = "other"

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

    intensity = req_data.get("intensity", row["intensity"])
    if intensity not in ("low", "medium", "high"):
        intensity = row["intensity"]

    exercises = req_data.get("exercises")
    if exercises is None:
        try:
            exercises = json.loads(row["exercises_json"] or "[]")
        except (TypeError, ValueError):
            exercises = []
    if not isinstance(exercises, list):
        exercises = []

    workout_type = (req_data.get("type") or row["type"] or "other").strip().lower()
    if workout_type not in ("cardio", "strength", "flexibility", "sports", "other"):
        workout_type = row["type"] or "other"

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
