from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.user import User, UserProfile
from app.models.donation import Donation
from app.models.badge import Badge
from datetime import datetime, timedelta

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(User).first():
        print("🌱 Database already seeded.")
        db.close()
        return

    print("🌱 Seeding ANN platform database...")

    # 1. Seed Verified Users
    donor = User(
        email="chef.royalspice@gmail.com",
        password_hash=get_password_hash("Demo123!"),
        name="Royal Spice Caterers",
        role="donor",
        photo_url="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100&auto=format&fit=crop&q=80",
        phone="+91 98765 43210",
        address="42 Heritage Boulevard, Downtown Commercial Zone"
    )
    db.add(donor)
    db.flush()

    db.add(UserProfile(
        user_id=donor.id,
        kitchen_type="Banquets & Commercial Kitchen",
        license_id="FSSAI-10019022008432",
        operating_hours="10:00 AM - 11:30 PM",
        meals_diverted=620,
        carbon_offset_kg=355.8,
        lat=28.6139,
        lng=77.2090,
        gps_address="42 Heritage Blvd, Central Sector"
    ))

    ngo = User(
        email="contact.hopeshelter@gmail.com",
        password_hash=get_password_hash("Demo123!"),
        name="Hope Shelter Network",
        role="ngo",
        photo_url="https://images.unsplash.com/photo-1593113598332-cd288d649433?w=100&auto=format&fit=crop&q=80",
        phone="+91 98123 45678",
        address="Sector 14 Community Center, Metro Relief District"
    )
    db.add(ngo)
    db.flush()

    db.add(UserProfile(
        user_id=ngo.id,
        shelter_type="Community Relief & Orphanage Care",
        reg_id="NGO-DARPAN/DL/2019/0248819",
        capacity="350 Meals / Day",
        fleet="4 Delivery Vans, 2 Electric Bikes",
        section_80g_status="Active & Verified",
        meals_served=1850,
        lat=28.6250,
        lng=77.2180,
        gps_address="Sector 14 Community Center, Metro Relief"
    ))

    # 2. Seed Initial Donations
    sample_donations = [
        Donation(
            numeric_id=1,
            title="30 Servings Veg Thali",
            donor_name="Royal Spice Caterers",
            donor_email="chef.royalspice@gmail.com",
            servings=30,
            lat=28.6139,
            lng=77.2090,
            image_url="https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500&auto=format&fit=crop&q=80",
            icon="🍲",
            expires_at=datetime.utcnow() + timedelta(hours=1, minutes=20),
            expiry_string="1h 20m",
            tag="⚡ Urgent (<2h)",
            tag_color="amber",
            status="Driver En Route",
            claimed=True,
            claimed_by_name="Hope Shelter Network",
            extra_info="Driver: Mark R. • ETA 12m"
        ),
        Donation(
            numeric_id=2,
            title="15 Packed Rice Bowls",
            donor_name="Green Earth Bistro",
            donor_email="greenbistro.chef@gmail.com",
            servings=15,
            lat=28.6190,
            lng=77.2130,
            image_url="https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500&auto=format&fit=crop&q=80",
            icon="🍱",
            expires_at=datetime.utcnow() + timedelta(hours=2, minutes=45),
            expiry_string="2h 45m",
            tag="Fresh Pack",
            tag_color="emerald",
            status="Awaiting NGO Claim",
            claimed=False,
            extra_info="Listed 20m ago"
        ),
        Donation(
            numeric_id=3,
            title="25 Sourdough Loaves",
            donor_name="Golden Crust Bakery",
            donor_email="golden.crust@gmail.com",
            servings=25,
            lat=28.6280,
            lng=77.2250,
            image_url="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80",
            icon="🥖",
            expires_at=datetime.utcnow() + timedelta(hours=6, minutes=10),
            expiry_string="6h 10m",
            tag="Artisan Bakery",
            tag_color="purple",
            status="Awaiting NGO Claim",
            claimed=False,
            extra_info="Ready for pickup"
        ),
        Donation(
            numeric_id=4,
            title="40 Sandwich Boxes",
            donor_name="TechHub Conference",
            donor_email="events@techhub.demo",
            servings=40,
            lat=28.6080,
            lng=77.2010,
            image_url="https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80",
            icon="🥪",
            expires_at=datetime.utcnow() + timedelta(hours=1, minutes=45),
            expiry_string="1h 45m",
            tag="Assorted Wraps",
            tag_color="emerald",
            status="Awaiting NGO Claim",
            claimed=False,
            extra_info="Refrigerated"
        )
    ]
    db.add_all(sample_donations)

    # 3. Seed Badges
    badges = [
        Badge(code="first_step", title="Zero Waste Pioneer", description="Diverted your first 50kg of food waste", icon="award", threshold_value=50.0),
        Badge(code="century_saver", title="100kg Climate Saver", description="Saved over 100kg of food from landfills", icon="shield-check", threshold_value=100.0),
        Badge(code="community_pillar", title="Community Pillar", description="Served over 1,000 community meals", icon="heart", threshold_value=1000.0)
    ]
    db.add_all(badges)

    db.commit()
    db.close()
    print("✅ ANN Database seeded successfully.")

if __name__ == "__main__":
    seed_database()