// ========================================
// Nutrition Experience
// ========================================

const NUTRITION_SAVED_KEY_BASE = 'fittrack_saved_meals_v1';
function nutritionSavedMealsStorageKey() {
  return activeDemoUserId ? (NUTRITION_SAVED_KEY_BASE + '_' + activeDemoUserId) : NUTRITION_SAVED_KEY_BASE;
}

const nutritionState = {
  weightGoal: 'maintain',
  baseGoals: {
    calories: 2200,
    protein: 140,
    carbs: 250,
    fats: 60
  },
  entries: [],
  savedMeals: [],
  showForm: false,
  showSavedMeals: true,
  activeMealType: 'breakfast'
};
let mealsLoadRequestId = 0;

const nutritionFoodDatabase = {
  carbohydrates: [
    // Grains & Cereals
    { id: 'white_rice_cooked', name: 'White rice (cooked)', calories: 130, protein: 2.4, carbs: 28, fats: 0.3, unit: 'grams' },
    { id: 'brown_rice_cooked', name: 'Brown rice (cooked)', calories: 111, protein: 2.6, carbs: 23, fats: 0.9, unit: 'grams' },
    { id: 'oats_dry', name: 'Oats (dry)', calories: 389, protein: 17, carbs: 66, fats: 7, unit: 'grams' },
    { id: 'whole_wheat_bread', name: 'Whole wheat bread', calories: 247, protein: 13, carbs: 41, fats: 4.2, unit: 'grams' },
    { id: 'white_bread', name: 'White bread', calories: 265, protein: 9, carbs: 49, fats: 3.2, unit: 'grams' },
    { id: 'pasta_cooked', name: 'Pasta (cooked)', calories: 131, protein: 5, carbs: 25, fats: 1.1, unit: 'grams' },
    { id: 'quinoa_cooked', name: 'Quinoa (cooked)', calories: 120, protein: 4.4, carbs: 21, fats: 1.9, unit: 'grams' },
    { id: 'sweet_potato', name: 'Sweet potato', calories: 86, protein: 1.6, carbs: 20, fats: 0.1, unit: 'grams' },
    { id: 'potato', name: 'Potato', calories: 77, protein: 2, carbs: 17, fats: 0.1, unit: 'grams' },
    { id: 'jasmine_rice_cooked', name: 'Jasmine rice (cooked)', calories: 130, protein: 2.5, carbs: 28, fats: 0.3, unit: 'grams' },
    { id: 'basmati_rice_cooked', name: 'Basmati rice (cooked)', calories: 130, protein: 2.7, carbs: 28, fats: 0.3, unit: 'grams' },
    { id: 'wild_rice_cooked', name: 'Wild rice (cooked)', calories: 101, protein: 3.9, carbs: 19, fats: 0.3, unit: 'grams' },
    { id: 'rye_bread', name: 'Rye bread', calories: 259, protein: 8, carbs: 48, fats: 3.3, unit: 'grams' },
    { id: 'sourdough_bread', name: 'Sourdough bread', calories: 290, protein: 9, carbs: 54, fats: 1.5, unit: 'grams' },
    { id: 'bagel', name: 'Bagel', calories: 245, protein: 9, carbs: 48, fats: 1.5, unit: 'grams' },
    { id: 'cereal_granola', name: 'Granola cereal', calories: 471, protein: 12, carbs: 63, fats: 20, unit: 'grams' },
    { id: 'bran_cereal', name: 'Bran cereal', calories: 354, protein: 7, carbs: 81, fats: 1.4, unit: 'grams' },
    { id: 'muesli', name: 'Muesli', calories: 363, protein: 10, carbs: 64, fats: 8, unit: 'grams' },
    { id: 'corn_flakes', name: 'Corn flakes', calories: 381, protein: 7, carbs: 85, fats: 0.9, unit: 'grams' },
    { id: 'couscous_cooked', name: 'Couscous (cooked)', calories: 112, protein: 3.8, carbs: 23, fats: 0.1, unit: 'grams' },
    { id: 'whole_wheat_pasta', name: 'Whole wheat pasta (cooked)', calories: 124, protein: 5.3, carbs: 26, fats: 0.5, unit: 'grams' },
    { id: 'noodles_ramen', name: 'Ramen noodles (cooked)', calories: 138, protein: 4.5, carbs: 25, fats: 4.3, unit: 'grams' },
    { id: 'barley_cooked', name: 'Barley (cooked)', calories: 95, protein: 2.3, carbs: 22, fats: 0.4, unit: 'grams' },
    { id: 'millet_cooked', name: 'Millet (cooked)', calories: 119, protein: 3.5, carbs: 23, fats: 1, unit: 'grams' },
    { id: 'buckwheat_cooked', name: 'Buckwheat (cooked)', calories: 92, protein: 3.4, carbs: 20, fats: 0.6, unit: 'grams' },
    // Vegetables
    { id: 'broccoli_raw', name: 'Broccoli (raw)', calories: 34, protein: 2.8, carbs: 7, fats: 0.4, unit: 'grams' },
    { id: 'carrot_raw', name: 'Carrot (raw)', calories: 41, protein: 0.9, carbs: 10, fats: 0.2, unit: 'grams' },
    { id: 'spinach_raw', name: 'Spinach (raw)', calories: 23, protein: 2.7, carbs: 3.6, fats: 0.4, unit: 'grams' },
    { id: 'kale_raw', name: 'Kale (raw)', calories: 49, protein: 4.3, carbs: 9, fats: 0.9, unit: 'grams' },
    { id: 'lettuce_raw', name: 'Lettuce (raw)', calories: 15, protein: 1.2, carbs: 2.9, fats: 0.2, unit: 'grams' },
    { id: 'bell_pepper', name: 'Bell pepper (red)', calories: 31, protein: 1, carbs: 6, fats: 0.3, unit: 'grams' },
    { id: 'cucumber', name: 'Cucumber (raw)', calories: 16, protein: 0.7, carbs: 3.6, fats: 0.1, unit: 'grams' },
    { id: 'tomato_raw', name: 'Tomato (raw)', calories: 18, protein: 0.9, carbs: 3.9, fats: 0.2, unit: 'grams' },
    { id: 'onion_raw', name: 'Onion (raw)', calories: 40, protein: 1.1, carbs: 9, fats: 0.1, unit: 'grams' },
    { id: 'garlic_raw', name: 'Garlic (raw)', calories: 149, protein: 6.4, carbs: 33, fats: 0.5, unit: 'grams' },
    { id: 'zucchini', name: 'Zucchini (raw)', calories: 21, protein: 1.5, carbs: 3.5, fats: 0.4, unit: 'grams' },
    { id: 'eggplant_raw', name: 'Eggplant (raw)', calories: 25, protein: 0.98, carbs: 5.9, fats: 0.2, unit: 'grams' },
    { id: 'asparagus_raw', name: 'Asparagus (raw)', calories: 27, protein: 3, carbs: 5, fats: 0.1, unit: 'grams' },
    { id: 'peas_cooked', name: 'Peas (cooked)', calories: 81, protein: 5.4, carbs: 14, fats: 0.4, unit: 'grams' },
    { id: 'corn_cooked', name: 'Corn (cooked)', calories: 96, protein: 3.4, carbs: 21, fats: 1.5, unit: 'grams' },
    { id: 'green_beans', name: 'Green beans (raw)', calories: 31, protein: 1.8, carbs: 7, fats: 0.2, unit: 'grams' },
    { id: 'cauliflower_raw', name: 'Cauliflower (raw)', calories: 25, protein: 1.9, carbs: 5, fats: 0.3, unit: 'grams' },
    { id: 'mushroom_raw', name: 'Mushroom (raw)', calories: 22, protein: 3.1, carbs: 3.3, fats: 0.3, unit: 'grams' },
    { id: 'cabbage_raw', name: 'Cabbage (raw)', calories: 25, protein: 1.3, carbs: 5.8, fats: 0.1, unit: 'grams' },
    { id: 'brussels_sprouts', name: 'Brussels sprouts (raw)', calories: 43, protein: 3.4, carbs: 8, fats: 0.3, unit: 'grams' },
    { id: 'artichoke', name: 'Artichoke (raw)', calories: 47, protein: 3.3, carbs: 10, fats: 0.1, unit: 'grams' },
    { id: 'beet_raw', name: 'Beet (raw)', calories: 43, protein: 1.6, carbs: 10, fats: 0.2, unit: 'grams' },
    { id: 'radish_raw', name: 'Radish (raw)', calories: 16, protein: 0.7, carbs: 3.4, fats: 0.1, unit: 'grams' },
    // Fruits
    { id: 'apple', name: 'Apple (medium)', calories: 52, protein: 0.3, carbs: 14, fats: 0.2, unit: 'grams' },
    { id: 'banana', name: 'Banana (medium)', calories: 89, protein: 1.1, carbs: 23, fats: 0.3, unit: 'grams' },
    { id: 'orange', name: 'Orange (medium)', calories: 47, protein: 0.9, carbs: 12, fats: 0.3, unit: 'grams' },
    { id: 'blueberries', name: 'Blueberries', calories: 57, protein: 0.7, carbs: 14, fats: 0.3, unit: 'grams' },
    { id: 'strawberries', name: 'Strawberries', calories: 32, protein: 0.8, carbs: 8, fats: 0.3, unit: 'grams' },
    { id: 'grapes', name: 'Grapes (red)', calories: 67, protein: 0.6, carbs: 17, fats: 0.2, unit: 'grams' },
    { id: 'watermelon', name: 'Watermelon', calories: 30, protein: 0.6, carbs: 8, fats: 0.2, unit: 'grams' },
    { id: 'mango', name: 'Mango (raw)', calories: 60, protein: 0.8, carbs: 15, fats: 0.4, unit: 'grams' },
    { id: 'pineapple', name: 'Pineapple (raw)', calories: 50, protein: 0.5, carbs: 13, fats: 0.1, unit: 'grams' },
    { id: 'kiwi', name: 'Kiwi (fruits)', calories: 61, protein: 1.1, carbs: 15, fats: 0.5, unit: 'grams' },
    { id: 'pear', name: 'Pear (medium)', calories: 57, protein: 0.4, carbs: 15, fats: 0.1, unit: 'grams' },
    { id: 'peach', name: 'Peach (medium)', calories: 39, protein: 0.9, carbs: 10, fats: 0.3, unit: 'grams' },
    { id: 'plum', name: 'Plum (medium)', calories: 30, protein: 0.5, carbs: 7, fats: 0.2, unit: 'grams' },
    { id: 'papaya', name: 'Papaya (raw)', calories: 43, protein: 0.5, carbs: 11, fats: 0.3, unit: 'grams' },
    { id: 'coconut_meat', name: 'Coconut meat (dried)', calories: 660, protein: 7.3, carbs: 24, fats: 64, unit: 'grams' },
    { id: 'date', name: 'Date (dried)', calories: 282, protein: 2.5, carbs: 75, fats: 0.15, unit: 'grams' },
    { id: 'raisin', name: 'Raisins', calories: 299, protein: 3.1, carbs: 79, fats: 0.5, unit: 'grams' },
    { id: 'fig_dried', name: 'Figs (dried)', calories: 249, protein: 3.3, carbs: 64, fats: 0.9, unit: 'grams' },
    { id: 'avocado', name: 'Avocado (raw)', calories: 160, protein: 2, carbs: 9, fats: 15, unit: 'grams' },
    { id: 'lemon', name: 'Lemon (raw)', calories: 29, protein: 1.1, carbs: 9, fats: 0.3, unit: 'grams' },
    { id: 'lime', name: 'Lime (raw)', calories: 30, protein: 0.7, carbs: 11, fats: 0.2, unit: 'grams' },
    // Legumes & Pulses
    { id: 'lentils_cooked', name: 'Lentils (cooked)', calories: 116, protein: 9, carbs: 20, fats: 0.4, unit: 'grams' },
    { id: 'beans_black_cooked', name: 'Black beans (cooked)', calories: 132, protein: 8.9, carbs: 24, fats: 0.5, unit: 'grams' },
    { id: 'beans_kidney_cooked', name: 'Kidney beans (cooked)', calories: 127, protein: 8.7, carbs: 23, fats: 0.4, unit: 'grams' },
    { id: 'peas_dry_cooked', name: 'Split peas (cooked)', calories: 118, protein: 8.2, carbs: 21, fats: 0.4, unit: 'grams' },
    { id: 'chickpeas_cooked', name: 'Chickpeas (cooked)', calories: 134, protein: 7.2, carbs: 23, fats: 2.1, unit: 'grams' },
    { id: 'peanuts', name: 'Peanuts (dry roasted)', calories: 567, protein: 26, carbs: 20, fats: 49, unit: 'grams' },
    { id: 'peanut_butter', name: 'Peanut butter', calories: 94, protein: 4, carbs: 3.5, fats: 8, unit: 'tablespoon' }
  ],
  proteins: [
    // Poultry
    { id: 'chicken_breast_cooked_skinless', name: 'Chicken breast (cooked, skinless)', calories: 165, protein: 31, carbs: 0, fats: 3.6, unit: 'grams' },
    { id: 'chicken_thigh_cooked', name: 'Chicken thigh (cooked, skinless)', calories: 209, protein: 26, carbs: 0, fats: 11, unit: 'grams' },
    { id: 'turkey_breast_cooked', name: 'Turkey breast (cooked)', calories: 189, protein: 29, carbs: 0, fats: 7.4, unit: 'grams' },
    { id: 'duck_cooked', name: 'Duck (cooked)', calories: 337, protein: 19, carbs: 0, fats: 29, unit: 'grams' },
    { id: 'chicken_ground_cooked', name: 'Ground chicken (cooked)', calories: 165, protein: 23, carbs: 0, fats: 7.4, unit: 'grams' },
    { id: 'turkey_ground_cooked', name: 'Ground turkey (cooked)', calories: 200, protein: 29, carbs: 0, fats: 8.7, unit: 'grams' },
    // Beef
    { id: 'ground_beef_85_lean', name: 'Ground beef (85% lean)', calories: 217, protein: 23, carbs: 0, fats: 13, unit: 'grams' },
    { id: 'ground_beef_93_lean', name: 'Ground beef (93% lean)', calories: 174, protein: 24, carbs: 0, fats: 8, unit: 'grams' },
    { id: 'beef_sirloin_lean', name: 'Beef sirloin (lean)', calories: 180, protein: 27, carbs: 0, fats: 8, unit: 'grams' },
    { id: 'beef_rib_eye', name: 'Beef rib eye', calories: 291, protein: 24, carbs: 0, fats: 23, unit: 'grams' },
    { id: 'beef_chuck_roast', name: 'Beef chuck roast', calories: 288, protein: 24, carbs: 0, fats: 21, unit: 'grams' },
    { id: 'beef_stew_meat', name: 'Beef stew meat (cooked)', calories: 198, protein: 32, carbs: 0, fats: 8, unit: 'grams' },
    { id: 'lean_ground_beef', name: 'Lean ground beef (90%)', calories: 176, protein: 24, carbs: 0, fats: 8, unit: 'grams' },
    // Fish & Seafood
    { id: 'salmon_atlantic', name: 'Salmon (Atlantic)', calories: 208, protein: 20, carbs: 0, fats: 13, unit: 'grams' },
    { id: 'salmon_wild', name: 'Salmon (wild)', calories: 182, protein: 25, carbs: 0, fats: 8.1, unit: 'grams' },
    { id: 'tuna_canned_water', name: 'Tuna (canned, water)', calories: 116, protein: 26, carbs: 0, fats: 1, unit: 'grams' },
    { id: 'tuna_fresh_cooked', name: 'Tuna (fresh, cooked)', calories: 144, protein: 29, carbs: 0, fats: 1.3, unit: 'grams' },
    { id: 'cod_cooked', name: 'Cod (cooked)', calories: 82, protein: 18, carbs: 0, fats: 0.7, unit: 'grams' },
    { id: 'tilapia_cooked', name: 'Tilapia (cooked)', calories: 128, protein: 26, carbs: 0, fats: 2.7, unit: 'grams' },
    { id: 'halibut_cooked', name: 'Halibut (cooked)', calories: 111, protein: 21, carbs: 0, fats: 2.3, unit: 'grams' },
    { id: 'mackerel_cooked', name: 'Mackerel (cooked)', calories: 305, protein: 21, carbs: 0, fats: 25, unit: 'grams' },
    { id: 'sardines_canned', name: 'Sardines (canned, oil)', calories: 208, protein: 20, carbs: 0, fats: 13, unit: 'grams' },
    { id: 'trout_cooked', name: 'Trout (cooked)', calories: 148, protein: 21, carbs: 0, fats: 7, unit: 'grams' },
    { id: 'shrimp_cooked', name: 'Shrimp (cooked)', calories: 99, protein: 24, carbs: 0, fats: 0.3, unit: 'grams' },
    { id: 'crab_cooked', name: 'Crab (cooked)', calories: 102, protein: 20, carbs: 0, fats: 2, unit: 'grams' },
    { id: 'lobster_cooked', name: 'Lobster (cooked)', calories: 90, protein: 19, carbs: 1.3, fats: 0.9, unit: 'grams' },
    { id: 'oysters_cooked', name: 'Oysters (cooked)', calories: 81, protein: 9.4, carbs: 7, fats: 2.2, unit: 'grams' },
    // Eggs (per 1 whole/unit)
    { id: 'whole_egg', name: 'Whole egg', calories: 78, protein: 6.5, carbs: 0.6, fats: 5.5, unit: 'whole' },
    { id: 'egg_white', name: 'Egg white', calories: 17, protein: 3.6, carbs: 0.2, fats: 0.2, unit: 'whole' },
    { id: 'egg_yolk', name: 'Egg yolk', calories: 55, protein: 2.7, carbs: 0.3, fats: 5.1, unit: 'whole' },
    // Dairy
    { id: 'greek_yogurt_nonfat', name: 'Greek yogurt (nonfat)', calories: 59, protein: 10, carbs: 4, fats: 0.4, unit: 'grams' },
    { id: 'greek_yogurt_full_fat', name: 'Greek yogurt (full-fat)', calories: 100, protein: 10, carbs: 4, fats: 5, unit: 'grams' },
    { id: 'cottage_cheese_low_fat', name: 'Cottage cheese (low-fat)', calories: 98, protein: 11, carbs: 3.4, fats: 4.3, unit: 'grams' },
    { id: 'milk_2percent', name: 'Milk (2%)', calories: 49, protein: 3.3, carbs: 4.8, fats: 1.9, unit: 'grams' },
    { id: 'milk_skim', name: 'Milk (skim)', calories: 34, protein: 3.4, carbs: 4.8, fats: 0.1, unit: 'grams' },
    { id: 'milk_whole', name: 'Milk (whole)', calories: 60, protein: 3.2, carbs: 4.8, fats: 3.2, unit: 'grams' },
    { id: 'kefir', name: 'Kefir (plain)', calories: 60, protein: 3.4, carbs: 4, fats: 3.5, unit: 'grams' },
    { id: 'cheese_cheddar', name: 'Cheese (cheddar)', calories: 403, protein: 23, carbs: 1.3, fats: 33, unit: 'grams' },
    { id: 'cheese_mozzarella', name: 'Cheese (mozzarella)', calories: 280, protein: 28, carbs: 3.1, fats: 17, unit: 'grams' },
    { id: 'cheese_feta', name: 'Cheese (feta)', calories: 264, protein: 14, carbs: 4.1, fats: 21, unit: 'grams' },
    { id: 'cheese_parmesan', name: 'Cheese (parmesan)', calories: 392, protein: 38, carbs: 4.1, fats: 29, unit: 'grams' },
    // Plant-Based Proteins
    { id: 'tofu_firm', name: 'Tofu (firm)', calories: 144, protein: 17, carbs: 3, fats: 9, unit: 'grams' },
    { id: 'tofu_silken', name: 'Tofu (silken)', calories: 61, protein: 6.6, carbs: 1.6, fats: 3.5, unit: 'grams' },
    { id: 'tempeh', name: 'Tempeh (fermented)', calories: 192, protein: 19, carbs: 9, fats: 11, unit: 'grams' },
    { id: 'edamame', name: 'Edamame (cooked)', calories: 111, protein: 11.1, carbs: 10, fats: 5, unit: 'grams' },
    { id: 'hemp_seeds', name: 'Hemp seeds', calories: 560, protein: 31, carbs: 12, fats: 48, unit: 'grams' },
    { id: 'chia_seeds', name: 'Chia seeds', calories: 60, protein: 2.1, carbs: 5, fats: 3.8, unit: 'tablespoon' },
    { id: 'seitan', name: 'Seitan (wheat gluten)', calories: 370, protein: 25, carbs: 14, fats: 5, unit: 'grams' },
    { id: 'textured_vegetable_protein', name: 'Textured vegetable protein (TVP)', calories: 275, protein: 50, carbs: 18, fats: 1.3, unit: 'grams' },
    // Processed Meats
    { id: 'turkey_deli_meat', name: 'Turkey deli meat', calories: 207, protein: 25, carbs: 1.4, fats: 11, unit: 'grams' },
    { id: 'chicken_deli_meat', name: 'Chicken deli meat', calories: 180, protein: 23, carbs: 0, fats: 9.3, unit: 'grams' },
    { id: 'bacon_cooked', name: 'Bacon (cooked)', calories: 541, protein: 37, carbs: 0.1, fats: 43, unit: 'grams' },
    { id: 'sausage_pork', name: 'Pork sausage (cooked)', calories: 301, protein: 27, carbs: 1.5, fats: 23, unit: 'grams' },
    // Nuts & Seeds (High in both protein and healthy fats)
    { id: 'almonds', name: 'Almonds', calories: 579, protein: 21, carbs: 22, fats: 50, unit: 'grams' },
    { id: 'walnuts', name: 'Walnuts', calories: 654, protein: 15, carbs: 14, fats: 65, unit: 'grams' },
    { id: 'cashews', name: 'Cashews', calories: 553, protein: 18, carbs: 30, fats: 44, unit: 'grams' },
    { id: 'pistachios', name: 'Pistachios', calories: 560, protein: 20, carbs: 28, fats: 45, unit: 'grams' },
    { id: 'sunflower_seeds', name: 'Sunflower seeds', calories: 70, protein: 2.9, carbs: 2.6, fats: 6.1, unit: 'tablespoon' },
    { id: 'pumpkin_seeds', name: 'Pumpkin seeds', calories: 67, protein: 3, carbs: 1.3, fats: 5.9, unit: 'tablespoon' },
    { id: 'flax_seeds', name: 'Flax seeds', calories: 64, protein: 2.1, carbs: 3.4, fats: 5, unit: 'tablespoon' },
    { id: 'peanut_butter', name: 'Peanut butter', calories: 94, protein: 4, carbs: 3.5, fats: 8, unit: 'tablespoon' }
  ]
};

