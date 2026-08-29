from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User, UserProfile
from app.models.notification import NotificationPreference
from app.models.activity import ActivityLog, OTPVerification
from app.schemas.auth import SendOTPRequest, SendOTPResponse, VerifyOTPRequest, GoogleAuthRequest, LoginRequest, RegisterRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/send-otp", response_model=SendOTPResponse)
def send_otp(req: SendOTPRequest, db: Session = Depends(get_db)):
    clean_email = req.email.lower().strip()
    otp = str(random.randint(100000, 999999))
    expires = datetime.utcnow() + timedelta(minutes=5)
    
    rec = db.query(OTPVerification).filter(OTPVerification.email == clean_email).first()
    if rec:
        rec.otp_code = otp
        rec.expires_at = expires
        rec.attempts = "0"
    else:
        rec = OTPVerification(email=clean_email, otp_code=otp, expires_at=expires)
        db.add(rec)
    
    log = ActivityLog(
        type="AUTH_OTP_SENT",
        title=f"OTP requested for {clean_email}",
        description="ANN security code generated for verification"
    )
    db.add(log)
    db.commit()
    
    print(f"\n==================================================")
    print(f"📩 [ANN GMAIL OTP] Verification code for {clean_email}: {otp}")
    print(f"⏰ Code valid for 5 minutes")
    print(f"==================================================\n")
    
    return SendOTPResponse(
        success=True,
        message=f"ANN Verification code sent to {clean_email}",
        email=clean_email,
        previewOtp=otp,
        expiresInSeconds=300
    )

@router.post("/verify-otp")
def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    clean_email = req.email.lower().strip()
    rec = db.query(OTPVerification).filter(OTPVerification.email == clean_email).first()
    
    if not rec or datetime.utcnow() > rec.expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code. Please request a new one.")
        
    if rec.otp_code != req.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid verification code. Please check your notification toast.")
        
    db.delete(rec)
    
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        user_role = req.role or "donor"
        user = User(
            email=clean_email,
            name=req.name or (clean_email.split("@")[0].replace(".", " ").title()),
            role=user_role,
            photo_url=req.photo or f"https://api.dicebear.com/7.x/initials/svg?seed={clean_email}",
            password_hash=get_password_hash("Demo123!")
        )
        db.add(user)
        db.flush()
        
        prof = UserProfile(
            user_id=user.id,
            kitchen_type="Banquets & Commercial Kitchen" if user_role == "donor" else "Relief Shelter",
            license_id="FSSAI-10019022008432" if user_role == "donor" else "NGO-DARPAN/DL/2019/0248819",
            lat=28.6139 if user_role == "donor" else 28.6250,
            lng=77.2090 if user_role == "donor" else 77.2180
        )
        db.add(prof)
        db.add(NotificationPreference(user_id=user.id))
        db.commit()
        db.refresh(user)

    token = create_access_token(user.id)
    return {
        "success": True,
        "token": token,
        "data": {
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "photo": user.photo_url,
            "phone": user.phone,
            "address": user.address,
            "kitchenType": user.profile.kitchen_type if user.profile else "",
            "shelterType": user.profile.shelter_type if user.profile else "",
            "licenseId": user.profile.license_id if user.profile else "",
            "regId": user.profile.reg_id if user.profile else "",
            "operatingHours": user.profile.operating_hours if user.profile else "",
            "capacity": user.profile.capacity if user.profile else "",
            "fleet": user.profile.fleet if user.profile else "",
            "section80G": user.profile.section_80g_status if user.profile else "Active & Verified",
            "mealsDiverted": user.profile.meals_diverted if user.profile else 620,
            "carbonOffset": f"{user.profile.carbon_offset_kg if user.profile else 355.8} kg CO₂e",
            "lat": user.profile.lat if user.profile else 28.6139,
            "lng": user.profile.lng if user.profile else 77.2090,
            "gpsAddress": user.profile.gps_address if user.profile else "Central Station",
            "verified": True
        }
    }