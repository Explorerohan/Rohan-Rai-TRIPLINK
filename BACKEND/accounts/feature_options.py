"""
Single source of truth for package Included features.
All allowed features and their icons are defined here—finite list, no unlimited free text.
Agents pick from this list when adding/editing a package; every feature has an icon.
Add or remove entries here to change what’s available app-wide.
"""
# Default icon only for legacy/custom names (should not be used if form uses this list only)
DEFAULT_FEATURE_ICON = "checkmark-circle-outline"

# All allowed features: list of {"name": "Display Name", "icon": "ionicons-name"}
# name = what agents see and what we store; icon = Ionicons name for mobile app.
# Order here is the order shown in the agent form.
FEATURE_OPTIONS = [
    # Connectivity & utilities
    {"name": "WiFi", "icon": "wifi-outline"},
    {"name": "Internet", "icon": "wifi-outline"},
    # Water & pool
    {"name": "Pool", "icon": "water-outline"},
    {"name": "Swimming Pool", "icon": "water-outline"},
    {"name": "Hot Tub", "icon": "water-outline"},
    {"name": "Spa", "icon": "water-outline"},
    {"name": "Tub", "icon": "water-outline"},
    {"name": "Bath", "icon": "water-outline"},
    # Heating & cooling
    {"name": "Heater", "icon": "flame-outline"},
    {"name": "AC", "icon": "snow-outline"},
    {"name": "Air Conditioning", "icon": "snow-outline"},
    # Food & dining
    {"name": "Meals", "icon": "restaurant-outline"},
    {"name": "Breakfast", "icon": "restaurant-outline"},
    {"name": "Lunch", "icon": "restaurant-outline"},
    {"name": "Dinner", "icon": "restaurant-outline"},
    {"name": "Restaurant", "icon": "restaurant-outline"},
    {"name": "Dining", "icon": "restaurant-outline"},
    # Accommodation
    {"name": "Accommodation", "icon": "bed-outline"},
    {"name": "Bed", "icon": "bed-outline"},
    {"name": "Hotel", "icon": "bed-outline"},
    {"name": "Room", "icon": "bed-outline"},
    # Transport & travel
    {"name": "Transport", "icon": "car-outline"},
    {"name": "Car", "icon": "car-outline"},
    {"name": "Airport Transfer", "icon": "car-outline"},
    {"name": "Pickup", "icon": "car-outline"},
    # Fitness & activities
    {"name": "Gym", "icon": "barbell-outline"},
    {"name": "Fitness", "icon": "barbell-outline"},
    {"name": "Workout", "icon": "barbell-outline"},
    # People & services
    {"name": "Guide", "icon": "person-outline"},
    {"name": "Tour Guide", "icon": "person-outline"},
    # General / perks
    {"name": "All Inclusive", "icon": "star-outline"},
    {"name": "Perks", "icon": "star-outline"},
]


def get_feature_icon(name):
    """Return Ionicons icon name for a feature name. Uses FEATURE_OPTIONS; fallback to default."""
    if not name or not isinstance(name, str):
        return DEFAULT_FEATURE_ICON
    key = name.strip().lower()
    if not key:
        return DEFAULT_FEATURE_ICON
    for opt in FEATURE_OPTIONS:
        if opt["name"].strip().lower() == key:
            return opt["icon"]
    return DEFAULT_FEATURE_ICON


def get_all_feature_options():
    """Return the full list of {name, icon} for use in forms and API."""
    return list(FEATURE_OPTIONS)
