/* ==========================================================================
   ANN (अन्न) — Frontend Client: Auth, Profiles, Listings, GPS & REST API
   ========================================================================== */

let currentRole = null;
let currentEntity = '';
let currentEmail = '';
let currentUserProfile = null;
let audioCtx = null;
let listings = [];
let jwtToken = localStorage.getItem('ann_jwt_token') || null;

// GPS Coordinates & Map Instances
let donorLat = 28.6139;
let donorLng = 77.2090;
let donorMap = null;
let donorMarker = null;
let donorCircle = null;
let routeMap = null;

const isServerEnv = window.location.protocol.startsWith('http');
const API_BASE = isServerEnv ? '/api' : null;

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`;
  return headers;
}

// 1. Real-Time Server-Sent Events (SSE) Listener
function initSSE() {
  if (!isServerEnv || typeof EventSource === 'undefined') return;
  try {
    const sse = new EventSource('/api/events');
    sse.addEventListener('listing:created', () => {
      beep(587, 'sine', 0.2);
      loadListings().then(() => {
        if (currentRole === 'donor') renderDonorCards();
        else if (currentRole === 'ngo') renderNgoCards();
        updateImpactStats();
      });
    });

    sse.addEventListener('listing:claimed', () => {
      beep(659, 'sine', 0.25);
      loadListings().then(() => {
        if (currentRole === 'donor') renderDonorCards();
        else if (currentRole === 'ngo') renderNgoCards();
        updateImpactStats();
      });
    });

    sse.addEventListener('listing:completed', () => {
      beep(880, 'sine', 0.3);
      loadListings().then(() => {
        if (currentRole === 'donor') renderDonorCards();
        else if (currentRole === 'ngo') renderNgoCards();
        updateImpactStats();
      });
    });

    sse.addEventListener('listing:deleted', () => {
      loadListings().then(() => {
        if (currentRole === 'donor') renderDonorCards();
        else if (currentRole === 'ngo') renderNgoCards();
      });
    });
  } catch (err) {
    console.warn('SSE stream error:', err);
  }
}

// 2. Dynamic Impact Stats Hydration
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
      if (carbonEl) carbonEl.textContent = `${data.carbonOffsetKg}`;
      if (bannerDivertedEl) bannerDivertedEl.textContent = `${data.divertedKg.toLocaleString()} kg`;
    }
  } catch (e) {
    console.warn('Failed to load stats:', e);
  }
}

// 3. Web Audio Tone Helper
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

// 4. Google Authentication & Gmail OTP Handlers
let pendingAuthUser = null;
let activeOtp = '';
let resendTimerInterval = null;

function openGoogleAuthModal() {
  beep(480);
  backToEmailStep();
  const modal = document.getElementById('google-auth-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeGoogleAuthModal() {
  const modal = document.getElementById('google-auth-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  if (resendTimerInterval) clearInterval(resendTimerInterval);
}

function backToEmailStep() {
  document.getElementById('auth-step-email').classList.remove('hidden');
  document.getElementById('auth-step-otp').classList.add('hidden');
  const errorMsg = document.getElementById('otp-error-msg');
  if (errorMsg) errorMsg.classList.add('hidden');
  if (resendTimerInterval) clearInterval(resendTimerInterval);
}

async function selectGoogleAccount(email, name, role) {
  pendingAuthUser = { email, name, role };
  await requestGmailOtp(email);
}

async function handleCustomGoogleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('google-custom-email').value.trim();
  const role = document.querySelector('input[name="custom-role"]:checked').value;
  const name = email.split('@')[0].replace('.', ' ').toUpperCase();

  pendingAuthUser = { email, name, role };
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
      if (data.success && data.previewOtp) {
        activeOtp = data.previewOtp;
      }
    } catch (err) {
      console.warn('API send-otp error:', err);
    }
  }

  if (!activeOtp) activeOtp = Math.floor(100000 + Math.random() * 900000).toString();

  document.getElementById('auth-step-email').classList.add('hidden');
  document.getElementById('auth-step-otp').classList.remove('hidden');
  document.getElementById('otp-target-email').textContent = email;
  document.getElementById('otp-input').value = '';
  document.getElementById('otp-error-msg').classList.add('hidden');

  const quickFillText = document.getElementById('quick-fill-text');
  if (quickFillText) quickFillText.textContent = `Click to Auto-Fill Received OTP: ${activeOtp}`;

  showGmailToast(activeOtp, email);
  startResendTimer();
  document.getElementById('otp-input').focus();
  lucide.createIcons();
}

function showGmailToast(otp, email) {
  const toast = document.getElementById('gmail-toast');
  const toastCode = document.getElementById('toast-otp-code');
  if (!toast || !toastCode) return;

  toastCode.textContent = otp;
  toast.classList.remove('hidden');
  toast.classList.add('flex');
  beep(880, 'sine', 0.2);
  setTimeout(() => dismissGmailToast(), 15000);
}

function dismissGmailToast() {
  const toast = document.getElementById('gmail-toast');
  if (toast) {
    toast.classList.add('hidden');
    toast.classList.remove('flex');
  }
}

function startResendTimer() {
  let seconds = 30;
  const timerDisplay = document.getElementById('otp-timer-display');
  const timerSeconds = document.getElementById('otp-timer-seconds');
  const resendBtn = document.getElementById('btn-resend-otp');

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
  if (!pendingAuthUser) return;
  await requestGmailOtp(pendingAuthUser.email);
}

function quickFillOtp() {
  const otpInput = document.getElementById('otp-input');
  if (otpInput && activeOtp) {
    otpInput.value = activeOtp;
    handleOtpSubmit(new Event('submit'));
  }
}

async function handleOtpSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!pendingAuthUser) return;

  const enteredOtp = document.getElementById('otp-input').value.trim();
  const errorMsg = document.getElementById('otp-error-msg');

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
          name: pendingAuthUser.name
        })
      });
      const data = await res.json();
      if (data.success) {
        verifiedUser = data.data;
        if (data.token) {
          jwtToken = data.token;
          localStorage.setItem('ann_jwt_token', jwtToken);
        }
      } else {
        errorMsg.textContent = data.detail || data.error || 'Invalid OTP code. Please try again.';
        errorMsg.classList.remove('hidden');
        beep(220, 'sawtooth');
        return;
      }
    } catch (err) {
      console.warn('API verify-otp error:', err);
    }
  }

  if (!verifiedUser) {
    errorMsg.textContent = 'Verification error. Please try again.';
    errorMsg.classList.remove('hidden');
    return;
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
  selectGoogleAccount(email, entityName, role);
}

function logout() {
  beep(350, 'triangle');
  currentRole = null;
  currentEmail = '';
  currentUserProfile = null;
  jwtToken = null;
  localStorage.removeItem('ann_jwt_token');
  switchView('login');
}

// 5. View Routing & Dashboard Hydration
async function switchView(role, entityName = '', email = '') {
  ['login', 'donor', 'ngo'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      el.classList.toggle('hidden', v !== role);
      if (v === role && v !== 'login') el.classList.add('flex');
      else el.classList.remove('flex');
    }
  });

  if (role === 'login') return;

  await loadListings();

  if (currentUserProfile) {
    if (role === 'donor') {
      const bannerName = document.getElementById('donor-banner-name');
      const profileName = document.getElementById('donor-profile-name');
      const btnName = document.getElementById('donor-nav-btn-name');
      const avatar = document.getElementById('donor-nav-avatar');

      if (bannerName) bannerName.textContent = currentUserProfile.name;
      if (profileName) profileName.textContent = `${currentUserProfile.name} • ANN Verified Kitchen`;
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
      if (profileName) profileName.textContent = `${currentUserProfile.name} • ANN Verified Relief Shelter`;
      if (btnName) btnName.textContent = currentUserProfile.name.split(' ')[0] || 'Profile';
      if (avatar && currentUserProfile.photo) avatar.src = currentUserProfile.photo;

      renderNgoCards();
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  lucide.createIcons();
}

// 6. Donor GPS Station & Interactive Maps
function initDonorMap() {
  const mapContainer = document.getElementById('donor-map');
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
    donorMarker.bindPopup(`<b>${currentEntity || 'ANN Kitchen Donor'}</b><br>Surplus Station`).openPopup();

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

        if (currentUserProfile && API_BASE) {
          currentUserProfile.lat = donorLat;
          currentUserProfile.lng = donorLng;
          try {
            await fetch(`${API_BASE}/profile`, {
              method: 'PUT',
              headers: getAuthHeaders(),
              body: JSON.stringify({ email: currentUserProfile.email, lat: donorLat, lng: donorLng })
            });
          } catch (e) {}
        }

        beep(660);
        confetti({ particleCount: 25, spread: 45 });
      },
      () => {
        if (statusBadge) statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> GPS Calibrated`;
        updateGpsDisplays();
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  } else {
    updateGpsDisplays();
  }
}

