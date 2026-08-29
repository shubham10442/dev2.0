import math
import re

def estimate_meals_from_title(title: str) -> int:
    if not title:
        return 25
    match = re.search(r"(\d+)", title)
    if match:
        val = int(match.group(1))
        if 1 <= val <= 2000:
            return val
    return 25

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    if not (lat1 and lon1 and lat2 and lon2):
        return 1.2
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(r * c, 1)

def compute_carbon_savings_kg(meals: int) -> float:
    # Industry standard: ~0.574 kg CO2e offset per rescued prepared meal
    return round(meals * 0.574, 1)

def compute_food_weight_kg(meals: int) -> int:
    # Average 0.45 kg per standard meal serving
    return int(round(meals * 0.45))