"""
USDA-Powered Nutrition AI Agent (Confirmation-First)
=====================================================
Parses natural-language food input, queries the USDA FoodData Central API,
and returns a CONFIRMATION payload for user review before logging.

Two-step flow:
  1. detect_foods()  → parse + USDA search → confirmation payload
  2. process_meal()  → confirmed foods → calculated macros for logging

Preferred data types (in order): Foundation → SR Legacy.
Branded foods are excluded unless the user explicitly mentions a brand.
"""

import json
import os
import re
import urllib.parse
import urllib.request

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
from .config import Config

USDA_API_KEY = Config.USDA_API_KEY
USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"
USDA_FOOD_URL = "https://api.nal.usda.gov/fdc/v1/food"

# USDA data type preference: Foundation first, then SR Legacy
PREFERRED_DATA_TYPES = ["Foundation", "SR Legacy"]

# ---------------------------------------------------------------------------
# Unit-to-gram conversion tables (approximate household measures)
# ---------------------------------------------------------------------------
UNIT_TO_GRAMS = {
    # Volume-based (approximate for most solid/liquid foods)
    "cup": 240,
    "cups": 240,
    "c": 240,
    "tablespoon": 15,
    "tablespoons": 15,
    "tbsp": 15,
    "teaspoon": 5,
    "teaspoons": 5,
    "tsp": 5,
    "ml": 1,
    "milliliter": 1,
    "milliliters": 1,
    "millilitre": 1,
    "millilitres": 1,
    "liter": 1000,
    "liters": 1000,
    "litre": 1000,
    "litres": 1000,
    "l": 1000,
    "fl oz": 30,
    "fluid ounce": 30,
    "fluid ounces": 30,
    # Weight-based
    "g": 1,
    "gram": 1,
    "grams": 1,
    "gm": 1,
    "kg": 1000,
    "kilogram": 1000,
    "kilograms": 1000,
    "oz": 28.35,
    "ounce": 28.35,
    "ounces": 28.35,
    "lb": 453.6,
    "lbs": 453.6,
    "pound": 453.6,
    "pounds": 453.6,
}

# Default weights for "piece/whole" items (grams per 1 piece)
PIECE_WEIGHTS = {
    "egg": 50,
    "eggs": 50,
    "whole egg": 50,
    "banana": 118,
    "apple": 182,
    "orange": 131,
    "slice": 30,
    "slices": 30,
    "piece": 100,
    "pieces": 100,
    "breast": 174,
    "thigh": 116,
    "drumstick": 96,
    "wing": 34,
    "tortilla": 49,
    "chapati": 40,
    "roti": 40,
    "naan": 90,
    "bagel": 105,
    "muffin": 57,
    "cookie": 30,
    "scoop": 30,
    "patty": 113,
    "fillet": 170,
    "strip": 30,
    "strips": 30,
    "bowl": 240,
    "glass": 240,
    "can": 355,
    "bottle": 500,
}

# Nutrient IDs for macros in USDA data
NUTRIENT_MAP = {
    1008: "calories",   # Energy (kcal)
    1003: "protein",    # Protein (g)
    1005: "carbs",      # Carbohydrate (g)
    1004: "fats",       # Total lipid / fat (g)
}


# ---------------------------------------------------------------------------
# NLP food parser
# ---------------------------------------------------------------------------

# Pattern for a single food segment: quantity + optional unit + food name
_SEGMENT_PATTERN = re.compile(
    r"""
    ^\s*
    (?:(\d+(?:\.\d+)?(?:\s*/\s*\d+)?)\s*)?      # quantity (number/fraction)
    (?:(cups?|tablespoons?|tbsp|teaspoons?|tsp|
        grams?|gm?|kg|kilograms?|oz|ounces?|
        pounds?|lbs?|lb|ml|milliliters?|
        liters?|litres?|l|fl\s*oz|
        fluid\s*ounces?|pieces?|slices?|
        whole|large|medium|small|servings?|
        bowls?|glass|glasses|scoops?|
        fillets?|breasts?|thighs?|
        drumsticks?|wings?|patty|patties|
        strips?|cans?|bottles?)\s+)?              # optional unit
    (.+?)                                         # food name (non-greedy)
    \s*$
    """,
    re.VERBOSE | re.IGNORECASE,
)