// 7. NGO GPS Route Modal
function openGpsRouteModal(listingId) {
  beep(480);
  const item = listings.find(l => l.id === listingId);
  if (!item) return;

  const targetLat = item.lat || 28.6139;
  const targetLng = item.lng || 77.2090;
  const ngoLat = 28.6250;
  const ngoLng = 77.2180;

  document.getElementById('route-modal-title').textContent = `${item.title} • Route`;
  document.getElementById('route-modal-subtitle').textContent = `Pickup from: ${item.donor || 'ANN Verified Donor'}`;
  document.getElementById('route-coords').textContent = `${targetLat.toFixed(4)}° N, ${targetLng.toFixed(4)}° E`;
  document.getElementById('route-address').textContent = item.gpsAddress || item.donor || 'Kitchen Location';
  document.getElementById('route-distance').textContent = item.dist || '1.4 km';
  document.getElementById('route-gmaps-btn').href = `https://www.google.com/maps/dir/?api=1&origin=${ngoLat},${ngoLng}&destination=${targetLat},${targetLng}`;

  const modal = document.getElementById('gps-route-modal');
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
  const modal = document.getElementById('gps-route-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
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
      console.warn('Backend API error:', err);
    }
  }
  return listings;
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

  if (activeContainer) {
    if (availableListings.length === 0) {
      activeContainer.innerHTML = `
        <div class="col-span-full p-6 text-center rounded-2xl bg-white/80 border border-slate-200 shadow-xs">
          <i data-lucide="package-open" class="w-8 h-8 mx-auto mb-2 text-emerald-400"></i>
          <p class="text-xs font-bold text-slate-700">No active surplus waiting for claim</p>
          <p class="text-[11px] text-slate-400 mt-0.5">Click "+ List Surplus Food" to broadcast excess meals to nearby shelters.</p>
        </div>
      `;
    } else {
      activeContainer.innerHTML = availableListings.map(item => `
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

  if (claimedContainer) {
    if (claimedListings.length === 0) {
      claimedContainer.innerHTML = `
        <div class="col-span-full p-6 text-center rounded-2xl bg-white/80 border border-slate-200 shadow-xs">
          <i data-lucide="truck" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          <p class="text-xs font-bold text-slate-700">No items currently claimed</p>
          <p class="text-[11px] text-slate-400 mt-0.5">When an NGO claims your surplus food, it will automatically move here with live dispatch status.</p>
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

  const items = await loadListings(query);

  container.innerHTML = items.map(item => `
    <div class="glass-card rounded-2xl p-4 shadow-soft border-l-4 border-l-${item.tagColor || 'blue'}-500 flex flex-col justify-between">
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
          <h4 class="font-bold text-slate-900 text-sm sm:text-base mt-1 truncate">${item.title}</h4>
          <p class="text-xs text-slate-500 flex items-center gap-1 truncate">
            <i data-lucide="map-pin" class="w-3 h-3 text-emerald-600 shrink-0"></i>
            <span>${item.donor || 'ANN Kitchen'} • ${item.dist || '1.2 km'}</span>
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

// 9. Handover, Claim & Certificate
async function claimFood(id) {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/listings/${id}/claim`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ngo: currentEntity || 'Hope Shelter Network' })
      });
      const result = await res.json();
      if (result.success) await loadListings();
    } catch (err) {
      console.warn('API claim error:', err);
    }
  }
  renderNgoCards();
  beep(660);
  confetti({ particleCount: 35, spread: 60 });
}

