/* ==========================================================================
   Ann — Frontend Client: Auth, Profiles, Listings, GPS & REST API
   ========================================================================== */

// 1. State Management
let currentRole = null;
let currentEntity = '';
let currentEmail = '';
let currentUserProfile = null;
let audioCtx = null;
let listings = [];

// GPS Coordinates & Map Instances
let donorLat = 28.6139;
let donorLng = 77.2090;
let donorMap = null;
let donorMarker = null;
let donorCircle = null;
let routeMap = null;

const isServerEnv = window.location.protocol.startsWith('http');
const API_BASE = isServerEnv ? '/api' : null;

// Real-Time Server-Sent Events (SSE) Listener
function initSSE() {
  if (!isServerEnv || typeof EventSource === 'undefined') return;
  try {
    const sse = new EventSource('/api/events');
    sse.addEventListener('listing:created', (e) => {
      beep(587, 'sine', 0.2);
      loadListings().then(() => {
        if (currentRole === 'donor') renderDonorCards();
        else if (currentRole === 'ngo') renderNgoCards();
        updateImpactStats();
      });
    });

    sse.addEventListener('listing:claimed', (e) => {
      beep(659, 'sine', 0.25);
      loadListings().then(() => {
        if (currentRole === 'donor') renderDonorCards();
        else if (currentRole === 'ngo') renderNgoCards();
        updateImpactStats();
      });
    });

    sse.addEventListener('listing:completed', (e) => {
      beep(880, 'sine', 0.3);
      loadListings().then(() => {
        if (currentRole === 'donor') renderDonorCards();
        else if (currentRole === 'ngo') renderNgoCards();
        updateImpactStats();
      });
    });

    sse.addEventListener('listing:deleted', (e) => {
      loadListings().then(() => {
        if (currentRole === 'donor') renderDonorCards();
        else if (currentRole === 'ngo') renderNgoCards();
      });
    });
  } catch (err) {
    console.warn('SSE stream error:', err);
  }
}

// Dynamic Impact Stats Hydration
async function updateImpactStats() {
  if (!API_BASE) return;
  try {
    const email = (currentUserProfile && currentUserProfile.email) || currentEmail || '';
    const res = await fetch(`${API_BASE}/stats?email=${encodeURIComponent(email)}`);
    const json = await res.json();
    if (!json.success || !json.data) return;

    const data = json.data;
    const mealsEl = document.getElementById('donor-impact-meals');
    const carbonEl = document.getElementById('donor-impact-carbon');
    const licenseEl = document.getElementById('donor-impact-license');
    const bannerDivertedEl = document.getElementById('donor-banner-diverted');

    const userStats = data.userStats;
    if (userStats) {
      if (mealsEl) mealsEl.textContent = `${userStats.meals} Meals`;
      if (carbonEl) carbonEl.textContent = userStats.carbon;
      if (licenseEl) licenseEl.textContent = userStats.license || 'FSSAI Active';
      if (bannerDivertedEl) bannerDivertedEl.textContent = `${Math.round(userStats.meals * 0.45).toLocaleString()} kg`;
    } else {
      if (mealsEl) mealsEl.textContent = `${data.divertedMeals.toLocaleString()} Meals`;
      if (carbonEl) carbonEl.textContent = `${data.carbonOffsetKg} kg CO₂e`;
      if (bannerDivertedEl) bannerDivertedEl.textContent = `${data.divertedKg.toLocaleString()} kg`;
    }
  } catch (e) {
    console.warn('Failed to load stats:', e);
  }
}

// Initial Fallback Profiles (for offline / file:// usage)
const fallbackUsers = {
  'chef.royalspice@gmail.com': {
    email: 'chef.royalspice@gmail.com',
    name: 'Royal Spice Caterers',
    role: 'donor',
    photo: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100&auto=format&fit=crop&q=80',
    kitchenType: 'Banquets & Commercial Kitchen',
    licenseId: 'FSSAI-10019022008432',
    phone: '+91 98765 43210',
    address: '42 Heritage Boulevard, Downtown Commercial Zone',
    operatingHours: '10:00 AM - 11:30 PM',
    mealsDiverted: 620,
    carbonOffset: '355.8 kg CO₂e',
    lat: 28.6139,
    lng: 77.2090,
    gpsAddress: '42 Heritage Blvd, Central Sector',
    verified: true
  },
  'contact.hopeshelter@gmail.com': {
    email: 'contact.hopeshelter@gmail.com',
    name: 'Hope Shelter Network',
    role: 'ngo',
    photo: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=100&auto=format&fit=crop&q=80',
    shelterType: 'Community Relief & Orphanage Care',
    regId: 'NGO-DARPAN/DL/2019/0248819',
    phone: '+91 98123 45678',
    address: 'Sector 14 Community Center, Metro Relief District',
    capacity: '350 Meals / Day',
    fleet: '4 Delivery Vans, 2 Electric Bikes',
    section80G: 'Active & Verified',
    mealsServed: 1850,
    lat: 28.6250,
    lng: 77.2180,
    gpsAddress: 'Sector 14 Community Center, Metro Relief',
    verified: true
  }
};

