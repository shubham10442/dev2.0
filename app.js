/* ==========================================================================
   Ann — Frontend Client: Auth, Profiles, Listings, GPS & REST API
   Cleaned & Streamlined Production Architecture
   ========================================================================== */

// 1. Global State & DOM Helpers
const $ = (id) => document.getElementById(id);

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
let signUpMap = null;
let signUpMarker = null;

// NGO Real-Time Alert State
const NGO_NOTIFS_KEY = 'ann_ngo_notifications_v2';
let ngoNotifications = [];
let ngoSoundEnabled = true;
let ngoToastTimer = null;

const isServerEnv = window.location.protocol.startsWith('http');
const API_BASE = isServerEnv ? '/api' : null;

// Cross-tab Real-Time Synchronization Channel
const gridChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ann_food_grid_sync') : null;

if (gridChannel) {
  gridChannel.onmessage = (event) => {
    const { type, payload } = event.data || {};
    const action = type ? type.replace('listing:', '') : '';
    if (action) handleListingSync(action, payload);
  };
}

// Unified Listing Sync Dispatcher for SSE and Cross-Tab
function handleListingSync(action, payload) {
  loadListings().then(() => {
    if (currentRole === 'donor') {
      renderDonorCards();
    } else if (currentRole === 'ngo') {
      renderNgoCards();
      if (action === 'created' && payload) showNgoFoodAlert(payload);
      else if (action === 'claimed' && payload?.id) markNgoNotificationClaimed(payload.id);
      else if (action === 'deleted' && payload?.id) removeNgoNotification(payload.id);
    }
    updateImpactStats();
  });
}

