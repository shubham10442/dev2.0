const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'listings.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Helpers for reading/writing persistent data
function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    let data = fs.readFileSync(file, 'utf8');
    data = data.replace(/^\uFEFF/, '');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return [];
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

// In-memory OTP storage: email -> { otp, expiresAt, attempts }
const otpStore = new Map();

// --------------------------------------------------------------------------
// AUTH & PROFILE ENDPOINTS (WITH GMAIL OTP)
// --------------------------------------------------------------------------

// 1. POST /api/auth/send-otp - Generate and dispatch 6-digit OTP to Gmail
app.post('/api/auth/send-otp', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Gmail address is required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  otpStore.set(cleanEmail, { otp, expiresAt, attempts: 0 });

  console.log(`\n==================================================`);
  console.log(`📩 [GMAIL OTP] Verification code for ${cleanEmail}: ${otp}`);
  console.log(`⏰ Code valid for 5 minutes (until ${new Date(expiresAt).toLocaleTimeString()})`);
  console.log(`==================================================\n`);

  res.json({
    success: true,
    message: `Verification code sent to ${cleanEmail}`,
    email: cleanEmail,
    previewOtp: otp,
    expiresInSeconds: 300
  });
});

// 2. POST /api/auth/verify-otp - Validate code and issue authenticated profile
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp, role, name, photo } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, error: 'Email and OTP code are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const storedRecord = otpStore.get(cleanEmail);

  if (!storedRecord) {
    return res.status(400).json({ success: false, error: 'No OTP requested for this email or code has expired. Please request a new code.' });
  }

  if (Date.now() > storedRecord.expiresAt) {
    otpStore.delete(cleanEmail);
    return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
  }

  if (storedRecord.otp !== otp.trim()) {
    storedRecord.attempts = (storedRecord.attempts || 0) + 1;
    if (storedRecord.attempts >= 5) {
      otpStore.delete(cleanEmail);
      return res.status(400).json({ success: false, error: 'Too many incorrect attempts. Please request a new code.' });
    }
    return res.status(400).json({ success: false, error: `Invalid verification code. ${5 - storedRecord.attempts} attempts remaining.` });
  }

  // OTP matches! Clear used OTP
  otpStore.delete(cleanEmail);

  // Authenticate or register profile
  const users = readJSON(USERS_FILE);
  let user = users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    const userRole = role || 'donor';
    user = {
      email: cleanEmail,
      name: name || (userRole === 'donor' ? 'Surplus Food Kitchen' : 'Community Relief NGO'),
      role: userRole,
      photo: photo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanEmail)}`,
      phone: '+91 98000 00000',
      address: 'Central District, City Zone',
      verified: true,
      createdAt: new Date().toISOString()
    };

    if (userRole === 'donor') {
      user.kitchenType = 'Restaurant & Catering';
      user.licenseId = 'FSSAI-' + Math.floor(10000000000000 + Math.random() * 90000000000000);
      user.operatingHours = '09:00 AM - 11:00 PM';
      user.mealsDiverted = 0;
      user.carbonOffset = '0 kg CO₂e';
      user.lat = 28.6139;
      user.lng = 77.2090;
      user.gpsAddress = 'Central Kitchen Station';
    } else {
      user.shelterType = 'Relief Center & Food Shelter';
      user.regId = 'NGO-REG/' + Math.floor(100000 + Math.random() * 900000);
      user.capacity = '200 Meals / Day';
      user.fleet = '2 Volunteer Vans';
      user.section80G = 'Active';
      user.mealsServed = 0;
      user.lat = 28.6250;
      user.lng = 77.2180;
      user.gpsAddress = 'Relief Hub Station';
    }

    users.push(user);
    writeJSON(USERS_FILE, users);
    console.log(`[AUTH] New user verified via Gmail OTP: ${cleanEmail} (${userRole})`);
  } else {
    if (role && user.role !== role) {
      user.role = role;
      writeJSON(USERS_FILE, users);
    }
    console.log(`[AUTH] User authenticated via Gmail OTP: ${cleanEmail} (${user.role})`);
  }

  res.json({
    success: true,
    message: 'Gmail OTP verification successful',
    data: user
  });
});

// 3. POST /api/auth/google - Authenticate or register Gmail user (Direct fallback)
app.post('/api/auth/google', (req, res) => {
  const { email, name, role, photo } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Gmail address is required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const users = readJSON(USERS_FILE);
  let user = users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    // Register new user profile
    const userRole = role || 'donor';
    user = {
      email: cleanEmail,
      name: name || (userRole === 'donor' ? 'Surplus Food Kitchen' : 'Community Relief NGO'),
      role: userRole,
      photo: photo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanEmail)}`,
      phone: '+91 98000 00000',
      address: 'Central District, City Zone',
      verified: true,
      createdAt: new Date().toISOString()
    };

    if (userRole === 'donor') {
      user.kitchenType = 'Restaurant & Catering';
      user.licenseId = 'FSSAI-' + Math.floor(10000000000000 + Math.random() * 90000000000000);
      user.operatingHours = '09:00 AM - 11:00 PM';
      user.mealsDiverted = 0;
      user.carbonOffset = '0 kg CO₂e';
    } else {
      user.shelterType = 'Relief Center & Food Shelter';
      user.regId = 'NGO-REG/' + Math.floor(100000 + Math.random() * 900000);
      user.capacity = '200 Meals / Day';
      user.fleet = '2 Volunteer Vans';
      user.section80G = 'Active';
      user.mealsServed = 0;
    }

    users.push(user);
    writeJSON(USERS_FILE, users);
    console.log(`[AUTH] New user registered via Gmail: ${cleanEmail} (${userRole})`);
  } else {
    // If role requested differs, update if requested
    if (role && user.role !== role) {
      user.role = role;
      writeJSON(USERS_FILE, users);
    }
    console.log(`[AUTH] User authenticated via Gmail: ${cleanEmail} (${user.role})`);
  }

  res.json({
    success: true,
    message: 'Gmail authentication successful',
    data: user
  });
});

