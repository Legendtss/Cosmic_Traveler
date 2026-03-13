"""
FILE: app/api/projects_routes.py

Responsibility:
  Projects and subtasks CRUD: GET/POST /api/projects,
  GET/PUT/DELETE /api/projects/<id>, GET/POST /api/projects/<id>/subtasks,
  toggle completed status, archive/restore.

MUST NOT:
  - Handle task, nutrition, or workout logic
  - Access AI or points modules
  - Contain raw SQL (use ProjectRepository)

Depends on:
  - ProjectRepository (data access layer)
  - helpers.default_user_id()
"""

from flask import Blueprint, jsonify, request

from ..repositories.project_repo import ProjectRepository
from ..middleware import rate_limit, validate_json
from .helpers import default_user_id

projects_bp = Blueprint("projects", __name__)


@projects_bp.route("/api/projects", methods=["GET"])
@rate_limit(max_requests=50, window_seconds=60)
def get_projects():
    """Get all projects for the user."""
    user_id = default_user_id()
    rows = ProjectRepository.get_all(user_id)
    projects = []
    for r in rows:
        # Get subtasks for each project
        subtasks = ProjectRepository.get_subtasks(r["id"], user_id)
        projects.append({
            "id": r["id"],
            "name": r["name"],
            "description": r["description"],
            "status": r["status"],
            "dueDate": r["due_date"],
            "createdAt": r["created_at"],
            "updatedAt": r["updated_at"],
            "subtasks": [
                {
                    "id": s["id"],
                    "title": s["title"],
                    "completed": bool(s["completed"]),
                    "sortOrder": s["sort_order"],
                }
                for s in subtasks
            ],
        })
    return jsonify(projects)


@projects_bp.route("/api/projects", methods=["POST"])
@rate_limit(max_requests=20, window_seconds=60)
@validate_json("name")
def create_project():
    """Create a new project."""
    user_id = default_user_id()
    data = request.get_json()
    
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Project name is required"}), 400
    
    project_row, subtask_rows = ProjectRepository.create(
        user_id,
        name=name,
        description=data.get("description", ""),
        due_date=data.get("dueDate"),
        subtasks=data.get("subtasks", []),
    )
    
    return jsonify({
        "id": project_row["id"],
        "name": project_row["name"],
        "description": project_row["description"],
        "status": project_row["status"],
        "dueDate": project_row["due_date"],
        "createdAt": project_row["created_at"],
        "updatedAt": project_row["updated_at"],
        "subtasks": [
            {
                "id": s["id"],
                "title": s["title"],
                "completed": bool(s["completed"]),
                "sortOrder": s["sort_order"],
            }
            for s in subtask_rows
        ],
    }), 201


@projects_bp.route("/api/projects/<int:project_id>", methods=["GET"])
@rate_limit(max_requests=50, window_seconds=60)
def get_project(project_id):
    """Get a specific project."""
    user_id = default_user_id()
    project_row = ProjectRepository.get_by_id(project_id, user_id)
    
    if not project_row:
        return jsonify({"error": "Project not found"}), 404
    
    subtasks = ProjectRepository.get_subtasks(project_id, user_id)
    return jsonify({
        "id": project_row["id"],
        "name": project_row["name"],
        "description": project_row["description"],
        "status": project_row["status"],
        "dueDate": project_row["due_date"],
        "createdAt": project_row["created_at"],
        "updatedAt": project_row["updated_at"],
        "subtasks": [
            {
                "id": s["id"],
                "title": s["title"],
                "completed": bool(s["completed"]),
                "sortOrder": s["sort_order"],
            }
            for s in subtasks
        ],
    })


@projects_bp.route("/api/projects/<int:project_id>", methods=["DELETE"])
@rate_limit(max_requests=20, window_seconds=60)
def delete_project(project_id):
    """Delete a project and all its subtasks."""
    user_id = default_user_id()
    success = ProjectRepository.delete(project_id, user_id)
    
    if not success:
        return jsonify({"error": "Project not found"}), 404
    
    return jsonify({"status": "deleted"})


@projects_bp.route("/api/projects/<int:project_id>/subtasks", methods=["GET"])
@rate_limit(max_requests=50, window_seconds=60)
def get_project_subtasks(project_id):
    """Get all subtasks for a project."""
    user_id = default_user_id()
    project_row = ProjectRepository.get_by_id(project_id, user_id)
    
    if not project_row:
        return jsonify({"error": "Project not found"}), 404
    
    subtasks = ProjectRepository.get_subtasks(project_id, user_id)
    return jsonify([
        {
            "id": s["id"],
            "title": s["title"],
            "completed": bool(s["completed"]),
            "sortOrder": s["sort_order"],
        }
        for s in subtasks
    ])
