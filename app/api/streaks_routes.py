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


from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from ..utils import safe_float, today_str
from ..repositories.streaks_repo import AnalyticsRepository, StreaksRepository
from .helpers import default_user_id

streaks_bp = Blueprint("streaks", __name__)
VALID_ANALYTICS_GRANULARITY = frozenset({"daily", "weekly", "monthly"})


def _parse_ymd(value):
  try:
    return datetime.strptime(value, "%Y-%m-%d").date()
  except (TypeError, ValueError):
    return None


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
    user_id = default_user_id()
    start_date = (request.args.get("start_date") or "").strip()
    end_date = (request.args.get("end_date") or "").strip()

    if start_date or end_date:
        if not start_date or not end_date:
            return jsonify({"error": "start_date and end_date are both required"}), 400
        start_obj = _parse_ymd(start_date)
        end_obj = _parse_ymd(end_date)
        if not start_obj or not end_obj:
            return jsonify({"error": "Dates must use YYYY-MM-DD format"}), 400
        if start_obj > end_obj:
            return jsonify({"error": "start_date must be <= end_date"}), 400
        summary = AnalyticsRepository.period_summary(user_id, start_date, end_date)
        return jsonify(summary)

    date_filter = request.args.get("date", today_str())
    summary = AnalyticsRepository.daily_summary(user_id, date_filter)
    return jsonify(summary)


@streaks_bp.route("/api/analytics/weekly", methods=["GET"])
def get_weekly_stats():
    user_id = default_user_id()
    start_date = (request.args.get("start_date") or "").strip()
    end_date = (request.args.get("end_date") or "").strip()
    granularity = (request.args.get("granularity") or "daily").strip().lower()
    if granularity not in VALID_ANALYTICS_GRANULARITY:
        granularity = "daily"

    if (start_date and not end_date) or (end_date and not start_date):
        return jsonify({"error": "start_date and end_date must be provided together"}), 400

    if start_date and end_date:
        start_obj = _parse_ymd(start_date)
        end_obj = _parse_ymd(end_date)
        if not start_obj or not end_obj:
            return jsonify({"error": "Dates must use YYYY-MM-DD format"}), 400
        if start_obj > end_obj:
            return jsonify({"error": "start_date must be <= end_date"}), 400
    else:
        end_obj = datetime.now().date()
        start_obj = end_obj - timedelta(days=6)
        start_date = start_obj.strftime("%Y-%m-%d")
        end_date = end_obj.strftime("%Y-%m-%d")

    trend_data = AnalyticsRepository.weekly_stats(
        user_id,
        start_date=start_date,
        end_date=end_date,
        granularity=granularity,
    )
    return jsonify(trend_data)