async function confirmHandover(id) {
  beep(520);
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/listings/${id}/complete`, { 
        method: 'POST',
        headers: getAuthHeaders()
      });
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
}

async function removeDonorListing(id) {
  if (API_BASE) {
    try {
      await fetch(`${API_BASE}/listings/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
    } catch (err) {
      console.warn('API delete error:', err);
    }
  }
  listings = listings.filter(i => i.id !== id);
  renderDonorCards();
  beep(280, 'triangle');
}

function openTaxReceiptAlert() {
  const email = (currentUserProfile && currentUserProfile.email) || currentEmail || 'chef.royalspice@gmail.com';
  beep(520);
  if (API_BASE) {
    window.open(`${API_BASE}/certificate/80g?email=${encodeURIComponent(email)}`, '_blank');
  }
}

// 10. Photo Upload & Preset Helpers
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
    gpsAddress: (currentUserProfile && currentUserProfile.address) || 'ANN Kitchen GPS Station',
    image: selectedFoodPhoto || null
  };

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/listings`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newPayload)
      });
      const result = await res.json();
      if (result.success) {
        await loadListings();
      }
    } catch (err) {
      console.warn('API error listing food:', err);
    }
  }

  renderDonorCards();
  closeDonationModal();
  document.getElementById('add-food-form').reset();
  removeSelectedPhoto();
  beep(587);
  confetti({ particleCount: 30, spread: 50 });
}

// 11. Profile Edit Modal & Handlers
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
    roleBadge.textContent = 'ANN Food Donor';
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
    roleBadge.textContent = 'ANN Relief Shelter';
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
      await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedData)
      });
    } catch (err) {
      console.warn('API error saving profile:', err);
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

// 12. Global Listeners & Bootstrap
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDonationModal();
    closeGoogleAuthModal();
    closeProfileModal();
    closeGpsRouteModal();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  loadListings();
  initSSE();
});