// Initial Fallback Listings (20 Items Total)
const fallbackListings = [
  { id: 1, title: '30 Servings Veg Thali', donor: 'Royal Spice Caterers', dist: '1.2 km', lat: 28.6139, lng: 77.2090, icon: '🍲', expires: '1h 20m', tag: '⚡ Urgent (<2h)', tagColor: 'amber', status: 'Driver En Route', claimed: true, extra: 'Driver: Mark R. • ETA 12m', quantity: 30, servings: 30, category: 'Cooked Meals' },
  { id: 2, title: '15 Packed Rice Bowls', donor: 'Green Earth Bistro', dist: '0.8 km', lat: 28.6190, lng: 77.2130, icon: '🍱', expires: '2h 45m', tag: 'Fresh Pack', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Listed 20m ago', quantity: 15, servings: 15, category: 'Cooked Meals' },
  { id: 3, title: '25 Sourdough Loaves', donor: 'Golden Crust Bakery', dist: '2.4 km', lat: 28.6280, lng: 77.2250, icon: '🥖', expires: '6h 10m', tag: 'Artisan Bakery', tagColor: 'purple', status: 'Awaiting NGO Claim', claimed: false, extra: 'Ready for pickup', quantity: 25, servings: 50, category: 'Bakery & Bread' },
  { id: 4, title: '40 Sandwich Boxes', donor: 'TechHub Conference', dist: '1.8 km', lat: 28.6080, lng: 77.2010, icon: '🥪', expires: '1h 45m', tag: 'Assorted Wraps', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Refrigerated', quantity: 20, servings: 40, category: 'Packaged Dry' },
  { id: 5, title: '50 Portions Paneer Butter Masala', donor: 'Spice Symphony Kitchen', dist: '1.5 km', lat: 28.6160, lng: 77.2140, icon: '🍛', expires: '2h 15m', tag: '⚡ Hot Meals', tagColor: 'amber', status: 'Awaiting NGO Claim', claimed: false, extra: 'Prepared 45m ago', quantity: 35, servings: 50, category: 'Cooked Meals' },
  { id: 6, title: '20 Fresh Fruit Salads & Juices', donor: 'Orchard Fresh Cafe', dist: '0.6 km', lat: 28.6175, lng: 77.2110, icon: '🥗', expires: '3h 30m', tag: 'Healthy Raw', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Chilled containers', quantity: 18, servings: 20, category: 'Raw Produce' },
  { id: 7, title: '35 Hyderabadi Dum Biryani Trays', donor: 'Nizam Royal Kitchen', dist: '3.1 km', lat: 28.6310, lng: 77.2290, icon: '🍲', expires: '2h 00m', tag: '⚡ High Demand', tagColor: 'amber', status: 'Awaiting NGO Claim', claimed: false, extra: 'Family trays', quantity: 40, servings: 35, category: 'Cooked Meals' },
  { id: 8, title: '60 Assorted Dinner Rolls & Buns', donor: 'Daily Bread Bakehouse', dist: '1.1 km', lat: 28.6145, lng: 77.2065, icon: '🥐', expires: '8h 00m', tag: 'Bakery Fresh', tagColor: 'purple', status: 'Awaiting NGO Claim', claimed: false, extra: 'Sealed food crates', quantity: 22, servings: 60, category: 'Bakery & Bread' },
  { id: 9, title: '25 Dal Makhani & Jeera Rice', donor: 'Punjabi Rasoi', dist: '2.2 km', lat: 28.6220, lng: 77.2200, icon: '🍛', expires: '1h 50m', tag: '⚡ Hot & Fresh', tagColor: 'amber', status: 'Awaiting NGO Claim', claimed: false, extra: 'Thermal insulated packs', quantity: 28, servings: 25, category: 'Cooked Meals' },
  { id: 10, title: '18 Whole Wheat Pasta Bowls', donor: 'Bella Italia Trattoria', dist: '1.7 km', lat: 28.6105, lng: 77.2040, icon: '🍝', expires: '3h 15m', tag: 'Fresh Pack', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Individually boxed', quantity: 15, servings: 18, category: 'Cooked Meals' },
  { id: 11, title: '45 South Indian Idli & Sambar', donor: 'Sagar Ratna Express', dist: '2.8 km', lat: 28.6290, lng: 77.2260, icon: '🥣', expires: '2h 30m', tag: 'Steamed Food', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Packed with coconut chutney', quantity: 30, servings: 45, category: 'Cooked Meals' },
  { id: 12, title: '30 Veg Hakka Noodles & Manchurian', donor: 'Red Wok Bistro', dist: '1.9 km', lat: 28.6095, lng: 77.2025, icon: '🍜', expires: '2h 10m', tag: 'Wok Fresh', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Sealed meal containers', quantity: 25, servings: 30, category: 'Cooked Meals' },
  { id: 13, title: '22 Fresh Butter Croissants', donor: 'Le Petit Paris Bakery', dist: '0.9 km', lat: 28.6180, lng: 77.2120, icon: '🥐', expires: '7h 30m', tag: 'Artisan Bakery', tagColor: 'purple', status: 'Awaiting NGO Claim', claimed: false, extra: 'Breakfast excess', quantity: 14, servings: 22, category: 'Bakery & Bread' },
  { id: 14, title: '55 Khichdi & Mixed Veg Bowls', donor: 'Satvik Bhojan Kendra', dist: '1.4 km', lat: 28.6155, lng: 77.2080, icon: '🍲', expires: '3h 00m', tag: 'Nutritious Diet', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Wholesome warm pots', quantity: 38, servings: 55, category: 'Cooked Meals' },
  { id: 15, title: '40 Rajma Chawal Lunch Boxes', donor: 'Delhi Delights Caterers', dist: '2.0 km', lat: 28.6210, lng: 77.2185, icon: '🍱', expires: '1h 30m', tag: '⚡ Urgent (<2h)', tagColor: 'amber', status: 'Awaiting NGO Claim', claimed: false, extra: 'Corporate lunch surplus', quantity: 32, servings: 40, category: 'Cooked Meals' },
  { id: 16, title: '28 Stuffed Parathas with Curd', donor: 'Highway Dhaba Kitchen', dist: '3.5 km', lat: 28.6340, lng: 77.2320, icon: '🫓', expires: '4h 00m', tag: 'Fresh Prepared', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Foil packed in pairs', quantity: 24, servings: 28, category: 'Cooked Meals' },
  { id: 17, title: '16 Quinoa & Roasted Veggie Bowls', donor: 'Healthy Harvest Cafe', dist: '1.3 km', lat: 28.6140, lng: 77.2070, icon: '🥗', expires: '3h 45m', tag: 'Superfood Salad', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Eco-friendly kraft boxes', quantity: 12, servings: 16, category: 'Raw Produce' },
  { id: 18, title: '35 Mixed Vegetable Pulao Pots', donor: 'Golden Spoon Banquets', dist: '2.6 km', lat: 28.6270, lng: 77.2240, icon: '🍚', expires: '2h 20m', tag: 'Fresh Feast', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Catering excess', quantity: 28, servings: 35, category: 'Cooked Meals' },
  { id: 19, title: '50 Multigrain Roti & Chana Packs', donor: 'Desi Rasoi Express', dist: '1.0 km', lat: 28.6165, lng: 77.2105, icon: '🫓', expires: '2h 40m', tag: 'High Protein', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Stacked & warm', quantity: 30, servings: 50, category: 'Cooked Meals' },
  { id: 20, title: '24 Fresh Salads & Cut Melons', donor: 'Urban Green Co.', dist: '0.7 km', lat: 28.6185, lng: 77.2125, icon: '🍉', expires: '4h 30m', tag: 'Chilled Fresh', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Cold storage dispatched', quantity: 16, servings: 24, category: 'Raw Produce' }
];

// Pagination State (Single Section Multi-page arrangement)
let ngoCurrentPage = 1;
const ngoItemsPerPage = 3; // 20 items / 3 per page = 7 pages (1, 2, 3 ... 7)
let donorCurrentPage = 1;
const donorItemsPerPage = 4;

// 2. Web Audio Helper
function beep(freq = 520, type = 'sine', duration = 0.15) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

// 3. Login & Authentication Handlers
function setLoginTab(tab) {
  const donorCard = document.getElementById('card-donor-login');
  const ngoCard = document.getElementById('card-ngo-login');
  const donorBtn = document.getElementById('tab-donor-btn');
  const ngoBtn = document.getElementById('tab-ngo-btn');
  if (!donorCard || !ngoCard || !donorBtn || !ngoBtn) return;

  if (tab === 'donor') {
    donorCard.classList.remove('hidden');
    ngoCard.classList.add('hidden');
    donorBtn.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition bg-white text-emerald-700 shadow-sm flex items-center justify-center gap-1.5';
    ngoBtn.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5';
  } else {
    donorCard.classList.add('hidden');
    ngoCard.classList.remove('hidden');
    ngoBtn.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition bg-white text-blue-700 shadow-sm flex items-center justify-center gap-1.5';
    donorBtn.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5';
  }
  lucide.createIcons();
}

function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input || !icon) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    icon.setAttribute('data-lucide', 'eye');
  }
  lucide.createIcons();
}

function handleDonorLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const emailInput = document.getElementById('donor-email');
  const passwordInput = document.getElementById('donor-password');
  const errorMsg = document.getElementById('donor-login-error');

  const email = (emailInput && emailInput.value.trim()) || '';
  const password = (passwordInput && passwordInput.value.trim()) || '';

  if (!email || !password) {
    if (errorMsg) {
      errorMsg.textContent = 'Please enter both email and password.';
      errorMsg.classList.remove('hidden');
    }
    beep(250, 'sawtooth');
    return;
  }

  if (errorMsg) errorMsg.classList.add('hidden');

  let user = fallbackUsers[email] || {
    email: email,
    name: email.split('@')[0].replace('.', ' ').toUpperCase(),
    role: 'donor',
    photo: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100&auto=format&fit=crop&q=80',
    phone: '+91 98111 22334',
    address: 'Food Boulevard, City Central',
    kitchenType: 'Commercial Kitchen',
    licenseId: 'FSSAI-10019022008432',
    capacity: '200 Meals/Day',
    operatingHours: '08:00 AM - 11:00 PM',
    lat: 28.6139,
    lng: 77.2090,
    gpsAddress: 'Connaught Place Station',
    verified: true
  };

  currentUserProfile = user;
  currentRole = 'donor';
  currentEmail = user.email;
  currentEntity = user.name;
  if (user.lat) donorLat = parseFloat(user.lat);
  if (user.lng) donorLng = parseFloat(user.lng);

  switchView('donor');
  beep(523);
  confetti({ particleCount: 50, spread: 65, colors: ['#10B981', '#34D399'] });
}

function handleNgoLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const emailInput = document.getElementById('ngo-email');
  const passwordInput = document.getElementById('ngo-password');
  const errorMsg = document.getElementById('ngo-login-error');

  const email = (emailInput && emailInput.value.trim()) || '';
  const password = (passwordInput && passwordInput.value.trim()) || '';

  if (!email || !password) {
    if (errorMsg) {
      errorMsg.textContent = 'Please enter both email/ID and password.';
      errorMsg.classList.remove('hidden');
    }
    beep(250, 'sawtooth');
    return;
  }

  if (errorMsg) errorMsg.classList.add('hidden');

  let user = fallbackUsers[email] || {
    email: email,
    name: email.split('@')[0].replace('.', ' ').toUpperCase(),
    role: 'ngo',
    photo: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=100&auto=format&fit=crop&q=80',
    phone: '+91 98765 43210',
    address: 'Sector 4, Community Welfare Lane',
    shelterType: 'Night Shelter & Relief Center',
    regId: 'NGO-DARPAN-DL/2021/029184',
    capacity: '350 People/Day',
    fleet: '2 Vans, 1 Electric Auto',
    operatingHours: '24/7 Relief Operations',
    lat: 28.6219,
    lng: 77.2144,
    gpsAddress: 'Barakhamba Shelter Station',
    verified: true
  };

  currentUserProfile = user;
  currentRole = 'ngo';
  currentEmail = user.email;
  currentEntity = user.name;
  if (user.lat) donorLat = parseFloat(user.lat);
  if (user.lng) donorLng = parseFloat(user.lng);

  switchView('ngo');
  beep(659);
  confetti({ particleCount: 50, spread: 65, colors: ['#3B82F6', '#60A5FA'] });
}

// Admin State
let activeAdminTab = 'overview';
let adminUsersList = [
  {
    id: 'u-101',
    name: 'Royal Spice Caterers',
    email: 'chef.royalspice@gmail.com',
    role: 'DONOR',
    status: 'ACTIVE',
    licenseId: 'FSSAI-10019022008432'
  },
  {
    id: 'u-102',
    name: 'Hope Shelter Network',
    email: 'contact.hopeshelter@gmail.com',
    role: 'NGO',
    status: 'ACTIVE',
    licenseId: 'NGO-DARPAN-DL/2021/029184'
  },
  {
    id: 'u-103',
    name: 'City Banquet Hall',
    email: 'manager.citybanquet@gmail.com',
    role: 'DONOR',
    status: 'PENDING_VERIFICATION',
    licenseId: 'FSSAI-20038190012847'
  },
  {
    id: 'u-104',
    name: 'Sarah Connor',
    email: 'sarah.admin@annwaste.org',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    licenseId: 'INTERNAL-EMP-001'
  }
];

let adminAuditLogs = [
  {
    id: 'log-01',
    action: 'USER_ROLE_CHANGE',
    details: 'Sarah Connor (SUPER_ADMIN) assigned DISPATCHER permissions to contact.hopeshelter@gmail.com.',
    time: 'Today at 20:10 UTC'
  },
  {
    id: 'log-02',
    action: 'LISTING_DELETE',
    details: 'Alex Vance (ADMIN) purged expired batch list-489 due to food safety regulations.',
    time: 'Today at 19:45 UTC'
  },
  {
    id: 'log-03',
    action: 'USER_STATUS_CHANGE',
    details: 'System compliance check verified license FSSAI-10019022008432 for Royal Spice Caterers.',
    time: 'Today at 18:20 UTC'
  }
];

function logAdminAudit(action, details) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' UTC';
  adminAuditLogs.unshift({
    id: 'log-' + Date.now(),
    action,
    details,
    time
  });
  renderAdminAuditLogs();
}

function switchAdminTab(tabName) {
  activeAdminTab = tabName;
  const tabs = ['overview', 'listings', 'users', 'analytics', 'audit'];
  const titles = {
    overview: 'System Analytics & Health Overview',
    listings: 'Food Resources & Listings Manager (CRUD)',
    users: 'User Directory & Role Authorization (RBAC)',
    analytics: 'Environmental Impact & Resource Conservation',
    audit: 'Immutable Security Audit Trail & Compliance'
  };

  tabs.forEach(t => {
    const panel = document.getElementById(`admin-panel-${t}`);
    const navBtn = document.getElementById(`admin-nav-${t}`);
    if (panel) panel.classList.toggle('hidden', t !== tabName);
    if (navBtn) {
      if (t === tabName) {
        navBtn.className = 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition bg-emerald-600 text-white shadow-md shadow-emerald-900/30';
      } else {
        navBtn.className = 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition text-slate-400 hover:text-slate-200 hover:bg-slate-800/60';
      }
    }
  });

  const headerTitle = document.getElementById('admin-header-title');
  if (headerTitle && titles[tabName]) headerTitle.textContent = titles[tabName];

  if (tabName === 'listings') renderAdminListingsTable();
  if (tabName === 'users') renderAdminUsersTable();
  if (tabName === 'audit') renderAdminAuditLogs();

  lucide.createIcons();
}

function renderAdminUsersTable(search = '') {
  const tbody = document.getElementById('admin-users-table-body');
  const countEl = document.getElementById('admin-user-count');
  if (!tbody) return;

  const filtered = adminUsersList.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.licenseId.toLowerCase().includes(search.toLowerCase())
  );

  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500">
      <img src="logo.png" alt="Ann" class="w-8 h-8 mx-auto mb-2 opacity-50 ann-empty-state-logo">
      <p class="font-medium text-xs text-slate-400">No partner accounts found matching "${search}"</p>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(u => `
    <tr class="hover:bg-slate-800/40 transition">
      <td class="p-3.5">
        <p class="font-bold text-white">${u.name}</p>
        <p class="text-slate-400 text-[11px] font-mono">${u.email}</p>
      </td>
      <td class="p-3.5">
        <select onchange="adminChangeRole('${u.id}', this.value)" class="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none">
          <option value="DONOR" ${u.role === 'DONOR' ? 'selected' : ''}>DONOR</option>
          <option value="NGO" ${u.role === 'NGO' ? 'selected' : ''}>NGO</option>
          <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
          <option value="SUPER_ADMIN" ${u.role === 'SUPER_ADMIN' ? 'selected' : ''}>SUPER_ADMIN</option>
        </select>
      </td>
      <td class="p-3.5 font-mono text-slate-400 text-[11px]">${u.licenseId}</td>
      <td class="p-3.5">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          u.status === 'ACTIVE'
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : u.status === 'SUSPENDED'
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        }">
          ${u.status}
        </span>
      </td>
      <td class="p-3.5 text-right">
        <button 
          onclick="adminToggleUserStatus('${u.id}')"
          class="px-3 py-1 rounded-lg text-xs font-bold transition ${
            u.status === 'ACTIVE'
              ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30'
              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
          }"
        >
          ${u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
        </button>
      </td>
    </tr>
  `).join('');

  lucide.createIcons();
}

function adminToggleUserStatus(id) {
  const user = adminUsersList.find(u => u.id === id);
  if (!user) return;
  const prev = user.status;
  user.status = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  logAdminAudit('USER_STATUS_CHANGE', `Sarah Connor (SUPER_ADMIN) changed status of ${user.name} from ${prev} to ${user.status}.`);
  renderAdminUsersTable();
  beep(440);
}

function adminChangeRole(id, newRole) {
  const user = adminUsersList.find(u => u.id === id);
  if (!user) return;
  const prev = user.role;
  user.role = newRole;
  logAdminAudit('USER_ROLE_CHANGE', `Sarah Connor (SUPER_ADMIN) updated authorization of ${user.name} from ${prev} to ${newRole}.`);
  renderAdminUsersTable();
  beep(520);
}

let adminListingsPage = 1;
const adminListingsPerPage = 5;

function setAdminPage(page) {
  adminListingsPage = page;
  renderAdminListingsTable();
  beep(480);
}

function renderAdminListingsTable(search = '') {
  const tbody = document.getElementById('admin-listings-table-body');
  if (!tbody) return;

  const filtered = listings.filter(l => 
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    l.donor.toLowerCase().includes(search.toLowerCase()) ||
    (l.category && l.category.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / adminListingsPerPage));
  if (adminListingsPage > totalPages) adminListingsPage = totalPages;
  if (adminListingsPage < 1) adminListingsPage = 1;

  const startIdx = (adminListingsPage - 1) * adminListingsPerPage;
  const endIdx = Math.min(startIdx + adminListingsPerPage, filtered.length);
  const pageItems = filtered.slice(startIdx, endIdx);

  const rangeEl = document.getElementById('admin-listings-page-range');
  const totalEl = document.getElementById('admin-listings-total');
  const paginationEl = document.getElementById('admin-listings-pagination');

  if (rangeEl) rangeEl.textContent = `${filtered.length === 0 ? 0 : startIdx + 1} - ${endIdx}`;
  if (totalEl) totalEl.textContent = filtered.length;
  if (paginationEl) paginationEl.innerHTML = buildPaginationHTML(adminListingsPage, totalPages, 'setAdminPage');

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">
      <img src="logo.png" alt="Ann" class="w-8 h-8 mx-auto mb-2 opacity-50 ann-empty-state-logo">
      <p class="font-medium text-xs text-slate-400">No resource listings found matching "${search}"</p>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = pageItems.map(l => `
    <tr class="hover:bg-slate-800/40 transition">
      <td class="p-3.5">
        <p class="font-bold text-white">${l.title}</p>
        <p class="text-slate-400 text-[11px]">ID: #${l.id} • ${l.claimedAt ? 'Reserved' : 'Ready'}</p>
      </td>
      <td class="p-3.5 text-slate-300">${l.category || 'Cooked Meals'}</td>
      <td class="p-3.5 text-slate-300 font-semibold">${l.quantity} kg (${l.servings} meals)</td>
      <td class="p-3.5 text-slate-400">${l.donor}</td>
      <td class="p-3.5">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          l.status === 'Available'
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : l.status.includes('Claimed')
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            : 'bg-slate-800 text-slate-400'
        }">
          ${l.status}
        </span>
      </td>
      <td class="p-3.5 text-right">
        <button 
          onclick="adminDeleteListing(${l.id})"
          class="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
          title="Force Delete Listing"
        >
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>
    </tr>
  `).join('');

  lucide.createIcons();
}

function adminDeleteListing(id) {
  if (!confirm('Are you sure you want to administratively purge listing #' + id + '?')) return;
  const index = listings.findIndex(l => l.id === id);
  if (index !== -1) {
    const item = listings[index];
    listings.splice(index, 1);
    logAdminAudit('LISTING_DELETE', `Admin Sarah Connor purged resource listing #${id} ("${item.title}").`);
    renderAdminListingsTable();
    beep(300, 'sawtooth');
  }
}

function openAdminCreateListingModal() {
  const modal = document.getElementById('admin-create-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
  }
}

function closeAdminCreateModal() {
  const modal = document.getElementById('admin-create-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function handleAdminCreateListing(e) {
  if (e && e.preventDefault) e.preventDefault();
  const title = document.getElementById('admin-new-title').value.trim();
  const kg = parseFloat(document.getElementById('admin-new-kg').value) || 20;
  const servings = parseInt(document.getElementById('admin-new-servings').value, 10) || 60;
  const category = document.getElementById('admin-new-category').value;
  const donor = document.getElementById('admin-new-donor').value.trim() || 'Royal Spice Caterers';

  const newId = Date.now();
  const newListing = {
    id: newId,
    title,
    category,
    quantity: kg,
    servings,
    donor,
    expiry: 'Within 4 hours',
    status: 'Available',
    phone: '+91 98111 22334',
    address: 'Connaught Place Central Station',
    lat: 28.6139,
    lng: 77.2090,
    tags: ['Fresh', 'Admin Verified'],
    createdAt: new Date().toISOString()
  };

  listings.unshift(newListing);
  logAdminAudit('LISTING_CREATE', `Admin override created listing #${newId} ("${title}", ${kg}kg) for ${donor}.`);
  closeAdminCreateModal();
  renderAdminListingsTable();
  beep(587);
}

function renderAdminAuditLogs() {
  const container = document.getElementById('admin-audit-log-container');
  if (!container) return;

  container.innerHTML = adminAuditLogs.map(log => `
    <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div>
        <span class="font-bold ${log.action.includes('DELETE') ? 'text-red-400' : log.action.includes('ROLE') ? 'text-amber-400' : 'text-emerald-400'}">[${log.action}]</span>
        <span class="text-slate-300 ml-1.5">${log.details}</span>
      </div>
      <span class="text-slate-500 text-[11px] shrink-0 font-mono">${log.time}</span>
    </div>
  `).join('');

  lucide.createIcons();
}

function adminExportCSV(type) {
  let csvContent = 'data:text/csv;charset=utf-8,';
  
  if (type === 'users' || activeAdminTab === 'users') {
    csvContent += 'ID,Name,Email,Role,Status,License\n';
    adminUsersList.forEach(u => {
      csvContent += `"${u.id}","${u.name}","${u.email}","${u.role}","${u.status}","${u.licenseId}"\n`;
    });
  } else {
    csvContent += 'ID,Title,Category,QuantityKg,Servings,Donor,Status\n';
    listings.forEach(l => {
      csvContent += `"${l.id}","${l.title}","${l.category || 'Cooked Meals'}",${l.quantity},${l.servings},"${l.donor}","${l.status}"\n`;
    });
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `ann_admin_export_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  beep(659);
}

function quickLogin(role) {
  if (role === 'donor') {
    const emailInput = document.getElementById('donor-email');
    const pwdInput = document.getElementById('donor-password');
    if (emailInput) emailInput.value = 'chef.royalspice@gmail.com';
    if (pwdInput) pwdInput.value = 'password123';
    handleDonorLogin(new Event('submit'));
  } else if (role === 'ngo') {
    const emailInput = document.getElementById('ngo-email');
    const pwdInput = document.getElementById('ngo-password');
    if (emailInput) emailInput.value = 'contact.hopeshelter@gmail.com';
    if (pwdInput) pwdInput.value = 'password123';
    handleNgoLogin(new Event('submit'));
  } else if (role === 'admin') {
    currentRole = 'admin';
    currentUserProfile = {
      name: 'Sarah Connor',
      email: 'sarah.admin@annwaste.org',
      role: 'SUPER_ADMIN'
    };
    switchView('admin');
    beep(784);
    confetti({ particleCount: 60, spread: 80, colors: ['#F59E0B', '#10B981'] });
  }
}

function logout() {
  beep(350, 'triangle');
  currentRole = null;
  currentEmail = '';
  currentUserProfile = null;
  switchView('login');
}

// 4. View Routing & Header Hydration
async function switchView(role = 'login') {
  currentRole = role;

  ['login', 'donor', 'ngo', 'admin'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      el.classList.toggle('hidden', v !== role);
      if (v === role) el.classList.add('flex');
      else el.classList.remove('flex');
    }
  });

  if (role === 'login') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    lucide.createIcons();
    return;
  }

  if (role === 'admin') {
    switchAdminTab('overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    lucide.createIcons();
    return;
  }

  if (!currentUserProfile) {
    if (role === 'donor') {
      currentUserProfile = fallbackUsers['chef.royalspice@gmail.com'];
    } else {
      currentUserProfile = fallbackUsers['contact.hopeshelter@gmail.com'];
    }
    currentEntity = currentUserProfile.name;
    currentEmail = currentUserProfile.email;
    if (currentUserProfile.lat) donorLat = parseFloat(currentUserProfile.lat);
    if (currentUserProfile.lng) donorLng = parseFloat(currentUserProfile.lng);
  }

  beep(role === 'donor' ? 523 : 659);
  await loadListings();

  // Hydrate Profile in Navigation & Badges
  if (currentUserProfile) {
    if (role === 'donor') {
      const bannerName = document.getElementById('donor-banner-name');
      const profileName = document.getElementById('donor-profile-name');
      const btnName = document.getElementById('donor-nav-btn-name');
      const avatar = document.getElementById('donor-nav-avatar');

      if (bannerName) bannerName.textContent = currentUserProfile.name;
      if (profileName) profileName.textContent = `${currentUserProfile.name} • Verified Kitchen`;
      if (btnName) btnName.textContent = currentUserProfile.name.split(' ')[0] || 'Profile';
      if (avatar && currentUserProfile.photo) avatar.src = currentUserProfile.photo;

      renderDonorCards();
      updateImpactStats();
      setTimeout(initDonorMap, 200);
    } else if (role === 'ngo') {
      const bannerName = document.getElementById('ngo-banner-name');
      const profileName = document.getElementById('ngo-profile-name');
      const btnName = document.getElementById('ngo-nav-btn-name');
      const avatar = document.getElementById('ngo-nav-avatar');

      if (bannerName) bannerName.textContent = currentUserProfile.name;
      if (profileName) profileName.textContent = `${currentUserProfile.name} • Verified Relief NGO`;
      if (btnName) btnName.textContent = currentUserProfile.name.split(' ')[0] || 'Profile';
      if (avatar && currentUserProfile.photo) avatar.src = currentUserProfile.photo;

      renderNgoCards();
      renderNgoNotifications();
      setTimeout(initNgoMap, 200);
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  lucide.createIcons();
}

// 5. Donor GPS Station & Interactive Maps
function initDonorMap() {
  const mapContainer = document.getElementById('donor-map');
  if (!mapContainer || typeof L === 'undefined') return;

  if (!donorMap) {
    donorMap = L.map('donor-map', { zoomControl: false }).setView([donorLat, donorLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(donorMap);

    // Custom Kitchen Pin Marker
    donorMarker = L.circleMarker([donorLat, donorLng], {
      radius: 8,
      fillColor: '#10B981',
      color: '#FFFFFF',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.95
    }).addTo(donorMap);
    donorMarker.bindPopup(`<b>${currentEntity || 'Kitchen Donor'}</b><br>Surplus Station`).openPopup();

    // 5 km Broadcast Radius Ring
    donorCircle = L.circle([donorLat, donorLng], {
      radius: 5000,
      color: '#10B981',
      weight: 1.5,
      dashArray: '4, 6',
      fillColor: '#10B981',
      fillOpacity: 0.08
    }).addTo(donorMap);
  } else {
    donorMap.invalidateSize();
    donorMap.setView([donorLat, donorLng], 13);
    if (donorMarker) donorMarker.setLatLng([donorLat, donorLng]);
    if (donorCircle) donorCircle.setLatLng([donorLat, donorLng]);
  }

  updateGpsDisplays();
}

function updateGpsDisplays() {
  const coordsStr = `${donorLat.toFixed(4)}° N, ${donorLng.toFixed(4)}° E`;
  const coordsEl = document.getElementById('donor-gps-coords');
  const modalGpsEl = document.getElementById('modal-gps-display');
  const gmapsLink = document.getElementById('donor-gmaps-link');
  const addrEl = document.getElementById('donor-gps-addr');

  if (coordsEl) coordsEl.textContent = coordsStr;
  if (modalGpsEl) modalGpsEl.textContent = coordsStr;
  if (gmapsLink) gmapsLink.href = `https://maps.google.com/?q=${donorLat},${donorLng}`;
  if (addrEl && currentUserProfile && currentUserProfile.address) {
    addrEl.textContent = currentUserProfile.address;
    addrEl.title = currentUserProfile.address;
  }
}

function detectDonorGps(forModal = false) {
  beep(480);
  const statusBadge = document.getElementById('donor-gps-status');
  if (statusBadge) {
    statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-spin"></span> Acquiring GPS...`;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        donorLat = pos.coords.latitude;
        donorLng = pos.coords.longitude;

        if (statusBadge) {
          statusBadge.className = "inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full";
          statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Live GPS Active`;
        }

        updateGpsDisplays();
        if (donorMap) {
          donorMap.setView([donorLat, donorLng], 14);
          if (donorMarker) donorMarker.setLatLng([donorLat, donorLng]);
          if (donorCircle) donorCircle.setLatLng([donorLat, donorLng]);
        }

        // Save updated coordinates to user profile
        if (currentUserProfile) {
          currentUserProfile.lat = donorLat;
          currentUserProfile.lng = donorLng;
          if (API_BASE) {
            try {
              await fetch(`${API_BASE}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUserProfile.email, lat: donorLat, lng: donorLng })
              });
            } catch (e) {}
          }
        }

        beep(660);
        confetti({ particleCount: 25, spread: 45 });
      },
      (err) => {
        console.warn('Geolocation warning/denied, using calibrated GPS station:', err);
        if (statusBadge) {
          statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> GPS Calibrated`;
        }
        updateGpsDisplays();
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  } else {
    updateGpsDisplays();
  }
}

// 5.1 NGO Real-Time Notification Center
let ngoNotifications = [
  {
    id: 'notif-1',
    type: 'urgent',
    title: '⚡ Urgent Food Rescue Alert',
    message: '30 Servings Veg Thali expires in < 1h 20m nearby at Royal Spice Caterers (1.2 km).',
    time: '5m ago',
    unread: true,
    listingId: 1,
    icon: 'alert-triangle',
    badgeColor: 'amber'
  },
  {
    id: 'notif-2',
    type: 'dispatch',
    title: '🚚 Volunteer Driver En Route',
    message: 'Driver Mark R. is en route to Hope Shelter with claimed surplus (ETA 12 mins).',
    time: '18m ago',
    unread: true,
    listingId: 1,
    icon: 'truck',
    badgeColor: 'blue'
  },
  {
    id: 'notif-3',
    type: 'new',
    title: '🍲 Fresh Surplus Broadcasted',
    message: '50 Portions Paneer Butter Masala listed by Spice Symphony Kitchen (1.5 km).',
    time: '32m ago',
    unread: true,
    listingId: 5,
    icon: 'sparkles',
    badgeColor: 'emerald'
  },
  {
    id: 'notif-4',
    type: 'delivered',
    title: '✅ Distribution Confirmed',
    message: '40 Sandwich Boxes from TechHub Conference verified and logged into relief ledger.',
    time: '2h ago',
    unread: false,
    listingId: 4,
    icon: 'check-circle-2',
    badgeColor: 'emerald'
  }
];

function toggleNgoNotifications() {
  const panel = document.getElementById('ngo-notifications-panel');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    panel.classList.remove('hidden');
    renderNgoNotifications();
    beep(520);
  } else {
    panel.classList.add('hidden');
  }
}

function renderNgoNotifications() {
  const listEl = document.getElementById('ngo-notifications-list');
  const badgeEl = document.getElementById('ngo-unread-badge');
  if (!listEl) return;

  const unreadCount = ngoNotifications.filter(n => n.unread).length;
  if (badgeEl) {
    if (unreadCount > 0) {
      badgeEl.textContent = unreadCount;
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.classList.add('hidden');
    }
  }

  if (ngoNotifications.length === 0) {
    listEl.innerHTML = `
      <div class="p-6 text-center text-slate-400 text-xs">
        <i data-lucide="bell-off" class="w-7 h-7 mx-auto mb-1.5 opacity-60"></i>
        <p>No notifications right now</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  listEl.innerHTML = ngoNotifications.map(n => `
    <div 
      onclick="handleNgoNotificationClick('${n.id}')"
      class="p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
        n.unread 
          ? 'bg-blue-50/70 border-blue-200 hover:bg-blue-100/60' 
          : 'bg-white border-slate-100 hover:bg-slate-50'
      }"
    >
      <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
        n.badgeColor === 'amber' ? 'bg-amber-100 text-amber-600' : (n.badgeColor === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600')
      }">
        <i data-lucide="${n.icon || 'bell'}" class="w-4 h-4"></i>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between gap-1">
          <span class="font-bold text-slate-900 text-xs leading-tight truncate">${n.title}</span>
          <span class="text-[10px] text-slate-400 shrink-0 font-medium">${n.time}</span>
        </div>
        <p class="text-xs text-slate-600 mt-0.5 line-clamp-2">${n.message}</p>
      </div>
      ${n.unread ? '<span class="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-2"></span>' : ''}
    </div>
  `).join('');

  lucide.createIcons();
}

function handleNgoNotificationClick(id) {
  const notif = ngoNotifications.find(n => n.id === id);
  if (!notif) return;
  notif.unread = false;
  renderNgoNotifications();

  if (notif.listingId) {
    plotNgoRoute(notif.listingId);
    const panel = document.getElementById('ngo-notifications-panel');
    if (panel) panel.classList.add('hidden');
  }
}

function markAllNgoNotificationsRead() {
  ngoNotifications.forEach(n => n.unread = false);
  renderNgoNotifications();
  beep(440);
}

function showNgoToast(title, message, type = 'info') {
  const container = document.getElementById('ngo-toast-container');
  if (!container) return;

  const toastId = 'toast-' + Date.now();
  const icon = type === 'success' ? 'check-circle-2' : (type === 'urgent' ? 'alert-triangle' : 'bell');
  const color = type === 'success' ? 'emerald' : (type === 'urgent' ? 'amber' : 'blue');

  const toast = document.createElement('div');
  toast.id = toastId;
  toast.className = `ngo-toast bg-white border border-${color}-200 shadow-2xl rounded-2xl p-3.5 flex items-start gap-3 text-xs pointer-events-auto border-l-4 border-l-${color}-600`;
  toast.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-${color}-100 text-${color}-700 flex items-center justify-center shrink-0 mt-0.5">
      <i data-lucide="${icon}" class="w-4 h-4"></i>
    </div>
    <div class="min-w-0 flex-1">
      <h5 class="font-extrabold text-slate-900 text-xs">${title}</h5>
      <p class="text-slate-600 mt-0.5 text-[11px] leading-relaxed">${message}</p>
    </div>
    <button onclick="document.getElementById('${toastId}')?.remove()" class="text-slate-400 hover:text-slate-600 p-1">
      <i data-lucide="x" class="w-3.5 h-3.5"></i>
    </button>
  `;

  container.appendChild(toast);
  lucide.createIcons();
  beep(type === 'success' ? 660 : 540);

  setTimeout(() => {
    const el = document.getElementById(toastId);
    if (el) el.remove();
  }, 5000);
}

// 5.2 NGO Nearby Surplus Food Radar Map
let ngoMap = null;
let ngoMarkersLayer = null;
let ngoStationMarker = null;
let ngoRadiusCircle = null;
let ngoRoutePolyline = null;
let currentNgoMapCategory = 'ALL';
const ngoStationLat = 28.6219;
const ngoStationLng = 77.2144;

function initNgoMap() {
  const mapContainer = document.getElementById('ngo-food-map');
  if (!mapContainer || typeof L === 'undefined') return;

  if (!ngoMap) {
    ngoMap = L.map('ngo-food-map', { zoomControl: true }).setView([ngoStationLat, ngoStationLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(ngoMap);

    // Custom Shelter Hub Icon
    const shelterIcon = L.divIcon({
      className: 'custom-shelter-marker',
      html: `
        <div class="w-9 h-9 rounded-2xl bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-black relative">
          <span class="absolute -inset-1 rounded-2xl bg-blue-400 opacity-60 animate-ping"></span>
          <span class="relative">NGO</span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    ngoStationMarker = L.marker([ngoStationLat, ngoStationLng], { icon: shelterIcon }).addTo(ngoMap);
    ngoStationMarker.bindPopup(`
      <div class="p-2 text-xs font-sans">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">Your Base Station</span>
        <h4 class="font-extrabold text-slate-900 text-sm mt-1">${currentEntity || 'Hope Shelter Network'}</h4>
        <p class="text-slate-500 mt-0.5">Primary Relief Reception & Kitchen Distribution Center</p>
      </div>
    `);

    // 5 km Broadcast Zone Ring
    ngoRadiusCircle = L.circle([ngoStationLat, ngoStationLng], {
      radius: 5000,
      color: '#3B82F6',
      weight: 1.5,
      dashArray: '5, 8',
      fillColor: '#3B82F6',
      fillOpacity: 0.05
    }).addTo(ngoMap);

    ngoMarkersLayer = L.layerGroup().addTo(ngoMap);
  } else {
    ngoMap.invalidateSize();
    ngoMap.setView([ngoStationLat, ngoStationLng], 13);
  }

  renderNgoMapMarkers();
}

function renderNgoMapMarkers() {
  if (!ngoMap || !ngoMarkersLayer) return;
  ngoMarkersLayer.clearLayers();

  let filtered = listings;
  if (currentNgoMapCategory === 'urgent') {
    filtered = listings.filter(i => (i.tag && i.tag.toLowerCase().includes('urgent')) || i.tagColor === 'amber');
  } else if (currentNgoMapCategory !== 'ALL') {
    filtered = listings.filter(i => (i.category || 'Cooked Meals') === currentNgoMapCategory);
  }

  filtered.forEach(item => {
    // Deterministic geo distribution around station if lat/lng missing
    const lat = item.lat || (ngoStationLat + (Math.sin(item.id * 1.7) * 0.022));
    const lng = item.lng || (ngoStationLng + (Math.cos(item.id * 1.7) * 0.022));

    const isClaimed = item.claimed;
    const isUrgent = (item.tag && item.tag.toLowerCase().includes('urgent')) || item.tagColor === 'amber';
    const pinColor = isClaimed ? '#64748B' : (isUrgent ? '#F59E0B' : '#10B981');
    const pinIcon = item.icon || '🍲';

    const foodIcon = L.divIcon({
      className: 'custom-food-marker',
      html: `
        <div style="background-color: ${pinColor}" class="w-8 h-8 rounded-2xl border-2 border-white shadow-md flex items-center justify-center text-sm cursor-pointer hover:scale-115 transition-transform">
          ${pinIcon}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([lat, lng], { icon: foodIcon }).addTo(ngoMarkersLayer);

    const popupHtml = `
      <div class="p-2 min-w-[220px] text-xs font-sans">
        <div class="flex items-center justify-between mb-1.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style="background-color: ${pinColor}20; color: ${pinColor}">
            ${item.tag || (isClaimed ? 'Claimed' : 'Available')}
          </span>
          <span class="text-[10px] text-slate-500 font-semibold">${item.expires || 'Within 2h'}</span>
        </div>
        <h4 class="font-extrabold text-slate-900 text-sm leading-tight">${item.title}</h4>
        <p class="text-slate-600 mt-1 flex items-center gap-1">
          <span class="font-bold text-slate-800">${item.donor || 'Kitchen Donor'}</span> • <span>${item.dist || '1.2 km'} away</span>
        </p>
        <p class="text-[11px] text-slate-500 mt-0.5">${item.quantity || 20} kg (${item.servings || 60} servings)</p>
        <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2">
          ${isClaimed 
            ? `<span class="flex-1 text-center py-1.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-[11px]">Claimed ✓</span>`
            : `<button onclick="claimFood(${item.id})" class="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-[11px] shadow-xs transition active:scale-95">Claim Food</button>`
          }
          <button onclick="plotNgoRoute(${item.id})" class="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-[11px] border border-blue-200 transition flex items-center gap-1 active:scale-95" title="Plot driving route on map">
            <span>Route</span>
          </button>
        </div>
      </div>
    `;
    marker.bindPopup(popupHtml);
  });
}

function recenterNgoMap() {
  if (!ngoMap) return;
  ngoMap.setView([ngoStationLat, ngoStationLng], 13);
  beep(480);
}

function filterNgoMapCategory(cat) {
  currentNgoMapCategory = cat;

  const pills = document.querySelectorAll('.ngo-map-filter-btn');
  pills.forEach(p => {
    p.className = 'ngo-map-filter-btn px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition text-xs';
  });

  const activeId = cat === 'ALL' ? 'ngo-map-btn-ALL' : (cat === 'urgent' ? 'ngo-map-btn-urgent' : (cat === 'Cooked Meals' ? 'ngo-map-btn-Cooked-Meals' : (cat === 'Bakery & Bread' ? 'ngo-map-btn-Bakery' : 'ngo-map-btn-Produce')));
  const activeBtn = document.getElementById(activeId);
  if (activeBtn) {
    activeBtn.className = 'ngo-map-filter-btn px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold transition shadow-xs text-xs';
  }

  renderNgoMapMarkers();
  beep(520);
}

function plotNgoRoute(listingId) {
  const item = listings.find(i => i.id === listingId);
  if (!item || !ngoMap) return;

  const targetLat = item.lat || (ngoStationLat + (Math.sin(item.id * 1.7) * 0.022));
  const targetLng = item.lng || (ngoStationLng + (Math.cos(item.id * 1.7) * 0.022));

  if (ngoRoutePolyline) {
    ngoMap.removeLayer(ngoRoutePolyline);
  }

  ngoRoutePolyline = L.polyline([
    [ngoStationLat, ngoStationLng],
    [targetLat, targetLng]
  ], {
    color: '#2563EB',
    weight: 4,
    dashArray: '8, 8',
    opacity: 0.9
  }).addTo(ngoMap);

  ngoMap.fitBounds(ngoRoutePolyline.getBounds(), { padding: [40, 40] });

  const clearBtn = document.getElementById('btn-clear-ngo-route');
  if (clearBtn) {
    clearBtn.classList.remove('hidden');
    clearBtn.classList.add('flex');
  }

  showNgoToast('Route Calculated', `~${item.dist || '1.2 km'} direct pickup route to ${item.donor}`, 'info');
  beep(600);
}

function clearNgoRoute() {
  if (ngoRoutePolyline && ngoMap) {
    ngoMap.removeLayer(ngoRoutePolyline);
    ngoRoutePolyline = null;
  }
  const clearBtn = document.getElementById('btn-clear-ngo-route');
  if (clearBtn) {
    clearBtn.classList.add('hidden');
    clearBtn.classList.remove('flex');
  }
  recenterNgoMap();
  beep(400);
}

// 6. NGO GPS Route & Navigation Modal
function openGpsRouteModal(listingId) {
  beep(480);
  const item = listings.find(l => l.id === listingId);
  if (!item) return;

  const targetLat = item.lat || 28.6139;
  const targetLng = item.lng || 77.2090;
  const ngoLat = 28.6250;
  const ngoLng = 77.2180;

  // Hydrate text fields
  document.getElementById('route-modal-title').textContent = `${item.title} • Route`;
  document.getElementById('route-modal-subtitle').textContent = `Pickup from: ${item.donor || 'Verified Donor'}`;
  document.getElementById('route-coords').textContent = `${targetLat.toFixed(4)}° N, ${targetLng.toFixed(4)}° E`;
  document.getElementById('route-address').textContent = item.gpsAddress || item.donor || 'Kitchen Location';
  document.getElementById('route-distance').textContent = item.dist || '1.4 km';
  document.getElementById('route-gmaps-btn').href = `https://www.google.com/maps/dir/?api=1&origin=${ngoLat},${ngoLng}&destination=${targetLat},${targetLng}`;

  const modal = document.getElementById('gps-route-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();

  // Initialize or re-center Route Map
  setTimeout(() => {
    if (typeof L === 'undefined') return;

    if (!routeMap) {
      routeMap = L.map('route-map', { zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(routeMap);
    }

    routeMap.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        routeMap.removeLayer(layer);
      }
    });

    // NGO Shelter Pin (Blue)
    const ngoMarker = L.circleMarker([ngoLat, ngoLng], {
      radius: 9,
      fillColor: '#2563EB',
      color: '#FFFFFF',
      weight: 2,
      fillOpacity: 0.95
    }).addTo(routeMap).bindPopup(`<b>Hope Shelter Hub</b><br>Dispatch Center`);

    // Donor Kitchen Pin (Green)
    const donorPin = L.circleMarker([targetLat, targetLng], {
      radius: 9,
      fillColor: '#10B981',
      color: '#FFFFFF',
      weight: 2,
      fillOpacity: 0.95
    }).addTo(routeMap).bindPopup(`<b>${item.donor}</b><br>${item.title}`).openPopup();

    // Turn-by-Turn Simulated Polyline Route
    const routeLine = L.polyline([
      [ngoLat, ngoLng],
      [(ngoLat + targetLat) / 2 + 0.002, (ngoLng + targetLng) / 2 - 0.001],
      [targetLat, targetLng]
    ], {
      color: '#2563EB',
      weight: 4,
      dashArray: '6, 8',
      opacity: 0.8
    }).addTo(routeMap);

    routeMap.invalidateSize();
    routeMap.fitBounds(L.featureGroup([ngoMarker, donorPin, routeLine]).getBounds().pad(0.2));
  }, 200);
}

function closeGpsRouteModal() {
  const modal = document.getElementById('gps-route-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// 7. Profile Management Modal
function openProfileModal() {
  if (!currentUserProfile) return;
  beep(450);

  const modal = document.getElementById('profile-modal');
  const avatar = document.getElementById('profile-modal-avatar');
  const nameEl = document.getElementById('profile-modal-name');
  const emailEl = document.getElementById('profile-modal-email');
  const roleBadge = document.getElementById('profile-modal-role-badge');
  const typeLabel = document.getElementById('profile-type-label');
  const licenseLabel = document.getElementById('profile-license-label');
  const extraFields = document.getElementById('profile-extra-fields');

  avatar.src = currentUserProfile.photo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUserProfile.email)}`;
  nameEl.textContent = currentUserProfile.name;
  emailEl.textContent = currentUserProfile.email;

  if (currentUserProfile.role === 'donor') {
    roleBadge.className = 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
    roleBadge.textContent = 'Food Donor';
    typeLabel.textContent = 'Kitchen / Food Category';
    licenseLabel.textContent = 'FSSAI Food License ID';

    extraFields.innerHTML = `
      <div class="flex justify-between py-1 border-b border-slate-200">
        <span class="text-slate-500">Operating Hours:</span>
        <strong class="text-slate-800">${currentUserProfile.operatingHours || '10:00 AM - 11:30 PM'}</strong>
      </div>
      <div class="flex justify-between py-1 border-b border-slate-200">
        <span class="text-slate-500">GPS Station Lock:</span>
        <strong class="font-mono text-emerald-700 font-bold">${donorLat.toFixed(4)}° N, ${donorLng.toFixed(4)}° E</strong>
      </div>
      <div class="flex justify-between py-1">
        <span class="text-slate-500">Surplus Diverted:</span>
        <strong class="text-emerald-700">${currentUserProfile.mealsDiverted || 620} Meals (${currentUserProfile.carbonOffset || '355.8 kg CO₂e'})</strong>
      </div>
    `;
  } else {
    roleBadge.className = 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800';
    roleBadge.textContent = 'NGO Relief Shelter';
    typeLabel.textContent = 'Shelter / Relief Type';
    licenseLabel.textContent = 'NGO Darpan / Registration ID';

    extraFields.innerHTML = `
      <div class="flex justify-between py-1 border-b border-slate-200">
        <span class="text-slate-500">Daily Feeding Capacity:</span>
        <strong class="text-slate-800">${currentUserProfile.capacity || '350 Meals / Day'}</strong>
      </div>
      <div class="flex justify-between py-1 border-b border-slate-200">
        <span class="text-slate-500">Delivery Fleet:</span>
        <strong class="text-slate-800">${currentUserProfile.fleet || '4 Delivery Vans'}</strong>
      </div>
      <div class="flex justify-between py-1">
        <span class="text-slate-500">80G Exemption Status:</span>
        <strong class="text-emerald-700">${currentUserProfile.section80G || 'Verified Active'}</strong>
      </div>
    `;
  }

  document.getElementById('profile-input-name').value = currentUserProfile.name || '';
  document.getElementById('profile-input-phone').value = currentUserProfile.phone || '';
  document.getElementById('profile-input-type').value = (currentUserProfile.role === 'donor' ? currentUserProfile.kitchenType : currentUserProfile.shelterType) || '';
  document.getElementById('profile-input-license').value = (currentUserProfile.role === 'donor' ? currentUserProfile.licenseId : currentUserProfile.regId) || '';
  document.getElementById('profile-input-address').value = currentUserProfile.address || '';

  document.getElementById('profile-status-msg').classList.add('hidden');

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function saveProfileChanges(e) {
  e.preventDefault();
  if (!currentUserProfile) return;

  const updatedData = {
    email: currentUserProfile.email,
    name: document.getElementById('profile-input-name').value.trim(),
    phone: document.getElementById('profile-input-phone').value.trim(),
    address: document.getElementById('profile-input-address').value.trim(),
    lat: donorLat,
    lng: donorLng
  };

  if (currentUserProfile.role === 'donor') {
    updatedData.kitchenType = document.getElementById('profile-input-type').value.trim();
    updatedData.licenseId = document.getElementById('profile-input-license').value.trim();
  } else {
    updatedData.shelterType = document.getElementById('profile-input-type').value.trim();
    updatedData.regId = document.getElementById('profile-input-license').value.trim();
  }

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      const data = await res.json();
      if (data.success) {
        currentUserProfile = data.data;
      }
    } catch (err) {
      console.warn('API error saving profile, updating locally:', err);
    }
  }

  Object.assign(currentUserProfile, updatedData);
  currentEntity = currentUserProfile.name;

  await switchView(currentUserProfile.role, currentUserProfile.name, currentUserProfile.email);

  beep(600);
  const statusMsg = document.getElementById('profile-status-msg');
  statusMsg.classList.remove('hidden');
  setTimeout(() => statusMsg.classList.add('hidden'), 3000);
}

// 8. Listings Data & Renderers
async function loadListings(query = '') {
  if (API_BASE) {
    try {
      let url = `${API_BASE}/listings`;
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (donorLat && donorLng) {
        params.append('lat', donorLat);
        params.append('lng', donorLng);
        params.append('sort', 'nearest');
      }
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        listings = data.data;
        return listings;
      }
    } catch (err) {
      console.warn('Backend API unavailable, using local memory cache:', err);
    }
  }

  if (listings.length === 0) listings = [...fallbackListings];
  if (query) {
    const q = query.toLowerCase().trim();
    return listings.filter(i => i.title.toLowerCase().includes(q) || (i.donor && i.donor.toLowerCase().includes(q)));
  }
  return listings;
}

// Pagination Helper Function (Matching exact uploaded visual design)
function buildPaginationHTML(currentPage, totalPages, clickHandlerName) {
  if (totalPages <= 1) return '';

  let html = `<div class="pagination-container">`;

  // Previous button
  const prevDisabled = currentPage <= 1;
  html += `
    <button 
      type="button"
      ${prevDisabled ? 'disabled' : `onclick="${clickHandlerName}(${currentPage - 1})"`}
      class="pagination-prev"
    >
      <i data-lucide="chevron-left" class="w-4 h-4"></i>
      <span>Previous</span>
    </button>
  `;

  // Compute page numbers with active box and ellipsis
  const pageNumbers = [];
  if (totalPages <= 6) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    if (currentPage <= 3) {
      pageNumbers.push(1, 2, 3, '...', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pageNumbers.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
    } else {
      pageNumbers.push(1, '...', currentPage, '...', totalPages);
    }
  }

  pageNumbers.forEach(p => {
    if (p === '...') {
      html += `<span class="pagination-dots">...</span>`;
    } else {
      const isActive = p === currentPage;
      if (isActive) {
        html += `
          <span class="pagination-active">
            ${p}
          </span>
        `;
      } else {
        html += `
          <button 
            type="button" 
            onclick="${clickHandlerName}(${p})"
            class="pagination-num"
          >
            ${p}
          </button>
        `;
      }
    }
  });

  // Next button
  const nextDisabled = currentPage >= totalPages;
  html += `
    <button 
      type="button"
      ${nextDisabled ? 'disabled' : `onclick="${clickHandlerName}(${currentPage + 1})"`}
      class="pagination-next"
    >
      <span>Next</span>
      <i data-lucide="chevron-right" class="w-4 h-4"></i>
    </button>
  `;

  html += `</div>`;
  return html;
}

function setNgoPage(page) {
  ngoCurrentPage = page;
  renderNgoCards();
  beep(480);
}

function setDonorPage(page) {
  donorCurrentPage = page;
  renderDonorCards();
  beep(480);
}

function renderDonorCards() {
  const activeContainer = document.getElementById('donor-listings-container');
  const claimedContainer = document.getElementById('donor-claimed-container');
  if (!activeContainer && !claimedContainer) return;

  const availableListings = listings.filter(item => !item.claimed);
  const claimedListings = listings.filter(item => item.claimed);

  const activeBadge = document.getElementById('donor-listing-badge');
  if (activeBadge) activeBadge.textContent = `${availableListings.length} Available`;

  const claimedBadge = document.getElementById('donor-claimed-badge');
  if (claimedBadge) claimedBadge.textContent = `${claimedListings.length} Claimed`;

  // 1. Render Available Surplus Listings (Paginated in single section)
  if (activeContainer) {
    const totalDonorPages = Math.max(1, Math.ceil(availableListings.length / donorItemsPerPage));
    if (donorCurrentPage > totalDonorPages) donorCurrentPage = totalDonorPages;
    if (donorCurrentPage < 1) donorCurrentPage = 1;

    const startDonorIdx = (donorCurrentPage - 1) * donorItemsPerPage;
    const endDonorIdx = Math.min(startDonorIdx + donorItemsPerPage, availableListings.length);
    const donorPageItems = availableListings.slice(startDonorIdx, endDonorIdx);

    const donorPageCurrentEl = document.getElementById('donor-page-current');
    const donorPageTotalEl = document.getElementById('donor-page-total');
    const donorPaginationControls = document.getElementById('donor-pagination-controls');

    if (donorPageCurrentEl) donorPageCurrentEl.textContent = donorCurrentPage;
    if (donorPageTotalEl) donorPageTotalEl.textContent = totalDonorPages;
    if (donorPaginationControls) {
      donorPaginationControls.innerHTML = buildPaginationHTML(donorCurrentPage, totalDonorPages, 'setDonorPage');
    }

    if (availableListings.length === 0) {
      activeContainer.innerHTML = `
        <div class="col-span-full p-8 text-center rounded-3xl bg-white/80 border border-slate-200/90 shadow-xs flex flex-col items-center justify-center">
          <img src="logo.png" alt="Ann Logo" class="w-12 h-12 object-contain opacity-70 mb-2.5 ann-empty-state-logo drop-shadow">
          <p class="text-sm font-bold text-slate-700">No active surplus waiting for claim</p>
          <p class="text-xs text-slate-400 mt-1 max-w-sm">Every surplus grain matters. Click "+ List Surplus Food" to broadcast excess meals to nearby shelters.</p>
        </div>
      `;
    } else {
      activeContainer.innerHTML = donorPageItems.map(item => `
        <div class="glass-card rounded-2xl p-4 shadow-soft border-l-4 border-l-emerald-500 flex flex-col justify-between hover:shadow-md transition">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">${item.tag || 'Available'}</span>
              <span class="text-xs font-semibold text-emerald-700">Awaiting NGO Claim</span>
            </div>
            <div class="flex items-start gap-3 mb-1">
              ${item.image 
                ? `<img src="${item.image}" alt="${item.title}" class="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs">` 
                : `<div class="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">${item.icon || '🍲'}</div>`
              }
              <div class="min-w-0 flex-1">
                <h4 class="font-bold text-slate-900 text-base leading-tight">${item.title}</h4>
                <div class="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
                  <span>Expires: ${item.expires}</span>
                  <span class="text-slate-300">•</span>
                  <span class="text-emerald-700 font-mono text-[11px] font-semibold">📍 GPS</span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            <span class="text-emerald-700 font-medium">● Ready for Pickup</span>
            <button onclick="removeDonorListing(${item.id})" class="text-xs text-red-500 hover:text-red-700 font-semibold transition">Cancel Listing</button>
          </div>
        </div>
      `).join('');
    }
  }

  // 2. Render Claimed Food by NGOs
  if (claimedContainer) {
    if (claimedListings.length === 0) {
      claimedContainer.innerHTML = `
        <div class="col-span-full p-8 text-center rounded-3xl bg-white/80 border border-slate-200/90 shadow-xs flex flex-col items-center justify-center">
          <img src="logo.png" alt="Ann Logo" class="w-12 h-12 object-contain opacity-70 mb-2.5 ann-empty-state-logo drop-shadow">
          <p class="text-sm font-bold text-slate-700">No items currently claimed</p>
          <p class="text-xs text-slate-400 mt-1 max-w-sm">When an NGO claims your surplus food, it will automatically move here with live dispatch status.</p>
        </div>
      `;
    } else {
      claimedContainer.innerHTML = claimedListings.map(item => `
        <div class="glass-card rounded-2xl p-4 shadow-soft border-l-4 border-l-blue-500 flex flex-col justify-between bg-blue-50/20 hover:shadow-md transition">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded flex items-center gap-1">
                <i data-lucide="check-circle-2" class="w-3 h-3 text-blue-600"></i> Claimed
              </span>
              <span class="text-xs font-bold text-blue-700">${item.status || 'Driver Dispatched'}</span>
            </div>
            <div class="flex items-start gap-3 mb-1">
              ${item.image 
                ? `<img src="${item.image}" alt="${item.title}" class="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs">` 
                : `<div class="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">${item.icon || '🍲'}</div>`
              }
              <div class="min-w-0 flex-1">
                <h4 class="font-bold text-slate-900 text-base leading-tight">${item.title}</h4>
                <p class="text-xs text-slate-600 mt-0.5 font-medium flex items-center gap-1">
                  <i data-lucide="heart-handshake" class="w-3.5 h-3.5 text-blue-500 shrink-0"></i>
                  <span>Claimed by: <strong class="text-slate-900">${item.claimedBy || 'Verified NGO'}</strong></span>
                </p>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between pt-3 mt-3 border-t border-slate-200/80 text-xs">
            <span class="text-blue-900 font-semibold flex items-center gap-1">
              <i data-lucide="navigation" class="w-3 h-3 text-blue-600"></i>
              <span>${item.extra || 'Driver En Route • ETA ~15m'}</span>
            </span>
            ${item.status === 'Delivered & Distributed'
              ? `<span class="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-lg text-[10px] shadow-xs flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Completed</span>`
              : `<button onclick="confirmHandover(${item.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10px] shadow-xs transition flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Confirm Handover</button>`
            }
          </div>
        </div>
      `).join('');
    }
  }

  lucide.createIcons();
}

async function renderNgoCards(query = '') {
  const container = document.getElementById('ngo-cards-container');
  if (!container) return;

  const allItems = await loadListings(query);
  const totalCount = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ngoItemsPerPage));

  if (ngoCurrentPage > totalPages) ngoCurrentPage = totalPages;
  if (ngoCurrentPage < 1) ngoCurrentPage = 1;

  const startIndex = (ngoCurrentPage - 1) * ngoItemsPerPage;
  const endIndex = Math.min(startIndex + ngoItemsPerPage, totalCount);
  const pageItems = allItems.slice(startIndex, endIndex);

  if (totalCount === 0) {
    container.innerHTML = `
      <div class="col-span-full p-8 text-center rounded-3xl bg-white/80 border border-slate-200/90 shadow-xs flex flex-col items-center justify-center">
        <img src="logo.png" alt="Ann Logo" class="w-12 h-12 object-contain opacity-70 mb-2.5 ann-empty-state-logo drop-shadow">
        <p class="text-sm font-bold text-slate-700">No surplus food listings found</p>
        <p class="text-xs text-slate-400 mt-1 max-w-sm">No donations match your query. Nearby kitchens broadcast fresh alerts in real-time.</p>
      </div>
    `;
  } else {
    container.innerHTML = pageItems.map(item => `
    <div class="glass-card rounded-2xl p-4 shadow-soft border-l-4 border-l-${item.tagColor || 'blue'}-500 flex flex-col justify-between hover:shadow-md transition">
      <div class="flex items-start gap-3 mb-3">
        ${item.image 
          ? `<img src="${item.image}" alt="${item.title}" class="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs">` 
          : `<div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shrink-0">${item.icon || '🍲'}</div>`
        }
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-1">
            <span class="text-[10px] font-bold uppercase bg-${item.tagColor || 'blue'}-100 text-${item.tagColor || 'blue'}-800 px-2 py-0.5 rounded truncate">${item.tag || 'Surplus'}</span>
            <button onclick="openGpsRouteModal(${item.id})" class="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded-md transition" title="View GPS Route on Map">
              <i data-lucide="navigation" class="w-3 h-3 text-blue-500"></i>
              <span>GPS Route</span>
            </button>
          </div>
          <h4 class="font-bold text-slate-900 text-sm sm:text-base mt-1 truncate" title="${item.title}">${item.title}</h4>
          <p class="text-xs text-slate-500 flex items-center gap-1 truncate">
            <i data-lucide="map-pin" class="w-3 h-3 text-emerald-600 shrink-0"></i>
            <span>${item.donor || 'Kitchen Donor'} • ${item.dist || '1.2 km'}</span>
          </p>
        </div>
      </div>
      <div class="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 text-xs">
        <span class="text-slate-500 font-medium">Expires: ${item.expires}</span>
        ${item.claimed 
          ? `<span class="bg-slate-800 text-emerald-300 font-bold px-3 py-1.5 rounded-xl">Claimed ✓</span>` 
          : `<button onclick="claimFood(${item.id})" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-xl shadow transition active:scale-95">Claim for NGO</button>`
        }
      </div>
    </div>
  `).join('');
  }

  // Update pagination indicators & render navigation
  const pageRange = document.getElementById('ngo-page-range');
  const totalCountEl = document.getElementById('ngo-total-count');
  const paginationControls = document.getElementById('ngo-pagination-controls');

  if (pageRange) pageRange.textContent = `${totalCount === 0 ? 0 : startIndex + 1} - ${endIndex}`;
  if (totalCountEl) totalCountEl.textContent = totalCount;
  if (paginationControls) {
    paginationControls.innerHTML = buildPaginationHTML(ngoCurrentPage, totalPages, 'setNgoPage');
  }

  lucide.createIcons();
}

// 9. Surplus Donation Modal & Actions with Custom Time Selection
let currentTimeMode = 'preset';

function setTimeMode(mode) {
  currentTimeMode = mode;
  beep(480);

  const btnPreset = document.getElementById('btn-mode-preset');
  const btnDuration = document.getElementById('btn-mode-duration');
  const btnSpecific = document.getElementById('btn-mode-specific');

  const activeClasses = ['bg-white', 'text-emerald-700', 'shadow-xs', 'font-bold'];
  const inactiveClasses = ['text-slate-600', 'font-normal'];

  [btnPreset, btnDuration, btnSpecific].forEach(btn => {
    btn.classList.remove(...activeClasses);
    btn.classList.add(...inactiveClasses);
  });

  const activeBtn = mode === 'preset' ? btnPreset : (mode === 'duration' ? btnDuration : btnSpecific);
  activeBtn.classList.remove(...inactiveClasses);
  activeBtn.classList.add(...activeClasses);

  document.getElementById('time-preset-container').classList.toggle('hidden', mode !== 'preset');
  document.getElementById('time-duration-container').classList.toggle('hidden', mode !== 'duration');
  document.getElementById('time-specific-container').classList.toggle('hidden', mode !== 'specific');
}

function getSelectedExpiryTime() {
  if (currentTimeMode === 'duration') {
    const hours = parseInt(document.getElementById('custom-duration-hours').value || '0', 10);
    const mins = parseInt(document.getElementById('custom-duration-mins').value || '0', 10);
    if (hours === 0 && mins === 0) return '1h 00m';
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours} Hour${hours > 1 ? 's' : ''}`;
    return `${mins} Mins`;
  } else if (currentTimeMode === 'specific') {
    const timeVal = document.getElementById('custom-exact-time').value;
    if (!timeVal) return 'By Tonight';
    const [h, m] = timeVal.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const formattedHour = h % 12 || 12;
    return `Until ${formattedHour}:${m < 10 ? '0' + m : m} ${period}`;
  }
  return document.getElementById('food-expiry-input').value;
}

// 9.1 Food Photo Capture & Preset Handlers
const foodPhotoPresets = {
  thali: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500&auto=format&fit=crop&q=80',
  rice: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500&auto=format&fit=crop&q=80',
  curry: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80',
  bakery: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80'
};
let selectedFoodPhoto = '';

function handlePhotoUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    selectedFoodPhoto = evt.target.result;
    showPhotoPreview(selectedFoodPhoto);
    beep(520);
  };
  reader.readAsDataURL(file);
}

function selectPresetPhoto(type) {
  selectedFoodPhoto = foodPhotoPresets[type] || '';
  if (selectedFoodPhoto) {
    showPhotoPreview(selectedFoodPhoto);
    beep(480);
  }
}

function showPhotoPreview(url) {
  const previewBox = document.getElementById('photo-preview-container');
  const previewImg = document.getElementById('food-photo-preview');
  const uploadZone = document.getElementById('photo-upload-zone');

  if (previewBox && previewImg) {
    previewImg.src = url;
    previewBox.classList.remove('hidden');
    if (uploadZone) uploadZone.classList.add('hidden');
  }
}

function removeSelectedPhoto() {
  selectedFoodPhoto = '';
  const previewBox = document.getElementById('photo-preview-container');
  const uploadZone = document.getElementById('photo-upload-zone');
  const fileInput = document.getElementById('food-photo-input');

  if (previewBox) previewBox.classList.add('hidden');
  if (uploadZone) uploadZone.classList.remove('hidden');
  if (fileInput) fileInput.value = '';
  beep(300, 'triangle');
}

function openDonationModal() {
  beep(440);
  removeSelectedPhoto();
  const now = new Date();
  now.setHours(now.getHours() + 3);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const timeInput = document.getElementById('custom-exact-time');
  if (timeInput) timeInput.value = `${hh}:${mm}`;

  updateGpsDisplays();

  const modal = document.getElementById('donation-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeDonationModal() {
  const modal = document.getElementById('donation-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function handleNewFoodSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('food-title-input').value;
  const expiry = getSelectedExpiryTime();

  const newPayload = {
    title,
    expires: expiry,
    donor: currentEntity || 'Royal Spice Caterers',
    donorEmail: (currentUserProfile && currentUserProfile.email) || currentEmail || 'chef.royalspice@gmail.com',
    lat: donorLat,
    lng: donorLng,
    gpsAddress: (currentUserProfile && currentUserProfile.address) || 'Verified Kitchen GPS Location',
    image: selectedFoodPhoto || null
  };

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPayload)
      });
      const result = await res.json();
      if (result.success) {
        await loadListings();
      }
    } catch (err) {
      console.warn('API error, saving locally:', err);
    }
  } else {
    listings.unshift({
      id: Date.now(),
      title,
      donor: currentEntity || 'Royal Spice Caterers',
      dist: 'Nearby (GPS)',
      icon: '🍲',
      image: selectedFoodPhoto || null,
      expires: expiry,
      lat: donorLat,
      lng: donorLng,
      gpsAddress: (currentUserProfile && currentUserProfile.address) || 'Kitchen GPS Location',
      tag: 'Just Listed',
      tagColor: 'emerald',
      status: 'Awaiting NGO Claim',
      claimed: false,
      extra: 'Ready for Pickup'
    });
  }

  renderDonorCards();
  closeDonationModal();
  document.getElementById('add-food-form').reset();
  removeSelectedPhoto();
  beep(587);
  confetti({ particleCount: 30, spread: 50 });
}