const nutritionBuilderState = {
  mode: 'manual',
  items: [],
  totals: { calories: 0, protein: 0, carbs: 0, fats: 0 }
};

function todayDateKey() {
  if (typeof toLocalDateKey === 'function') {
    return toLocalDateKey(new Date());
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function normalizeMealType(mealType) {
  const key = String(mealType || 'other').toLowerCase();
  const map = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
    other: 'Other'
  };
  return map[key] || 'Other';
}

function parseMacro(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nutritionRound(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function nutritionBuilderFindFood(category, foodId) {
  const foods = nutritionFoodDatabase[category] || [];
  return foods.find(food => food.id === foodId) || null;
}

function nutritionBuildItemFromFood(food, category, quantity) {
  let ratio = 1;
  let displayQuantity = quantity;
  
  // Convert based on unit type
  if (food.unit === 'whole') {
    // For whole units (like eggs), quantity is already in units
    ratio = quantity;
    displayQuantity = quantity;
  } else if (food.unit === 'tablespoon') {
    // For tablespoons, convert to relative units (1 tbsp ≈ 15g)
    ratio = (quantity * 15) / 100;
    displayQuantity = quantity;
  } else {
    // For grams (default)
    ratio = Math.max(0, Number(quantity) || 0) / 100;
    displayQuantity = quantity;
  }
  
  return {
    id: `${food.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    foodId: food.id,
    category,
    name: food.name,
    unit: food.unit || 'grams',
    displayQuantity: Math.max(0, Number(displayQuantity) || 0),
    grams: food.unit === 'whole' ? (quantity * 50) : (food.unit === 'tablespoon' ? (quantity * 15) : displayQuantity),
    calories: nutritionRound(food.calories * ratio),
    protein: nutritionRound(food.protein * ratio),
    carbs: nutritionRound(food.carbs * ratio),
    fats: nutritionRound(food.fats * ratio)
  };
}

function nutritionCalculateBuilderTotals() {
  const totals = nutritionBuilderState.items.reduce((acc, item) => ({
    calories: acc.calories + parseMacro(item.calories),
    protein: acc.protein + parseMacro(item.protein),
    carbs: acc.carbs + parseMacro(item.carbs),
    fats: acc.fats + parseMacro(item.fats)
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  nutritionBuilderState.totals = {
    calories: nutritionRound(totals.calories),
    protein: nutritionRound(totals.protein),
    carbs: nutritionRound(totals.carbs),
    fats: nutritionRound(totals.fats)
  };
}

function nutritionPopulateFoodOptions() {
  const categoryEl = document.getElementById('nutrition-builder-category');
  const foodEl = document.getElementById('nutrition-builder-food');
  if (!categoryEl || !foodEl) return;

  const category = categoryEl.value || 'carbohydrates';
  const foods = nutritionFoodDatabase[category] || [];
  foodEl.innerHTML = foods.map((food) => `<option value="${food.id}">${escapeHtml(food.name)}</option>`).join('');
  
  // Update quantity label and input for first food
  nutritionUpdateQuantityLabel();
}

function nutritionUpdateQuantityLabel() {
  const categoryEl = document.getElementById('nutrition-builder-category');
  const foodEl = document.getElementById('nutrition-builder-food');
  const gramsEl = document.getElementById('nutrition-builder-grams');
  const labelEl = document.getElementById('nutrition-builder-qty-label');
  
  if (!categoryEl || !foodEl || !gramsEl || !labelEl) return;

  const category = categoryEl.value || 'carbohydrates';
  const food = nutritionBuilderFindFood(category, foodEl.value);
  
  if (!food) return;

  const unit = food.unit || 'grams';
  let label = 'Quantity (g)';
  let step = '50';
  let placeholder = '100';
  let defaultValue = '100';

  if (unit === 'whole') {
    label = 'Quantity (whole)';
    step = '1';
    placeholder = '1';
    defaultValue = '1';
  } else if (unit === 'tablespoon') {
    label = 'Quantity (tbsp)';
    step = '0.5';
    placeholder = '1';
    defaultValue = '1';
  }

  labelEl.textContent = label;
  gramsEl.step = step;
  gramsEl.placeholder = placeholder;
  gramsEl.value = defaultValue;
  gramsEl.min = unit === 'grams' ? '50' : '1';
}

function nutritionUpdateBuilderMacroInputs() {
  const calEl = document.getElementById('nutrition-form-calories');
  const proEl = document.getElementById('nutrition-form-protein');
  const carbEl = document.getElementById('nutrition-form-carbs');
  const fatEl = document.getElementById('nutrition-form-fats');

  if (calEl) calEl.value = String(nutritionBuilderState.totals.calories);
  if (proEl) proEl.value = String(nutritionBuilderState.totals.protein);
  if (carbEl) carbEl.value = String(nutritionBuilderState.totals.carbs);
  if (fatEl) fatEl.value = String(nutritionBuilderState.totals.fats);
}

function nutritionBuilderSummaryName() {
  if (!nutritionBuilderState.items.length) return '';
  return nutritionBuilderState.items
    .map(item => {
      let quantityStr = `${Math.round(item.grams)}g`;
      if (item.unit === 'whole') {
        quantityStr = `${item.displayQuantity} whole`;
      } else if (item.unit === 'tablespoon') {
        quantityStr = `${item.displayQuantity} tbsp`;
      }
      return `${item.name} (${quantityStr})`;
    })
    .join(', ');
}

function renderNutritionBuilderList() {
  const listEl = document.getElementById('nutrition-builder-list');
  const totalsEl = document.getElementById('nutrition-builder-totals');
  if (!listEl || !totalsEl) return;

  if (nutritionBuilderState.items.length === 0) {
    listEl.innerHTML = '<div class="nutrition-empty" style="margin-top: 10px;">No foods added yet.</div>';
    totalsEl.innerHTML = '';
    nutritionCalculateBuilderTotals();
    nutritionUpdateBuilderMacroInputs();
    return;
  }

  listEl.innerHTML = nutritionBuilderState.items.map((item) => {
    let quantityDisplay = `${Math.round(item.grams)}g`;
    if (item.unit === 'whole') {
      quantityDisplay = `${item.displayQuantity} ${item.displayQuantity === 1 ? 'whole' : 'wholes'}`;
    } else if (item.unit === 'tablespoon') {
      quantityDisplay = `${item.displayQuantity} tbsp`;
    }
    
    return `
    <div class="nutrition-builder-item">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${item.category === 'carbohydrates' ? 'Carbohydrates' : 'Proteins'}</small>
      </div>
      <div><small>${quantityDisplay}</small></div>
      <div class="nutrition-builder-item-macros">
        <span>${nutritionRound(item.calories)} cal</span>
        <span>P ${nutritionRound(item.protein)}g</span>
        <span>C ${nutritionRound(item.carbs)}g</span>
        <span>F ${nutritionRound(item.fats)}g</span>
      </div>
      <button type="button" class="nutrition-builder-remove" data-builder-remove-id="${item.id}">Remove</button>
    </div>
  `}).join('');

  nutritionCalculateBuilderTotals();
  nutritionUpdateBuilderMacroInputs();
  totalsEl.innerHTML = `
    <div><span>Calories</span><strong>${nutritionBuilderState.totals.calories}</strong></div>
    <div><span>Protein</span><strong>${nutritionBuilderState.totals.protein}g</strong></div>
    <div><span>Carbs</span><strong>${nutritionBuilderState.totals.carbs}g</strong></div>
    <div><span>Fats</span><strong>${nutritionBuilderState.totals.fats}g</strong></div>
  `;
}

function clearNutritionBuilderState() {
  nutritionBuilderState.items = [];
  nutritionCalculateBuilderTotals();
  nutritionUpdateBuilderMacroInputs();
  renderNutritionBuilderList();
}

function nutritionSetMode(modeValue) {
  const mode = modeValue === 'builder' ? 'builder' : 'manual';
  nutritionBuilderState.mode = mode;

  const manualSection = document.getElementById('nutrition-manual-fields');
  const builderSection = document.getElementById('nutrition-builder-fields');
  const caloriesEl = document.getElementById('nutrition-form-calories');
  const proteinEl = document.getElementById('nutrition-form-protein');
  const carbsEl = document.getElementById('nutrition-form-carbs');
  const fatsEl = document.getElementById('nutrition-form-fats');

  if (manualSection) manualSection.classList.toggle('nutrition-collapsed', mode !== 'manual');
  if (builderSection) builderSection.classList.toggle('nutrition-collapsed', mode !== 'builder');

  const manualRequired = mode === 'manual';
  [caloriesEl, proteinEl, carbsEl, fatsEl].forEach((el) => {
    if (!el) return;
    if (manualRequired) {
      el.setAttribute('required', 'required');
      el.readOnly = false;
    } else {
      el.removeAttribute('required');
      el.readOnly = true;
    }
  });

  if (mode === 'builder') {
    nutritionPopulateFoodOptions();
    renderNutritionBuilderList();
  }
}

function addNutritionBuilderItem() {
  const categoryEl = document.getElementById('nutrition-builder-category');
  const foodEl = document.getElementById('nutrition-builder-food');
  const gramsEl = document.getElementById('nutrition-builder-grams');
  if (!categoryEl || !foodEl || !gramsEl) return;

  const category = categoryEl.value || 'carbohydrates';
  const food = nutritionBuilderFindFood(category, foodEl.value);
  if (!food) return;

  let quantity = Math.max(1, parseMacro(gramsEl.value));
  
  // Apply rounding based on unit type
  if (food.unit === 'grams' || !food.unit) {
    // Round to nearest 50g for grams
    quantity = Math.round(quantity / 50) * 50;
    if (quantity === 0) quantity = 50;
  } else if (food.unit === 'whole') {
    // Round to whole number
    quantity = Math.max(1, Math.round(quantity));
  } else if (food.unit === 'tablespoon') {
    // Round to nearest 0.5
    quantity = Math.round(quantity * 2) / 2;
  }

  nutritionBuilderState.items.push(nutritionBuildItemFromFood(food, category, quantity));
  renderNutritionBuilderList();
}

function getGoalAdjustedCalories() {
  const dynamic = Number(profileState?.targetCalories);
  if (Number.isFinite(dynamic) && dynamic > 0) return dynamic;
  return nutritionState.baseGoals.calories;
}

function getWeekStartDate(currentDate) {
  const d = new Date(currentDate);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

function persistSavedMeals() {
  localStorage.setItem(nutritionSavedMealsStorageKey(), JSON.stringify(nutritionState.savedMeals));
}

function loadSavedMeals() {
  nutritionState.savedMeals = [];
  try {
    const raw = localStorage.getItem(nutritionSavedMealsStorageKey());
    if (!raw) {
      if (activeDemoUserId) {
        const seeded = deepClone((DEMO_USER_DUMMY_DATA[activeDemoUserId] && DEMO_USER_DUMMY_DATA[activeDemoUserId].savedMeals) || []);
        if (seeded.length) {
          nutritionState.savedMeals = seeded;
          persistSavedMeals();
        }
      }
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      nutritionState.savedMeals = parsed
        .filter(m => m && typeof m === 'object')
        .map((m) => ({
          ...m,
          meal_type: m.meal_type || m.meal || 'other',
          calories: Math.max(0, Number(m.calories) || 0),
          protein: Math.max(0, Number(m.protein) || 0),
          carbs: Math.max(0, Number(m.carbs) || 0),
          fats: Math.max(0, Number(m.fats) || 0)
        }));
      if (activeDemoUserId) {
        const seeded = deepClone((DEMO_USER_DUMMY_DATA[activeDemoUserId] && DEMO_USER_DUMMY_DATA[activeDemoUserId].savedMeals) || []);
        if (seeded.length) {
          const existingIds = new Set(nutritionState.savedMeals.map((m) => String(m.id)));
          seeded.forEach((meal) => {
            if (!existingIds.has(String(meal.id))) nutritionState.savedMeals.push(meal);
          });
        }
      }
      persistSavedMeals();
      if (activeDemoUserId && nutritionState.savedMeals.length === 0) {
        const seeded = deepClone((DEMO_USER_DUMMY_DATA[activeDemoUserId] && DEMO_USER_DUMMY_DATA[activeDemoUserId].savedMeals) || []);
        if (seeded.length) {
          nutritionState.savedMeals = seeded;
          persistSavedMeals();
        }
      }
    }
  } catch (_err) {
    nutritionState.savedMeals = [];
  }
}

function mealDateKey(entry) {
  const raw = String(entry?.date || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (raw.includes('T')) return raw.split('T')[0];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  if (typeof toLocalDateKey === 'function') return toLocalDateKey(parsed);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderNutritionGoals() {
  const goalCalories = getGoalAdjustedCalories();
  const titleEl = document.getElementById('nutrition-goal-title');
  const modeEl = document.getElementById('nutrition-goal-mode-label');
  if (titleEl) {
    if (nutritionState.weightGoal === 'loss') {
      titleEl.textContent = 'Calorie Deficit for Weight Loss';
    } else if (nutritionState.weightGoal === 'gain') {
      titleEl.textContent = 'Calorie Surplus for Weight Gain';
    } else {
      titleEl.textContent = 'Balanced Nutrition for Maintenance';
    }
  }
  if (modeEl) {
    modeEl.textContent = nutritionState.weightGoal === 'loss'
      ? 'Weight Loss'
      : nutritionState.weightGoal === 'gain'
        ? 'Weight Gain'
        : 'Weight Stability';
  }

  const caloriesEl = document.getElementById('nutrition-goal-calories');
  const proteinEl = document.getElementById('nutrition-goal-protein');
  const carbsEl = document.getElementById('nutrition-goal-carbs');
  const fatsEl = document.getElementById('nutrition-goal-fats');
  if (caloriesEl) caloriesEl.textContent = String(goalCalories);
  if (proteinEl) proteinEl.textContent = `${nutritionState.baseGoals.protein}g`;
  if (carbsEl) carbsEl.textContent = `${nutritionState.baseGoals.carbs}g`;
  if (fatsEl) fatsEl.textContent = `${nutritionState.baseGoals.fats}g`;

}

function renderNutritionToday() {
  const today = todayDateKey();
  const todayEntries = nutritionState.entries.filter(e => mealDateKey(e) === today);
  const totals = todayEntries.reduce((acc, e) => ({
    calories: acc.calories + parseMacro(e.calories),
    protein: acc.protein + parseMacro(e.protein),
    carbs: acc.carbs + parseMacro(e.carbs),
    fats: acc.fats + parseMacro(e.fats)
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const dateEl = document.getElementById('nutrition-today-date');
  if (dateEl) dateEl.textContent = formatDisplayDate(today);
  const calEl = document.getElementById('nutrition-today-calories');
  const proEl = document.getElementById('nutrition-today-protein');
  const carbEl = document.getElementById('nutrition-today-carbs');
  const fatEl = document.getElementById('nutrition-today-fats');
  if (calEl) calEl.textContent = String(Math.round(totals.calories));
  if (proEl) proEl.textContent = `${Math.round(totals.protein)}g`;
  if (carbEl) carbEl.textContent = `${Math.round(totals.carbs)}g`;
  if (fatEl) fatEl.textContent = `${Math.round(totals.fats)}g`;

  const targetCalories = Math.max(0, Number(getGoalAdjustedCalories()) || 0);
  const consumedCalories = Math.max(0, Math.round(totals.calories));
  const calorieProgress = targetCalories > 0 ? Math.max(0, Math.min(100, Math.round((consumedCalories / targetCalories) * 100))) : 0;
  const proteinProgress = nutritionState.baseGoals.protein > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, totals.protein) / nutritionState.baseGoals.protein) * 100)))
    : 0;
  const carbsProgress = nutritionState.baseGoals.carbs > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, totals.carbs) / nutritionState.baseGoals.carbs) * 100)))
    : 0;
  const fatsProgress = nutritionState.baseGoals.fats > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, totals.fats) / nutritionState.baseGoals.fats) * 100)))
    : 0;

  const calorieFillEl = document.getElementById('nutrition-calorie-progress-fill');
  const proteinFillEl = document.getElementById('nutrition-protein-progress-fill');
  const carbsFillEl = document.getElementById('nutrition-carbs-progress-fill');
  const fatsFillEl = document.getElementById('nutrition-fats-progress-fill');

  if (calorieFillEl) calorieFillEl.style.width = `${calorieProgress}%`;
  if (proteinFillEl) proteinFillEl.style.width = `${proteinProgress}%`;
  if (carbsFillEl) carbsFillEl.style.width = `${carbsProgress}%`;
  if (fatsFillEl) fatsFillEl.style.width = `${fatsProgress}%`;
}

function renderNutritionWeek() {
  const today = new Date(todayDateKey());
  const weekStart = getWeekStartDate(today);
  const thisWeekEntries = nutritionState.entries.filter((e) => {
    const key = mealDateKey(e);
    if (!key) return false;
    const parsed = new Date(`${key}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && parsed >= weekStart;
  });
  const thisWeekTotals = thisWeekEntries.reduce((acc, e) => ({
    calories: acc.calories + parseMacro(e.calories),
    protein: acc.protein + parseMacro(e.protein),
    carbs: acc.carbs + parseMacro(e.carbs),
    fats: acc.fats + parseMacro(e.fats)
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const days = new Set(thisWeekEntries.map(mealDateKey).filter(Boolean)).size;
  const avgCalories = days > 0 ? Math.round(thisWeekTotals.calories / days) : 0;
  const goalCalories = getGoalAdjustedCalories();
  const weeklyGoalCalories = goalCalories * 7;
  const weeklyDiff = Math.round(thisWeekTotals.calories - weeklyGoalCalories);

  const onTrack = nutritionState.weightGoal === 'loss'
    ? weeklyDiff <= 0
    : nutritionState.weightGoal === 'gain'
      ? weeklyDiff >= 0
      : Math.abs(weeklyDiff) <= 500;

  const goalTypeEl = document.getElementById('nutrition-week-goal-type');
  const avgEl = document.getElementById('nutrition-week-avg-cal');
  const targetEl = document.getElementById('nutrition-week-target');
  const diffEl = document.getElementById('nutrition-week-diff');
  const noteEl = document.getElementById('nutrition-week-note');
  const badgeEl = document.getElementById('nutrition-week-track-badge');

  if (goalTypeEl) {
    goalTypeEl.textContent = nutritionState.weightGoal === 'loss'
      ? 'Weight Loss'
      : nutritionState.weightGoal === 'gain'
        ? 'Weight Gain'
        : 'Maintain Weight';
  }

  if (avgEl) avgEl.textContent = `${avgCalories} cal`;
  if (targetEl) targetEl.textContent = `Target: ${goalCalories} cal/day`;
  if (diffEl) diffEl.textContent = `${weeklyDiff > 0 ? '+' : ''}${weeklyDiff} cal`;
  if (noteEl) {
    noteEl.textContent = nutritionState.weightGoal === 'loss'
      ? (weeklyDiff <= 0 ? 'Deficit maintained!' : 'Reduce intake')
      : nutritionState.weightGoal === 'gain'
        ? (weeklyDiff >= 0 ? 'Surplus achieved!' : 'Increase intake')
        : (Math.abs(weeklyDiff) <= 500 ? 'Balanced intake' : 'Adjust intake');
  }

  if (badgeEl) {
    badgeEl.textContent = onTrack ? 'On Track' : 'Adjust Intake';
    badgeEl.classList.toggle('off', !onTrack);
  }
}

function renderSavedMeals() {
  const section = document.getElementById('nutrition-saved-meals-section');
  const grid = document.getElementById('nutrition-saved-meals-grid');
  if (!section || !grid) return;

  section.classList.toggle('nutrition-collapsed', !nutritionState.showSavedMeals);
  if (!nutritionState.showSavedMeals) return;

  if (nutritionState.savedMeals.length === 0) {
    grid.innerHTML = '<div class="nutrition-empty">No saved meals yet. Save a meal from the form.</div>';
    return;
  }

  const orderedTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  if (!orderedTypes.includes(nutritionState.activeMealType)) {
    nutritionState.activeMealType = 'breakfast';
  }

  const byType = orderedTypes.reduce((acc, type) => {
    acc[type] = nutritionState.savedMeals.filter((m) => {
      const mealType = String(m.meal_type || m.meal || '').toLowerCase();
      return mealType === type;
    });
    return acc;
  }, {});

  const activeType = nutritionState.activeMealType;
  const activeItems = byType[activeType] || [];
  const tabsHtml = orderedTypes.map((type) => {
    const isActive = activeType === type;
    return `
      <button
        class="nutrition-saved-tab ${isActive ? 'is-active' : ''}"
        type="button"
        data-meal-tab="${type}"
        aria-selected="${isActive ? 'true' : 'false'}"
        role="tab"
      >
        ${normalizeMealType(type)}
      </button>
    `;
  }).join('');

  const itemsHtml = activeItems.map((m) => {
    return `
      <div class="nutrition-saved-item">
        <div class="nutrition-saved-head">
          <h4>${escapeHtml(m.name)}</h4>
          <button class="nutrition-delete-saved" data-id="${m.id}" title="Delete saved meal">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
        <span class="nutrition-pill">${normalizeMealType(m.meal_type)}</span>
        <div class="nutrition-saved-macros">
          <span class="cal"><i class="fas fa-fire"></i> ${Math.round(m.calories)} cal</span>
          <span class="protein">${Math.round(m.protein)}g protein</span>
          <span class="carbs">${Math.round(m.carbs)}g carbs</span>
          <span class="fats">${Math.round(m.fats)}g fats</span>
        </div>
        <button class="nutrition-use-saved" data-use-id="${m.id}">Use this meal</button>
      </div>
    `;
  }).join('');

  const emptyTypeHtml = `<div class="nutrition-empty">No saved ${normalizeMealType(activeType).toLowerCase()} meals yet.</div>`;
  grid.innerHTML = `
    <div class="nutrition-saved-tabs" role="tablist" aria-label="Saved meal types">
      ${tabsHtml}
    </div>
    <div class="nutrition-saved-content" data-active-meal-content="${activeType}">
      ${itemsHtml || emptyTypeHtml}
    </div>
  `;
}

function renderNutritionHistory() {
  const list = document.getElementById('nutrition-history-list');
  if (!list) return;

  const today = todayDateKey();
  const sorted = nutritionState.entries
    .filter(entry => mealDateKey(entry) === today)
    .sort((a, b) => {
    const ad = `${a.date || ''} ${a.time || ''}`;
    const bd = `${b.date || ''} ${b.time || ''}`;
    return bd.localeCompare(ad);
    });

  if (sorted.length === 0) {
    list.innerHTML = '<div class="nutrition-empty" style="margin-top: 10px;">No meals logged today yet.</div>';
    return;
  }

  list.innerHTML = sorted.map(entry => `
    <div class="nutrition-history-item">
      <div class="nutrition-history-head">
        <span class="nutrition-pill">${normalizeMealType(entry.meal_type)}</span>
        <button class="nutrition-history-delete" data-history-delete-id="${entry.id}" title="Delete meal" aria-label="Delete meal">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
      <div class="nutrition-history-food">${escapeHtml(entry.name)}</div>
      <div class="nutrition-history-time">${escapeHtml(entry.time || '--:--')} - ${escapeHtml(entry.date || '')}</div>
      <div class="nutrition-history-macros">
        <span class="cal"><i class="fas fa-fire"></i> ${Math.round(parseMacro(entry.calories))} cal</span>
        <span class="protein">${Math.round(parseMacro(entry.protein))}g protein</span>
        <span class="carbs">${Math.round(parseMacro(entry.carbs))}g carbs</span>
        <span class="fats">${Math.round(parseMacro(entry.fats))}g fats</span>
      </div>
    </div>
  `).join('');
}

async function deleteMealEntry(mealId) {
  const idNum = Number(mealId);
  if (!Number.isFinite(idNum) || idNum <= 0) return;

  try {
    if (activeDemoUserId) {
      const meals = getActiveUserMealsData();
      const nextMeals = meals.filter(m => Number(m.id) !== idNum);
      setActiveUserMealsData(nextMeals);
    } else {
      const response = await fetch(`/api/meals/${idNum}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
    }
    await loadMeals();
  } catch (err) {
    console.error('Error deleting meal:', err);
    alert('Could not delete meal right now.');
  }
}

// ---------------------------------------------------------------------------
// AI Meal Logger — 2-Step Confirmation Flow (USDA-powered)
// ---------------------------------------------------------------------------

let aiMealPanelOpen = false;
let aiDetectedData = null; // Holds Step 1 detection result for Step 2

function toggleAIMealLog() {
  aiMealPanelOpen = !aiMealPanelOpen;
  const panel = document.getElementById('nutrition-ai-panel');
  if (!panel) return;
  panel.classList.toggle('nutrition-collapsed', !aiMealPanelOpen);

  // Reset all sub-sections
  _aiResetPanel();

  if (aiMealPanelOpen) {
    const input = document.getElementById('ai-food-input');
    if (input) setTimeout(() => input.focus(), 100);
  }
}

function _aiResetPanel() {
  const status = document.getElementById('ai-meal-status');
  const confirm = document.getElementById('ai-step-confirm');
  const result = document.getElementById('ai-meal-result');
  const inputStep = document.getElementById('ai-step-input');

  if (status) { status.classList.add('nutrition-collapsed'); status.innerHTML = ''; }
  if (confirm) { confirm.classList.add('nutrition-collapsed'); }
  if (result) { result.classList.add('nutrition-collapsed'); result.innerHTML = ''; }
  if (inputStep) { inputStep.classList.remove('nutrition-collapsed'); }
  aiDetectedData = null;
}

// ---- STEP 1: Detect Foods ----

async function submitAIDetect() {
  const input = document.getElementById('ai-food-input');
  const mealTypeSelect = document.getElementById('ai-meal-type');
  const statusEl = document.getElementById('ai-meal-status');
  const detectBtn = document.getElementById('ai-detect-btn');

  const userInput = (input?.value || '').trim();
  const mealType = mealTypeSelect?.value || 'other';

  if (!userInput) {
    if (input) input.focus();
    return;
  }

  // Show loading
  statusEl.className = 'nutrition-ai-status loading';
  statusEl.classList.remove('nutrition-collapsed');
  statusEl.innerHTML = '<span class="ai-spinner"></span> Detecting foods via USDA database...';
  if (detectBtn) detectBtn.disabled = true;

  try {
    let data;
    if (typeof activeDemoUserId !== 'undefined' && activeDemoUserId) {
      data = simulateAIDetect(userInput, mealType);
    } else {
      const response = await fetch('/api/nutrition/ai-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: userInput, meal_type: mealType })
      });
      data = await response.json();
      if (!response.ok) throw new Error(data.error || `API error: ${response.status}`);
    }

    const itemCount = (data.items || []).length;
    if (itemCount === 0 && data.status !== 'confirm') {
      statusEl.className = 'nutrition-ai-status error';
      const reason = data.clarifications?.[0]?.reason || data.error || 'No foods found. Try being more specific.';
      statusEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(reason)}`;
      return;
    }

    // Save detection data and show confirmation table
    aiDetectedData = data;
    statusEl.classList.add('nutrition-collapsed');
    statusEl.innerHTML = '';
    renderAIConfirmation(data);

  } catch (err) {
    console.error('AI detect error:', err);
    statusEl.className = 'nutrition-ai-status error';
    statusEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message || 'Could not detect foods. Please try again.'}`;
  } finally {
    if (detectBtn) detectBtn.disabled = false;
  }
}

// ---- Render Confirmation Table ----

function renderAIConfirmation(data) {
  const inputStep = document.getElementById('ai-step-input');
  const confirmStep = document.getElementById('ai-step-confirm');
  const tableWrap = document.getElementById('ai-confirm-table-wrap');
  const clarifyEl = document.getElementById('ai-confirm-clarifications');

  // Hide input, show confirmation
  if (inputStep) inputStep.classList.add('nutrition-collapsed');
  if (confirmStep) confirmStep.classList.remove('nutrition-collapsed');

  const items = data.items || [];

  let html = `<table class="nutrition-ai-result-table ai-confirm-table">
    <thead>
      <tr>
        <th>Your Input</th>
        <th>USDA Match</th>
        <th>Confidence</th>
        <th>Qty (g)</th>
        <th>Calories</th>
        <th>Protein</th>
        <th>Carbs</th>
        <th>Fats</th>
        <th></th>
      </tr>
    </thead>
    <tbody>`;

  items.forEach((item, idx) => {
    const confClass = item.confidence === 'high' ? 'ai-conf-high' : item.confidence === 'medium' ? 'ai-conf-med' : 'ai-conf-low';
    const confIcon = item.confidence === 'high' ? 'check-circle' : item.confidence === 'medium' ? 'info-circle' : 'exclamation-triangle';
    html += `
      <tr id="ai-item-row-${idx}" data-idx="${idx}">
        <td class="ai-cell-input">${escapeHtml(item.original_input)}</td>
        <td class="ai-cell-match">${escapeHtml(item.matched_name)}${item.note ? `<br><small class="ai-food-note">${escapeHtml(item.note)}</small>` : ''}</td>
        <td><span class="ai-conf-badge ${confClass}"><i class="fas fa-${confIcon}"></i> ${item.confidence}</span></td>
        <td><input type="number" class="ai-qty-input" value="${item.quantity_g}" min="1" step="1" onchange="updateAIItemMacros(${idx}, this.value)" data-per100='${JSON.stringify(item.per_100g || {})}'/></td>
        <td class="ai-cal">${item.calories}</td>
        <td class="ai-prot">${item.protein}g</td>
        <td class="ai-carb">${item.carbs}g</td>
        <td class="ai-fat">${item.fats}g</td>
        <td><button class="ai-remove-btn" onclick="removeAIItem(${idx})" title="Remove"><i class="fas fa-times"></i></button></td>
      </tr>`;
  });

  html += '</tbody></table>';
  if (tableWrap) tableWrap.innerHTML = html;

  // Show clarifications if any
  if (data.clarifications && data.clarifications.length > 0 && clarifyEl) {
    let clarifyHTML = '<div class="ai-clarify-list">';
    for (const c of data.clarifications) {
      clarifyHTML += `<p class="ai-clarify-item"><i class="fas fa-question-circle"></i> <strong>${escapeHtml(c.original_input)}</strong>: ${escapeHtml(c.reason)}</p>`;
    }
    clarifyHTML += '</div>';
    clarifyEl.innerHTML = clarifyHTML;
    clarifyEl.classList.remove('nutrition-collapsed');
  } else if (clarifyEl) {
    clarifyEl.classList.add('nutrition-collapsed');
    clarifyEl.innerHTML = '';
  }

  updateAITotals();
}

function updateAIItemMacros(idx, newQtyG) {
  if (!aiDetectedData || !aiDetectedData.items[idx]) return;
  const item = aiDetectedData.items[idx];
  const qty = parseFloat(newQtyG) || 0;
  const per100 = item.per_100g || {};
  const factor = qty / 100;

  item.quantity_g = Math.round(qty * 10) / 10;
  item.calories = Math.round((per100.calories || 0) * factor * 10) / 10;
  item.protein = Math.round((per100.protein || 0) * factor * 10) / 10;
  item.carbs = Math.round((per100.carbs || 0) * factor * 10) / 10;
  item.fats = Math.round((per100.fats || 0) * factor * 10) / 10;

  // Update row cells
  const row = document.getElementById(`ai-item-row-${idx}`);
  if (row) {
    row.querySelector('.ai-cal').textContent = item.calories;
    row.querySelector('.ai-prot').textContent = item.protein + 'g';
    row.querySelector('.ai-carb').textContent = item.carbs + 'g';
    row.querySelector('.ai-fat').textContent = item.fats + 'g';
  }
  updateAITotals();
}

function removeAIItem(idx) {
  if (!aiDetectedData) return;
  aiDetectedData.items.splice(idx, 1);
  // Re-render entire confirmation (indexes shifted)
  renderAIConfirmation(aiDetectedData);
}

function updateAITotals() {
  if (!aiDetectedData) return;
  const items = aiDetectedData.items || [];
  const totals = {
    calories: items.reduce((s, f) => s + (f.calories || 0), 0),
    protein: items.reduce((s, f) => s + (f.protein || 0), 0),
    carbs: items.reduce((s, f) => s + (f.carbs || 0), 0),
    fats: items.reduce((s, f) => s + (f.fats || 0), 0),
  };
  const el = document.getElementById('ai-confirm-totals');
  if (el) {
    el.innerHTML = `
      <div class="ai-totals-grid">
        <div class="ai-total-item"><span>Total Calories</span><strong>${Math.round(totals.calories)}</strong></div>
        <div class="ai-total-item"><span>Protein</span><strong>${Math.round(totals.protein * 10) / 10}g</strong></div>
        <div class="ai-total-item"><span>Carbs</span><strong>${Math.round(totals.carbs * 10) / 10}g</strong></div>
        <div class="ai-total-item"><span>Fats</span><strong>${Math.round(totals.fats * 10) / 10}g</strong></div>
      </div>
      <p class="ai-result-note"><i class="fas fa-database"></i> Data sourced from USDA FoodData Central</p>`;
  }
}

// ---- STEP 2: Confirm & Log ----

async function confirmAIMealLog() {
  if (!aiDetectedData || !aiDetectedData.items || aiDetectedData.items.length === 0) return;

  const statusEl = document.getElementById('ai-meal-status');
  const confirmBtn = document.getElementById('ai-confirm-btn');
  const mealType = aiDetectedData.meal_type || 'other';

  statusEl.className = 'nutrition-ai-status loading';
  statusEl.classList.remove('nutrition-collapsed');
  statusEl.innerHTML = '<span class="ai-spinner"></span> Logging confirmed foods...';
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const confirmedFoods = aiDetectedData.items.map(item => ({
      name: item.matched_name,
      fdc_id: item.fdc_id,
      quantity_g: item.quantity_g,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      original_input: item.original_input,
      data_type: item.data_type || ''
    }));

    let savedCount = 0;

    if (typeof activeDemoUserId !== 'undefined' && activeDemoUserId) {
      // Demo mode: save to localStorage
      const meals = getActiveUserMealsData();
      for (const food of confirmedFoods) {
        meals.push({
          id: nextLocalId(meals),
          name: food.name,
          meal_type: mealType.toLowerCase(),
          calories: Math.round(food.calories),
          protein: Math.round(food.protein * 10) / 10,
          carbs: Math.round(food.carbs * 10) / 10,
          fats: Math.round(food.fats * 10) / 10,
          date: todayDateKey(),
          time: new Date().toTimeString().slice(0, 5)
        });
        savedCount++;
      }
      setActiveUserMealsData(meals);
    } else {
      // API mode
      const response = await fetch('/api/nutrition/ai-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: mealType,
          foods: confirmedFoods,
          date: todayDateKey(),
          time: new Date().toTimeString().slice(0, 5)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `API error: ${response.status}`);
      savedCount = (data.foods || []).length;
    }

    // Show success
    const totalCals = Math.round(confirmedFoods.reduce((s, f) => s + (f.calories || 0), 0));
    const confirmStep = document.getElementById('ai-step-confirm');
    const resultEl = document.getElementById('ai-meal-result');

    if (confirmStep) confirmStep.classList.add('nutrition-collapsed');

    statusEl.className = 'nutrition-ai-status success';
    statusEl.innerHTML = `<i class="fas fa-check-circle"></i> Successfully logged ${savedCount} food item${savedCount > 1 ? 's' : ''} — ${totalCals} kcal total`;

    // Show summary table in result
    let tableHTML = `<table class="nutrition-ai-result-table"><thead><tr>
      <th>Food</th><th>Qty (g)</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fats</th>
    </tr></thead><tbody>`;
    for (const f of confirmedFoods) {
      tableHTML += `<tr><td>${escapeHtml(f.name)}</td><td>${f.quantity_g}</td><td>${Math.round(f.calories)}</td><td>${Math.round(f.protein * 10) / 10}g</td><td>${Math.round(f.carbs * 10) / 10}g</td><td>${Math.round(f.fats * 10) / 10}g</td></tr>`;
    }
    tableHTML += `</tbody><tfoot><tr><td colspan="2"><strong>Total</strong></td>
      <td><strong>${totalCals}</strong></td>
      <td><strong>${Math.round(confirmedFoods.reduce((s,f)=>s+f.protein,0)*10)/10}g</strong></td>
      <td><strong>${Math.round(confirmedFoods.reduce((s,f)=>s+f.carbs,0)*10)/10}g</strong></td>
      <td><strong>${Math.round(confirmedFoods.reduce((s,f)=>s+f.fats,0)*10)/10}g</strong></td>
    </tr></tfoot></table>`;

    if (resultEl) { resultEl.innerHTML = tableHTML; resultEl.classList.remove('nutrition-collapsed'); }

    // Clear input and refresh
    const input = document.getElementById('ai-food-input');
    if (input) input.value = '';
    aiDetectedData = null;
    await loadMeals();

  } catch (err) {
    console.error('AI confirm log error:', err);
    statusEl.className = 'nutrition-ai-status error';
    statusEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message || 'Could not log foods. Please try again.'}`;
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

function cancelAIConfirm() {
  const inputStep = document.getElementById('ai-step-input');
  const confirmStep = document.getElementById('ai-step-confirm');
  const statusEl = document.getElementById('ai-meal-status');

  if (confirmStep) confirmStep.classList.add('nutrition-collapsed');
  if (inputStep) inputStep.classList.remove('nutrition-collapsed');
  if (statusEl) { statusEl.classList.add('nutrition-collapsed'); statusEl.innerHTML = ''; }
  aiDetectedData = null;

  const input = document.getElementById('ai-food-input');
  if (input) setTimeout(() => input.focus(), 100);
}

// escapeHtml defined once at line ~999 — avoid duplicates

/**
 * Demo mode: simulate AI food detection using the local nutritionFoodDatabase.
 * Returns a confirmation payload (same shape as /api/nutrition/ai-detect).
 */
function simulateAIDetect(userInput, mealType) {
  const allFoods = [
    ...(nutritionFoodDatabase.carbohydrates || []),
    ...(nutritionFoodDatabase.proteins || [])
  ];

  const segments = userInput.split(/,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
  const items = [];
  const clarifications = [];

  for (const segment of segments) {
    const qtyMatch = segment.match(/^(\d+(?:\.\d+)?)\s*(cup|cups|g|grams?|tbsp|tablespoon|oz|piece|pieces|whole|large|medium|small)?\s*(.+)$/i);
    let quantity = 1, unit = '', foodName = segment;

    if (qtyMatch) {
      quantity = parseFloat(qtyMatch[1]) || 1;
      unit = (qtyMatch[2] || '').toLowerCase();
      foodName = qtyMatch[3].trim();
    }

    const searchLower = foodName.toLowerCase();
    let bestMatch = null, bestScore = 0;

    for (const food of allFoods) {
      const nameLower = food.name.toLowerCase();
      let score = 0;
      for (const w of searchLower.split(/\s+/)) {
        if (nameLower.includes(w)) score += w.length;
      }
      if (score > bestScore) { bestScore = score; bestMatch = food; }
    }

    if (bestMatch && bestScore >= 2) {
      let grams = 100;
      if (unit === 'cup' || unit === 'cups') grams = quantity * 240;
      else if (unit === 'g' || unit === 'gram' || unit === 'grams') grams = quantity;
      else if (unit === 'tbsp' || unit === 'tablespoon') grams = quantity * 15;
      else if (unit === 'oz') grams = quantity * 28.35;
      else {
        const pieceWeights = { egg: 50, banana: 118, apple: 182, orange: 131 };
        const key = Object.keys(pieceWeights).find(k => bestMatch.name.toLowerCase().includes(k));
        grams = key ? quantity * pieceWeights[key] : quantity * 100;
      }

      const factor = (bestMatch.unit === 'whole' || bestMatch.unit === 'tablespoon') ? quantity : grams / 100;

      // Compute per-100g values for editing
      const per100 = {
        calories: bestMatch.unit === 'whole' ? bestMatch.calories : bestMatch.calories,
        protein: bestMatch.unit === 'whole' ? bestMatch.protein : bestMatch.protein,
        carbs: bestMatch.unit === 'whole' ? bestMatch.carbs : bestMatch.carbs,
        fats: bestMatch.unit === 'whole' ? bestMatch.fats : bestMatch.fats,
      };

      items.push({
        original_input: segment,
        matched_name: bestMatch.name,
        fdc_id: null,
        data_type: 'Local Database',
        confidence: bestScore >= 6 ? 'high' : bestScore >= 3 ? 'medium' : 'low',
        quantity: quantity,
        unit: unit || 'piece',
        quantity_g: Math.round(grams * 10) / 10,
        calories: Math.round(bestMatch.calories * factor * 10) / 10,
        protein: Math.round(bestMatch.protein * factor * 10) / 10,
        carbs: Math.round(bestMatch.carbs * factor * 10) / 10,
        fats: Math.round(bestMatch.fats * factor * 10) / 10,
        per_100g: per100,
        note: null,
        alternatives: []
      });
    } else {
      clarifications.push({
        original_input: segment,
        quantity: quantity,
        unit: unit || 'piece',
        reason: `No match found for '${foodName}'. Try a more specific name.`,
        suggestions: []
      });
    }
  }

  const result = {
    status: items.length > 0 ? 'confirm' : 'clarify',
    meal_type: mealType.charAt(0).toUpperCase() + mealType.slice(1),
    items,
    user_input: userInput
  };
  if (clarifications.length > 0) result.clarifications = clarifications;
  return result;
}

// Allow Enter key to trigger detect
document.addEventListener('DOMContentLoaded', function() {
  const aiInput = document.getElementById('ai-food-input');
  if (aiInput) {
    aiInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitAIDetect();
      }
    });
  }
});

function renderNutritionFormVisibility() {
  const formSection = document.getElementById('nutrition-form-section');
  if (!formSection) return;
  formSection.classList.toggle('nutrition-collapsed', !nutritionState.showForm);
}

function renderNutritionUI() {
  renderNutritionGoals();
  renderNutritionToday();
  renderNutritionWeek();
  renderSavedMeals();
  renderNutritionFormVisibility();
  renderNutritionHistory();
}

async function loadMeals() {
  const requestId = ++mealsLoadRequestId;
  const sourceUserId = activeDemoUserId || '';
  try {
    let meals;
    if (activeDemoUserId) {
      meals = getActiveUserMealsData();
    } else {
      const response = await fetch('/api/meals');
      if (!response.ok) throw new Error('Failed to load meals');
      meals = await response.json();
    }
    if (requestId !== mealsLoadRequestId || sourceUserId !== (activeDemoUserId || '')) return;
    nutritionState.entries = Array.isArray(meals) ? meals : [];
  } catch (err) {
    console.error('Error loading meals:', err);
    if (requestId !== mealsLoadRequestId || sourceUserId !== (activeDemoUserId || '')) return;
    nutritionState.entries = [];
  }
  renderNutritionUI();
  refreshDashboardMetrics();
  updateStatisticsForActiveUser();
  renderStatistics();
  refreshStreaksAfterChange();
}
function resetNutritionForm() {
  const form = document.getElementById('nutrition-form');
  if (form) form.reset();
  clearNutritionBuilderState();
  nutritionSetMode('manual');
}

async function submitNutritionForm(e) {
  e.preventDefault();
  if (!updateNutritionAccessState()) return;

  const mealType = document.getElementById('nutrition-form-meal')?.value || 'other';
  const mode = document.getElementById('nutrition-form-mode')?.value || 'manual';
  let food = (document.getElementById('nutrition-form-food')?.value || '').trim();
  let calories = parseMacro(document.getElementById('nutrition-form-calories')?.value);
  let protein = parseMacro(document.getElementById('nutrition-form-protein')?.value);
  let carbs = parseMacro(document.getElementById('nutrition-form-carbs')?.value);
  let fats = parseMacro(document.getElementById('nutrition-form-fats')?.value);

  if (mode === 'builder') {
    if (nutritionBuilderState.items.length === 0) {
      alert('Add at least one food item before saving the meal.');
      return;
    }
    nutritionCalculateBuilderTotals();
    calories = nutritionBuilderState.totals.calories;
    protein = nutritionBuilderState.totals.protein;
    carbs = nutritionBuilderState.totals.carbs;
    fats = nutritionBuilderState.totals.fats;
  }

  if (!food) {
    alert('Add a food name for this meal.');
    return;
  }

  try {
    const mealData = {
      name: food,
      meal_type: mealType,
      calories: Math.max(0, Number(calories) || 0),
      protein: Math.max(0, Number(protein) || 0),
      carbs: Math.max(0, Number(carbs) || 0),
      fats: Math.max(0, Number(fats) || 0),
      date: todayDateKey(),
      time: new Date().toTimeString().slice(0, 5)
    };

    if (activeDemoUserId) {
      const meals = getActiveUserMealsData();
      meals.push({
        id: nextLocalId(meals),
        ...mealData
      });
      setActiveUserMealsData(meals);
      await loadMeals();
      resetNutritionForm();
      nutritionState.showForm = false;
      renderNutritionFormVisibility();
      return;
    }

    const response = await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mealData)
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    await loadMeals();
    resetNutritionForm();
    nutritionState.showForm = false;
    renderNutritionFormVisibility();
  } catch (err) {
    console.error('Error creating meal:', err);
    alert('Could not add meal right now.');
  }
}
function saveCurrentMealPreset() {
  if (!updateNutritionAccessState()) return;
  const mealType = document.getElementById('nutrition-form-meal')?.value || 'other';
  const mode = document.getElementById('nutrition-form-mode')?.value || 'manual';
  let food = (document.getElementById('nutrition-form-food')?.value || '').trim();
  let calories = parseMacro(document.getElementById('nutrition-form-calories')?.value);
  let protein = parseMacro(document.getElementById('nutrition-form-protein')?.value);
  let carbs = parseMacro(document.getElementById('nutrition-form-carbs')?.value);
  let fats = parseMacro(document.getElementById('nutrition-form-fats')?.value);

  if (mode === 'builder') {
    if (nutritionBuilderState.items.length === 0) {
      alert('Add foods first to save this built meal.');
      return;
    }
    nutritionCalculateBuilderTotals();
    calories = nutritionBuilderState.totals.calories;
    protein = nutritionBuilderState.totals.protein;
    carbs = nutritionBuilderState.totals.carbs;
    fats = nutritionBuilderState.totals.fats;
  }

  if (!food || calories <= 0) {
    alert('Add meal name and macros before saving.');
    return;
  }

  const meal = {
    id: Date.now(),
    name: food,
    meal_type: mealType,
    calories: Math.max(0, Number(calories) || 0),
    protein: Math.max(0, Number(protein) || 0),
    carbs: Math.max(0, Number(carbs) || 0),
    fats: Math.max(0, Number(fats) || 0)
  };
  nutritionState.savedMeals = [meal, ...nutritionState.savedMeals];
  persistSavedMeals();
  renderSavedMeals();
}

async function useSavedMeal(savedId) {
  if (!updateNutritionAccessState()) return;
  const meal = nutritionState.savedMeals.find(m => String(m.id) === String(savedId));
  if (!meal) return;

  const mealData = {
    name: meal.name || 'Saved meal',
    meal_type: meal.meal_type || meal.meal || 'other',
    calories: Math.max(0, Number(meal.calories) || 0),
    protein: Math.max(0, Number(meal.protein) || 0),
    carbs: Math.max(0, Number(meal.carbs) || 0),
    fats: Math.max(0, Number(meal.fats) || 0),
    date: todayDateKey(),
    time: new Date().toTimeString().slice(0, 5)
  };

  try {
    if (activeDemoUserId) {
      const meals = getActiveUserMealsData();
      meals.push({ id: nextLocalId(meals), ...mealData });
      setActiveUserMealsData(meals);
    } else {
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mealData)
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
    }

    await loadMeals();
  } catch (err) {
    console.error('Error using saved meal:', err);
    alert('Could not add saved meal right now.');
  }
}

function deleteSavedMeal(savedId) {
  nutritionState.savedMeals = nutritionState.savedMeals.filter(m => String(m.id) !== String(savedId));
  persistSavedMeals();
  renderSavedMeals();
}

function setupNutrition() {
  if (!document.getElementById('nutrition')) return;

  loadSavedMeals();
  syncNutritionGoalWithProfile();
  updateNutritionAccessState();

  const toggleSavedBtn = document.getElementById('nutrition-toggle-saved-btn');
  const toggleFormBtn = document.getElementById('nutrition-toggle-form-btn');
  const cancelFormBtn = document.getElementById('nutrition-cancel-form-btn');
  const saveMealBtn = document.getElementById('nutrition-save-meal-btn');
  const nutritionForm = document.getElementById('nutrition-form');
  const savedGrid = document.getElementById('nutrition-saved-meals-grid');
  const historyList = document.getElementById('nutrition-history-list');
  const modeEl = document.getElementById('nutrition-form-mode');
  const builderCategoryEl = document.getElementById('nutrition-builder-category');
  const builderAddBtn = document.getElementById('nutrition-builder-add-btn');
  const builderList = document.getElementById('nutrition-builder-list');

  if (toggleSavedBtn) {
    toggleSavedBtn.addEventListener('click', () => {
      nutritionState.showSavedMeals = !nutritionState.showSavedMeals;
      renderSavedMeals();
    });
  }

  if (toggleFormBtn) {
    toggleFormBtn.addEventListener('click', () => {
      if (!updateNutritionAccessState()) return;
      nutritionState.showForm = !nutritionState.showForm;
      renderNutritionFormVisibility();
    });
  }

  if (cancelFormBtn) {
    cancelFormBtn.addEventListener('click', () => {
      nutritionState.showForm = false;
      renderNutritionFormVisibility();
    });
  }

  if (saveMealBtn) {
    saveMealBtn.addEventListener('click', saveCurrentMealPreset);
  }

  if (modeEl) {
    modeEl.addEventListener('change', (e) => {
      nutritionSetMode(e.target.value);
    });
  }

  if (builderCategoryEl) {
    builderCategoryEl.addEventListener('change', nutritionPopulateFoodOptions);
  }

  const builderFoodEl = document.getElementById('nutrition-builder-food');
  if (builderFoodEl) {
    builderFoodEl.addEventListener('change', nutritionUpdateQuantityLabel);
  }

  if (builderAddBtn) {
    builderAddBtn.addEventListener('click', addNutritionBuilderItem);
  }

  if (builderList) {
    builderList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest?.('[data-builder-remove-id]');
      if (!removeBtn) return;
      const removeId = removeBtn.getAttribute('data-builder-remove-id');
      nutritionBuilderState.items = nutritionBuilderState.items.filter(item => item.id !== removeId);
      renderNutritionBuilderList();
    });
  }

  if (nutritionForm) {
    nutritionForm.addEventListener('submit', submitNutritionForm);
  }

  if (savedGrid) {
    savedGrid.addEventListener('click', (e) => {
      const target = e.target;
      const tabBtn = target.closest?.('[data-meal-tab]');
      const deleteBtn = target.closest?.('[data-id]');
      const useBtn = target.closest?.('[data-use-id]');
      if (tabBtn) {
        const mealType = String(tabBtn.getAttribute('data-meal-tab') || '').toLowerCase();
        if (mealType) {
          nutritionState.activeMealType = mealType;
        }
        renderSavedMeals();
      } else if (deleteBtn) {
        deleteSavedMeal(deleteBtn.getAttribute('data-id'));
      } else if (useBtn) {
        useSavedMeal(useBtn.getAttribute('data-use-id'));
      }
    });
  }

  if (historyList) {
    historyList.addEventListener('click', (e) => {
      const target = e.target;
      const deleteBtn = target.closest?.('[data-history-delete-id]');
      if (!deleteBtn) return;
      deleteMealEntry(deleteBtn.getAttribute('data-history-delete-id'));
    });
  }

  nutritionPopulateFoodOptions();
  nutritionSetMode(modeEl?.value || 'manual');
  renderNutritionBuilderList();
  renderNutritionUI();
  updateNutritionAccessState();
  loadMeals();
}

// ========================================
// Dashboard Experience
// ========================================

const dashboardState = {
  timerRunning: false,
  timerSeconds: 0,
