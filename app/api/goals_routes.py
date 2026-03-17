"""
Goals API Routes
Handles all goal-related endpoints
"""
from flask import Blueprint, request, jsonify, send_file
from app.repositories.goals_repo import GoalsRepository
from app.auth import get_current_user_id
from app.db import get_db
import os
import io
import base64
from datetime import datetime

# Try to import image processing library
try:
    from PIL import Image, ImageDraw, ImageFilter
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# Try to import Gemini API (might not be installed or available)
try:
    import google.generativeai as genai
    HAS_GENAI = True
except (ImportError, AttributeError):
    HAS_GENAI = False


goals_bp = Blueprint('goals', __name__, url_prefix='/api/goals')

# Configure Gemini API if available
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY and HAS_GENAI:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception:
        GEMINI_API_KEY = None


def get_user_id():
    """Get user ID from session cookie - will abort with 401 if not authenticated"""
    return get_current_user_id()


@goals_bp.route('', methods=['GET'])
def get_goals():
    """Get all goals for current user"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    status = request.args.get('status')  # Filter by status if provided
    goals = GoalsRepository.get_all_goals(user_id, status)
    
    return jsonify({
        'success': True,
        'goals': goals,
        'count': len(goals)
    }), 200


@goals_bp.route('/<int:goal_id>', methods=['GET'])
def get_goal(goal_id):
    """Get specific goal by ID"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    goal = GoalsRepository.get_goal_by_id(goal_id, user_id)
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404
    
    return jsonify({
        'success': True,
        'goal': goal
    }), 200


@goals_bp.route('', methods=['POST'])
def create_goal():
    """Create a new goal"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    
    required_fields = ['title', 'category']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        goal_id = GoalsRepository.create_goal(
            user_id=user_id,
            title=data['title'],
            description=data.get('description', ''),
            category=data['category'],
            target_progress=float(data.get('target_progress', 100)),
            time_limit=data.get('time_limit'),
            card_image_url=data.get('card_image_url'),
            ai_prompt=data.get('ai_prompt')
        )
        
        goal = GoalsRepository.get_goal_by_id(goal_id, user_id)
        
        return jsonify({
            'success': True,
            'goal': goal,
            'message': 'Goal created successfully'
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@goals_bp.route('/<int:goal_id>', methods=['PUT'])
def update_goal(goal_id):
    """Update a goal"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    goal = GoalsRepository.get_goal_by_id(goal_id, user_id)
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404
    
    data = request.get_json()
    
    # Handle progress update specially
    if 'current_progress' in data:
        try:
            GoalsRepository.update_progress(goal_id, user_id, float(data['current_progress']))
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # Update other fields
    update_fields = {k: v for k, v in data.items() 
                    if k != 'current_progress' and k not in ['id', 'user_id', 'created_at', 'updated_at', 'completed_at']}
    
    if update_fields:
        try:
            GoalsRepository.update_goal(goal_id, user_id, **update_fields)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    goal = GoalsRepository.get_goal_by_id(goal_id, user_id)
    
    return jsonify({
        'success': True,
        'goal': goal,
        'message': 'Goal updated successfully'
    }), 200