async function removeDonorListing(id) {
  if (API_BASE) {
    try {
      await fetch(`${API_BASE}/listings/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('API delete error:', err);
    }
  }
  listings = listings.filter(i => i.id !== id);
  renderDonorCards();
  beep(280, 'triangle');
}

async function claimFood(id) {
  const item = listings.find(i => i.id === id);
  if (item) {
    item.claimed = true;
    item.status = 'Awaiting Driver Pickup';

    // Add alert to NGO Notification Center
    ngoNotifications.unshift({
      id: 'notif-' + Date.now(),
      type: 'claimed',
      title: '✅ Surplus Food Reserved',
      message: `You claimed "${item.title}" (${item.quantity || 20}kg) from ${item.donor}. Volunteer driver dispatch initiated.`,
      time: 'Just now',
      unread: true,
      listingId: item.id,
      icon: 'check-circle-2',
      badgeColor: 'blue'
    });
    renderNgoNotifications();
    showNgoToast('Surplus Food Reserved!', `Successfully claimed "${item.title}" from ${item.donor}.`, 'success');
  }

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/listings/${id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ngo: currentEntity || 'Hope Shelter Network' })
      });
      const result = await res.json();
      if (result.success) {
        await loadListings();
      }
    } catch (err) {
      console.warn('API claim error:', err);
    }
  }

  renderNgoCards();
  renderNgoMapMarkers();
  beep(660);
  confetti({ particleCount: 40, spread: 70, colors: ['#3B82F6', '#60A5FA', '#10B981'] });
}

async function confirmHandover(id) {
  beep(520);
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/listings/${id}/complete`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await loadListings();
        renderDonorCards();
        updateImpactStats();
        beep(880);
        confetti({ particleCount: 40, spread: 60, colors: ['#10B981', '#34D399'] });
        return;
      }
    } catch (e) {
      console.warn('API error completing handover:', e);
    }
  }

  // Local fallback
  const item = listings.find(l => l.id === id);
  if (item) {
    item.status = 'Delivered & Distributed';
    item.extra = 'Handover Complete • Distributed';
  }
  renderDonorCards();
  beep(880);
}

function openTaxReceiptAlert() {
  const email = (currentUserProfile && currentUserProfile.email) || currentEmail || 'chef.royalspice@gmail.com';
  beep(520);
  if (API_BASE) {
    window.open(`${API_BASE}/certificate/80g?email=${encodeURIComponent(email)}`, '_blank');
  } else {
    alert("📄 Section 80G Tax Exemption Certificate downloaded for " + ((currentUserProfile && currentUserProfile.name) || 'Royal Spice Caterers') + ".");
  }
}

// 10. Event Listeners
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDonationModal();
    closeProfileModal();
    closeGpsRouteModal();
  }
});

// Close NGO Notification panel when clicking outside
document.addEventListener('click', (e) => {
  const panel = document.getElementById('ngo-notifications-panel');
  const btn = document.getElementById('ngo-notifications-btn');
  if (panel && !panel.classList.contains('hidden')) {
    if (!panel.contains(e.target) && (!btn || !btn.contains(e.target))) {
      panel.classList.add('hidden');
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  switchView('login');
  initSSE();
});