# Separator pattern for splitting multi-food input
_SEPARATOR_PATTERN = re.compile(r'\s*(?:,\s*|\s+and\s+|\s*\+\s*|\s*;\s*)', re.IGNORECASE)

# Size multipliers
SIZE_MULTIPLIERS = {
    "small": 0.75,
    "medium": 1.0,
    "large": 1.25,
}


# ---------------------------------------------------------------------------
# Semantic safety filters
# ---------------------------------------------------------------------------
# Maps a user search term to USDA result keywords that should be REJECTED
# to prevent silent mis-matching (e.g. user says "egg" but USDA returns "eggplant").
SEMANTIC_EXCLUSIONS = {
    "egg":       ["eggplant", "egg roll", "egg noodle", "eggnog"],
    "eggs":      ["eggplant", "egg roll", "egg noodle", "eggnog"],
    "butter":    ["butternut", "buttermilk", "butterscotch", "butterfly"],
    "corn":      ["corned", "cornbread"],
    "rice":      ["rice paper", "rice noodle", "licorice"],
    "cream":     ["cream cheese", "cream soda", "ice cream"],
    "milk":      ["milkshake", "milkfish"],
    "chicken":   ["chickpea", "chicken pox"],
    "turkey":    ["turkey berry"],
    "fish":      ["fish sauce", "fish cake", "starfish"],
    "bread":     ["breadfruit", "bread crumb"],
    "olive":     ["olive oil"],
    "coconut":   ["coconut oil", "coconut milk"],
    "peanut":    ["peanut oil", "peanut butter"],
    "almond":    ["almond milk", "almond oil", "almond butter"],
}

# ---------------------------------------------------------------------------
# Composite / Indian food detection
# ---------------------------------------------------------------------------
# Foods that are composite dishes — we detect them and offer to log as-is
# or break down into components. Each entry: { search_term, components }
COMPOSITE_FOODS = {
    "biryani":        {"search": "biryani", "note": "Composite dish (rice + meat/veg + spices). Logging as whole dish."},
    "dal":            {"search": "lentil soup cooked", "note": "Lentil-based curry. Logging as cooked lentils."},
    "daal":           {"search": "lentil soup cooked", "note": "Lentil-based curry. Logging as cooked lentils."},
    "samosa":         {"search": "samosa", "note": "Fried pastry with filling. Logging as whole item."},
    "paratha":        {"search": "paratha", "note": "Stuffed flatbread. Logging as whole item."},
    "dosa":           {"search": "dosa", "note": "Fermented rice-lentil crepe. Logging as whole item."},
    "idli":           {"search": "idli", "note": "Steamed rice-lentil cake. Logging as whole item."},
    "upma":           {"search": "upma", "note": "Semolina dish. Logging as whole item."},
    "poha":           {"search": "poha flattened rice", "note": "Flattened rice dish. Logging as whole item."},
    "khichdi":        {"search": "khichdi rice lentil", "note": "Rice + lentil porridge. Logging as whole dish."},
    "tikka masala":   {"search": "tikka masala", "note": "Composite curry dish. Logging as whole item."},
    "butter chicken": {"search": "butter chicken", "note": "Chicken in creamy tomato sauce. Logging as whole dish."},
    "palak paneer":   {"search": "palak paneer spinach", "note": "Spinach + paneer curry. Logging as whole dish."},
    "chole":          {"search": "chickpea curry", "note": "Chickpea curry. Logging as whole dish."},
    "chana masala":   {"search": "chickpea curry", "note": "Chickpea curry. Logging as whole dish."},
    "rajma":          {"search": "kidney bean curry", "note": "Kidney bean curry. Logging as whole dish."},
    "pav bhaji":      {"search": "pav bhaji", "note": "Mashed vegetable curry with bread. Logging as whole dish."},
    "aloo gobi":      {"search": "potato cauliflower", "note": "Potato + cauliflower dish. Logging as whole dish."},
    "pulao":          {"search": "pilaf rice", "note": "Flavored rice dish. Logging as whole dish."},
    "pasta":          {"search": "pasta cooked", "note": "Note: logging plain cooked pasta. Add sauce separately."},
    "sandwich":       {"search": "sandwich", "note": "Composite item. Logging as assembled sandwich."},
    "burrito":        {"search": "burrito", "note": "Composite wrapped item. Logging as whole."},
    "pizza":          {"search": "pizza", "note": "Composite item. Logging as whole slice/piece."},
    "burger":         {"search": "hamburger", "note": "Composite item with bun + patty. Logging as whole."},
}


