from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User

router = APIRouter(tags=["Profiles"])

@router.get("/profile")
def get_profile(email: str = None, role: str = None, db: Session = Depends(get_db)):
    query = db.query(User)
    if email:
        user = query.filter(User.email == email.lower().strip()).first()
    elif role:
        user = query.filter(User.role == role).first()
    else:
        user = query.first()
        
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    p = user.profile
    return {
        "success": True,
        "data": {
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "photo": user.photo_url,
            "phone": user.phone,
            "address": user.address,
            "kitchenType": p.kitchen_type if p else "",
            "shelterType": p.shelter_type if p else "",
            "licenseId": p.license_id if p else "",
            "regId": p.reg_id if p else "",
            "operatingHours": p.operating_hours if p else "",
            "capacity": p.capacity if p else "",
            "fleet": p.fleet if p else "",
            "section80G": p.section_80g_status if p else "Active & Verified",
            "mealsDiverted": p.meals_diverted if p else 620,
            "carbonOffset": f"{p.carbon_offset_kg if p else 355.8} kg CO₂e",
            "lat": p.lat if p else 28.6139,
            "lng": p.lng if p else 77.2090,
            "gpsAddress": p.gps_address if p else "Central Station",
            "verified": True
        }
    }

@router.put("/profile")
def update_profile(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
        
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    if "name" in payload: user.name = payload["name"]
    if "phone" in payload: user.phone = payload["phone"]
    if "address" in payload: user.address = payload["address"]
    
    p = user.profile
    if p:
        if "kitchenType" in payload: p.kitchen_type = payload["kitchenType"]
        if "shelterType" in payload: p.shelter_type = payload["shelterType"]
        if "licenseId" in payload: p.license_id = payload["licenseId"]
        if "regId" in payload: p.reg_id = payload["regId"]
        if "lat" in payload and payload["lat"] is not None: p.lat = float(payload["lat"])
        if "lng" in payload and payload["lng"] is not None: p.lng = float(payload["lng"])
        if "gpsAddress" in payload: p.gps_address = payload["gpsAddress"]
        
    db.commit()
    return {"success": True, "message": "Profile updated successfully"}