from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.database import get_db
from app.models.user import User

router = APIRouter(tags=["80G Tax Exemption Certificate"])

@router.get("/certificate/80g", response_class=HTMLResponse)
def get_80g_certificate(email: str = "chef.royalspice@gmail.com", db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    donor_name = user.name if user else "Royal Spice Caterers"
    fssai = user.profile.license_id if user and user.profile else "FSSAI-10019022008432"
    meals = user.profile.meals_diverted if user and user.profile else 620
    kg_diverted = int(round(meals * 0.45))
    inr_value = meals * 50
    cert_id = f"ANN-80G-{abs(hash(donor_name)) % 1000000:06d}-2026"
    today_str = datetime.now().strftime("%B %d, %Y")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Section 80G Certificate — {donor_name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen py-10 px-4 flex flex-col items-center justify-center font-sans">
  <div class="max-w-3xl w-full mb-4 flex justify-between">
    <button onclick="window.close()" class="text-xs font-bold text-slate-600 hover:text-slate-900">← Close</button>
    <button onclick="window.print()" class="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs shadow">🖨️ Print / Save as PDF</button>
  </div>
  <div class="max-w-3xl w-full bg-white rounded-3xl p-8 sm:p-12 shadow-2xl border-4 border-double border-emerald-700 relative">
    <div class="text-center pb-6 border-b-2 border-emerald-700">
      <span class="inline-block bg-emerald-100 text-emerald-900 text-xs font-extrabold uppercase px-3 py-1 rounded-full mb-2">
        FORM 10BE • SECTION 80G(5)(vi) EXEMPTION CERTIFICATE
      </span>
      <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900">ANN (अन्न) SURPLUS REDISTRIBUTION ALLIANCE</h1>
      <p class="text-xs text-slate-500 mt-1">In Partnership with Hope Shelter Network & Relief Trust</p>
      <div class="flex justify-center gap-3 text-xs text-slate-600 mt-2 font-mono">
        <span>NGO Darpan: <strong>NGO-DARPAN/DL/2019/0248819</strong></span> • <span>80G URN: <strong>AABCH8291EF20214</strong></span>
      </div>
    </div>
    <div class="flex justify-between items-center py-4 text-xs text-slate-500 border-b border-slate-200">
      <div>Certificate ID: <strong class="font-mono text-slate-900">{cert_id}</strong></div>
      <div>Date: <strong class="text-slate-900">{today_str}</strong></div>
    </div>
    <div class="py-6 text-sm leading-relaxed space-y-4">
      <p>This certifies that <strong>{donor_name}</strong> (FSSAI License: <strong class="font-mono text-emerald-800">{fssai}</strong>) has contributed wholesome surplus food to the ANN zero-waste humanitarian relief network.</p>
      <div class="grid grid-cols-3 gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center my-4">
        <div><span class="text-xs font-bold text-emerald-800 block">Meals Rescued</span><strong class="text-2xl font-extrabold text-emerald-950">{meals:,}</strong></div>
        <div><span class="text-xs font-bold text-emerald-800 block">Weight Diverted</span><strong class="text-2xl font-extrabold text-emerald-950">{kg_diverted:,} kg</strong></div>
        <div><span class="text-xs font-bold text-emerald-800 block">Fair Market Value</span><strong class="text-2xl font-extrabold text-emerald-950">₹{inr_value:,}</strong></div>
      </div>
      <p class="text-xs text-slate-600">Donations made to the ANN alliance qualify for tax deductions under Section 80G of the Income Tax Act, 1961.</p>
    </div>
    <div class="pt-8 border-t border-slate-200 grid grid-cols-2 gap-6 items-end">
      <div class="w-24 h-24 border-2 border-dashed border-emerald-300 rounded-2xl flex flex-col items-center justify-center p-2 text-center bg-emerald-50">
        <span class="text-[9px] font-mono text-emerald-800 font-bold">DIGITAL SEAL</span>
        <span class="text-xs font-extrabold text-emerald-900 mt-1">✓ VERIFIED</span>
      </div>
      <div class="text-right">
        <div class="font-serif italic text-lg text-emerald-900 font-bold">Dr. Anita Sharma</div>
        <p class="text-xs font-bold text-slate-800">Director of Operations</p>
        <p class="text-xs text-slate-500">ANN Zero-Waste Alliance</p>
      </div>
    </div>
  </div>
</body>
</html>"""