def _semantic_filter(user_term, usda_results):
    """
    Filter USDA results to prevent semantic mismatches.
    E.g., if user searched for 'egg', remove results containing 'eggplant'.
    Returns filtered list of USDA results.
    """
    user_lower = user_term.lower().strip()

    # Find the most specific matching exclusion key
    exclusion_terms = None
    for key, exclusions in SEMANTIC_EXCLUSIONS.items():
        if key == user_lower or user_lower.endswith(f" {key}"):
            exclusion_terms = exclusions
            break

    if not exclusion_terms:
        return usda_results

    filtered = []
    for food in usda_results:
        desc = food.get("description", "").lower()
        excluded = False
        for excl in exclusion_terms:
            if excl.lower() in desc:
                excluded = True
                break
        if not excluded:
            filtered.append(food)

    # If filtering removed ALL results, return originals (better than nothing)
    return filtered if filtered else usda_results


def _compute_confidence(user_term, usda_food):
    """
    Compute a confidence score for how well a USDA result matches the user input.
    Returns: 'high', 'medium', or 'low'
    """
    user_words = set(user_term.lower().split())
    desc = usda_food.get("description", "").lower()
    desc_words = set(desc.replace(",", " ").replace("(", " ").replace(")", " ").split())

    # Check how many user words appear in the USDA description
    matches = sum(1 for w in user_words if any(w in dw or dw in w for dw in desc_words))
    match_ratio = matches / max(len(user_words), 1)

    # Data type bonus
    data_type = usda_food.get("dataType", "")
    is_preferred = data_type in PREFERRED_DATA_TYPES

    if match_ratio >= 0.7 and is_preferred:
        return "high"
    elif match_ratio >= 0.5 or is_preferred:
        return "medium"
    else:
        return "low"


def _check_composite(food_name):
    """
    Check if the food name matches a known composite/Indian dish.
    Returns the composite food entry dict or None.
    """
    food_lower = food_name.lower().strip()
    for key, entry in COMPOSITE_FOODS.items():
        if key in food_lower or food_lower in key:
            return entry
    return None


def _parse_quantity(raw):
    """Parse a human quantity string like '2', '1.5', '1/2' into a float."""
    if not raw:
        return 1.0
    raw = raw.strip()
    if "/" in raw:
        parts = raw.split("/")
        try:
            return float(parts[0].strip()) / float(parts[1].strip())
        except (ValueError, ZeroDivisionError):
            return 1.0
    try:
        return float(raw)
    except ValueError:
        return 1.0


def parse_food_input(user_input):
    """
    Parse natural language food input into a list of structured items.
    Returns list of dicts: [{name, quantity, unit, quantity_g}, ...]
    """
    text = user_input.strip()
    if not text:
        return []

    # Split input into segments by separators (comma, "and", "+", ";")
    segments = _SEPARATOR_PATTERN.split(text)
    segments = [s.strip() for s in segments if s.strip()]

    items = []
    for segment in segments:
        m = _SEGMENT_PATTERN.match(segment)
        if not m:
            # Treat entire segment as food name with qty=1
            items.append({
                "name": segment,
                "quantity": 1.0,
                "unit": "piece",
                "quantity_g": None,
            })
            continue

        qty_str, unit_str, food_name = m.group(1), m.group(2), m.group(3)
        food_name = food_name.strip().rstrip(",;").strip()
        if not food_name or len(food_name) < 2:
            continue

        quantity = _parse_quantity(qty_str)
        unit = (unit_str or "").strip().lower()

        # Determine grams
        size_mult = SIZE_MULTIPLIERS.get(unit, None)
        if size_mult is not None:
            quantity_g = None
            unit = "piece"
            quantity *= size_mult
        elif unit in ("piece", "pieces", "whole", "serving", "servings"):
            quantity_g = None
            unit = "piece"
        elif unit in UNIT_TO_GRAMS:
            quantity_g = quantity * UNIT_TO_GRAMS[unit]
        elif unit in PIECE_WEIGHTS:
            quantity_g = quantity * PIECE_WEIGHTS[unit]
        elif unit == "":
            quantity_g = None
            unit = "piece"
        else:
            quantity_g = None
            unit = "piece"

        items.append({
            "name": food_name,
            "quantity": quantity,
            "unit": unit,
            "quantity_g": quantity_g,
        })

    # Fallback: if nothing matched, treat entire input as one food
    if not items:
        items.append({
            "name": text,
            "quantity": 1.0,
            "unit": "piece",
            "quantity_g": None,
        })

    return items