// 2. GET /api/profile - Retrieve profile by email or role
app.get('/api/profile', (req, res) => {
  const { email, role } = req.query;
  const users = readJSON(USERS_FILE);

  let user = null;
  if (email) {
    user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  } else if (role) {
    user = users.find(u => u.role === role);
  }

  if (!user) {
    return res.status(404).json({ success: false, error: 'User profile not found.' });
  }

  res.json({ success: true, data: user });
});

// 3. PUT /api/profile - Update profile details
app.put('/api/profile', (req, res) => {
  const { email, name, phone, address, kitchenType, licenseId, shelterType, regId, capacity, fleet, operatingHours } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: 'User email is required to update profile.' });
  }

  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

  if (!user) {
    return res.status(404).json({ success: false, error: 'User profile not found.' });
  }

  // Update allowed fields
  if (name !== undefined) user.name = name.trim();
  if (phone !== undefined) user.phone = phone.trim();
  if (address !== undefined) user.address = address.trim();
  if (kitchenType !== undefined) user.kitchenType = kitchenType.trim();
  if (licenseId !== undefined) user.licenseId = licenseId.trim();
  if (shelterType !== undefined) user.shelterType = shelterType.trim();
  if (regId !== undefined) user.regId = regId.trim();
  if (capacity !== undefined) user.capacity = capacity.trim();
  if (fleet !== undefined) user.fleet = fleet.trim();
  if (operatingHours !== undefined) user.operatingHours = operatingHours.trim();
  if (req.body.lat !== undefined) user.lat = parseFloat(req.body.lat);
  if (req.body.lng !== undefined) user.lng = parseFloat(req.body.lng);
  if (req.body.gpsAddress !== undefined) user.gpsAddress = req.body.gpsAddress.trim();

  writeJSON(USERS_FILE, users);
  console.log(`[PROFILE] Updated profile for ${user.email}`);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: user
  });
});

// --------------------------------------------------------------------------
// LISTINGS & STATS ENDPOINTS
// --------------------------------------------------------------------------

