"""
FILE: app/api/streaks_routes.py

Responsibility:
  Streak evaluation, progress reporting, achievement checking,
  analytics summary, and weekly analytics endpoints.

MUST NOT:
  - Handle CRUD for tasks/meals/workouts
  - Access AI modules

Depends on:
  - repositories.streaks_repo.StreaksRepository, AnalyticsRepository
  - utils.safe_float, utils.today_str
  - helpers.default_user_id()

⚠️ Points constants are duplicated in script.js §9.
"""


from flask import Blueprint, jsonify, request

from ..utils import safe_float, today_str
from ..repositories.streaks_repo import AnalyticsRepository, StreaksRepository
from .helpers import default_user_id

streaks_bp = Blueprint("streaks", __name__)


@streaks_bp.route("/api/streaks/evaluate", methods=["POST"])
def streaks_evaluate():
    user_id = default_user_id()
    req_data = request.get_json(silent=True) or {}
    date = req_data.get("date", today_str())
    protein_goal = safe_float(req_data.get("protein_goal"), 140)

    result = StreaksRepository.evaluate(user_id, date, protein_goal)
    return jsonify(result), 200


@streaks_bp.route("/api/streaks/progress", methods=["GET"])
def streaks_progress():
    user_id = default_user_id()
    date = request.args.get("date", today_str())
    protein_goal = safe_float(request.args.get("protein_goal"), 140)

    result = StreaksRepository.full_progress(user_id, date, protein_goal)
    return jsonify(result), 200


@streaks_bp.route("/api/user/stats", methods=["POST"])
def user_stats_update():
    user_id = default_user_id()
    result = StreaksRepository.evaluate(user_id, today_str(), 140)
    return jsonify(result), 200


@streaks_bp.route("/api/analytics/summary", methods=["GET"])
def get_summary():
    date_filter = request.args.get("date", today_str())
    summary = AnalyticsRepository.daily_summary(default_user_id(), date_filter)
    return jsonify(summary)


@streaks_bp.route("/api/analytics/weekly", methods=["GET"])
def get_weekly_stats():
    weekly_data = AnalyticsRepository.weekly_stats(default_user_id())
    return jsonify(weekly_data)
