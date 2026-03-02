"""
Agentic Conversational AI Avatar — FitTrack Pro
=================================================
Stateful, multi-turn conversational assistant.
Supports nutrition logging, task/project creation, workout logging,
and general-purpose Q&A.

Flow: detect → clarify (if needed) → preview → edit → confirm → save → loop
NEVER auto-saves. ALWAYS confirms with user first.

Uses Google Gemini API with conversation history.
Falls back to a rule-based local engine when no API key is configured.
"""

import json
import os
import re
import time

import google.generativeai as genai

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
from .config import Config

GEMINI_API_KEY = Config.GEMINI_API_KEY
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

# Initialize the SDK client
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    _genai_client = genai
else:
    _genai_client = None

# ---------------------------------------------------------------------------
# Rate-limit state  (module-level singleton — safe for single-process Flask)
# ---------------------------------------------------------------------------
_GEMINI_COOLDOWN_SEC = 3        # minimum seconds between Gemini calls
_gemini_last_call_ts = 0.0      # epoch of last successful or attempted call
_gemini_lock = False             # True while a request is in-flight
_AI_CACHE_TTL_SEC = 600
_AI_CACHE_MAX = 200
_ai_response_cache = {}
_gemini_stats = {
    "requests": 0,
    "success": 0,
    "failed": 0,
    "rate_limited": 0,
}


def _log_safe(msg):
    """Print without crashing on non-ASCII characters (Windows console safe)."""
    try:
        print(msg)
    except Exception:
        try:
            ascii_msg = str(msg).encode("ascii", "ignore").decode("ascii")
            print(ascii_msg)
        except Exception:
            pass