# ---------------------------------------------------------------------------
# USDA API helpers
# ---------------------------------------------------------------------------

def _usda_request(url, params=None, timeout=10):
    """Make a GET request to USDA API and return parsed JSON."""
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "FitTrackNutritionAI/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        raise RuntimeError(f"USDA API error: {e}")


def search_usda_food(query, page_size=5):
    """
    Search USDA FoodData Central for a food item.
    Returns list of candidate foods sorted by preference (Foundation > SR Legacy).
    """
    params = {
        "api_key": USDA_API_KEY,
        "query": query,
        "pageSize": page_size,
        "dataType": ",".join(PREFERRED_DATA_TYPES),
    }
    data = _usda_request(USDA_SEARCH_URL, params)
    foods = data.get("foods", [])

    # Sort by data type preference
    def _sort_key(f):
        dt = f.get("dataType", "")
        try:
            return PREFERRED_DATA_TYPES.index(dt)
        except ValueError:
            return len(PREFERRED_DATA_TYPES)

    foods.sort(key=_sort_key)
    return foods


def get_usda_food_details(fdc_id):
    """Fetch detailed nutrition data for a specific USDA food by FDC ID."""
    params = {"api_key": USDA_API_KEY}
    url = f"{USDA_FOOD_URL}/{fdc_id}"
    return _usda_request(url, params)


def extract_macros_from_usda(food_data):
    """
    Extract calories, protein, carbs, fats from USDA food detail response.
    Values are per 100g.
    Returns dict: {calories, protein, carbs, fats, serving_weight_g, food_name}
    """
    nutrients = food_data.get("foodNutrients", [])
    macros = {"calories": 0, "protein": 0, "carbs": 0, "fats": 0}

    for n in nutrients:
        # Handle both search result and detail response formats
        nutrient_id = None
        amount = 0

        if "nutrientId" in n:
            nutrient_id = n["nutrientId"]
            amount = n.get("value", 0) or 0
        elif "nutrient" in n:
            nutrient_id = n["nutrient"].get("id")
            amount = n.get("amount", 0) or 0

        if nutrient_id in NUTRIENT_MAP:
            macros[NUTRIENT_MAP[nutrient_id]] = float(amount)

    # Try to get serving weight
    serving_weight = None
    portions = food_data.get("foodPortions", [])
    if portions:
        # Use the first portion that has a weight
        for p in portions:
            w = p.get("gramWeight")
            if w and float(w) > 0:
                serving_weight = float(w)
                break

    food_name = food_data.get("description", "Unknown food")

    return {
        "calories": macros["calories"],
        "protein": macros["protein"],
        "carbs": macros["carbs"],
        "fats": macros["fats"],
        "serving_weight_g": serving_weight,
        "food_name": food_name,
    }


