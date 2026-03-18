"""
Goals Repository
Handles all database operations for user goals
"""
from typing import List, Dict, Any, Optional
import secrets
from app.db import get_db
from app.utils import now_iso


def _row_dict(row):
    if row is None:
        return None
    return row if isinstance(row, dict) else dict(row)


class GoalsRepository:
    """Repository for goal data access"""
    
    @staticmethod
    def create_goal(user_id: int, title: str, description: str, 
                   category: str, target_progress: float = 100,
                   time_limit: Optional[str] = None, 
                   card_image_url: Optional[str] = None,
                   ai_prompt: Optional[str] = None) -> int:
        """Create a new goal for user"""
        conn = get_db()
        
        try:
            cursor = conn.execute("""
                INSERT INTO goals (
                    user_id, title, description, category, 
                    target_progress, time_limit, card_image_url, ai_prompt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, title, description, category, 
                  target_progress, time_limit, card_image_url, ai_prompt))
            
            conn.commit()
            return int(cursor.lastrowid) if cursor.lastrowid else 0
        except Exception as e:
            conn.rollback()
            raise e
    
    @staticmethod
    def get_goal_by_id(goal_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific goal by ID (verify ownership)"""
        conn = get_db()
        row = conn.execute("""
            SELECT * FROM goals 
            WHERE id = ? AND user_id = ?
        """, (goal_id, user_id)).fetchone()

        return _row_dict(row)
    
    @staticmethod
    def get_all_goals(user_id: int, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all goals for a user, optionally filtered by status"""
        conn = get_db()
        if status:
            rows = conn.execute("""
                SELECT * FROM goals 
                WHERE user_id = ? AND status = ?
                ORDER BY updated_at DESC
            """, (user_id, status)).fetchall()
        else:
            rows = conn.execute("""
                SELECT * FROM goals 
                WHERE user_id = ?
                ORDER BY updated_at DESC
            """, (user_id,)).fetchall()

        return [_row_dict(row) for row in rows]
    
    @staticmethod
    def update_progress(goal_id: int, user_id: int, current_progress: float) -> Dict[str, Any]:
        """Update goal progress and mark complete if 100%."""
        conn = get_db()
        
        try:
            goal_row = conn.execute("""
                SELECT snippets_collected
                FROM goals
                WHERE id = ? AND user_id = ?
            """, (goal_id, user_id)).fetchone()
            if not goal_row:
                return {"updated": False, "snippets_collected": 0}

            goal_data = _row_dict(goal_row) or {}
            existing_snippets = max(0, min(4, int(goal_data.get('snippets_collected') or 0)))

            # Clamp progress between 0 and 100
            current_progress = max(0, min(100, current_progress))
            progress_based_snippets = int((current_progress / 100) * 4)
            snippets_collected = max(existing_snippets, progress_based_snippets)
            
            # If reaching 100%, mark as completed
            if current_progress >= 100:
                result = conn.execute("""
                    UPDATE goals 
                    SET current_progress = 100, status = 'completed', 
                        snippets_collected = ?, completed_at = ?, updated_at = ?
                    WHERE id = ? AND user_id = ?
                """, (4, now_iso(), now_iso(), goal_id, user_id))
            else:
                result = conn.execute("""
                    UPDATE goals 
                    SET current_progress = ?, snippets_collected = ?, updated_at = ?
                    WHERE id = ? AND user_id = ?
                """, (current_progress, snippets_collected, now_iso(), goal_id, user_id))
            
            conn.commit()
            return {
                "updated": result.rowcount > 0,
                "snippets_collected": 4 if current_progress >= 100 else snippets_collected,
            }
        except Exception as e:
            conn.rollback()
            raise e
    
    @staticmethod
    def update_goal(goal_id: int, user_id: int, **kwargs) -> bool:
        """Update goal fields"""
        conn = get_db()

        allowed_fields = {
            "title",
            "description",
            "category",
            "target_progress",
            "time_limit",
            "card_image_url",
            "ai_prompt",
            "notes",
            "status",
        }
        update_fields = {k: kwargs[k] for k in kwargs if k in allowed_fields}
        if not update_fields:
            return False

        try:
            existing_row = conn.execute(
                """
                SELECT title, description, category, target_progress, time_limit,
                       card_image_url, ai_prompt, notes, status
                FROM goals
                WHERE id = ? AND user_id = ?
                """,
                (goal_id, user_id),
            ).fetchone()
            if not existing_row:
                return False

            existing = _row_dict(existing_row) or {}
            status_val = update_fields.get("status", existing.get("status"))
            if status_val not in ("active", "completed", "archived"):
                status_val = existing.get("status", "active")

            target_progress = update_fields.get("target_progress", existing.get("target_progress"))
            try:
                target_progress = float(target_progress)
            except (TypeError, ValueError):
                target_progress = existing.get("target_progress", 100)
            target_progress = max(0.1, min(100.0, target_progress))

            result = conn.execute(
                """
                UPDATE goals
                SET title = ?,
                    description = ?,
                    category = ?,
                    target_progress = ?,
                    time_limit = ?,
                    card_image_url = ?,
                    ai_prompt = ?,
                    notes = ?,
                    status = ?,
                    updated_at = ?
                WHERE id = ? AND user_id = ?
                """,
                (
                    update_fields.get("title", existing.get("title")),
                    update_fields.get("description", existing.get("description")),
                    update_fields.get("category", existing.get("category")),
                    target_progress,
                    update_fields.get("time_limit", existing.get("time_limit")),
                    update_fields.get("card_image_url", existing.get("card_image_url")),
                    update_fields.get("ai_prompt", existing.get("ai_prompt")),
                    update_fields.get("notes", existing.get("notes")),
                    status_val,
                    now_iso(),
                    goal_id,
                    user_id,
                ),
            )

            conn.commit()
            return result.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise e
    
    @staticmethod
    def delete_goal(goal_id: int, user_id: int) -> bool:
        """Delete a goal"""
        conn = get_db()
        
        try:
            result = conn.execute("""
                DELETE FROM goals 
                WHERE id = ? AND user_id = ?
            """, (goal_id, user_id))
            
            conn.commit()
            return result.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise e
    
    @staticmethod
    def generate_share_token(goal_id: int, user_id: int) -> Optional[str]:
        """Generate and store a share token for a goal"""
        conn = get_db()
        
        try:
            share_token = secrets.token_urlsafe(16)
            
            result = conn.execute("""
                UPDATE goals 
                SET is_shared = 1, share_token = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
            """, (share_token, now_iso(), goal_id, user_id))
            
            conn.commit()
            
            if result.rowcount > 0:
                return share_token
            return None
        except Exception as e:
            conn.rollback()
            raise e
    
    @staticmethod
    def get_goal_by_share_token(share_token: str) -> Optional[Dict[str, Any]]:
        """Get goal by share token (public view)"""
        conn = get_db()
        row = conn.execute("""
            SELECT id, user_id, title, description, category, 
                   target_progress, current_progress, snippets_collected, card_image_url, 
                   status, created_at, updated_at
            FROM goals 
            WHERE share_token = ? AND is_shared = 1
        """, (share_token,)).fetchone()

        return _row_dict(row)
    
    @staticmethod
    def revoke_share(goal_id: int, user_id: int) -> bool:
        """Revoke sharing for a goal"""
        conn = get_db()
        
        try:
            result = conn.execute("""
                UPDATE goals 
                SET is_shared = 0, share_token = NULL, updated_at = ?
                WHERE id = ? AND user_id = ?
            """, (now_iso(), goal_id, user_id))
            
            conn.commit()
            return result.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise e
    
    @staticmethod
    def archive_goal(goal_id: int, user_id: int) -> bool:
        """Archive a goal"""
        return GoalsRepository.update_goal(goal_id, user_id, status='archived')
    
    @staticmethod
    def get_unlock_segments(current_progress: float, num_segments: int = 4) -> List[int]:
        """Calculate which segments should be unlocked based on progress
        Returns list of segment indices that are unlocked (0-indexed)
        
        Milestone-based: 4 segments at 25%, 50%, 75%, 100%
        Example: 50% progress with 4 segments = [0, 1] (first 2 unlocked)
        Example: 75% progress with 4 segments = [0, 1, 2] (first 3 unlocked)
        """
        unlocked_count = int((current_progress / 100) * num_segments)
        unlocked_count = max(0, min(num_segments, unlocked_count))
        return list(range(unlocked_count))