# ---------------------------------------------------------------------------
# Indian food estimation database (common dishes, per-serving)
# ---------------------------------------------------------------------------
INDIAN_FOOD_ESTIMATES = {
    "roti": {"calories": 120, "protein": 3, "carbs": 20, "fats": 3.5, "serving": "1 medium", "grams": 40},
    "chapati": {"calories": 120, "protein": 3, "carbs": 20, "fats": 3.5, "serving": "1 medium", "grams": 40},
    "naan": {"calories": 260, "protein": 9, "carbs": 45, "fats": 5, "serving": "1 piece", "grams": 90},
    "paratha": {"calories": 230, "protein": 5, "carbs": 30, "fats": 10, "serving": "1 medium", "grams": 80},
    "dal": {"calories": 180, "protein": 12, "carbs": 24, "fats": 4, "serving": "1 bowl (200ml)", "grams": 200},
    "dal chawal": {"calories": 350, "protein": 14, "carbs": 58, "fats": 6, "serving": "1 plate", "grams": 350},
    "rice": {"calories": 200, "protein": 4, "carbs": 45, "fats": 0.5, "serving": "1 cup cooked", "grams": 200},
    "biryani": {"calories": 450, "protein": 18, "carbs": 52, "fats": 18, "serving": "1 plate", "grams": 300},
    "chicken biryani": {"calories": 500, "protein": 25, "carbs": 52, "fats": 20, "serving": "1 plate", "grams": 300},
    "paneer butter masala": {"calories": 400, "protein": 18, "carbs": 15, "fats": 30, "serving": "1 bowl", "grams": 200},
    "butter chicken": {"calories": 440, "protein": 28, "carbs": 12, "fats": 32, "serving": "1 bowl", "grams": 200},
    "chole": {"calories": 240, "protein": 12, "carbs": 36, "fats": 6, "serving": "1 bowl", "grams": 200},
    "chana masala": {"calories": 240, "protein": 12, "carbs": 36, "fats": 6, "serving": "1 bowl", "grams": 200},
    "rajma": {"calories": 220, "protein": 14, "carbs": 35, "fats": 3, "serving": "1 bowl", "grams": 200},
    "palak paneer": {"calories": 300, "protein": 16, "carbs": 10, "fats": 22, "serving": "1 bowl", "grams": 200},
    "aloo gobi": {"calories": 180, "protein": 5, "carbs": 25, "fats": 7, "serving": "1 bowl", "grams": 200},
    "samosa": {"calories": 260, "protein": 5, "carbs": 30, "fats": 14, "serving": "1 piece", "grams": 80},
    "dosa": {"calories": 170, "protein": 4, "carbs": 28, "fats": 5, "serving": "1 medium", "grams": 100},
    "masala dosa": {"calories": 280, "protein": 6, "carbs": 38, "fats": 12, "serving": "1 medium", "grams": 150},
    "idli": {"calories": 60, "protein": 2, "carbs": 12, "fats": 0.5, "serving": "1 piece", "grams": 40},
    "upma": {"calories": 200, "protein": 5, "carbs": 30, "fats": 7, "serving": "1 bowl", "grams": 200},
    "poha": {"calories": 180, "protein": 4, "carbs": 32, "fats": 5, "serving": "1 bowl", "grams": 200},
    "khichdi": {"calories": 220, "protein": 8, "carbs": 35, "fats": 5, "serving": "1 bowl", "grams": 250},
    "pav bhaji": {"calories": 400, "protein": 10, "carbs": 50, "fats": 18, "serving": "1 plate", "grams": 300},
    "vada pav": {"calories": 300, "protein": 6, "carbs": 40, "fats": 13, "serving": "1 piece", "grams": 120},
    "puri": {"calories": 100, "protein": 2, "carbs": 12, "fats": 5, "serving": "1 piece", "grams": 25},
    "bhatura": {"calories": 300, "protein": 6, "carbs": 40, "fats": 13, "serving": "1 piece", "grams": 70},
    "raita": {"calories": 60, "protein": 3, "carbs": 5, "fats": 3, "serving": "1 small bowl", "grams": 100},
    "lassi": {"calories": 180, "protein": 5, "carbs": 28, "fats": 5, "serving": "1 glass", "grams": 250},
    "chai": {"calories": 80, "protein": 2, "carbs": 12, "fats": 2.5, "serving": "1 cup", "grams": 150},
    "gulab jamun": {"calories": 150, "protein": 2, "carbs": 22, "fats": 6, "serving": "1 piece", "grams": 40},
    "jalebi": {"calories": 150, "protein": 1, "carbs": 30, "fats": 4, "serving": "1 piece", "grams": 30},
    "halwa": {"calories": 250, "protein": 4, "carbs": 35, "fats": 12, "serving": "1 small bowl", "grams": 100},
    "egg": {"calories": 78, "protein": 6, "carbs": 0.6, "fats": 5, "serving": "1 whole", "grams": 50},
    "boiled egg": {"calories": 78, "protein": 6, "carbs": 0.6, "fats": 5, "serving": "1 whole", "grams": 50},
    "omelette": {"calories": 154, "protein": 11, "carbs": 1, "fats": 12, "serving": "2-egg", "grams": 120},
    "paneer": {"calories": 260, "protein": 18, "carbs": 4, "fats": 20, "serving": "100g", "grams": 100},
    "curd": {"calories": 60, "protein": 3, "carbs": 5, "fats": 3, "serving": "1 cup", "grams": 200},
    "yogurt": {"calories": 60, "protein": 3, "carbs": 5, "fats": 3, "serving": "1 cup", "grams": 200},
    "milk": {"calories": 120, "protein": 6, "carbs": 10, "fats": 6, "serving": "1 glass", "grams": 250},
    "banana": {"calories": 105, "protein": 1.3, "carbs": 27, "fats": 0.4, "serving": "1 medium", "grams": 118},
    "apple": {"calories": 95, "protein": 0.5, "carbs": 25, "fats": 0.3, "serving": "1 medium", "grams": 182},
    "chicken breast": {"calories": 165, "protein": 31, "carbs": 0, "fats": 3.6, "serving": "100g", "grams": 100},
    "fish curry": {"calories": 250, "protein": 20, "carbs": 8, "fats": 15, "serving": "1 bowl", "grams": 200},
    "egg curry": {"calories": 220, "protein": 14, "carbs": 10, "fats": 14, "serving": "1 bowl", "grams": 200},
    "aloo paratha": {"calories": 280, "protein": 6, "carbs": 38, "fats": 12, "serving": "1 piece", "grams": 100},
    "gobi paratha": {"calories": 260, "protein": 6, "carbs": 35, "fats": 11, "serving": "1 piece", "grams": 100},
    "paneer paratha": {"calories": 300, "protein": 10, "carbs": 32, "fats": 15, "serving": "1 piece", "grams": 100},
    "maggi": {"calories": 310, "protein": 7, "carbs": 44, "fats": 12, "serving": "1 pack", "grams": 70},
    "bread": {"calories": 80, "protein": 3, "carbs": 14, "fats": 1, "serving": "1 slice", "grams": 30},
    "toast": {"calories": 80, "protein": 3, "carbs": 14, "fats": 1, "serving": "1 slice", "grams": 30},
    "butter": {"calories": 36, "protein": 0, "carbs": 0, "fats": 4, "serving": "1 tsp", "grams": 5},
    "ghee": {"calories": 45, "protein": 0, "carbs": 0, "fats": 5, "serving": "1 tsp", "grams": 5},
    # --- Global / compound foods ---
    "peanut butter sandwich": {"calories": 350, "protein": 14, "carbs": 31, "fats": 18, "serving": "1 sandwich", "grams": 120},
    "peanut butter": {"calories": 190, "protein": 8, "carbs": 6, "fats": 16, "serving": "2 tbsp", "grams": 32},
    "peanut butter toast": {"calories": 270, "protein": 11, "carbs": 20, "fats": 17, "serving": "1 slice", "grams": 60},
    "peanut butter and jelly": {"calories": 380, "protein": 12, "carbs": 45, "fats": 18, "serving": "1 sandwich", "grams": 130},
    "sandwich": {"calories": 250, "protein": 12, "carbs": 30, "fats": 10, "serving": "1 sandwich", "grams": 150},
    "chicken sandwich": {"calories": 350, "protein": 25, "carbs": 30, "fats": 14, "serving": "1 sandwich", "grams": 180},
    "egg sandwich": {"calories": 300, "protein": 16, "carbs": 28, "fats": 14, "serving": "1 sandwich", "grams": 160},
    "protein shake": {"calories": 250, "protein": 30, "carbs": 12, "fats": 5, "serving": "1 shake", "grams": 350},
    "whey protein": {"calories": 120, "protein": 24, "carbs": 3, "fats": 1.5, "serving": "1 scoop", "grams": 30},
    "protein smoothie": {"calories": 280, "protein": 25, "carbs": 28, "fats": 8, "serving": "1 glass", "grams": 350},
    "smoothie": {"calories": 200, "protein": 8, "carbs": 35, "fats": 4, "serving": "1 glass", "grams": 300},
    "pasta": {"calories": 350, "protein": 12, "carbs": 60, "fats": 5, "serving": "1 plate", "grams": 200},
    "pizza": {"calories": 270, "protein": 12, "carbs": 33, "fats": 10, "serving": "1 slice", "grams": 120},
    "burger": {"calories": 350, "protein": 20, "carbs": 30, "fats": 16, "serving": "1 burger", "grams": 200},
    "fries": {"calories": 310, "protein": 4, "carbs": 42, "fats": 15, "serving": "1 medium", "grams": 120},
    "salad": {"calories": 120, "protein": 4, "carbs": 12, "fats": 6, "serving": "1 bowl", "grams": 200},
    "chicken salad": {"calories": 250, "protein": 28, "carbs": 10, "fats": 12, "serving": "1 bowl", "grams": 250},
    "wrap": {"calories": 300, "protein": 15, "carbs": 32, "fats": 12, "serving": "1 wrap", "grams": 180},
    "chicken wrap": {"calories": 350, "protein": 25, "carbs": 30, "fats": 14, "serving": "1 wrap", "grams": 200},
    "avocado toast": {"calories": 280, "protein": 6, "carbs": 26, "fats": 18, "serving": "1 slice", "grams": 120},
    "avocado": {"calories": 160, "protein": 2, "carbs": 9, "fats": 15, "serving": "1/2 avocado", "grams": 100},
    "greek yogurt": {"calories": 100, "protein": 17, "carbs": 6, "fats": 0.7, "serving": "1 cup", "grams": 170},
    "cheese": {"calories": 110, "protein": 7, "carbs": 0.4, "fats": 9, "serving": "1 slice", "grams": 28},
    "coffee": {"calories": 5, "protein": 0.3, "carbs": 0, "fats": 0, "serving": "1 cup", "grams": 240},
    "latte": {"calories": 150, "protein": 8, "carbs": 15, "fats": 6, "serving": "1 cup", "grams": 300},
    "cappuccino": {"calories": 120, "protein": 6, "carbs": 12, "fats": 5, "serving": "1 cup", "grams": 250},
    "orange juice": {"calories": 110, "protein": 1, "carbs": 26, "fats": 0.3, "serving": "1 glass", "grams": 250},
    "juice": {"calories": 110, "protein": 1, "carbs": 26, "fats": 0.3, "serving": "1 glass", "grams": 250},
    "mango": {"calories": 100, "protein": 1, "carbs": 25, "fats": 0.5, "serving": "1 cup", "grams": 165},
    "orange": {"calories": 62, "protein": 1.2, "carbs": 15, "fats": 0.2, "serving": "1 medium", "grams": 130},
    "scrambled eggs": {"calories": 180, "protein": 12, "carbs": 2, "fats": 14, "serving": "2-egg", "grams": 120},
    "egg bhurji": {"calories": 180, "protein": 12, "carbs": 2, "fats": 14, "serving": "2-egg", "grams": 120},
    "chicken": {"calories": 165, "protein": 31, "carbs": 0, "fats": 3.6, "serving": "100g", "grams": 100},
    "chicken curry": {"calories": 250, "protein": 20, "carbs": 8, "fats": 15, "serving": "1 bowl", "grams": 200},
    "fish": {"calories": 206, "protein": 22, "carbs": 0, "fats": 12, "serving": "1 piece", "grams": 100},
    "oats": {"calories": 150, "protein": 5, "carbs": 27, "fats": 3, "serving": "1 bowl", "grams": 40},
}

