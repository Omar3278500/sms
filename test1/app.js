/*************************************************
 * Demo SMS Dashboard - Single Page App
 * Pure HTML + CSS + JS
 *************************************************/

/* =========================
   CONFIG
========================= */
const API_KEY = "ZNX_99Q2EGXCMXLK6O8V0PCRLMV6";
const BASE_URL = "https://api.zenexnetwork.com";

/* =========================
   STATE
========================= */
let activeRanges = [];
let filteredServices = [];
let selectedService = null;
let selectedRange = null;
let currentNumber = null;
let currentMessages = [];
let poller = null;
let currentOtps = [];

/* =========================
   ELEMENTS
========================= */
const serviceListEl = document.getElementById("serviceList");
const serviceCountEl = document.getElementById("serviceCount");
const serviceSearchEl = document.getElementById("serviceSearch");
const rangesListEl = document.getElementById("rangesList");
const numberInfoEl = document.getElementById("numberInfo");
const messagesBoxEl = document.getElementById("messagesBox");
const selectedServiceBannerEl = document.getElementById("selectedServiceBanner");
const otpListEl = document.getElementById("otpList");
const selectedServiceLabelEl = document.getElementById("selectedServiceLabel");
const wizardStepButtons = Array.from(document.querySelectorAll(".wizard-step"));
const stepPanels = {
  1: document.getElementById("step1"),
  2: document.getElementById("step2"),
  3: document.getElementById("step3")
};
const backToServiceBtn = document.getElementById("backToServiceBtn");
const backToRangeBtn = document.getElementById("backToRangeBtn");
const nextToRangeBtn = document.getElementById("nextToRangeBtn");
const nextToNumberBtn = document.getElementById("nextToNumberBtn");

const statServiceEl = document.getElementById("statService");
const statRangesEl = document.getElementById("statRanges");
const statNumberEl = document.getElementById("statNumber");
const statMessagesEl = document.getElementById("statMessages");

const reloadBtn = document.getElementById("reloadBtn");
const pollNowBtn = document.getElementById("pollNowBtn");

const apiDot = document.getElementById("apiDot");
const apiStatusText = document.getElementById("apiStatusText");
const toastEl = document.getElementById("toast");
const currentUserEl = document.getElementById("currentUser");
const historyListEl = document.getElementById("historyList");
const loginOverlayEl = document.getElementById("loginOverlay");
const loginUserSelectEl = document.getElementById("loginUserSelect");
const loginNewUserInputEl = document.getElementById("loginNewUserInput");
const loginBtn = document.getElementById("loginBtn");
const addUserBtn = document.getElementById("addUserBtn");
const logoutBtn = document.getElementById("logoutBtn");

const USER_STORAGE_KEY = "smsDashboardUsers";
const USER_DATA_STORAGE_KEY = "smsDashboardUserData";

let currentUserId = null;
let currentUserName = null;
let currentUserData = { history: [] };

/* =========================
   HELPERS
========================= */
function setApiStatus(type = "idle", text = "Idle") {
  apiDot.classList.remove("success", "error");

  if (type === "success") apiDot.classList.add("success");
  if (type === "error") apiDot.classList.add("error");

  apiStatusText.textContent = text;
}

function showToast(message, type = "success") {
  toastEl.textContent = message;
  toastEl.className = `toast ${type}`;
  toastEl.classList.remove("hidden");

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 3000);
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(date = new Date()) {
  return new Date(date).toLocaleString();
}

function extractDigitsOnly(number = "") {
  return String(number).replace(/[^\d]/g, "");
}