def extract_macros_from_search_result(food):
    """
    Extract macros from a USDA search result item (lighter than detail endpoint).
    Values are per 100g.
    """
    nutrients = food.get("foodNutrients", [])
    macros = {"calories": 0, "protein": 0, "carbs": 0, "fats": 0}

    for n in nutrients:
        nutrient_id = n.get("nutrientId")
        amount = n.get("value", 0) or 0
        if nutrient_id in NUTRIENT_MAP:
            macros[NUTRIENT_MAP[nutrient_id]] = float(amount)

    # Serving weight from search results
    serving_weight = None
    serving_size = food.get("servingSize")
    if serving_size and float(serving_size) > 0:
        serving_weight = float(serving_size)

    food_name = food.get("description", "Unknown food")

    return {
        "calories": macros["calories"],
        "protein": macros["protein"],
        "carbs": macros["carbs"],
        "fats": macros["fats"],
        "serving_weight_g": serving_weight,
        "food_name": food_name,
        "fdc_id": food.get("fdcId"),
        "data_type": food.get("dataType", ""),
    }


# ---------------------------------------------------------------------------
# Core AI agent logic — TWO-STEP CONFIRMATION FLOW
# ---------------------------------------------------------------------------

def _resolve_quantity_g(item, usda_serving_weight):
    """
    Resolve the quantity in grams for a food item.
    Priority: explicit grams from unit conversion > USDA serving weight > PIECE_WEIGHTS > 100g default.
    """
    if item["quantity_g"] is not None:
        return round(item["quantity_g"], 1)

    # Try USDA serving weight for piece-based items
    if usda_serving_weight and item["unit"] == "piece":
        return round(item["quantity"] * usda_serving_weight, 1)

    # Try PIECE_WEIGHTS lookup
    food_lower = item["name"].lower().strip()
    for key, weight in PIECE_WEIGHTS.items():
        if key in food_lower or food_lower in key:
            return round(item["quantity"] * weight, 1)

    # Default: 100g per piece
    return round(item["quantity"] * 100, 1)


def _round1(value):
    """Round to 1 decimal place."""
    return round(float(value), 1)


def detect_foods(user_input, meal_type="other"):
    """
    STEP 1: Detect foods from natural-language input and return a CONFIRMATION
    payload for the user to review, edit, and approve BEFORE logging.

    NO database writes. NO auto-logging. Returns suggestions only.

    Args:
        user_input: Natural language food description
        meal_type: One of 'breakfast', 'lunch', 'dinner', 'snack', 'other'

    Returns:
        dict with:
            status: 'confirm' | 'clarify' | 'error'
            meal_type: normalized meal type
            items: list of detected food items with USDA match info
            clarifications: list of items needing user clarification
    """
    meal_type = meal_type.lower().strip()
    if meal_type not in ("breakfast", "lunch", "dinner", "snack", "other"):
        meal_type = "other"

    parsed_items = parse_food_input(user_input)
    if not parsed_items:
        return {
            "status": "error",
            "error": "Could not parse any food items from your input. Try something like '2 eggs and 1 cup rice'.",
            "user_input": user_input,
        }

    detected = []
    clarifications = []

    for item in parsed_items:
        try:
            # Check for composite/Indian foods
            composite = _check_composite(item["name"])
            search_term = composite["search"] if composite else item["name"]

            # Search USDA
            search_results = search_usda_food(search_term)

            # Apply semantic safety filter
            search_results = _semantic_filter(item["name"], search_results)

            if not search_results:
                clarifications.append({
                    "original_input": item["name"],
                    "quantity": item["quantity"],
                    "unit": item["unit"],
                    "reason": f"No USDA match found for '{item['name']}'. Please rephrase or choose a different food.",
                    "suggestions": [],
                })
                continue

            # Best match
            best = search_results[0]
            confidence = _compute_confidence(item["name"], best)
            macros_preview = extract_macros_from_search_result(best)

            # Resolve quantity
            quantity_g = _resolve_quantity_g(item, macros_preview["serving_weight_g"])
            factor = quantity_g / 100.0

            entry = {
                "original_input": item["name"],
                "matched_name": macros_preview["food_name"],
                "fdc_id": macros_preview.get("fdc_id"),
                "data_type": macros_preview.get("data_type", ""),
                "confidence": confidence,
                "quantity": item["quantity"],
                "unit": item["unit"],
                "quantity_g": _round1(quantity_g),
                "calories": _round1(macros_preview["calories"] * factor),
                "protein": _round1(macros_preview["protein"] * factor),
                "carbs": _round1(macros_preview["carbs"] * factor),
                "fats": _round1(macros_preview["fats"] * factor),
                "per_100g": {
                    "calories": _round1(macros_preview["calories"]),
                    "protein": _round1(macros_preview["protein"]),
                    "carbs": _round1(macros_preview["carbs"]),
                    "fats": _round1(macros_preview["fats"]),
                },
                "note": composite["note"] if composite else None,
                # Alternative matches (top 3 excluding best)
                "alternatives": [
                    {
                        "name": extract_macros_from_search_result(alt)["food_name"],
                        "fdc_id": alt.get("fdcId"),
                        "data_type": alt.get("dataType", ""),
                        "confidence": _compute_confidence(item["name"], alt),
                    }
                    for alt in search_results[1:4]
                ],
            }
            detected.append(entry)

        except Exception as e:
            clarifications.append({
                "original_input": item["name"],
                "quantity": item["quantity"],
                "unit": item["unit"],
                "reason": f"Error looking up '{item['name']}': {str(e)}",
                "suggestions": [],
            })

    # Determine overall status
    if not detected and clarifications:
        status = "clarify"
    elif clarifications:
        status = "confirm"  # Some matched, some need clarification
    else:
        status = "confirm"

    result = {
        "status": status,
        "meal_type": meal_type.capitalize(),
        "items": detected,
        "user_input": user_input,
    }
    if clarifications:
        result["clarifications"] = clarifications

    return result