# Quantity words
QTY_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "half": 0.5, "quarter": 0.25,
    "a": 1, "an": 1,
}

# ---------------------------------------------------------------------------
# System prompt for Gemini (compact strict version for production)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are FitTrack AI in a productivity + fitness app.

CRITICAL: Return ONLY a raw JSON object. No markdown fences. No text before/after.

The user selects a mode BEFORE sending a message:
- mode=nutrition → ALWAYS return a nutrition confirmation with estimated macros. NEVER return chat_response.
- mode=workout → ALWAYS return a workout confirmation. NEVER return chat_response.
- mode=task → ALWAYS return a task confirmation. NEVER return chat_response.
- mode=general → Answer conversationally as chat_response.

When mode is NOT general, you MUST return status="confirmation_required" with the right action_type.
Always set intent_confidence to "high" when the mode matches.
Estimate realistic macros — users prefer approximate values over "I don't know".
Never claim data was saved. Never invent IDs.

JSON schemas:

Chat (mode=general only):
{"intent":"general_chat","intent_confidence":"high","status":"chat_response","message":"..."}

Nutrition (mode=nutrition):
{"intent":"nutrition_log","intent_confidence":"high","status":"confirmation_required","action_type":"log_nutrition","summary":"...","details":{"meal_type":"breakfast|lunch|dinner|snack|other","foods":[{"name":"...","components":[{"item":"...","qty":"..."}],"estimated_macros":{"calories":0,"protein":0,"carbs":0,"fats":0}}]},"confidence":"high","message":"..."}

Task (mode=task):
{"intent":"task_log","intent_confidence":"high","status":"confirmation_required","action_type":"add_task","summary":"...","details":{"title":"...","description":"","category":"general","priority":"low|medium|high","date":"YYYY-MM-DD","tags":[]},"confidence":"high","message":"..."}

Workout (mode=workout):
{"intent":"workout_log","intent_confidence":"high","status":"confirmation_required","action_type":"log_workout","summary":"...","details":{"name":"...","type":"cardio|strength|flexibility|sports|other","duration":0,"calories_burned":0,"intensity":"low|medium|high","exercises":[],"notes":""},"confidence":"high","message":"..."}

Project (mode=general, user asks):
{"intent":"project_create","intent_confidence":"high","status":"confirmation_required","action_type":"add_project","summary":"...","details":{"name":"...","description":"","subtasks":[],"due_date":""},"confidence":"high","message":"..."}
"""

# ---------------------------------------------------------------------------
# Mentor system prompt — motivational check-in with real data
# ---------------------------------------------------------------------------
MENTOR_SYSTEM_PROMPT = """You are a productivity mentor inside a performance tracking app called FitTrack Pro.

Your job is to:
- Motivate the user
- Hold them accountable
- Encourage consistency
- Suggest actionable next steps
- Be supportive but disciplined

You are NOT casual. You are NOT robotic. You are focused, calm, strong.

You have access to their real-time progress data (provided in the user message below). All numbers are pre-calculated — do NOT guess or invent data.

Rules:
- Respond in 4-6 sentences maximum.
- Keep it actionable — mention what is left today.
- Encourage completion.
- If streak is at risk (no tasks done, protein not met, workouts pending), warn them.
- If they are doing well, praise them.
- If they have overdue tasks, call it out.
- Do NOT hallucinate new tasks or data.
- Do NOT change any data.
- Do NOT use generic motivational quotes.
- Address the user by first name.
- Use line breaks between thoughts for readability.