// Real-Time Server-Sent Events (SSE) Listener
function initSSE() {
  if (!isServerEnv || typeof EventSource === 'undefined') return;
  try {
    const sse = new EventSource('/api/events');

    sse.addEventListener('listing:created', (e) => {
      let data = null;
      try { data = e.data ? JSON.parse(e.data) : null; } catch (_) {}
      handleListingSync('created', data);
    });

    sse.addEventListener('listing:claimed', (e) => {
      beep(659, 'sine', 0.25);
      let data = null;
      try { data = e.data ? JSON.parse(e.data) : null; } catch (_) {}
      handleListingSync('claimed', data);
    });

    sse.addEventListener('listing:completed', () => {
      beep(880, 'sine', 0.3);
      handleListingSync('completed');
    });

    sse.addEventListener('listing:deleted', (e) => {
      let data = null;
      try { data = e.data ? JSON.parse(e.data) : null; } catch (_) {}
      handleListingSync('deleted', data);
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

    const { data } = json;
    const mealsEl = $('donor-impact-meals');
    const carbonEl = $('donor-impact-carbon');
    const licenseEl = $('donor-impact-license');
    const bannerDivertedEl = $('donor-banner-diverted');

    if (data.userStats) {
      if (mealsEl) mealsEl.textContent = `${data.userStats.meals} Meals`;
      if (carbonEl) carbonEl.textContent = data.userStats.carbon;
      if (licenseEl) licenseEl.textContent = data.userStats.license || 'FSSAI Active';
      if (bannerDivertedEl) bannerDivertedEl.textContent = `${Math.round(data.userStats.meals * 0.45).toLocaleString()} kg`;
    } else {
      if (mealsEl) mealsEl.textContent = `${data.divertedMeals.toLocaleString()} Meals`;
      if (carbonEl) carbonEl.textContent = `${data.carbonOffsetKg} kg CO₂e`;
      if (bannerDivertedEl) bannerDivertedEl.textContent = `${data.divertedKg.toLocaleString()} kg`;
    }
  } catch (e) {
    console.warn('Failed to load stats:', e);
  }
}

// Offline / Local Fallback Datastores
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

const fallbackListings = [
  { id: 1, title: '30 Servings Veg Thali', donor: 'Royal Spice Caterers', dist: '1.2 km', lat: 28.6139, lng: 77.2090, icon: '🍲', expires: '1h 20m', tag: '⚡ Urgent (<2h)', tagColor: 'amber', status: 'Driver En Route', claimed: true, extra: 'Driver: Mark R. • ETA 12m' },
  { id: 2, title: '15 Packed Rice Bowls', donor: 'Green Earth Bistro', dist: '0.8 km', lat: 28.6190, lng: 77.2130, icon: '🍱', expires: '2h 45m', tag: 'Fresh Pack', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Listed 20m ago' },
  { id: 3, title: '25 Sourdough Loaves', donor: 'Golden Crust Bakery', dist: '2.4 km', lat: 28.6280, lng: 77.2250, icon: '🥖', expires: '6h 10m', tag: 'Artisan Bakery', tagColor: 'purple', status: 'Awaiting NGO Claim', claimed: false, extra: 'Ready for pickup' },
  { id: 4, title: '40 Sandwich Boxes', donor: 'TechHub Conference', dist: '1.8 km', lat: 28.6080, lng: 77.2010, icon: '🥪', expires: '1h 45m', tag: 'Assorted Wraps', tagColor: 'emerald', status: 'Awaiting NGO Claim', claimed: false, extra: 'Refrigerated' }
];

// 2. Web Audio Helper
function beep(freq = 520, type = 'sine', duration = 0.15) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
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
  } catch (_) {}
}

// 3. Google Authentication & Gmail OTP Handlers
let pendingAuthUser = null;
let activeOtp = '';
let resendTimerInterval = null;

function openGoogleAuthModal() {
  beep(480);
  backToEmailStep();
  const modal = $('google-auth-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeGoogleAuthModal() {
  const modal = $('google-auth-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  if (resendTimerInterval) clearInterval(resendTimerInterval);
}

function backToEmailStep() {
  const emailStep = $('auth-step-email');
  const otpStep = $('auth-step-otp');
  const errorMsg = $('otp-error-msg');
  if (emailStep) emailStep.classList.remove('hidden');
  if (otpStep) otpStep.classList.add('hidden');
  if (errorMsg) errorMsg.classList.add('hidden');
  if (resendTimerInterval) clearInterval(resendTimerInterval);
}

async function selectGoogleAccount(email, name, role) {
  pendingAuthUser = {
    email,
    name,
    role,
    photo: role === 'donor'
      ? 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=100&auto=format&fit=crop&q=80'
  };
  await requestGmailOtp(email);
}

async function handleCustomGoogleAuth(e) {
  e.preventDefault();
  const email = $('google-custom-email').value.trim();
  const role = document.querySelector('input[name="custom-role"]:checked').value;
  const name = email.split('@')[0].replace('.', ' ').toUpperCase();

  pendingAuthUser = {
    email,
    name,
    role,
    photo: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`
  };
  await requestGmailOtp(email);
}

async function requestGmailOtp(email) {
  beep(520);
  activeOtp = '';

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success && data.previewOtp) activeOtp = data.previewOtp;
    } catch (err) {
      console.warn('API send-otp error, using fallback code:', err);
    }
  }

  if (!activeOtp) {
    activeOtp = Math.floor(100000 + Math.random() * 900000).toString();
  }

  $('auth-step-email').classList.add('hidden');
  $('auth-step-otp').classList.remove('hidden');
  $('otp-target-email').textContent = email;
  $('otp-input').value = '';
  $('otp-error-msg').classList.add('hidden');

  const quickFillText = $('quick-fill-text');
  if (quickFillText) quickFillText.textContent = `Click to Auto-Fill Received OTP: ${activeOtp}`;

  showGmailToast(activeOtp, email);
  startResendTimer();
  $('otp-input').focus();
  lucide.createIcons();
}

function showGmailToast(otp, email) {
  const toast = $('gmail-toast');
  const toastCode = $('toast-otp-code');
  if (!toast || !toastCode) return;

  toastCode.textContent = otp;
  toast.classList.remove('hidden');
  toast.classList.add('flex');
  beep(880, 'sine', 0.2);

  setTimeout(() => dismissGmailToast(), 15000);
}

function dismissGmailToast() {
  const toast = $('gmail-toast');
  if (toast) {
    toast.classList.add('hidden');
    toast.classList.remove('flex');
  }
}

function startResendTimer() {
  let seconds = 30;
  const timerDisplay = $('otp-timer-display');
  const timerSeconds = $('otp-timer-seconds');
  const resendBtn = $('btn-resend-otp');

  if (resendTimerInterval) clearInterval(resendTimerInterval);

  timerDisplay.classList.remove('hidden');
  resendBtn.classList.add('hidden');
  timerSeconds.textContent = seconds;

  resendTimerInterval = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      timerSeconds.textContent = seconds;
    } else {
      clearInterval(resendTimerInterval);
      timerDisplay.classList.add('hidden');
      resendBtn.classList.remove('hidden');
    }
  }, 1000);
}

async function resendOtp() {
  if (pendingAuthUser) await requestGmailOtp(pendingAuthUser.email);
}

function quickFillOtp() {
  const otpInput = $('otp-input');
  if (otpInput && activeOtp) {
    otpInput.value = activeOtp;
    handleOtpSubmit(new Event('submit'));
  }
}

async function handleOtpSubmit(e) {
  if (e?.preventDefault) e.preventDefault();
  if (!pendingAuthUser) return;

  const enteredOtp = $('otp-input').value.trim();
  const errorMsg = $('otp-error-msg');

  if (enteredOtp.length !== 6) {
    errorMsg.textContent = 'Please enter the full 6-digit code.';
    errorMsg.classList.remove('hidden');
    beep(250, 'sawtooth');
    return;
  }

  let verifiedUser = null;

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingAuthUser.email,
          otp: enteredOtp,
          role: pendingAuthUser.role,
          name: pendingAuthUser.name,
          photo: pendingAuthUser.photo
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.isNewUser) {
          dismissGmailToast();
          closeGoogleAuthModal();
          openSignUpFlow(data.email, data.suggestedRole || pendingAuthUser.role);
          return;
        }
        verifiedUser = data.data;
      } else {
        errorMsg.textContent = data.error || 'Invalid OTP code. Please try again.';
        errorMsg.classList.remove('hidden');
        beep(220, 'sawtooth');
        return;
      }
    } catch (err) {
      console.warn('API verify-otp error, checking offline:', err);
    }
  }

  if (!verifiedUser) {
    if (enteredOtp === activeOtp) {
      if (!fallbackUsers[pendingAuthUser.email]) {
        dismissGmailToast();
        closeGoogleAuthModal();
        openSignUpFlow(pendingAuthUser.email, pendingAuthUser.role);
        return;
      }
      verifiedUser = fallbackUsers[pendingAuthUser.email];
    } else {
      errorMsg.textContent = 'Invalid verification code. Please check your Gmail notification.';
      errorMsg.classList.remove('hidden');
      beep(220, 'sawtooth');
      return;
    }
  }

  currentUserProfile = verifiedUser;
  currentRole = currentUserProfile.role;
  currentEmail = currentUserProfile.email;
  currentEntity = currentUserProfile.name;

  if (currentUserProfile.lat) donorLat = parseFloat(currentUserProfile.lat);
  if (currentUserProfile.lng) donorLng = parseFloat(currentUserProfile.lng);

  dismissGmailToast();
  closeGoogleAuthModal();

  await switchView(currentRole, currentEntity, currentEmail);

  beep(currentRole === 'donor' ? 523 : 659);
  confetti({
    particleCount: 50,
    spread: 70,
    colors: currentRole === 'donor' ? ['#10B981', '#34D399'] : ['#3B82F6', '#60A5FA']
  });
}

function loginAs(role, entityName, email) {
  openGoogleAuthModal();
  selectGoogleAccount(email || (role === 'donor' ? 'chef.royalspice@gmail.com' : 'contact.hopeshelter@gmail.com'), entityName, role);
}

function logout() {
  beep(350, 'triangle');
  currentRole = null;
  currentEmail = '';
  currentUserProfile = null;
  switchView('login');
}

// 4. View Routing & Header Hydration
async function switchView(role, entityName = '', email = '') {
  currentRole = role;
  ['login', 'signup', 'donor', 'ngo'].forEach(v => {
    const el = $(`view-${v}`);
    if (el) {
      el.classList.toggle('hidden', v !== role);
      if (v === role && v !== 'login') el.classList.add('flex');
      else el.classList.remove('flex');
    }
  });

  if (role === 'login') return;
  if (role === 'signup') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => initSignUpMap(), 250);
    lucide.createIcons();
    return;
  }

  await loadListings();

  // Hydrate Profile in Navigation & Badges
  if (currentUserProfile) {
    const prefix = role === 'donor' ? 'donor' : 'ngo';
    const bannerName = $(`${prefix}-banner-name`);
    const profileName = $(`${prefix}-profile-name`);
    const btnName = $(`${prefix}-nav-btn-name`);
    const avatar = $(`${prefix}-nav-avatar`);

    if (bannerName) bannerName.textContent = currentUserProfile.name;
    if (profileName) {
      if (role === 'donor') {
        profileName.textContent = `${currentUserProfile.name} • Verified Kitchen`;
      } else {
        const darpanTag = currentUserProfile.regId ? ` • Darpan: ${currentUserProfile.regId.replace('NGO-DARPAN/', '')}` : '';
        profileName.textContent = `${currentUserProfile.name} • Verified Relief eNGO${darpanTag}`;
      }
    }
    if (btnName) btnName.textContent = currentUserProfile.name.split(' ')[0] || 'Profile';
    if (avatar && currentUserProfile.photo) avatar.src = currentUserProfile.photo;
  }

  if (role === 'donor') {
    renderDonorCards();
    updateImpactStats();
    setTimeout(initDonorMap, 200);
  } else if (role === 'ngo') {
    renderNgoCards();
    syncNgoNotificationsWithListings();
    updateDesktopNotifButton();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  lucide.createIcons();
}

// 4b. Sign Up & Partner Onboarding Flow
function startDirectSignUp() {
  beep(520, 'sine', 0.15);
  openGoogleAuthModal();
  const customEmail = $('google-custom-email');
  if (customEmail) {
    setTimeout(() => {
      customEmail.focus();
      customEmail.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }
}

function startNgoSignUp() {
  beep(587, 'sine', 0.15);
  openSignUpFlow('relief.director@gmail.com', 'ngo');
}

function selectSampleNgoDarpan(id) {
  const input = $('signup-darpan');
  if (input) {
    input.value = id;
    verifyNgoRegistration();
  }
}

let isNgoDarpanVerified = false;

async function verifyNgoRegistration() {
  const input = $('signup-darpan');
  if (!input) return;
  const regNo = input.value.trim();

  const btn = $('btn-verify-darpan');
  const btnText = $('btn-verify-text');
  const resultBox = $('ngo-verification-box');
  const errorBox = $('ngo-verification-error');
  const badge = $('ngo-auth-badge');

  if (!regNo) {
    if (errorBox) {
      errorBox.innerHTML = '<strong>Registration Number Required:</strong> Please enter an NGO Darpan Unique ID (e.g. DL/2019/0248819).';
      errorBox.classList.remove('hidden');
    }
    beep(220, 'sawtooth');
    return;
  }

  beep(520, 'sine', 0.1);
  if (btnText) btnText.textContent = 'Verifying...';
  if (btn) btn.disabled = true;

  let data = null;
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/ngo/verify-darpan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationNo: regNo })
      });
      data = await res.json();
    } catch (err) {
      console.warn('verify-darpan API error, using client validation:', err);
    }
  }

  if (!data) {
    const clean = regNo.toUpperCase().replace(/^NGO-DARPAN\//, '').replace(/^DARPAN\//, '');
    const sampleNames = {
      'DL/2019/0248819': 'Hope Shelter Network Relief Foundation',
      'MH/2021/0192847': 'Seva Annapurna Food Bank Trust',
      'KA/2020/0394819': 'Karuna Relief Care Foundation'
    };
    if (sampleNames[clean] || /^[A-Z]{2}\/\d{4}\/\d{5,8}$/.test(clean)) {
      data = {
        success: true,
        verified: true,
        registrationNo: clean,
        legalName: sampleNames[clean] || 'Verified Community Relief Foundation',
        state: clean.startsWith('DL') ? 'Delhi (NCT)' : (clean.startsWith('MH') ? 'Maharashtra' : 'Karnataka'),
        act: 'Societies Registration Act XXI of 1860 / Indian Trusts Act',
        section80G: 'Active & Verified (80G(5)(vi) Compliant)',
        section12A: 'Registered (AAATH2819E)',
        authorizedSignatory: 'Dr. Alok Verma (General Secretary)'
      };
    } else {
      data = {
        success: false,
        error: 'Invalid NGO Darpan / Society Registration Number format. Standard format is STATE/YEAR/NUMBER (e.g. DL/2019/0248819).'
      };
    }
  }

  if (btnText) btnText.textContent = 'Verify Darpan';
  if (btn) btn.disabled = false;

  if (data.success && data.verified) {
    isNgoDarpanVerified = true;
    if (errorBox) errorBox.classList.add('hidden');
    if (resultBox) resultBox.classList.remove('hidden');
    if (badge) {
      badge.classList.remove('hidden');
      badge.classList.add('flex');
    }

    const fields = {
      'ngo-verified-darpan-tag': data.registrationNo,
      'ngo-verified-legal-name': data.legalName,
      'ngo-verified-state': data.state,
      'ngo-verified-act': data.act,
      'ngo-verified-80g': data.section80G
    };
    for (const [id, val] of Object.entries(fields)) {
      const el = $(id);
      if (el) el.textContent = val;
    }

    const nameInput = $('signup-name');
    if (nameInput && (!nameInput.value || nameInput.value.includes('Food Works') || nameInput.value.includes('Relief Director'))) {
      nameInput.value = data.legalName;
    }
    const signatoryInput = $('signup-signatory');
    if (signatoryInput && data.authorizedSignatory) signatoryInput.value = data.authorizedSignatory;

    beep(880, 'sine', 0.25);
    lucide.createIcons();
  } else {
    isNgoDarpanVerified = false;
    if (resultBox) resultBox.classList.add('hidden');
    if (badge) badge.classList.add('hidden');
    if (errorBox) {
      errorBox.innerHTML = `<strong>Verification Failed:</strong> ${data.error || 'Registration number could not be authenticated.'}<br><span class="text-[11px] text-slate-500">Please check the Darpan format or pick one of the sample IDs above.</span>`;
      errorBox.classList.remove('hidden');
    }
    beep(220, 'sawtooth');
  }
}

function openSignUpFlow(email, role = 'donor') {
  const cleanEmail = (email || '').trim().toLowerCase();
  const emailInput = $('signup-email');
  if (emailInput) emailInput.value = cleanEmail;

  const nameInput = $('signup-name');
  if (nameInput) {
    const rawName = cleanEmail.split('@')[0] || '';
    const formatted = rawName.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    nameInput.value = formatted ? `${formatted} Food Works` : '';
  }

  setSignUpRole(role || 'donor');
  generateDemoLicense(role === 'ngo' ? 'darpan' : 'fssai');
  switchView('signup');
  beep(659, 'sine', 0.2);
}

function setSignUpRole(role) {
  beep(480, 'sine', 0.1);
  const roleInput = $('signup-role');
  if (roleInput) roleInput.value = role;

  const isDonor = role === 'donor';
  const donorCard = $('role-card-donor');
  const ngoCard = $('role-card-ngo');

  if (donorCard) {
    donorCard.className = `role-card ${isDonor ? 'active' : ''} cursor-pointer p-4 rounded-2xl border-2 ${isDonor ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-white'} transition relative flex flex-col justify-between`;
  }
  if (ngoCard) {
    ngoCard.className = `role-card ${!isDonor ? 'active' : ''} cursor-pointer p-4 rounded-2xl border-2 ${!isDonor ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white'} transition relative flex flex-col justify-between`;
  }

  $('badge-donor')?.classList.toggle('hidden', !isDonor);
  const badgeNgo = $('badge-ngo');
  if (badgeNgo) {
    badgeNgo.classList.toggle('hidden', isDonor);
    if (!isDonor) badgeNgo.className = 'text-[10px] font-extrabold uppercase bg-blue-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1';
  }

  $('signup-donor-credentials')?.classList.toggle('hidden', !isDonor);
  $('signup-ngo-credentials')?.classList.toggle('hidden', isDonor);

  const categoryLabel = $('signup-category-label');
  const categorySelect = $('signup-category');
  if (categoryLabel) categoryLabel.textContent = isDonor ? 'Kitchen Facility Type *' : 'Relief Shelter Category *';

  if (categorySelect) {
    categorySelect.innerHTML = isDonor
      ? `<option value="Banquets & Commercial Kitchen">Banquets & Commercial Kitchen</option>
         <option value="Fine Dine & Restaurant">Fine Dine & Restaurant</option>
         <option value="Artisan Bakery & Cafe">Artisan Bakery & Cafe</option>
         <option value="Corporate Cafeteria">Corporate Cafeteria</option>
         <option value="Cloud Kitchen Facility">Cloud Kitchen Facility</option>`
      : `<option value="Community Relief & Food Shelter">Community Relief & Food Shelter</option>
         <option value="Orphanage & Children Relief">Orphanage & Children Relief</option>
         <option value="Elderly Care & Community Home">Elderly Care & Community Home</option>
         <option value="Disaster Relief Foundation">Disaster Relief Foundation</option>
         <option value="Mobile Community Hunger Drive">Mobile Community Hunger Drive</option>`;
  }

  if (!isDonor) {
    const darpanInput = $('signup-darpan');
    if (darpanInput && !darpanInput.value) darpanInput.value = 'DL/2019/0248819';
    setTimeout(() => verifyNgoRegistration(), 120);
  }

  lucide.createIcons();
}

function generateDemoLicense(type) {
  beep(740, 'sine', 0.1);
  const input = $(type === 'fssai' ? 'signup-fssai' : 'signup-darpan');
  if (input) {
    input.value = type === 'fssai'
      ? 'FSSAI-' + Math.floor(10000000000000 + Math.random() * 90000000000000)
      : 'NGO-DARPAN/DL/' + new Date().getFullYear() + '/' + Math.floor(100000 + Math.random() * 900000);
  }
}

function initSignUpMap(lat = 28.6139, lng = 77.2090) {
  const container = $('signup-map');
  if (!container || typeof L === 'undefined') return;

  if (signUpMap) {
    signUpMap.remove();
    signUpMap = null;
  }

  signUpMap = L.map('signup-map', { zoomControl: false }).setView([lat, lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(signUpMap);

  const pinIcon = L.divIcon({
    className: 'custom-gps-pin',
    html: `<div style="background:#2b5e43;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 4px 14px rgba(0,0,0,0.3);border:2.5px solid white;">📍</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  signUpMarker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(signUpMap);

  const updatePos = (coords) => setSignUpCoords(coords.lat, coords.lng);
  signUpMarker.on('dragend', (e) => updatePos(e.target.getLatLng()));
  signUpMap.on('click', (e) => {
    signUpMarker.setLatLng(e.latlng);
    updatePos(e.latlng);
  });

  setTimeout(() => { if (signUpMap) signUpMap.invalidateSize(); }, 300);
}

function setSignUpCoords(lat, lng) {
  const latEl = $('signup-lat');
  const lngEl = $('signup-lng');
  const display = $('signup-coords-display');
  const numLat = Number(lat).toFixed(4);
  const numLng = Number(lng).toFixed(4);
  if (latEl) latEl.value = numLat;
  if (lngEl) lngEl.value = numLng;
  if (display) display.textContent = `${numLat}° N, ${numLng}° E`;
}

function detectSignUpGps() {
  beep(600, 'sine', 0.15);
  const display = $('signup-coords-display');
  if (display) display.textContent = 'Detecting GPS station...';

  if (!navigator.geolocation) {
    alert('Geolocation not supported by your browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setSignUpCoords(lat, lng);
      if (signUpMap && signUpMarker) {
        signUpMap.setView([lat, lng], 15);
        signUpMarker.setLatLng([lat, lng]);
      }
      beep(880, 'sine', 0.2);
    },
    () => {
      const lat = 28.6139 + (Math.random() - 0.5) * 0.015;
      const lng = 77.2090 + (Math.random() - 0.5) * 0.015;
      setSignUpCoords(lat, lng);
      if (signUpMap && signUpMarker) {
        signUpMap.setView([lat, lng], 15);
        signUpMarker.setLatLng([lat, lng]);
      }
    },
    { enableHighAccuracy: true, timeout: 6000 }
  );
}

async function handleSignUpSubmit(e) {
  if (e?.preventDefault) e.preventDefault();

  const role = $('signup-role').value || 'donor';
  const email = ($('signup-email').value || '').trim().toLowerCase();
  const name = $('signup-name').value.trim();
  const phone = $('signup-phone').value.trim();
  const category = $('signup-category').value;
  const address = $('signup-address').value.trim();
  const lat = parseFloat($('signup-lat').value) || (role === 'ngo' ? 28.6250 : 28.6139);
  const lng = parseFloat($('signup-lng').value) || (role === 'ngo' ? 77.2180 : 77.2090);

  if (!email || !name) {
    alert('Please enter your organization name and verified email.');
    return;
  }

  const payload = {
    email,
    name,
    role,
    phone,
    address,
    lat,
    lng,
    gpsAddress: address || (role === 'donor' ? 'Kitchen Station Tagged' : 'Relief Shelter Station Tagged'),
    photo: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`
  };

  if (role === 'donor') {
    payload.kitchenType = category;
    payload.licenseId = ($('signup-fssai').value || '').trim() || ('FSSAI-' + Math.floor(10000000000000 + Math.random() * 90000000000000));
    payload.operatingHours = ($('signup-hours').value || '').trim() || '10:00 AM - 11:30 PM';
    payload.mealsDiverted = 0;
    payload.carbonOffset = '0 kg CO₂e';
  } else {
    payload.shelterType = category;
    payload.regId = ($('signup-darpan').value || '').trim().toUpperCase() || 'NGO-DARPAN/DL/2019/0248819';
    payload.signatory = ($('signup-signatory').value || '').trim() || 'General Secretary';
    payload.capacity = '400 Meals / Day';
    payload.fleet = '3 Vans, 2 Bikes';
    payload.section80G = 'Active & Verified';
    payload.mealsServed = 0;
  }

  let registeredUser = null;

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) registeredUser = data.data;
    } catch (err) {
      console.warn('API register error, saving to local state:', err);
    }
  }

  if (!registeredUser) {
    registeredUser = { ...payload, id: 'usr_' + Date.now(), verified: true, createdAt: new Date().toISOString() };
    fallbackUsers[email] = registeredUser;
  }

  currentUserProfile = registeredUser;
  currentRole = currentUserProfile.role;
  currentEmail = currentUserProfile.email;
  currentEntity = currentUserProfile.name;
  if (currentUserProfile.lat) donorLat = currentUserProfile.lat;
  if (currentUserProfile.lng) donorLng = currentUserProfile.lng;

  beep(880, 'sine', 0.3);
  confetti({
    particleCount: 75,
    spread: 80,
    origin: { y: 0.6 },
    colors: currentRole === 'donor' ? ['#2b5e43', '#4d8966', '#d68936'] : ['#2c5870', '#5b8ba8', '#d68936']
  });

  await switchView(currentRole, currentEntity, currentEmail);
}

// 4c. NGO Real-Time Surplus Food Notification & Alert System
function playFoodAlertChime() {
  if (!ngoSoundEnabled) return;
  beep(698.46, 'sine', 0.35);
  setTimeout(() => beep(880.00, 'sine', 0.4), 140);
}

function toggleNgoSound() {
  ngoSoundEnabled = !ngoSoundEnabled;
  const icon = $('sound-toggle-icon');
  const text = $('sound-toggle-text');
  const btn = $('btn-sound-toggle');

  if (icon) {
    icon.setAttribute('data-lucide', ngoSoundEnabled ? 'volume-2' : 'volume-x');
    icon.className = `w-3.5 h-3.5 ${ngoSoundEnabled ? 'text-emerald-600' : 'text-slate-400'}`;
  }
  if (text) text.textContent = ngoSoundEnabled ? 'Sound: ON' : 'Sound: Muted';
  if (btn) {
    btn.className = `flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-xl transition ${
      ngoSoundEnabled ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-200 text-slate-500'
    }`;
  }

  if (ngoSoundEnabled) beep(660, 'sine', 0.15);
  lucide.createIcons();
}

// Helper to save and update all notification UI elements in one call
function refreshNgoNotificationUI() {
  try {
    localStorage.setItem(NGO_NOTIFS_KEY, JSON.stringify(ngoNotifications));
  } catch (_) {}
  updateNgoBellBadge();
  renderNgoNotificationsList();
}

function loadNgoNotifications() {
  try {
    const raw = localStorage.getItem(NGO_NOTIFS_KEY);
    ngoNotifications = raw ? JSON.parse(raw) : [];
  } catch (_) {
    ngoNotifications = [];
  }
}

function syncNgoNotificationsWithListings() {
  loadNgoNotifications();

  if (listings && listings.length > 0) {
    const listingsMap = new Map(listings.map(item => [item.id, item]));

    // 1. Sync claimed status
    ngoNotifications.forEach(n => {
      const match = listingsMap.get(n.id);
      if (match && match.claimed) n.claimed = true;
    });

    // 2. Populate unclaimed listings
    const existingIds = new Set(ngoNotifications.map(n => n.id));
    listings.filter(l => !l.claimed).forEach(item => {
      if (!existingIds.has(item.id)) {
        ngoNotifications.unshift({
          ...item,
          alertId: 'alert_' + item.id,
          receivedAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          read: false
        });
      }
    });
  }

  ngoNotifications = ngoNotifications.slice(0, 20);
  refreshNgoNotificationUI();
}

function markNgoNotificationClaimed(id) {
  let changed = false;
  ngoNotifications.forEach(n => {
    if (n.id === id) {
      n.claimed = true;
      changed = true;
    }
  });
  if (changed) refreshNgoNotificationUI();
}

function removeNgoNotification(id) {
  ngoNotifications = ngoNotifications.filter(n => n.id !== id);
  refreshNgoNotificationUI();
}

async function requestDesktopNotificationPermission() {
  if (typeof window.Notification === 'undefined') {
    alert('Desktop notifications are not supported in this browser.');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification('Ann Surplus Food Radar', {
      body: 'Desktop notifications are active. You will receive alerts when surplus food is posted.',
      icon: 'logo.png'
    });
    updateDesktopNotifButton();
    return;
  }

  const permission = await Notification.requestPermission();
  updateDesktopNotifButton();
  if (permission === 'granted') {
    new Notification('Ann Surplus Food Radar', {
      body: '🔔 Real-time desktop alerts enabled! You will be notified instantly when nearby kitchens post food.',
      icon: 'logo.png'
    });
    beep(660, 'sine', 0.18);
  }
}

function updateDesktopNotifButton() {
  const btn = $('btn-desktop-notif-toggle');
  if (!btn || typeof window.Notification === 'undefined') return;

  const isGranted = Notification.permission === 'granted';
  btn.innerHTML = `<i data-lucide="${isGranted ? 'bell-check' : 'bell'}" class="w-3 h-3 text-${isGranted ? 'emerald' : 'blue'}-600"></i><span class="text-${isGranted ? 'emerald' : 'blue'}-700 font-bold">${isGranted ? 'Alerts Enabled' : 'Enable Browser Alerts'}</span>`;
  lucide.createIcons();
}

function showNgoFoodAlert(listing) {
  if (!listing) return;

  const alertItem = {
    ...listing,
    alertId: 'alert_' + Date.now() + Math.random().toString(36).substr(2, 4),
    receivedAt: new Date(),
    read: false,
    claimed: Boolean(listing.claimed)
  };

  ngoNotifications = [alertItem, ...ngoNotifications.filter(n => n.id !== listing.id)].slice(0, 20);
  refreshNgoNotificationUI();

  // Desktop notification
  if (typeof window.Notification !== 'undefined' && Notification.permission === 'granted' && !listing.claimed) {
    try {
      const deskNotif = new Notification(`🍲 Surplus Food: ${listing.title}`, {
        body: `${listing.donor || 'Verified Kitchen'} has surplus meals available (${listing.dist || 'Nearby'}). Click to claim for NGO!`,
        icon: 'logo.png',
        tag: `ann-alert-${listing.id}`
      });
      deskNotif.onclick = () => {
        window.focus();
        showNgoFoodAlert(listing);
        deskNotif.close();
      };
    } catch (_) {}
  }

  // Hydrate Floating Alert Toast
  const toast = $('ngo-surplus-toast');
  if (toast) {
    const titleEl = $('ngo-toast-title');
    const donorEl = $('ngo-toast-donor');
    const distEl = $('ngo-toast-dist');
    const expiresEl = $('ngo-toast-expires');
    const mediaEl = $('ngo-toast-media');
    const claimBtn = $('ngo-toast-claim-btn');
    const mapBtn = $('ngo-toast-map-btn');

    if (titleEl) titleEl.textContent = listing.title || 'Surplus Meals Ready';
    if (donorEl) donorEl.textContent = listing.donor || 'Verified Kitchen';
    if (distEl) distEl.textContent = listing.dist ? `${listing.dist} away` : 'Nearby Station';
    if (expiresEl) expiresEl.textContent = listing.expires ? `Expires in ${listing.expires}` : 'Immediate Pickup';

    if (mediaEl) {
      mediaEl.innerHTML = listing.image
        ? `<img src="${listing.image}" alt="${listing.title}" class="w-full h-full object-cover">`
        : (listing.icon || '🍲');
    }

    if (claimBtn) claimBtn.onclick = () => claimFoodFromAlert(listing.id);
    if (mapBtn) {
      mapBtn.onclick = () => {
        dismissNgoAlertToast();
        openGpsRouteModal(listing.id);
      };
    }

    playFoodAlertChime();
    toast.classList.remove('hidden');
    toast.classList.add('flex');

    if (ngoToastTimer) clearTimeout(ngoToastTimer);
    ngoToastTimer = setTimeout(() => dismissNgoAlertToast(), 14000);
  }

  lucide.createIcons();
}

function dismissNgoAlertToast() {
  const toast = $('ngo-surplus-toast');
  if (toast) {
    toast.classList.add('hidden');
    toast.classList.remove('flex');
  }
}

async function claimFoodFromAlert(listingId) {
  dismissNgoAlertToast();
  await claimFood(listingId);
  markNgoNotificationClaimed(listingId);
}

function toggleNgoNotificationsDropdown() {
  const dropdown = $('ngo-notifications-dropdown');
  if (!dropdown) return;

  const isHidden = dropdown.classList.contains('hidden');
  if (isHidden) {
    dropdown.classList.remove('hidden');
    ngoNotifications.forEach(n => n.read = true);
    refreshNgoNotificationUI();
    beep(500, 'sine', 0.08);
  } else {
    dropdown.classList.add('hidden');
  }
  lucide.createIcons();
}

function updateNgoBellBadge() {
  const badge = $('ngo-bell-count');
  if (!badge) return;

  const unreadCount = ngoNotifications.filter(n => !n.read && !n.claimed).length;
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
  }
}

function renderNgoNotificationsList() {
  const container = $('ngo-notifications-list');
  if (!container) return;

  const activeAlerts = ngoNotifications.filter(n => !n.claimed);

  if (activeAlerts.length === 0) {
    container.innerHTML = `
      <div class="p-5 text-center text-slate-400 space-y-1">
        <i data-lucide="bell-off" class="w-7 h-7 mx-auto text-slate-300"></i>
        <p class="font-bold text-slate-700 text-xs">No active surplus food alerts</p>
        <p class="text-[11px] text-slate-400">When nearby kitchens broadcast excess meals, alerts will appear here in real-time.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = activeAlerts.map(item => `
    <div class="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 transition flex items-start gap-2.5 group">
      <div class="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 text-lg shadow-xs">
        ${item.image ? `<img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover">` : (item.icon || '🍲')}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <h5 class="font-bold text-slate-900 text-xs truncate">${item.title}</h5>
          <span class="text-[10px] text-emerald-700 font-bold shrink-0">${item.dist || '1.2 km'}</span>
        </div>
        <p class="text-[11px] text-slate-500 truncate">${item.donor} • Expires in ${item.expires || '2h'}</p>
        <div class="mt-1.5 flex items-center gap-1.5">
          <button onclick="claimFoodFromAlert(${item.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1 px-2 rounded-md shadow-xs transition">Claim Pickup</button>
          <button onclick="openGpsRouteModal(${item.id})" class="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] py-1 px-2 rounded-md font-semibold transition flex items-center gap-0.5">
            <i data-lucide="navigation" class="w-2.5 h-2.5"></i><span>Route</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

function clearNgoNotifications() {
  ngoNotifications = [];
  refreshNgoNotificationUI();
  beep(400, 'sine', 0.1);
}

function simulateFoodAlert() {
  let sampleListing = listings.find(i => !i.claimed);
  if (!sampleListing) {
    sampleListing = {
      id: Date.now(),
      title: '45 Packed Biryani Trays',
      donor: 'Royal Spice Caterers',
      dist: '0.9 km',
      lat: 28.6145,
      lng: 77.2095,
      icon: '🍲',
      expires: '1h 45m',
      extra: 'Fresh Banquet Surplus',
      tag: 'Just Listed',
      tagColor: 'emerald',
      status: 'Awaiting NGO Claim',
      claimed: false,
      createdAt: new Date().toISOString()
    };
    listings.unshift(sampleListing);
    renderNgoCards();
  }

  showNgoFoodAlert(sampleListing);
  if (gridChannel) gridChannel.postMessage({ type: 'listing:created', payload: sampleListing });
}

// 5. Donor GPS Station & Interactive Maps
function initDonorMap() {
  const mapContainer = $('donor-map');
  if (!mapContainer || typeof L === 'undefined') return;

  if (!donorMap) {
    donorMap = L.map('donor-map', { zoomControl: false }).setView([donorLat, donorLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(donorMap);

    donorMarker = L.circleMarker([donorLat, donorLng], {
      radius: 8,
      fillColor: '#10B981',
      color: '#FFFFFF',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.95
    }).addTo(donorMap);
    donorMarker.bindPopup(`<b>${currentEntity || 'Kitchen Donor'}</b><br>Surplus Station`).openPopup();

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
  const coordsEl = $('donor-gps-coords');
  const modalGpsEl = $('modal-gps-display');
  const gmapsLink = $('donor-gmaps-link');
  const addrEl = $('donor-gps-addr');

  if (coordsEl) coordsEl.textContent = coordsStr;
  if (modalGpsEl) modalGpsEl.textContent = coordsStr;
  if (gmapsLink) gmapsLink.href = `https://maps.google.com/?q=${donorLat},${donorLng}`;
  if (addrEl && currentUserProfile?.address) {
    addrEl.textContent = currentUserProfile.address;
    addrEl.title = currentUserProfile.address;
  }
}

function detectDonorGps(forModal = false) {
  beep(480);
  const statusBadge = $('donor-gps-status');
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
            } catch (_) {}
          }
        }

        beep(660);
        confetti({ particleCount: 25, spread: 45 });
      },
      (err) => {
        console.warn('Geolocation denied/fallback:', err);
        if (statusBadge) statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> GPS Calibrated`;
        updateGpsDisplays();
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  } else {
    updateGpsDisplays();
  }
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

  $('route-modal-title').textContent = `${item.title} • Route`;
  $('route-modal-subtitle').textContent = `Pickup from: ${item.donor || 'Verified Donor'}`;
  $('route-coords').textContent = `${targetLat.toFixed(4)}° N, ${targetLng.toFixed(4)}° E`;
  $('route-address').textContent = item.gpsAddress || item.donor || 'Kitchen Location';
  $('route-distance').textContent = item.dist || '1.4 km';
  $('route-gmaps-btn').href = `https://www.google.com/maps/dir/?api=1&origin=${ngoLat},${ngoLng}&destination=${targetLat},${targetLng}`;

  const modal = $('gps-route-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();

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

    const ngoMarker = L.circleMarker([ngoLat, ngoLng], {
      radius: 9,
      fillColor: '#2563EB',
      color: '#FFFFFF',
      weight: 2,
      fillOpacity: 0.95
    }).addTo(routeMap).bindPopup(`<b>Hope Shelter Hub</b><br>Dispatch Center`);

    const donorPin = L.circleMarker([targetLat, targetLng], {
      radius: 9,
      fillColor: '#10B981',
      color: '#FFFFFF',
      weight: 2,
      fillOpacity: 0.95
    }).addTo(routeMap).bindPopup(`<b>${item.donor}</b><br>${item.title}`).openPopup();

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
  const modal = $('gps-route-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// 7. Profile Management Modal
function openProfileModal() {
  if (!currentUserProfile) return;
  beep(450);

  const modal = $('profile-modal');
  $('profile-modal-avatar').src = currentUserProfile.photo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUserProfile.email)}`;
  $('profile-modal-name').textContent = currentUserProfile.name;
  $('profile-modal-email').textContent = currentUserProfile.email;

  const isDonor = currentUserProfile.role === 'donor';
  const roleBadge = $('profile-modal-role-badge');
  const typeLabel = $('profile-type-label');
  const licenseLabel = $('profile-license-label');
  const extraFields = $('profile-extra-fields');

  if (isDonor) {
    roleBadge.className = 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
    roleBadge.textContent = 'Food Donor';
    typeLabel.textContent = 'Kitchen / Food Category';
    licenseLabel.textContent = 'FSSAI Food License ID';

    extraFields.innerHTML = `
      <div class="flex justify-between py-1 border-b border-slate-200"><span class="text-slate-500">Operating Hours:</span><strong class="text-slate-800">${currentUserProfile.operatingHours || '10:00 AM - 11:30 PM'}</strong></div>
      <div class="flex justify-between py-1 border-b border-slate-200"><span class="text-slate-500">GPS Station Lock:</span><strong class="font-mono text-emerald-700 font-bold">${donorLat.toFixed(4)}° N, ${donorLng.toFixed(4)}° E</strong></div>
      <div class="flex justify-between py-1"><span class="text-slate-500">Surplus Diverted:</span><strong class="text-emerald-700">${currentUserProfile.mealsDiverted || 620} Meals (${currentUserProfile.carbonOffset || '355.8 kg CO₂e'})</strong></div>
    `;
  } else {
    roleBadge.className = 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800';
    roleBadge.textContent = 'NGO Relief Shelter';
    typeLabel.textContent = 'Shelter / Relief Type';
    licenseLabel.textContent = 'NGO Darpan / Registration ID';

    extraFields.innerHTML = `
      <div class="flex justify-between py-1 border-b border-slate-200"><span class="text-slate-500">Daily Feeding Capacity:</span><strong class="text-slate-800">${currentUserProfile.capacity || '350 Meals / Day'}</strong></div>
      <div class="flex justify-between py-1 border-b border-slate-200"><span class="text-slate-500">Delivery Fleet:</span><strong class="text-slate-800">${currentUserProfile.fleet || '4 Delivery Vans'}</strong></div>
      <div class="flex justify-between py-1"><span class="text-slate-500">80G Exemption Status:</span><strong class="text-emerald-700">${currentUserProfile.section80G || 'Verified Active'}</strong></div>
    `;
  }

  $('profile-input-name').value = currentUserProfile.name || '';
  $('profile-input-phone').value = currentUserProfile.phone || '';
  $('profile-input-type').value = (isDonor ? currentUserProfile.kitchenType : currentUserProfile.shelterType) || '';
  $('profile-input-license').value = (isDonor ? currentUserProfile.licenseId : currentUserProfile.regId) || '';
  $('profile-input-address').value = currentUserProfile.address || '';
  $('profile-status-msg').classList.add('hidden');

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function closeProfileModal() {
  const modal = $('profile-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function saveProfileChanges(e) {
  e.preventDefault();
  if (!currentUserProfile) return;

  const isDonor = currentUserProfile.role === 'donor';
  const updatedData = {
    email: currentUserProfile.email,
    name: $('profile-input-name').value.trim(),
    phone: $('profile-input-phone').value.trim(),
    address: $('profile-input-address').value.trim(),
    lat: donorLat,
    lng: donorLng
  };

  if (isDonor) {
    updatedData.kitchenType = $('profile-input-type').value.trim();
    updatedData.licenseId = $('profile-input-license').value.trim();
  } else {
    updatedData.shelterType = $('profile-input-type').value.trim();
    updatedData.regId = $('profile-input-license').value.trim();
  }

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      const data = await res.json();
      if (data.success) currentUserProfile = data.data;
    } catch (err) {
      console.warn('API profile update error, saving locally:', err);
    }
  }

  Object.assign(currentUserProfile, updatedData);
  currentEntity = currentUserProfile.name;

  await switchView(currentUserProfile.role, currentUserProfile.name, currentUserProfile.email);

  beep(600);
  const statusMsg = $('profile-status-msg');
  if (statusMsg) {
    statusMsg.classList.remove('hidden');
    setTimeout(() => statusMsg.classList.add('hidden'), 3000);
  }
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
      console.warn('Backend API unavailable, using cached listings:', err);
    }
  }

  if (listings.length === 0) listings = [...fallbackListings];
  if (query) {
    const q = query.toLowerCase().trim();
    return listings.filter(i => i.title.toLowerCase().includes(q) || (i.donor && i.donor.toLowerCase().includes(q)));
  }
  return listings;
}

function renderDonorCards() {
  const activeContainer = $('donor-listings-container');
  const claimedContainer = $('donor-claimed-container');
  if (!activeContainer && !claimedContainer) return;

  const availableListings = listings.filter(item => !item.claimed);
  const claimedListings = listings.filter(item => item.claimed);

  const activeBadge = $('donor-listing-badge');
  if (activeBadge) activeBadge.textContent = `${availableListings.length} Available`;
  const claimedBadge = $('donor-claimed-badge');
  if (claimedBadge) claimedBadge.textContent = `${claimedListings.length} Claimed`;

  if (activeContainer) {
    activeContainer.innerHTML = availableListings.length === 0
      ? `<div class="col-span-full p-6 text-center rounded-2xl bg-white/80 border border-slate-200 shadow-xs">
           <i data-lucide="package-open" class="w-8 h-8 mx-auto mb-2 text-emerald-400"></i>
           <p class="text-xs font-bold text-slate-700">No active surplus waiting for claim</p>
           <p class="text-[11px] text-slate-400 mt-0.5">Click "+ List Surplus Food" to broadcast excess meals to nearby shelters.</p>
         </div>`
      : availableListings.map(item => `
          <div class="glass-card rounded-2xl p-4 shadow-soft border-l-4 border-l-emerald-500 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">${item.tag || 'Available'}</span>
                <span class="text-xs font-semibold text-emerald-700">Awaiting NGO Claim</span>
              </div>
              <div class="flex items-start gap-3 mb-1">
                ${item.image ? `<img src="${item.image}" alt="${item.title}" class="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs">` : `<div class="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">${item.icon || '🍲'}</div>`}
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

  if (claimedContainer) {
    claimedContainer.innerHTML = claimedListings.length === 0
      ? `<div class="col-span-full p-6 text-center rounded-2xl bg-white/80 border border-slate-200 shadow-xs">
           <i data-lucide="truck" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
           <p class="text-xs font-bold text-slate-700">No items currently claimed</p>
           <p class="text-[11px] text-slate-400 mt-0.5">When an NGO claims your surplus food, it will automatically move here with live dispatch status.</p>
         </div>`
      : claimedListings.map(item => `
          <div class="glass-card rounded-2xl p-4 shadow-soft border-l-4 border-l-blue-500 flex flex-col justify-between bg-blue-50/20 hover:shadow-md transition">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded flex items-center gap-1"><i data-lucide="check-circle-2" class="w-3 h-3 text-blue-600"></i> Claimed</span>
                <span class="text-xs font-bold text-blue-700">${item.status || 'Driver Dispatched'}</span>
              </div>
              <div class="flex items-start gap-3 mb-1">
                ${item.image ? `<img src="${item.image}" alt="${item.title}" class="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs">` : `<div class="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">${item.icon || '🍲'}</div>`}
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

  lucide.createIcons();
}

async function renderNgoCards(query = '') {
  const container = $('ngo-cards-container');
  if (!container) return;

  const items = await loadListings(query);

  container.innerHTML = items.map(item => `
    <div class="glass-card rounded-2xl p-4 shadow-soft border-l-4 border-l-${item.tagColor || 'blue'}-500 flex flex-col justify-between">
      <div class="flex items-start gap-3 mb-3">
        ${item.image ? `<img src="${item.image}" alt="${item.title}" class="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs">` : `<div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shrink-0">${item.icon || '🍲'}</div>`}
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-1">
            <span class="text-[10px] font-bold uppercase bg-${item.tagColor || 'blue'}-100 text-${item.tagColor || 'blue'}-800 px-2 py-0.5 rounded truncate">${item.tag || 'Surplus'}</span>
            <button onclick="openGpsRouteModal(${item.id})" class="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded-md transition" title="View GPS Route on Map">
              <i data-lucide="navigation" class="w-3 h-3 text-blue-500"></i><span>GPS Route</span>
            </button>
          </div>
          <h4 class="font-bold text-slate-900 text-sm sm:text-base mt-1 truncate">${item.title}</h4>
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
          : `<button onclick="claimFood(${item.id})" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-xl shadow transition">Claim for NGO</button>`
        }
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

// 9. Surplus Donation Modal & Timing Options
let currentTimeMode = 'preset';

function setTimeMode(mode) {
  currentTimeMode = mode;
  beep(480);

  const btnPreset = $('btn-mode-preset');
  const btnDuration = $('btn-mode-duration');
  const btnSpecific = $('btn-mode-specific');
  const buttons = [btnPreset, btnDuration, btnSpecific];

  buttons.forEach(btn => {
    if (!btn) return;
    btn.classList.remove('bg-white', 'text-emerald-700', 'shadow-xs', 'font-bold');
    btn.classList.add('text-slate-600', 'font-normal');
  });

  const activeBtn = mode === 'preset' ? btnPreset : (mode === 'duration' ? btnDuration : btnSpecific);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-600', 'font-normal');
    activeBtn.classList.add('bg-white', 'text-emerald-700', 'shadow-xs', 'font-bold');
  }

  $('time-preset-container')?.classList.toggle('hidden', mode !== 'preset');
  $('time-duration-container')?.classList.toggle('hidden', mode !== 'duration');
  $('time-specific-container')?.classList.toggle('hidden', mode !== 'specific');
}

function getSelectedExpiryTime() {
  if (currentTimeMode === 'duration') {
    const hours = parseInt($('custom-duration-hours').value || '0', 10);
    const mins = parseInt($('custom-duration-mins').value || '0', 10);
    if (hours === 0 && mins === 0) return '1h 00m';
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours} Hour${hours > 1 ? 's' : ''}`;
    return `${mins} Mins`;
  } else if (currentTimeMode === 'specific') {
    const timeVal = $('custom-exact-time').value;
    if (!timeVal) return 'By Tonight';
    const [h, m] = timeVal.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const formattedHour = h % 12 || 12;
    return `Until ${formattedHour}:${m < 10 ? '0' + m : m} ${period}`;
  }
  return $('food-expiry-input').value;
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
  reader.onload = (evt) => {
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
  const previewBox = $('photo-preview-container');
  const previewImg = $('food-photo-preview');
  const uploadZone = $('photo-upload-zone');
  if (previewBox && previewImg) {
    previewImg.src = url;
    previewBox.classList.remove('hidden');
    if (uploadZone) uploadZone.classList.add('hidden');
  }
}

function removeSelectedPhoto() {
  selectedFoodPhoto = '';
  $('photo-preview-container')?.classList.add('hidden');
  $('photo-upload-zone')?.classList.remove('hidden');
  const fileInput = $('food-photo-input');
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
  const timeInput = $('custom-exact-time');
  if (timeInput) timeInput.value = `${hh}:${mm}`;

  updateGpsDisplays();
  const modal = $('donation-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeDonationModal() {
  const modal = $('donation-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleNewFoodSubmit(e) {
  e.preventDefault();
  const title = $('food-title-input').value;
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

  let createdItem = null;

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPayload)
      });
      const result = await res.json();
      if (result.success) {
        createdItem = result.data;
        await loadListings();
      }
    } catch (err) {
      console.warn('API listing error, saving locally:', err);
    }
  }

  if (!createdItem) {
    createdItem = {
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
      extra: 'Ready for Pickup',
      createdAt: new Date().toISOString()
    };
    listings.unshift(createdItem);
  }

  if (gridChannel) gridChannel.postMessage({ type: 'listing:created', payload: createdItem });

  renderDonorCards();
  closeDonationModal();
  $('add-food-form').reset();
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
  removeNgoNotification(id);
  if (gridChannel) gridChannel.postMessage({ type: 'listing:deleted', payload: { id } });
  renderDonorCards();
  beep(280, 'triangle');
}

async function claimFood(id) {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/listings/${id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ngo: currentEntity || 'Hope Shelter Network' })
      });
      const result = await res.json();
      if (result.success) await loadListings();
    } catch (err) {
      console.warn('API claim error:', err);
    }
  }

  const item = listings.find(i => i.id === id);
  if (item) item.claimed = true;
  markNgoNotificationClaimed(id);

  if (gridChannel) gridChannel.postMessage({ type: 'listing:claimed', payload: { id, ngo: currentEntity } });

  renderNgoCards();
  beep(660);
  confetti({ particleCount: 35, spread: 60 });
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
      console.warn('API handover error:', e);
    }
  }

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

// 10. Global Event Listeners & Audio Autoplay Unlocking
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDonationModal();
    closeGoogleAuthModal();
    closeProfileModal();
    closeGpsRouteModal();
    const dropdown = $('ngo-notifications-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
  }
});

const unlockAudioOnInteraction = () => {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
};
document.addEventListener('click', unlockAudioOnInteraction, { passive: true });
document.addEventListener('keydown', unlockAudioOnInteraction, { passive: true });

document.addEventListener('click', (e) => {
  const dropdown = $('ngo-notifications-dropdown');
  const bellBtn = $('ngo-bell-btn');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!dropdown.contains(e.target) && (!bellBtn || !bellBtn.contains(e.target))) {
      dropdown.classList.add('hidden');
    }
  }
});

// Periodic background polling fallback for eNGO (every 20s)
setInterval(() => {
  if (currentRole === 'ngo') {
    loadListings().then(() => {
      renderNgoCards();
      syncNgoNotificationsWithListings();
    }).catch(() => {});
  }
}, 20000);

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  loadListings().then(() => {
    if (currentRole === 'ngo') {
      syncNgoNotificationsWithListings();
      updateDesktopNotifButton();
    }
  });
  initSSE();
  updateDesktopNotifButton();
});
