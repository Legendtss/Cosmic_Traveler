"""
Goals Repository
Handles all database operations for user goals
"""
from typing import List, Dict, Any, Optional
import secrets
from app.db import get_db
from app.utils import now_iso


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
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
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
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM goals 
            WHERE id = ? AND user_id = ?
        """, (goal_id, user_id))
        
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None
    
    @staticmethod
    def get_all_goals(user_id: int, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all goals for a user, optionally filtered by status"""
        conn = get_db()
        cursor = conn.cursor()
        
        if status:
            cursor.execute("""
                SELECT * FROM goals 
                WHERE user_id = ? AND status = ?
                ORDER BY updated_at DESC
            """, (user_id, status))
        else:
            cursor.execute("""
                SELECT * FROM goals 
                WHERE user_id = ?
                ORDER BY updated_at DESC
            """, (user_id,))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    
    @staticmethod
    def update_progress(goal_id: int, user_id: int, current_progress: float) -> bool:
        """Update goal progress and mark complete if 100%"""
        conn = get_db()
        cursor = conn.cursor()
        
        try:
            # Clamp progress between 0 and 100
            current_progress = max(0, min(100, current_progress))
            
            # If reaching 100%, mark as completed
            if current_progress >= 100:
                cursor.execute("""
                    UPDATE goals 
                    SET current_progress = 100, status = 'completed', 
                        completed_at = ?, updated_at = ?
                    WHERE id = ? AND user_id = ?
                """, (now_iso(), now_iso(), goal_id, user_id))
            else:
                cursor.execute("""
                    UPDATE goals 
                    SET current_progress = ?, updated_at = ?
                    WHERE id = ? AND user_id = ?
                """, (current_progress, now_iso(), goal_id, user_id))
            
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise e
    
    @staticmethod
    def update_goal(goal_id: int, user_id: int, **kwargs) -> bool:
        """Update goal fields"""
        conn = get_db()
        cursor = conn.cursor()
        
        allowed_fields = {'title', 'description', 'category', 'target_progress', 
                         'time_limit', 'card_image_url', 'ai_prompt', 'notes', 'status'}
        update_fields = {k: v for k, v in kwargs.items() if k in allowed_fields}
        
        if not update_fields:
            return False
        
        try:
            update_fields['updated_at'] = now_iso()
            
            set_clause = ', '.join([f"{k} = ?" for k in update_fields.keys()])
            values = list(update_fields.values()) + [goal_id, user_id]
            
            cursor.execute(f"""
                UPDATE goals 
                SET {set_clause}
                WHERE id = ? AND user_id = ?
            """, values)
            
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise e
    
    @staticmethod
    def delete_goal(goal_id: int, user_id: int) -> bool:
        """Delete a goal"""
        conn = get_db()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                DELETE FROM goals 
                WHERE id = ? AND user_id = ?
            """, (goal_id, user_id))
            
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise e
    
    @staticmethod
    def generate_share_token(goal_id: int, user_id: int) -> Optional[str]:
        """Generate and store a share token for a goal"""
        conn = get_db()
        cursor = conn.cursor()
        
        try:
            share_token = secrets.token_urlsafe(16)
            
            cursor.execute("""
                UPDATE goals 
                SET is_shared = 1, share_token = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
            """, (share_token, now_iso(), goal_id, user_id))
            
            conn.commit()
            
            if cursor.rowcount > 0:
                return share_token
            return None
        except Exception as e:
            conn.rollback()
            raise e
    
    @staticmethod
    def get_goal_by_share_token(share_token: str) -> Optional[Dict[str, Any]]:
        """Get goal by share token (public view)"""
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, user_id, title, description, category, 
                   target_progress, current_progress, card_image_url, 
                   status, created_at, updated_at
            FROM goals 
            WHERE share_token = ? AND is_shared = 1
        """, (share_token,))
        
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None
    
    @staticmethod
    def revoke_share(goal_id: int, user_id: int) -> bool:
        """Revoke sharing for a goal"""
        conn = get_db()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                UPDATE goals 
                SET is_shared = 0, share_token = NULL, updated_at = ?
                WHERE id = ? AND user_id = ?
            """, (now_iso(), goal_id, user_id))
            
            conn.commit()
            return cursor.rowcount > 0
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
        return list(range(unlocked_count))