function getUniqueServices() {
  const map = new Map();

  for (const item of activeRanges) {
    const service = item?.service || "Unknown";
    if (!map.has(service)) {
      map.set(service, {
        service,
        count: 1
      });
    } else {
      map.get(service).count += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.service.localeCompare(b.service)
  );
}


function setLoadingRanges() {
  rangesListEl.innerHTML = `
    <div class="empty-state">
      <span class="loader"></span>
      Loading ranges...
    </div>
  `;
}

function setLoadingMessages() {
  messagesBoxEl.innerHTML = `
    <div class="empty-state">
      <span class="loader"></span>
      Checking incoming messages...
    </div>
  `;
}

function updateStats() {
  statServiceEl.textContent = selectedService || "—";

  const serviceRanges = selectedService
    ? activeRanges.filter((r) => r.service === selectedService)
    : [];

  statRangesEl.textContent = String(serviceRanges.length);
  statNumberEl.textContent = currentNumber || "—";
  statMessagesEl.textContent = String(currentMessages.length);
}

function setWizardStep(step) {
  if (![1, 2, 3].includes(step)) return;

  if (step === 2 && !selectedService) {
    showToast("Please choose a service first.", "error");
    return;
  }

  if (step === 3 && !selectedRange) {
    showToast("Please choose a range first.", "error");
    return;
  }

  wizardStepButtons.forEach((button) => {
    const buttonStep = Number(button.getAttribute("data-step"));
    button.classList.toggle("step-active", buttonStep === step);
  });

  Object.entries(stepPanels).forEach(([key, panel]) => {
    panel.classList.toggle("step-active", Number(key) === step);
  });
}

function updateStepLabels() {
  if (selectedServiceLabelEl) {
    selectedServiceLabelEl.textContent = selectedService || "no service";
  }
}

function getStoredUsers() {
  try {
    return JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveStoredUsers(users) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
}

function getUserData(userId) {
  try {
    const data = JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY) || "{}");
    return data[userId] || { history: [], lastState: {} };
  } catch {
    return { history: [], lastState: {} };
  }
}

function saveUserData(userId, data) {
  try {
    const allData = JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY) || "{}");
    allData[userId] = data;
    localStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify(allData));
  } catch {
    localStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify({ [userId]: data }));
  }
}

function saveUserState() {
  if (!currentUserId) return;
  currentUserData.lastState = {
    selectedService,
    selectedRange,
    currentNumber,
    currentMessages
  };
  saveUserData(currentUserId, currentUserData);
}

function restoreUserState() {
  const lastState = currentUserData.lastState || {};
  selectedService = lastState.selectedService || null;
  selectedRange = lastState.selectedRange || null;
  currentNumber = lastState.currentNumber || null;
  currentMessages = lastState.currentMessages || [];

  if (selectedService) {
    selectedServiceBannerEl.textContent = `Selected service: ${selectedService}`;
  }

  if (currentNumber) {
    numberInfoEl.innerHTML = `
      <div class="empty-state">
        Restored number ${escapeHtml(currentNumber)} from previous session.
      </div>
    `;
    updateStats();
    startPolling();
  }
}

function openLoginOverlay() {
  loginOverlayEl.classList.remove("hidden");
}

function closeLoginOverlay() {
  loginOverlayEl.classList.add("hidden");
}

function normalizeUserName(name) {
  return String(name || "").trim();
}