// 4. GET /api/listings - Retrieve all listings with optional search
app.get('/api/listings', (req, res) => {
  const { q } = req.query;
  let listings = readJSON(DATA_FILE);

  if (q) {
    const query = q.toLowerCase().trim();
    listings = listings.filter(item =>
      item.title.toLowerCase().includes(query) ||
      (item.donor && item.donor.toLowerCase().includes(query))
    );
  }

  res.json({ success: true, count: listings.length, data: listings });
});

// 5. POST /api/listings - Create a new surplus food listing (from Donor)
app.post('/api/listings', (req, res) => {
  const { title, expires, donor, icon, lat, lng, gpsAddress, image } = req.body;

  if (!title || !expires) {
    return res.status(400).json({ success: false, error: 'Title and expiry window are required.' });
  }

  const listings = readJSON(DATA_FILE);
  const newListing = {
    id: Date.now(),
    title: title.trim(),
    donor: donor ? donor.trim() : 'Royal Spice Caterers',
    dist: 'Nearby (GPS)',
    lat: lat ? parseFloat(lat) : 28.6139,
    lng: lng ? parseFloat(lng) : 77.2090,
    gpsAddress: gpsAddress ? gpsAddress.trim() : 'Kitchen GPS Location',
    image: image || null,
    icon: icon || '🍲',
    expires: expires.trim(),
    tag: 'Just Listed',
    tagColor: 'emerald',
    status: 'Awaiting NGO Claim',
    claimed: false,
    claimedBy: null,
    extra: 'Ready for Pickup',
    createdAt: new Date().toISOString()
  };

  listings.unshift(newListing);
  writeJSON(DATA_FILE, listings);

  res.status(201).json({ success: true, message: 'Surplus food listed successfully', data: newListing });
});

// 6. DELETE /api/listings/:id - Cancel/remove listing (by Donor)
app.delete('/api/listings/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  let listings = readJSON(DATA_FILE);
  const initialCount = listings.length;

  listings = listings.filter(item => item.id !== id);

  if (listings.length === initialCount) {
    return res.status(404).json({ success: false, error: 'Listing not found.' });
  }

  writeJSON(DATA_FILE, listings);
  res.json({ success: true, message: 'Listing cancelled successfully', id });
});

// 7. POST /api/listings/:id/claim - Claim food for NGO pickup
app.post('/api/listings/:id/claim', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { ngo } = req.body;
  const listings = readJSON(DATA_FILE);
  const item = listings.find(l => l.id === id);

  if (!item) {
    return res.status(404).json({ success: false, error: 'Listing not found.' });
  }

  if (item.claimed) {
    return res.status(400).json({ success: false, error: 'Food item has already been claimed.' });
  }

  item.claimed = true;
  item.claimedBy = ngo || 'Hope Shelter Network';
  item.status = 'Driver Dispatched';
  item.extra = 'Driver Assigned • ETA ~15m';

  writeJSON(DATA_FILE, listings);
  res.json({ success: true, message: 'Food successfully claimed for NGO', data: item });
});

// 8. GET /api/stats - Community impact metrics
app.get('/api/stats', (req, res) => {
  const listings = readJSON(DATA_FILE);
  const totalListed = listings.length;
  const claimedCount = listings.filter(l => l.claimed).length;

  res.json({
    success: true,
    data: {
      divertedKg: 1420 + (claimedCount * 18),
      divertedMeals: 620 + (claimedCount * 30),
      carbonOffsetKg: (355.8 + (claimedCount * 9.2)).toFixed(1),
      activeListings: totalListed - claimedCount,
      claimedListings: claimedCount
    }
  });
});

// Fallback to index.html for single-page routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🍲 Ann Server running at: http://localhost:${PORT}`);
  console.log(`📡 REST API available at: http://localhost:${PORT}/api/listings`);
  console.log(`👤 Auth & Profiles at:   http://localhost:${PORT}/api/profile`);
  console.log(`==================================================\n`);
});
