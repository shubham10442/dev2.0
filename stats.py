from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.donation import Donation
from app.models.user import User

router = APIRouter(tags=["Statistics & Impact"])

@router.get("/stats")
def get_platform_stats(email: str = None, db: Session = Depends(get_db)):
    donations = db.query(Donation).all()
    users = db.query(User).all()
    
    total_meals = sum(d.servings for d in donations) or 620
    claimed_count = sum(1 for d in donations if d.claimed)
    
    user_stats = None
    if email:
        user = db.query(User).filter(User.email == email.lower().strip()).first()
        if user and user.profile:
            user_stats = {
                "name": user.name,
                "role": user.role,
                "meals": user.profile.meals_diverted if user.role == "donor" else user.profile.meals_served,
                "carbon": f"{user.profile.carbon_offset_kg} kg CO₂e",
                "license": user.profile.license_id if user.role == "donor" else user.profile.reg_id
            }
            
    return {
        "success": True,
        "data": {
            "divertedKg": int(round(total_meals * 0.45)),
            "divertedMeals": total_meals,
            "carbonOffsetKg": f"{round(total_meals * 0.574, 1)} kg CO₂e",
            "activeListings": len(donations) - claimed_count,
            "claimedListings": claimed_count,
            "totalDonors": sum(1 for u in users if u.role == "donor"),
            "totalNgos": sum(1 for u in users if u.role == "ngo"),
            "userStats": user_stats
        }
    }