function populateLoginUsers() {
  const users = getStoredUsers();
  loginUserSelectEl.innerHTML = users
    .map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)}</option>`)
    .join("");

  if (!users.length) {
    loginUserSelectEl.innerHTML = `<option value="">No users yet</option>`;
  }
}

function renderHistory() {
  if (!currentUserData.history || !currentUserData.history.length) {
    historyListEl.innerHTML = `<div class="empty-state">No history yet.</div>`;
    return;
  }

  historyListEl.innerHTML = currentUserData.history
    .slice()
    .reverse()
    .map((entry) => {
      return `
        <div class="history-card">
          <div>
            <strong>${escapeHtml(entry.number || entry.service || "Unknown")}</strong>
            <div class="service-meta">${escapeHtml(entry.service || "No service")}</div>
          </div>
          <div style="margin-top: 10px; color: var(--muted);">
            ${escapeHtml(entry.note || "Provisioned number")}
          </div>
          <small>${escapeHtml(formatTime(entry.time))}</small>
        </div>
      `;
    })
    .join("");
}

function addHistoryItem(entry) {
  if (!currentUserId) return;
  currentUserData.history = currentUserData.history || [];
  currentUserData.history.push({
    time: new Date().toISOString(),
    ...entry
  });
  saveUserData(currentUserId, currentUserData);
  renderHistory();
}

function setCurrentUser(userId, userName) {
  currentUserId = userId;
  currentUserName = userName;
  currentUserData = getUserData(userId);
  currentUserEl.textContent = userName || "Guest";
  logoutBtn.disabled = false;
  closeLoginOverlay();
  renderHistory();
  restoreUserState();
}

function createUser(name) {
  const normalized = normalizeUserName(name);
  if (!normalized) return null;

  const users = getStoredUsers();
  if (users.some((user) => user.name.toLowerCase() === normalized.toLowerCase())) {
    return null;
  }

  const id = `user-${Date.now()}`;
  users.push({ id, name: normalized });
  saveStoredUsers(users);
  populateLoginUsers();
  return { id, name: normalized };
}

function loginDefaultUser() {
  const users = getStoredUsers();
  if (users.length) {
    setCurrentUser(users[0].id, users[0].name);
    return true;
  }
  return false;
}

/* =========================
   OTP CODE EXTRACTION
   (for display only)
========================= */
function extractOtpCode(text = "") {
  const value = String(text || "");

  // Quick match: contiguous 4-8 digits
  const quick = value.match(/\b\d{4,8}\b/);
  if (quick) return quick[0];

  // Fallback: allow digits separated by common delimiters (spaces, dash, dot, comma)
  // Scan the string to capture runs that contain only digits and allowed separators
  for (let i = 0; i < value.length; i++) {
    let digits = "";
    let j = i;
    while (j < value.length) {
      const ch = value[j];
      if (/\d/.test(ch)) {
        digits += ch;
        if (digits.length > 8) break;
        j++;
        continue;
      }

      // allow short separators between digits
      if (/^[\s\-\.,]$/.test(ch)) {
        // lookahead: only allow separator if next char is digit
        const next = value[j + 1] || "";
        if (/\d/.test(next)) {
          j++;
          continue;
        }
      }

      break;
    }

    if (digits.length >= 4 && digits.length <= 8) return digits;
  }

  return null;
}

/* =========================
   API REQUEST WRAPPER
========================= */
async function apiRequest(endpoint, options = {}) {
  const headers = {
    mapikey: API_KEY,
    ...(options.headers || {})
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid JSON response from API");
  }

  if (!response.ok) {
    const msg = data?.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }

  return data;
}

/* =========================
   LOAD ACTIVE RANGES
========================= */
async function loadActiveRanges() {
  try {
    setApiStatus("idle", "Loading routes...");
    serviceListEl.innerHTML = `<div class="empty-state small"><span class="loader"></span>Loading services...</div>`;

    const data = await apiRequest("/v1/active-ranges");

    activeRanges = data?.data?.active_ranges || [];

    const services = getUniqueServices();
    filteredServices = services;

    renderServices();
    updateStats();

    setApiStatus("success", "Routes loaded");
    // Loaded routes for user session
  } catch (error) {
    console.error(error);
    setApiStatus("error", "API error");
    serviceListEl.innerHTML = `<div class="empty-state small">Failed to load services.</div>`;
    showToast(error.message || "Failed to load active ranges", "error");
    // Error loading active routes for user session
  }
}

/* =========================
   RENDER SERVICES
========================= */
function renderServices(list = filteredServices) {
  serviceCountEl.textContent = String(list.length);

  if (!list.length) {
    serviceListEl.innerHTML = `<div class="empty-state small">No matching services found.</div>`;
    return;
  }

  serviceListEl.innerHTML = list
    .map((item) => {
      const isActive = selectedService === item.service;
      return `
        <button class="service-item ${isActive ? "active" : ""}" data-service="${escapeHtml(item.service)}">
          <div class="service-title">${escapeHtml(item.service)}</div>
          <div class="service-meta">${item.count} active route(s)</div>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll(".service-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const service = btn.getAttribute("data-service");
      selectService(service);
    });
  });
}

/* =========================
   SERVICE SEARCH
========================= */
function handleServiceSearch() {
  const query = serviceSearchEl.value.trim().toLowerCase();
  const all = getUniqueServices();

  if (!query) {
    filteredServices = all;
  } else {
    filteredServices = all.filter((item) =>
      item.service.toLowerCase().includes(query)
    );
  }

  renderServices(filteredServices);
}

/* =========================
   SELECT SERVICE
========================= */
function selectService(service) {
  selectedService = service;
  selectedRange = null;

  renderServices(filteredServices);

  const ranges = activeRanges.filter((r) => r.service === service);
  selectedServiceBannerEl.textContent = `Selected service: ${service} • ${ranges.length} route(s) available`;
  if (selectedServiceLabelEl) {
    selectedServiceLabelEl.textContent = service;
  }
  renderRanges(ranges);
  setWizardStep(2);

  updateStats();
}