def process_confirmed_foods(confirmed_items, meal_type="other"):
    """
    STEP 2: Process user-confirmed foods into final meal entries ready for logging.

    Only called AFTER user has reviewed and confirmed the detection results.
    Each item in confirmed_items should have: name, fdc_id, quantity_g, and optionally
    the pre-calculated macros (to avoid re-fetching).

    Args:
        confirmed_items: List of confirmed food dicts from the frontend
        meal_type: Meal type string

    Returns:
        dict with meal_type, foods[], total{}
    """
    meal_type = meal_type.lower().strip()
    if meal_type not in ("breakfast", "lunch", "dinner", "snack", "other"):
        meal_type = "other"

    foods = []

    for item in confirmed_items:
        food_entry = {
            "name": item.get("name", item.get("matched_name", "Unknown")),
            "quantity_g": _round1(item.get("quantity_g", 100)),
            "calories": _round1(item.get("calories", 0)),
            "protein": _round1(item.get("protein", 0)),
            "carbs": _round1(item.get("carbs", 0)),
            "fats": _round1(item.get("fats", 0)),
            "fdc_id": item.get("fdc_id"),
            "data_type": item.get("data_type", ""),
            "original_input": item.get("original_input", ""),
        }
        foods.append(food_entry)

    total = {
        "calories": _round1(sum(f["calories"] for f in foods)),
        "protein": _round1(sum(f["protein"] for f in foods)),
        "carbs": _round1(sum(f["carbs"] for f in foods)),
        "fats": _round1(sum(f["fats"] for f in foods)),
    }

    return {
        "meal_type": meal_type.capitalize(),
        "foods": foods,
        "total": total,
    }


def process_meal(user_input, meal_type="other"):
    """
    Legacy / convenience entry point — runs detect_foods() and immediately
    returns the result. The frontend should use detect_foods() + process_confirmed_foods()
    for the full 2-step confirmation flow.
    """
    return detect_foods(user_input, meal_type)


def search_foods(query, limit=8):
    """
    Search USDA for foods matching a query. Returns simplified results
    for autocomplete/search UI.
    """
    try:
        results = search_usda_food(query, page_size=limit)
        return [
            {
                "fdc_id": f.get("fdcId"),
                "name": f.get("description", ""),
                "data_type": f.get("dataType", ""),
                "brand": f.get("brandName", "") or f.get("brandOwner", ""),
                "calories": next(
                    (n.get("value", 0) for n in f.get("foodNutrients", [])
                     if n.get("nutrientId") == 1008),
                    0
                ),
            }
            for f in results
        ]
    except Exception:
        return []