@goals_bp.route('/<int:goal_id>', methods=['DELETE'])
def delete_goal(goal_id):
    """Delete a goal"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    goal = GoalsRepository.get_goal_by_id(goal_id, user_id)
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404
    
    try:
        GoalsRepository.delete_goal(goal_id, user_id)
        return jsonify({
            'success': True,
            'message': 'Goal deleted successfully'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@goals_bp.route('/<int:goal_id>/share', methods=['POST'])
def share_goal(goal_id):
    """Generate share link for a goal"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    goal = GoalsRepository.get_goal_by_id(goal_id, user_id)
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404
    
    try:
        share_token = GoalsRepository.generate_share_token(goal_id, user_id)
        
        if share_token:
            share_url = f"/shared/goal/{share_token}"
            goal = GoalsRepository.get_goal_by_id(goal_id, user_id)
            
            return jsonify({
                'success': True,
                'share_token': share_token,
                'share_url': share_url,
                'goal': goal
            }), 200
        else:
            return jsonify({'error': 'Failed to generate share token'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@goals_bp.route('/<int:goal_id>/share', methods=['DELETE'])
def revoke_share(goal_id):
    """Revoke share link for a goal"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    goal = GoalsRepository.get_goal_by_id(goal_id, user_id)
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404
    
    try:
        GoalsRepository.revoke_share(goal_id, user_id)
        
        return jsonify({
            'success': True,
            'message': 'Share link revoked'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@goals_bp.route('/shared/<share_token>', methods=['GET'])
def get_shared_goal(share_token):
    """Get a public shared goal"""
    goal = GoalsRepository.get_goal_by_share_token(share_token)
    
    if not goal:
        return jsonify({'error': 'Goal not found or not shared'}), 404
    
    # Calculate unlock segments (4 milestones: 25%, 50%, 75%, 100%)
    unlocked = GoalsRepository.get_unlock_segments(goal['current_progress'], num_segments=4)
    
    return jsonify({
        'success': True,
        'goal': goal,
        'unlocked_segments': unlocked,
        'total_segments': 4
    }), 200


@goals_bp.route('/<int:goal_id>/image', methods=['POST'])
def upload_or_generate_image(goal_id):
    """Upload custom image or generate with Gemini AI"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    goal = GoalsRepository.get_goal_by_id(goal_id, user_id)
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404
    
    data = request.get_json()
    
    try:
        if 'image_file' in request.files:
            # Handle file upload
            file = request.files['image_file']
            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            
            # Read and encode image
            image_data = file.read()
            encoded_image = base64.b64encode(image_data).decode('utf-8')
            image_url = f"data:image/png;base64,{encoded_image}"
            
            GoalsRepository.update_goal(goal_id, user_id, card_image_url=image_url)
            
            return jsonify({
                'success': True,
                'message': 'Image uploaded successfully',
                'card_image_url': image_url
            }), 200
        
        elif 'ai_prompt' in data and GEMINI_API_KEY and HAS_GENAI:
            # Generate image with Gemini
            prompt = data['ai_prompt']
            
            try:
                model = genai.GenerativeModel('gemini-pro-vision')
                response = model.generate_content([
                    f"Create a professional achievement card design for a goal: {goal['title']}. {prompt}"
                ])
                
                # For now, store the prompt and we'll generate the image client-side
                # In production, you'd use DALL-E or Stable Diffusion
                GoalsRepository.update_goal(
                    goal_id, user_id, 
                    ai_prompt=prompt,
                    card_image_url=None  # Will be generated on frontend
                )
                
                return jsonify({
                    'success': True,
                    'message': 'Image generation initiated',
                    'ai_prompt': prompt
                }), 200
            except Exception as e:
                return jsonify({'error': f'Image generation failed: {str(e)}'}), 500
        
        elif 'ai_prompt' in data and not HAS_GENAI:
            # Genai not available but try to store the prompt anyway
            prompt = data['ai_prompt']
            GoalsRepository.update_goal(
                goal_id, user_id, 
                ai_prompt=prompt,
                card_image_url=None
            )
            return jsonify({
                'success': True,
                'message': 'AI prompt stored (Gemini not available)',
                'ai_prompt': prompt,
                'warning': 'AI image generation service not configured'
            }), 200
        
        else:
            return jsonify({'error': 'No image data provided'}), 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@goals_bp.route('/<int:goal_id>/download', methods=['GET'])
def download_card(goal_id):
    """Download goal card as image"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if not HAS_PIL:
        return jsonify({'error': 'Image generation not available. Pillow library not installed.'}), 503
    
    goal = GoalsRepository.get_goal_by_id(goal_id, user_id)
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404
    
    try:
        # Generate card image
        card_image = generate_card_image(goal)
        
        # Convert to bytes and send
        img_bytes = io.BytesIO()
        card_image.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        filename = f"goal_{goal_id}_{datetime.now().strftime('%Y%m%d')}.png"
        
        return send_file(
            img_bytes,
            mimetype='image/png',
            as_attachment=True,
            download_name=filename
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def generate_card_image(goal: dict):
    """Generate a card image from goal data"""
    if not HAS_PIL:
        raise RuntimeError("PIL/Pillow not available for image generation")
    
    # Card dimensions
    width, height = 800, 600
    
    # Create image with gradient
    img = Image.new('RGB', (width, height), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    
    # Background with completion color
    progress_percent = goal['current_progress']
    if progress_percent >= 100:
        # Gold for completed
        bg_color = (255, 215, 0)
    elif progress_percent >= 75:
        # Orange-gold
        bg_color = (255, 180, 0)
    elif progress_percent >= 50:
        # Orange
        bg_color = (255, 140, 0)
    elif progress_percent >= 25:
        # Yellow
        bg_color = (255, 200, 0)
    else:
        # Gray for started
        bg_color = (200, 200, 200)
    
    # Draw background
    draw.rectangle([(0, 0), (width, height)], fill=bg_color)
    
    # Add title
    title_y = 50
    draw.text((40, title_y), goal['title'], fill=(255, 255, 255))
    
    # Add progress bar
    bar_width = width - 80
    bar_height = 40
    bar_x = 40
    bar_y = height - 150
    
    # Background bar
    draw.rectangle([(bar_x, bar_y), (bar_x + bar_width, bar_y + bar_height)], 
                  fill=(200, 200, 200), outline=(0, 0, 0), width=2)
    
    # Progress fill
    progress_fill = (bar_x + (bar_width * progress_percent / 100))
    draw.rectangle([(bar_x, bar_y), (progress_fill, bar_y + bar_height)], 
                  fill=(0, 200, 0))
    
    # Progress text
    progress_text = f"{progress_percent:.0f}%"
    draw.text((width // 2 - 20, bar_y + 10), progress_text, fill=(0, 0, 0))
    
    # Add completion date if completed
    if goal['status'] == 'completed' and goal['completed_at']:
        completion_date = goal['completed_at'][:10]
        draw.text((40, height - 80), f"Completed on {completion_date}", fill=(255, 255, 255))
    
    return img