/* =========================
   RENDER RANGES
========================= */
function renderRanges(ranges) {
  if (!ranges.length) {
    rangesListEl.innerHTML = `<div class="empty-state">No ranges available for this service.</div>`;
    return;
  }

  rangesListEl.innerHTML = ranges
    .map((r, index) => {
      const tag = r.tag || "General";
      const hits = r.hits ?? 0;
      const range = r.range || "N/A";

      return `
        <div class="range-card">
          <div class="range-top">
            <div class="range-value">${escapeHtml(range)}</div>
            <div class="range-tag">${escapeHtml(tag)}</div>
          </div>

          <div class="range-meta">
            Service: <strong>${escapeHtml(r.service || "Unknown")}</strong><br />
            Success hits: <strong>${hits}</strong>
          </div>

          <button class="btn btn-primary provision-btn" data-range="${escapeHtml(range)}">
            Get Number
          </button>
        </div>
      `;
    })
    .join("");

  document.querySelectorAll(".provision-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const range = btn.getAttribute("data-range");
      provisionNumber(range);
    });
  });
}

/* =========================
   PROVISION NUMBER
========================= */
async function provisionNumber(range) {
  try {
    if (!range) return;

    selectedRange = range;
    currentNumber = null;
    currentMessages = [];
    updateStats();

    numberInfoEl.innerHTML = `
      <div class="empty-state">
        <span class="loader"></span>
        Provisioning number for range ${escapeHtml(range)}...
      </div>
    `;

    messagesBoxEl.innerHTML = `<div class="empty-state">No messages yet.</div>`;

    setApiStatus("idle", "Provisioning number...");

    const data = await apiRequest("/v1/getnum", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        range,
        is_national: false,
        remove_plus: false
      })
    });

    const num = data?.data;
    if (!num) throw new Error("No number returned from API");

    currentNumber = num.full_number || num.number || num.copy || null;

    renderNumberInfo(num);
    updateStats();

    setApiStatus("success", "Number provisioned");
    showToast("Number provisioned successfully", "success");
    setWizardStep(3);

    addHistoryItem({
      number: currentNumber,
      service: selectedService || "Unknown service",
      note: `Provisioned number from range ${range}`
    });

    saveUserState();
    startPolling();
  } catch (error) {
    console.error(error);
    numberInfoEl.innerHTML = `<div class="empty-state">Failed to provision number.</div>`;
    setApiStatus("error", "Provision failed");
    showToast(error.message || "Failed to provision number", "error");
    // Provision failed for current user
  }
}

/* =========================
   RENDER NUMBER INFO
========================= */
function renderNumberInfo(num) {
  const displayNumber = num.number || num.full_number || "N/A";
  const fullNumber = num.full_number || displayNumber;
  const copyNumber = num.copy || displayNumber;
  const country = num.country || "Unknown";
  const operator = num.operator || "Unknown";
  const status = num.status || "Unknown";
  const iso = num.iso || "N/A";

  numberInfoEl.innerHTML = `
    <div class="number-grid">
      <div class="number-main">
        <div>
          <div class="number-big">${escapeHtml(displayNumber)}</div>
          <div class="service-meta">Provisioned from range: ${escapeHtml(selectedRange || "N/A")}</div>
        </div>

        <div class="number-actions">
          <button class="btn btn-secondary btn-sm" id="copyNumberBtn">Copy Number</button>
          <button class="btn btn-secondary btn-sm" id="copyFullBtn">Copy Full</button>
          <button class="btn btn-primary btn-sm" id="getNewNumberBtn">Get New Number</button>
        </div>
      </div>

      <div class="kv-grid">
        <div class="kv-item">
          <span>Country</span>
          <strong>${escapeHtml(country)}</strong>
        </div>
        <div class="kv-item">
          <span>Operator</span>
          <strong>${escapeHtml(operator)}</strong>
        </div>
        <div class="kv-item">
          <span>Status</span>
          <strong>${escapeHtml(status)}</strong>
        </div>
        <div class="kv-item">
          <span>ISO</span>
          <strong>${escapeHtml(iso)}</strong>
        </div>
      </div>
    </div>
  `;

  const copyNumberBtn = document.getElementById("copyNumberBtn");
  const copyFullBtn = document.getElementById("copyFullBtn");

  copyNumberBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(displayNumber);
      showToast("Number copied", "success");
    } catch {
      showToast("Copy failed", "error");
    }
  });

  copyFullBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyNumber || fullNumber);
      showToast("Full number copied", "success");
    } catch {
      showToast("Copy failed", "error");
    }
  });

  const getNewNumberBtn = document.getElementById("getNewNumberBtn");
  getNewNumberBtn?.addEventListener("click", async () => {
    if (!selectedRange) {
      showToast("No active range selected", "error");
      return;
    }
    // Clear OTPs before provisioning new number
    currentOtps = [];
    otpListEl.innerHTML = `<div class="empty-state">No OTPs yet.</div>`;
    await provisionNumber(selectedRange);
  });
}