CRITICAL: Return ONLY a raw JSON object. No markdown fences. No text before/after.
JSON schema:
{"intent":"general_chat","intent_confidence":"high","status":"chat_response","message":"Your motivational message here."}
"""

# ---------------------------------------------------------------------------
# Gemini API call  (with rate-limit guard & detailed error handling)
# ---------------------------------------------------------------------------

def _call_gemini(user_message, context=None, system_prompt_override=None):
    """
    Send a message to Google Gemini API using the official SDK.

    Guards:
      • Skips if no API key / client not initialized
      • Enforces a cooldown of _GEMINI_COOLDOWN_SEC between calls
      • Prevents concurrent in-flight requests (_gemini_lock)

    Returns parsed dict on success, None on failure.
    """
    global _gemini_last_call_ts, _gemini_lock

    # --- Guard 1: no client → fail ---
    if not _genai_client:
        _log_safe("[AI Avatar] Gemini client not initialized (no API key?).")
        return None

    # --- Guard 2: concurrent lock ---
    if _gemini_lock:
        _log_safe("[AI Avatar] Gemini request already in-flight — skipping duplicate.")
        return None

    # --- Guard 3: cooldown ---
    elapsed = time.time() - _gemini_last_call_ts
    if elapsed < _GEMINI_COOLDOWN_SEC:
        _log_safe(f"[AI Avatar] Gemini cooldown active ({elapsed:.1f}s / {_GEMINI_COOLDOWN_SEC}s) — skipping.")
        return None

    # --- Build the prompt ---
    user_text = ""
    if context:
        user_text += f"User context:\n- Current page: {context.get('current_page', 'unknown')}\n"
        mode_ctx = context.get("mode", "general")
        user_text += f"- Selected mode: {mode_ctx}\n"
        prefs = context.get("user_preferences", {})
        if prefs:
            user_text += f"- Goal: {prefs.get('goal', 'not set')}\n"
            user_text += f"- Diet: {prefs.get('diet_type', 'not set')}\n"
        today = context.get("today", "")
        if today:
            user_text += f"- Today's date: {today}\n"
        user_text += "\n"
    user_text += user_message

    # Combine system prompt + user message
    active_system_prompt = system_prompt_override or SYSTEM_PROMPT
    full_prompt = f"{active_system_prompt}\n\n---\nUser message:\n{user_text}"

    _log_safe(
        f"[AI Avatar] Gemini SDK request -> model={GEMINI_MODEL}, "
        f"prompt_len={len(full_prompt)}, has_context={bool(context)}"
    )

    # --- Fire the request under lock ---
    _gemini_lock = True
    _gemini_last_call_ts = time.time()
    _gemini_stats["requests"] += 1
    try:
        model = _genai_client.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(full_prompt)
        _log_safe(f"[AI Avatar] Gemini responded; candidate_count={len(getattr(response, 'candidates', []) or [])}")

        # Extract text from response
        if not response.text:
            print("[AI Avatar] Gemini returned empty response.")
            _gemini_stats["failed"] += 1
            return None

        text = response.text.strip()
        _log_safe(f"[AI Avatar] Gemini raw response: {text[:200]}...")

        # Clean potential markdown fencing
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

        parsed = json.loads(text)
        _gemini_stats["success"] += 1
        print(f"[AI Avatar] Gemini OK — status={parsed.get('status')}")
        return parsed

    except Exception as e:
        _gemini_stats["failed"] += 1
        err_str = str(e)
        _log_safe(f"[AI Avatar] Gemini error: {type(e).__name__}: {err_str[:500]}")
        # Check for rate limiting in error message
        if "429" in err_str or "rate" in err_str.lower():
            _gemini_stats["rate_limited"] += 1
            _gemini_last_call_ts = time.time() + 5  # extra 5-sec penalty
            print("[AI Avatar] Rate-limited — extending cooldown by 5s.")
        return None

    finally:
        _gemini_lock = False


def _norm_confidence(value, default="low"):
    val = str(value or "").strip().lower()
    if val in ("high", "medium", "low"):
        return val
    return default


def _normalize_action_type(value):
    raw = str(value or "").strip().lower()
    mapping = {
        "log_nutrition": "log_nutrition",
        "nutrition_log": "log_nutrition",
        "add_task": "add_task",
        "task_log": "add_task",
        "log_workout": "log_workout",
        "workout_log": "log_workout",
        "add_project": "add_project",
        "project_create": "add_project",
    }
    return mapping.get(raw, "")


def _compute_nutrition_total(items):
    calories = 0
    protein = 0.0
    carbs = 0.0
    fats = 0.0
    for item in items:
        calories += max(0, int(round(float(item.get("calories", 0) or 0))))
        protein += max(0.0, float(item.get("protein", 0) or 0))
        carbs += max(0.0, float(item.get("carbs", 0) or 0))
        fats += max(0.0, float(item.get("fats", 0) or 0))
    return {
        "calories": calories,
        "protein": round(protein, 1),
        "carbs": round(carbs, 1),
        "fats": round(fats, 1),
    }


def _normalize_nutrition_details(details):
    if not isinstance(details, dict):
        details = {}
    meal_type = str(details.get("meal_type") or "other").strip().lower()
    if meal_type not in ("breakfast", "lunch", "dinner", "snack", "other"):
        meal_type = "other"

    items = []
    raw_items = details.get("items", [])
    raw_foods = details.get("foods", [])
    if isinstance(raw_items, list) and raw_items:
        source = raw_items
        use_food_shape = False
    elif isinstance(raw_foods, list):
        source = raw_foods
        use_food_shape = True
    else:
        source = []
        use_food_shape = False

    for entry in source:
        if not isinstance(entry, dict):
            continue
        if use_food_shape:
            name = str(entry.get("name") or "Food").strip() or "Food"
            macros = entry.get("estimated_macros", {}) if isinstance(entry.get("estimated_macros"), dict) else {}
            components = entry.get("components", [])
            if not isinstance(components, list):
                components = []
            normalized_components = []
            for comp in components:
                if not isinstance(comp, dict):
                    continue
                item_name = str(comp.get("item") or "").strip()
                qty = str(comp.get("qty") or "").strip()
                if item_name:
                    normalized_components.append({"item": item_name, "qty": qty or "1 serving"})
            items.append(
                {
                    "name": name,
                    "quantity": 1,
                    "unit": "serving",
                    "components": normalized_components,
                    "calories": max(0, int(round(float(macros.get("calories", 0) or 0)))),
                    "protein": round(max(0.0, float(macros.get("protein", 0) or 0)), 1),
                    "carbs": round(max(0.0, float(macros.get("carbs", 0) or 0)), 1),
                    "fats": round(max(0.0, float(macros.get("fats", 0) or 0)), 1),
                    "is_estimate": True,
                    "note": "Gemini estimated",
                }
            )
            continue

        name = str(entry.get("name") or "Food").strip() or "Food"
        items.append(
            {
                "name": name,
                "quantity": float(entry.get("quantity", 1) or 1),
                "unit": str(entry.get("unit") or "serving"),
                "components": entry.get("components", []) if isinstance(entry.get("components"), list) else [],
                "calories": max(0, int(round(float(entry.get("calories", 0) or 0)))),
                "protein": round(max(0.0, float(entry.get("protein", 0) or 0)), 1),
                "carbs": round(max(0.0, float(entry.get("carbs", 0) or 0)), 1),
                "fats": round(max(0.0, float(entry.get("fats", 0) or 0)), 1),
                "is_estimate": bool(entry.get("is_estimate", True)),
                "note": str(entry.get("note") or ""),
            }
        )

    return {
        "meal_type": meal_type,
        "items": items,
        "total": _compute_nutrition_total(items),
    }


def _manual_fallback_response(mode):
    mode_name = str(mode or "general").strip().lower()
    if mode_name == "nutrition":
        msg = "Gemini is unavailable right now. Please add this meal in the Nutrition form manually."
    elif mode_name == "task":
        msg = "Gemini is unavailable right now. Please add this task from the Tasks form manually."
    elif mode_name == "workout":
        msg = "Gemini is unavailable right now. Please add this workout from the Workout form manually."
    else:
        msg = "Gemini is unavailable right now. Please retry in a moment."
    return {"status": "manual_fallback", "message": msg}


def _cache_key(user_input, context, mode):
    session_id = ""
    if isinstance(context, dict):
        session_id = str(context.get("session_id") or "").strip()
    return f"{session_id}|{mode}|{user_input.strip().lower()}"


def _get_cached_response(cache_key):
    now = time.time()
    row = _ai_response_cache.get(cache_key)
    if not row:
        return None
    if now - row["ts"] > _AI_CACHE_TTL_SEC:
        _ai_response_cache.pop(cache_key, None)
        return None
    return json.loads(json.dumps(row["value"]))


def _set_cached_response(cache_key, value):
    _ai_response_cache[cache_key] = {"ts": time.time(), "value": value}
    if len(_ai_response_cache) <= _AI_CACHE_MAX:
        return
    oldest_key = min(_ai_response_cache.keys(), key=lambda k: _ai_response_cache[k]["ts"])
    _ai_response_cache.pop(oldest_key, None)


def get_gemini_analytics():
    requests = _gemini_stats["requests"]
    success_rate = 0.0 if requests == 0 else round((_gemini_stats["success"] / requests) * 100, 2)
    return {
        "requests": requests,
        "success": _gemini_stats["success"],
        "failed": _gemini_stats["failed"],
        "rate_limited": _gemini_stats["rate_limited"],
        "success_rate": success_rate,
    }


def _normalize_gemini_payload(payload):
    if not isinstance(payload, dict):
        return {"status": "clarification_needed", "message": "Please rephrase your request."}

    status = str(payload.get("status") or "").strip().lower()
    intent = str(payload.get("intent") or "unknown").strip().lower()
    intent_conf = _norm_confidence(payload.get("intent_confidence"), "low")
    response_conf = _norm_confidence(payload.get("confidence"), intent_conf)

    if status == "chat_response":
        return {
            "intent": intent,
            "intent_confidence": intent_conf,
            "status": "chat_response",
            "message": str(payload.get("message") or "How can I help you?"),
        }

    if status == "clarification_needed":
        return {
            "intent": intent,
            "intent_confidence": intent_conf,
            "status": "clarification_needed",
            "message": str(payload.get("message") or "Could you clarify what you want to log?"),
        }

    if status != "confirmation_required":
        return {
            "intent": "unknown",
            "intent_confidence": "low",
            "status": "clarification_needed",
            "message": "I could not understand that. Please clarify.",
        }

    action_type = _normalize_action_type(payload.get("action_type"))
    if not action_type:
        action_type = _normalize_action_type(intent)
    if not action_type:
        return {
            "intent": intent or "unknown",
            "intent_confidence": intent_conf,
            "status": "clarification_needed",
            "message": "I need one more detail before I can draft that action.",
        }

    if intent_conf == "low":
        return {
            "intent": intent,
            "intent_confidence": intent_conf,
            "status": "clarification_needed",
            "message": str(payload.get("message") or "I might be wrong. Please clarify before I draft this."),
        }

    details = payload.get("details", {})
    if action_type == "log_nutrition":
        details = _normalize_nutrition_details(details)

    return {
        "intent": intent,
        "intent_confidence": intent_conf,
        "status": "confirmation_required",
        "action_type": action_type,
        "summary": str(payload.get("summary") or "Please review this draft"),
        "details": details if isinstance(details, dict) else {},
        "confidence": response_conf,
        "message": str(payload.get("message") or "Please confirm or edit before saving."),
    }


# ---------------------------------------------------------------------------
# Local fallback engine (no API key needed)
# ---------------------------------------------------------------------------

def _parse_quantity_word(text):
    """Extract a numeric quantity from text like '2 eggs' or 'three rotis'."""
    # Try numeric
    m = re.match(r"(\d+(?:\.\d+)?)\s*", text)
    if m:
        return float(m.group(1)), text[m.end():].strip()

    # Try word quantities
    lower = text.lower().strip()
    for word, val in QTY_WORDS.items():
        if lower.startswith(word + " "):
            return val, lower[len(word):].strip()

    return 1.0, text.strip()


def _classify_intent(user_input, context=None):
    """Simple rule-based intent classification."""
    lower = user_input.lower().strip()
    page = (context or {}).get("current_page", "").lower()

    # Nutrition keywords
    nutrition_kw = [
        "ate", "eaten", "had", "log", "food", "meal", "breakfast", "lunch",
        "dinner", "snack", "calories", "macros", "nutrition", "drink", "drank",
        "roti", "rice", "dal", "egg", "chicken", "paneer", "dosa", "idli",
        "biryani", "samosa", "chai", "milk", "banana", "apple", "bread"
    ]

    # Task keywords
    task_kw = [
        "task", "todo", "to-do", "to do", "reminder", "remind",
        "need to", "have to", "gotta", "should", "must", "deadline"
    ]

    # Project keywords
    project_kw = [
        "project", "create project", "new project", "start project"
    ]

    has_nutrition = any(kw in lower for kw in nutrition_kw)
    has_task = any(kw in lower for kw in task_kw)
    has_project = any(kw in lower for kw in project_kw)

    if has_nutrition and has_task:
        return "multiple_actions"
    if has_project:
        return "add_project"
    if has_task:
        return "add_task"
    if has_nutrition or page == "nutrition":
        return "log_nutrition"

    return "general_chat"


def _guess_meal_type(text):
    """Guess meal type from text."""
    lower = text.lower()
    if any(w in lower for w in ["breakfast", "morning"]):
        return "breakfast"
    if any(w in lower for w in ["lunch", "afternoon"]):
        return "lunch"
    if any(w in lower for w in ["dinner", "evening", "night"]):
        return "dinner"
    if any(w in lower for w in ["snack", "tea time", "munchies"]):
        return "snack"
    return "snack"  # default


def _local_nutrition(user_input, context=None):
    """
    Local rule-based nutrition estimation from the Indian food database.
    Returns a confirmation payload.
    """
    # Split input into food segments
    text = re.sub(r"(?i)^(i |i've |i have |had |ate |eaten |log |add |please )+(for )?(breakfast |lunch |dinner |snack )?", "", user_input.strip())
    # Also strip trailing meal type references
    text = re.sub(r"(?i)\s+for\s+(breakfast|lunch|dinner|snack)\s*$", "", text)
    segments = re.split(r"\s*(?:,|\band\b|\+|;|\bwith\b)\s*", text, flags=re.IGNORECASE)
    segments = [s.strip() for s in segments if s.strip()]

    items = []
    low_confidence = False

    for seg in segments:
        qty, food_text = _parse_quantity_word(seg)

        # Strip common modifiers
        food_clean = re.sub(r"\b(cooked|raw|boiled|fried|grilled|baked|steamed|hot|cold|fresh|leftover)\b", "", food_text, flags=re.IGNORECASE).strip()
        food_lower = food_clean.lower()

        # Direct lookup — longest key first to match compound foods
        match = None
        for key in sorted(INDIAN_FOOD_ESTIMATES.keys(), key=len, reverse=True):
            if key in food_lower:
                match = INDIAN_FOOD_ESTIMATES[key]
                matched_name = key
                break
        # Fallback: try matching the food as a substring of a key (only if multi-word)
        if not match and len(food_lower.split()) >= 2:
            for key in sorted(INDIAN_FOOD_ESTIMATES.keys(), key=len, reverse=True):
                if food_lower in key:
                    match = INDIAN_FOOD_ESTIMATES[key]
                    matched_name = key
                    break

        if match:
            items.append({
                "name": matched_name.title(),
                "quantity": qty,
                "unit": match["serving"],
                "calories": round(match["calories"] * qty),
                "protein": round(match["protein"] * qty, 1),
                "carbs": round(match["carbs"] * qty, 1),
                "fats": round(match["fats"] * qty, 1),
                "is_estimate": True,
                "note": f"~{match['grams'] * qty:.0f}g estimated"
            })
        else:
            low_confidence = True
            items.append({
                "name": food_text.title(),
                "quantity": qty,
                "unit": "serving",
                "calories": 0,
                "protein": 0,
                "carbs": 0,
                "fats": 0,
                "is_estimate": True,
                "note": "Could not estimate — please enter values manually"
            })

    if not items:
        return {
            "status": "clarification_needed",
            "message": "I couldn't identify any food items. Could you describe what you ate more specifically?"
        }

    total = {
        "calories": sum(i["calories"] for i in items),
        "protein": round(sum(i["protein"] for i in items), 1),
        "carbs": round(sum(i["carbs"] for i in items), 1),
        "fats": round(sum(i["fats"] for i in items), 1),
    }

    meal_type = _guess_meal_type(user_input)

    return {
        "status": "confirmation_required",
        "action_type": "log_nutrition",
        "summary": f"Log {len(items)} food item{'s' if len(items) > 1 else ''} as {meal_type}",
        "details": {
            "meal_type": meal_type,
            "items": items,
            "total": total
        },
        "confidence": "low" if low_confidence else ("medium" if any(i["is_estimate"] for i in items) else "high"),
        "message": "These are estimated values. Please review and confirm, edit, or cancel."
    }


def _local_task(user_input, context=None):
    """Local rule-based task extraction."""
    # Strip common prefixes
    text = re.sub(r"(?i)^(add |create |new |make )?(a )?(task|todo|to-do|reminder)?\s*:?\s*", "", user_input.strip())
    text = re.sub(r"(?i)^(i need to |i have to |i must |i should |i gotta |remind me to )\s*", "", text.strip())

    # Extract date hints
    date = ""
    today = (context or {}).get("today", "")
    lower = text.lower()
    if "today" in lower:
        date = today
        text = re.sub(r"\b(by |before |until )?\btoday\b", "", text, flags=re.IGNORECASE).strip()
    elif "tomorrow" in lower:
        # Simple tomorrow calc
        if today:
            from datetime import datetime as dt, timedelta
            try:
                d = dt.strptime(today, "%Y-%m-%d") + timedelta(days=1)
                date = d.strftime("%Y-%m-%d")
            except ValueError:
                date = ""
        text = re.sub(r"\b(by |before |until )?\btomorrow\b", "", text, flags=re.IGNORECASE).strip()

    # Extract tags (words starting with #)
    tags = re.findall(r"#(\w+)", text)
    text = re.sub(r"#\w+", "", text).strip()

    # Trim trailing punctuation
    title = text.strip().rstrip(".,;:!?").strip()
    if not title:
        return {
            "status": "clarification_needed",
            "message": "What should the task be? Please provide a task description."
        }

    return {
        "status": "confirmation_required",
        "action_type": "add_task",
        "summary": f"Create task: {title}",
        "details": {
            "title": title,
            "description": "",
            "category": "general",
            "priority": "medium",
            "date": date or today,
            "tags": tags
        },
        "confidence": "high" if len(title) > 3 else "medium",
        "message": "Please confirm, edit, or cancel."
    }


def _local_workout(user_input, context=None):
    """Local rule-based workout extraction."""
    lower = user_input.lower().strip()
    today = (context or {}).get("today", "")

    # Workout type detection
    type_map = {
        "cardio": ["cardio", "running", "run", "jogging", "jog", "cycling", "bike",
                    "swimming", "swim", "walking", "walk", "hiit", "jumping", "treadmill",
                    "elliptical", "rowing", "skipping"],
        "strength": ["strength", "weight", "lifting", "gym", "push", "pull", "squat",
                      "deadlift", "bench", "curl", "press", "dumbbell", "barbell",
                      "resistance", "muscle"],
        "flexibility": ["yoga", "stretch", "stretching", "pilates", "flexibility",
                        "meditation"],
        "sports": ["sports", "basketball", "football", "soccer", "cricket", "badminton",
                   "tennis", "volleyball", "table tennis", "hockey"]
    }

    workout_type = "general"
    workout_name = "Workout"
    for wtype, keywords in type_map.items():
        for kw in keywords:
            if kw in lower:
                workout_type = wtype
                workout_name = kw.title()
                break
        if workout_type != "general":
            break

    # Duration extraction
    duration = 0
    dur_match = re.search(r"(\d+)\s*(?:min(?:ute)?s?|hrs?|hours?)", lower)
    if dur_match:
        duration = int(dur_match.group(1))
        if "hour" in lower or "hr" in lower:
            duration *= 60

    # Calories extraction
    calories_burned = 0
    cal_match = re.search(r"(?:burn(?:ed|t)?|cal(?:orie)?s?)\s*[:=]?\s*(\d+)", lower) or \
                re.search(r"(\d+)\s*(?:cal(?:orie)?s?\s*(?:burn(?:ed)?)?|kcal)", lower)
    if cal_match:
        calories_burned = int(cal_match.group(1))

    # Intensity
    intensity = "medium"
    if any(w in lower for w in ["light", "easy", "gentle", "slow"]):
        intensity = "low"
    elif any(w in lower for w in ["intense", "hard", "heavy", "high", "vigorous"]):
        intensity = "high"

    # Exercises (split by comma/and)
    segments = re.split(r"\s*(?:,|\band\b|\+|;)\s*", user_input.strip())
    exercises = []
    if len(segments) > 1:
        for seg in segments:
            clean = re.sub(r"\d+\s*(?:min(?:ute)?s?|hrs?|hours?|cal(?:orie)?s?|kcal)\s*", "", seg, flags=re.IGNORECASE).strip()
            if 1 < len(clean) < 60:
                exercises.append(clean)

    # Estimate calories if not provided
    if not calories_burned and duration > 0:
        rate_map = {"cardio": 10, "strength": 7, "flexibility": 4, "sports": 8, "general": 6}
        calories_burned = round(duration * rate_map.get(workout_type, 6))

    if workout_name == "Workout" and exercises:
        workout_name = exercises[0]

    return {
        "status": "confirmation_required",
        "action_type": "log_workout",
        "summary": f"Log workout: {workout_name} ({duration} min, ~{calories_burned} cal)",
        "details": {
            "name": workout_name,
            "type": workout_type,
            "duration": duration,
            "calories_burned": calories_burned,
            "intensity": intensity,
            "exercises": exercises,
            "notes": "",
            "date": today
        },
        "confidence": "medium" if duration > 0 else "low",
        "message": "These are estimated values. Please review and confirm, edit, or cancel."
    }


def _local_project(user_input, context=None):
    """Local rule-based project extraction."""
    text = re.sub(r"(?i)^(add |create |new |make |start )?(a )?(project)?\s*:?\s*", "", user_input.strip())

    # Check for subtasks (lines, numbered items, bullet points)
    lines = re.split(r"\n|;|\bwith subtasks?\b:?\s*", text, flags=re.IGNORECASE)
    name = lines[0].strip().rstrip(".,;:!?").strip()
    subtasks = [l.strip().lstrip("-•0123456789.)").strip() for l in lines[1:] if l.strip()]

    if not name:
        return {
            "status": "clarification_needed",
            "message": "What should the project be called? Please provide a name."
        }

    return {
        "status": "confirmation_required",
        "action_type": "add_project",
        "summary": f"Create project: {name}" + (f" with {len(subtasks)} subtask(s)" if subtasks else ""),
        "details": {
            "name": name,
            "description": "",
            "subtasks": subtasks,
            "due_date": ""
        },
        "confidence": "high" if len(name) > 3 else "medium",
        "message": "Please confirm, edit, or cancel."
    }


def _local_chat(user_input, context=None):
    """Handle general chat locally with personality."""
    lower = user_input.lower().strip()

    # Greetings
    if re.match(r"^(hi|hello|hey|howdy|yo|sup|hola|namaste|good morning|good afternoon|good evening)\b", lower):
        return {"status": "chat_response", "message": "Hey there! 👋 How's it going? I'm your FitTrack AI buddy — I can log meals, create tasks, answer questions, or just chat. What's on your mind?"}

    # Goodbyes
    if re.match(r"^(bye|goodbye|see ya|later|good night|cya)\b", lower):
        return {"status": "chat_response", "message": "See ya! 👋 Take care and stay on track. I'm always here when you need me!"}

    # Thanks
    if any(w in lower for w in ["thank", "thanks", "thx", "appreciate"]):
        return {"status": "chat_response", "message": "You're welcome! 😊 Always happy to help. Anything else I can do for you?"}

    # How are you
    if any(w in lower for w in ["how are you", "how're you", "how r u", "what's up", "whats up"]):
        return {"status": "chat_response", "message": "I'm doing great, thanks for asking! 😄 I'm ready to help you crush your goals today. What can I do for you?"}

    # Identity
    if any(w in lower for w in ["who are you", "what are you", "your name", "what's your name"]):
        return {"status": "chat_response", "message": "I'm **FitTrack AI** — your personal productivity & fitness assistant! 🤖✨ I can log meals (I know Indian food really well!), create tasks & projects, answer questions, and keep you motivated. Try me out!"}

    # Help
    if any(w in lower for w in ["help", "what can you do", "how do you work", "features", "commands"]):
        return {"status": "chat_response", "message": "Here's what I can do for you! ✨\n\n🍽️ **Log Meals** — _\"I had 2 rotis and dal for lunch\"_\n📋 **Create Tasks** — _\"Add task: finish report by tomorrow\"_\n📁 **Create Projects** — _\"Create project website redesign\"_\n💬 **Answer Questions** — Ask me anything! Science, health, coding, math, life advice...\n💪 **Fitness Tips** — Nutrition advice, protein goals, workout ideas\n\nJust type naturally and I'll figure it out!"}

    # Fitness / health questions (common ones)
    if any(w in lower for w in ["how much protein", "protein intake", "daily protein"]):
        return {"status": "chat_response", "message": "Great question! 💪 Aim for **0.7-1g of protein per pound of bodyweight** (about 1.6-2.2g per kg). So if you're 70kg, target around **112-154g per day**. Great sources: chicken, eggs, dal, paneer, Greek yogurt, tofu, and whey protein!"}

    if any(w in lower for w in ["how many calories", "calorie intake", "daily calories", "how much should i eat"]):
        return {"status": "chat_response", "message": "It depends on your goals! 📊\n\n- **Maintain weight**: ~2000-2500 cal/day for most adults\n- **Lose weight**: Cut 300-500 calories below maintenance\n- **Gain muscle**: Add 200-300 calories above maintenance\n\nFor a more precise number, search for a TDEE calculator online using your age, weight, height, and activity level!"}

    if any(w in lower for w in ["motivate me", "motivation", "i feel lazy", "feeling unmotivated", "don't feel like"]):
        import random
        quotes = [
            "🔥 \"The only bad workout is the one that didn't happen.\" You've got this — just start small, even 5 minutes counts!",
            "💪 \"Discipline is choosing between what you want now and what you want most.\" Your future self will thank you!",
            "🚀 \"Every expert was once a beginner.\" One step at a time — you're making progress even when it doesn't feel like it!",
            "⭐ \"You don't have to be extreme, just consistent.\" Log a meal, check off one task — small wins add up!",
            "🎯 \"Action cures fear. Momentum cures laziness.\" Do one tiny thing right now and watch the energy flow!",
        ]
        return {"status": "chat_response", "message": random.choice(quotes)}

    if any(w in lower for w in ["weight loss", "lose weight", "fat loss"]):
        return {"status": "chat_response", "message": "Here are the **fundamentals of fat loss**: 🎯\n\n1. **Calorie deficit** — Eat ~300-500 cal less than you burn\n2. **High protein** — Keeps you full + preserves muscle (aim 1.6g/kg)\n3. **Strength training** — Builds/maintains muscle which boosts metabolism\n4. **Sleep 7-8 hrs** — Poor sleep = higher cravings\n5. **Stay consistent** — Progress > perfection\n\nI can help you track meals and stay accountable! Just tell me what you eat. 🍽️"}

    if any(w in lower for w in ["muscle gain", "build muscle", "bulk"]):
        return {"status": "chat_response", "message": "To build muscle effectively: 💪\n\n1. **Calorie surplus** — Eat ~200-300 cal above maintenance\n2. **Protein** — 1.8-2.2g per kg bodyweight\n3. **Progressive overload** — Gradually increase weights/reps\n4. **Rest** — Muscles grow during recovery, not in the gym\n5. **Sleep** — Growth hormone peaks during deep sleep\n\nTrack your meals here and I'll help you hit your protein targets!"}

    # General knowledge — defer to a friendly "I can help" message for the local engine
    # (Gemini would handle these, but local fallback is limited)
    if "?" in user_input or any(w in lower for w in ["what is", "what's", "who is", "who's", "where is", "when is", "why is", "how to", "how do", "explain", "tell me about", "define"]):
        return {"status": "chat_response", "message": f"That's a great question! 🤔 I'd love to give you a detailed answer, but my local brain is a bit limited. Try asking me about nutrition, fitness, or productivity — those are my superpowers! Or I can help you log a meal or create a task. 😊"}

    # Default — friendly and encouraging
    return {"status": "chat_response", "message": "Hmm, I'm not quite sure what you mean 🤔 but I'm here to help! You can:\n\n🍽️ Tell me what you ate — _\"I had biryani for lunch\"_\n📋 Create a task — _\"Add task buy groceries\"_\n❓ Ask a question — _\"How much protein do I need?\"_\n\nWhat would you like to do?"}


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def process_avatar_message(user_input, context=None, mode="general"):
    """
    Main entry point for the AI Avatar.

    Args:
        user_input: Natural language message from the user
        context: Dict with current_page, user_preferences, today, etc.
        mode: Explicit user-selected mode — 'nutrition', 'workout', 'task', or 'general'

    Returns:
        dict — structured response (confirmation_required, clarification_needed, or chat_response)
    """
    if not user_input or not user_input.strip():
        return {
            "status": "clarification_needed",
            "message": "It looks like you sent an empty message. What would you like help with?"
        }

    # Inject mode into context for Gemini
    if context is None:
        context = {}
    context["mode"] = mode

    # --- Detect mentor mode ---
    is_mentor = user_input.strip().startswith("[MENTOR_MODE]") or (context.get("mentor_mode") is True)
    mentor_prompt_override = MENTOR_SYSTEM_PROMPT if is_mentor else None

    # --- Try Gemini first ---
    gemini_result = None
    if _genai_client:
        gemini_result = _call_gemini(user_input, context, system_prompt_override=mentor_prompt_override)

    if gemini_result:
        normalized = _normalize_gemini_payload(gemini_result)
        # If mode is explicit (not general) but Gemini returned a chat_response,
        # fall through to the local engine which reliably produces confirmations.
        if mode != "general" and normalized.get("status") == "chat_response":
            _log_safe(f"[AI Avatar] Gemini returned chat_response in {mode} mode — falling back to local engine.")
        else:
            normalized["analytics"] = get_gemini_analytics()
            return normalized

    # --- Local fallback for structured modes ---
    _log_safe(f"[AI Avatar] Using local engine for mode={mode}")
    if mode == "nutrition":
        result = _local_nutrition(user_input, context)
    elif mode == "task":
        result = _local_task(user_input, context)
    elif mode == "workout":
        result = _local_workout(user_input, context)
    else:
        # General mode — try local chat, or report error if Gemini was expected
        if not _genai_client:
            return {"error": "Gemini API key is not configured on the server."}
        if not gemini_result:
            return {"error": "Gemini API request failed. Check server logs for details."}
        result = _local_chat(user_input, context)

    result["analytics"] = get_gemini_analytics()
    return result
