from pydantic import BaseModel, EmailStr
from typing import Optional

class SendOTPRequest(BaseModel):
    email: EmailStr

class SendOTPResponse(BaseModel):
    success: bool
    message: str
    email: str
    previewOtp: str
    expiresInSeconds: int

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str
    role: Optional[str] = "donor"
    name: Optional[str] = None
    photo: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: Optional[str] = "donor"
    photo: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "donor"
    phone: Optional[str] = "+91 98000 00000"
    address: Optional[str] = "Central District"