/* =========================
   POLLING CONTROL
========================= */
function startPolling() {
  stopPolling();

  if (!currentNumber) return;

  pollMessages();
  poller = setInterval(pollMessages, 4000);

}

function stopPolling() {
  if (poller) {
    clearInterval(poller);
    poller = null;
  }
}

/* =========================
   POLL MESSAGES
========================= */
async function pollMessages() {
  try {
    if (!currentNumber) return;

    setApiStatus("idle", "Checking messages...");
    setLoadingMessages();

    const data = await apiRequest("/v1/numsuccess/info");
    const otps = data?.data?.otps || [];

    const normalizedCurrent = extractDigitsOnly(currentNumber);

    const matched = otps.filter((msg) => {
      const msgNumber = extractDigitsOnly(msg.number || "");
      return msgNumber === normalizedCurrent;
    });

    currentMessages = matched.sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });

    renderMessages(currentMessages);
    updateStats();
    setApiStatus("success", "Messages synced");

    if (matched.length) {
      // Fetched message data for the current number
    }
  } catch (error) {
    console.error(error);
    setApiStatus("error", "Polling failed");
    messagesBoxEl.innerHTML = `<div class="empty-state">Failed to load messages.</div>`;
    // Message polling failed for current user
  }
}

/* =========================
   RENDER MESSAGES
========================= */
function renderMessages(messages) {
  if (!currentNumber) {
    messagesBoxEl.innerHTML = `<div class="empty-state">Provision a number first to view incoming messages.</div>`;
    return;
  }

  if (!messages.length) {
    messagesBoxEl.innerHTML = `
      <div class="empty-state">
        No incoming messages yet for <strong>${escapeHtml(currentNumber)}</strong>.
      </div>
    `;
    return;
  }

  messagesBoxEl.innerHTML = messages
    .map((msg) => {
      const number = msg.number || "Unknown";
      const text = msg.otp || "";
      const time = msg.created_at || "Unknown time";
      const nid = msg.nid || "N/A";
      const country = msg.country || "Unknown";
      const operator = msg.operator || "Unknown";
      const extractedCode = extractOtpCode(text);

      return `
        <div class="message-card">
          <div class="message-head">
            <div>
              <strong>${escapeHtml(number)}</strong>
              <div class="service-meta">${escapeHtml(country)} • ${escapeHtml(operator)} • ${escapeHtml(nid)}</div>
            </div>
            <div class="message-time">${escapeHtml(time)}</div>
          </div>

          <div class="message-body">${escapeHtml(text)}</div>

          ${
            extractedCode
              ? `<div class="message-otp">Detected Code: ${escapeHtml(extractedCode)}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  // Build OTP list from messages and render
  const prevKeys = new Set((currentOtps || []).map((o) => `${o.code}::${o.number}`));
  const otps = [];
  for (const msg of messages) {
    const text = msg.otp || msg.otp_text || msg.otp_text || msg.message || msg.otp || "";
    const extracted = extractOtpCode(text || msg.otp || msg.otp_text || msg.message);
    if (extracted) {
      otps.push({
        code: extracted,
        number: msg.number || currentNumber,
        time: msg.created_at || new Date().toISOString(),
        text: text || msg.otp || msg.message || ""
      });
    }
  }

  // keep most recent unique OTPs (by code+number)
  const map = new Map();
  for (const o of otps.reverse()) {
    const key = `${o.code}::${o.number}`;
    if (!map.has(key)) map.set(key, o);
  }

  currentOtps = Array.from(map.values()).reverse();
  // persist any newly detected OTPs to user history (avoid duplicates)
  const newItems = currentOtps.filter((o) => {
    const key = `${o.code}::${o.number}`;
    if (prevKeys.has(key)) return false;
    // avoid duplicates already in persisted history
    if (currentUserData && Array.isArray(currentUserData.history)) {
      const exists = currentUserData.history.some((h) => (h.number || h.service || "") && String(h.note || "").includes(o.code) && (h.number || "") === (o.number || ""));
      if (exists) return false;
    }
    return true;
  });

  for (const ni of newItems) {
    if (currentUserId) {
      addHistoryItem({
        number: ni.number,
        service: selectedService || "Unknown service",
        note: `OTP: ${ni.code}`
      });
    }
  }

  renderOtps();
}

function renderOtps() {
  if (!otpListEl) return;
  if (!currentOtps.length) {
    otpListEl.innerHTML = `<div class="empty-state">No OTPs yet.</div>`;
    return;
  }

  otpListEl.innerHTML = currentOtps
    .map((o) => `
      <div class="otp-card" data-code="${escapeHtml(o.code)}">
        <div class="otp-code">${escapeHtml(o.code)}</div>
        <div class="otp-meta">${escapeHtml(o.number || "-")} • ${escapeHtml(formatTime(o.time))}</div>
      </div>
    `)
    .join("");

  // add copy listeners
  otpListEl.querySelectorAll('.otp-card').forEach((el) => {
    el.addEventListener('click', async () => {
      const code = el.getAttribute('data-code');
      try {
        await navigator.clipboard.writeText(code);
        showToast('OTP copied', 'success');
      } catch {
        showToast('Copy failed', 'error');
      }
    });
  });
}

/* =========================
   EVENTS
========================= */
reloadBtn.addEventListener("click", async () => {
  await loadActiveRanges();

  if (selectedService) {
    const ranges = activeRanges.filter((r) => r.service === selectedService);
    renderRanges(ranges);
  }

  showToast("Routes reloaded", "success");
});

pollNowBtn.addEventListener("click", async () => {
  if (!currentNumber) {
    showToast("Provision a number first", "error");
    return;
  }

  await pollMessages();
  showToast("Manual message check completed", "success");
});

serviceSearchEl.addEventListener("input", handleServiceSearch);

wizardStepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const step = Number(button.getAttribute("data-step"));
    setWizardStep(step);
  });
});

backToServiceBtn?.addEventListener("click", () => {
  setWizardStep(1);
});

nextToRangeBtn?.addEventListener("click", () => {
  if (!selectedService) {
    showToast("Choose a service first.", "error");
    return;
  }
  setWizardStep(2);
});

nextToNumberBtn?.addEventListener("click", () => {
  if (!selectedRange) {
    showToast("Choose a range first.", "error");
    return;
  }
  setWizardStep(3);
});

backToRangeBtn?.addEventListener("click", () => {
  setWizardStep(2);
});

loginBtn.addEventListener("click", () => {
  const userId = loginUserSelectEl.value;
  const users = getStoredUsers();
  const user = users.find((item) => item.id === userId);

  if (user) {
    setCurrentUser(user.id, user.name);
    return;
  }

  showToast("Please select a valid user.", "error");
});

addUserBtn.addEventListener("click", () => {
  const name = loginNewUserInputEl.value.trim();
  if (!name) {
    showToast("Enter a name to add a new user.", "error");
    return;
  }

  const created = createUser(name);
  if (!created) {
    showToast("User already exists or invalid name.", "error");
    return;
  }

  loginNewUserInputEl.value = "";
  showToast(`User ${created.name} added. Select it to login.`, "success");
});

logoutBtn.addEventListener("click", () => {
  currentUserId = null;
  currentUserName = null;
  currentUserData = { history: [] };
  currentUserEl.textContent = "Guest";
  logoutBtn.disabled = true;
  openLoginOverlay();
});

/* =========================
   INIT
========================= */
async function init() {
  setWizardStep(1);
  updateStepLabels();
  populateLoginUsers();

  if (!loginDefaultUser()) {
    openLoginOverlay();
  }

  updateStats();
  await loadActiveRanges();
}

init();