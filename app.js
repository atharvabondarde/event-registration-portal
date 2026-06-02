// app.js - Main Controller for InfotechWay Event Portal

// Core Application State
let events = [];
let registrations = [];
let systemLogs = [];
let users = [];
let currentUser = null;

// Form wizards and details state
let wizardCustomFields = [];
let wizardSchedule = [];
let currentWizardStep = 1;
let registrationChart = null;
let lastExplorerView = "events";

// -------------------------------------------------------------
// APP SETUP & INITIALIZATION
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  // Sync databases
  await loadServerState();
  initializeDatabase();
  loadStateFromStorage();
  
  // Theme Setup
  initTheme();
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) themeToggle.addEventListener("click", toggleTheme);
  
  // Check active user session
  const session = getSession();
  if (session) {
    authenticateUser(session);
  } else {
    showLandingScreen();
  }

  // Pre-set default values in event date inputs
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateInput = document.getElementById("new-event-date");
  const timeInput = document.getElementById("new-event-time");
  if (dateInput) dateInput.value = tomorrow.toISOString().split('T')[0];
  if (timeInput) timeInput.value = "09:00";
});

function loadStateFromStorage() {
  events = getEvents();
  registrations = getRegistrations();
  systemLogs = getLogs();
  users = getUsers();
}

function saveStateToStorage() {
  saveEvents(events);
  saveRegistrations(registrations);
  saveLogs(systemLogs);
  saveUsers(users);
}

// -------------------------------------------------------------
// AUTHENTICATION INTERFACE LOGIC
// -------------------------------------------------------------
function showLandingScreen() {
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("app-shell").style.display = "none";
  document.getElementById("landing-container").style.display = "flex";
  renderLandingStats();
}

function showAuthScreen(tabName = 'login') {
  document.getElementById("landing-container").style.display = "none";
  document.getElementById("auth-container").style.display = "flex";
  document.getElementById("app-shell").style.display = "none";
  switchAuthTab(tabName);
}

function renderLandingStats() {
  const tEvents = document.getElementById("stat-total-events");
  const tUsers = document.getElementById("stat-total-users");
  const tRegs = document.getElementById("stat-total-registrations");
  if(tEvents) tEvents.innerText = events.length;
  if(tUsers) tUsers.innerText = users.length;
  if(tRegs) tRegs.innerText = registrations.length;
  
  const carousel = document.getElementById("landing-events-container");
  if (!carousel) return;
  
  if (events.length === 0) {
    carousel.innerHTML = `<div class="glass-panel" style="padding: 40px; text-align: center; width: 100%;">
      <h3 style="color: var(--text-secondary);">No Sequences Initiated</h3>
      <p style="margin-top: 10px;">The database is currently empty. Initialize an account to begin orchestration.</p>
    </div>`;
  } else {
    // Generate carousel items if events exist
    let html = "";
    events.slice(0, 5).forEach(ev => {
      html += `<div class="glass-card" style="min-width: 300px; padding: 20px; border-radius: var(--radius-sm);">
        <h3 class="glow-text" style="margin-bottom: 10px;">${ev.title}</h3>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 15px;">${ev.date} @ ${ev.time}</p>
        <div style="color: var(--primary); font-weight: 600;">${ev.price === 0 ? 'Free Entry' : '$'+ev.price}</div>
      </div>`;
    });
    carousel.innerHTML = html;
  }
}

function switchAuthTab(tabName) {
  const tabs = document.querySelectorAll(".auth-tab-btn");
  const forms = document.querySelectorAll(".auth-form");
  
  tabs.forEach(tab => {
    if (tab.innerText.toLowerCase().includes(tabName === 'login' ? 'in' : 'create')) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  forms.forEach(form => {
    if (form.id === `${tabName}-form`) {
      form.classList.add("active");
    } else {
      form.classList.remove("active");
    }
  });
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  loadStateFromStorage();
  const foundUser = users.find(u => u.email.toLowerCase() === email && u.password === password);

  if (foundUser) {
    saveSession(foundUser);
    authenticateUser(foundUser);
    showToast(`Welcome back, ${foundUser.name}!`, "success");
    document.getElementById("login-form").reset();
  } else {
    showToast("Invalid email address or security password.", "danger");
  }
}

function handleRegisterSubmit(event) {
  event.preventDefault();
  const name = document.getElementById("reg-fullname").value.trim();
  const email = document.getElementById("reg-user-email").value.trim().toLowerCase();
  const password = document.getElementById("reg-user-password").value;
  const role = document.getElementById("reg-role-select").value;

  loadStateFromStorage();
  
  // Duplicate check
  if (users.some(u => u.email.toLowerCase() === email)) {
    showToast("An account with this email already exists.", "warning");
    return;
  }

  const newUser = { name, email, password, role };
  users.push(newUser);
  saveUsers(users);
  
  // Log inside system
  addLog("info", `New user registry: ${name} (${role}) signed up.`);
  
  // Login directly
  saveSession(newUser);
  authenticateUser(newUser);
  showToast(`Account created successfully! Welcome ${name}.`, "success");
  document.getElementById("register-form").reset();
}

function handleLogout() {
  saveSession(null);
  currentUser = null;
  showLandingScreen();
  showToast("Session Terminated. Returning to Home Interface.", "info");
}

function authenticateUser(userObject) {
  currentUser = userObject;
  loadStateFromStorage();
  
  // Add body class toggle for conditional rendering CSS
  document.body.setAttribute("data-user-role", currentUser.role);

  document.getElementById("landing-container").style.display = "none";
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("app-shell").style.display = "flex";
  
  // // Setup user details in headers
  // document.getElementById("header-user-name").innerText = currentUser.name;
  // document.getElementById("header-user-role").innerText = currentUser.role === "admin" ? "Organizer Admin" : "Attendee Participant";
  
  // const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  // document.getElementById("header-user-avatar").innerText = initials;

  const userName = document.getElementById("header-user-name");
  if (userName) {
    userName.innerText = currentUser.name;
  }

  const userRole = document.getElementById("header-user-role");
  if (userRole) {
    userRole.innerText =
      currentUser.role === "admin"
        ? "Organizer Admin"
        : "Attendee Participant";
  }

  const userAvatar = document.getElementById("header-user-avatar");
  if (userAvatar) {
    const initials = currentUser.name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);

    userAvatar.innerText = initials;
  }

  // Open App Container
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("app-shell").style.display = "flex";

  // Redirect to role dashboard
  if (currentUser.role === "admin") {
    switchView("dashboard");
  } else {
    switchView("participant-dashboard");
  }
}

// -------------------------------------------------------------
// SPA ROUTING ENGINE
// -------------------------------------------------------------
function switchView(viewName) {
  // Authorization checks
  if (currentUser.role === "participant") {
    const restrictedForParticipant = ["dashboard", "participants", "notifications", "create-event"];
    if (restrictedForParticipant.includes(viewName)) {
      showToast("Access Restricted. Admins only.", "danger");
      switchView("participant-dashboard");
      return;
    }
  }

  // Deactivate all view containers
  const containers = document.querySelectorAll(".view-container");
  containers.forEach(container => container.classList.remove("active"));
  
  // Deactivate top nav links
  const navItems = document.querySelectorAll(".top-navbar-menu .top-nav-item");
  navItems.forEach(item => item.classList.remove("active"));

  const headerTitle = document.getElementById("view-title");
  const quickCreateBtn = document.getElementById("quick-create-btn");

  // Show active view
  const targetContainer = document.getElementById(`${viewName}-view`);
  if (targetContainer) {
    targetContainer.classList.add("active");
  }

  // Highlight Top Nav Menu
  const activeNav = document.querySelector(`.top-navbar-menu .top-nav-item[data-view="${viewName}"]`);
  if (activeNav) {
    activeNav.classList.add("active");
  }

  // View specific setups
  if (viewName === "dashboard") {
    headerTitle.innerText = "Admin Portal Dashboard";
    if (quickCreateBtn) quickCreateBtn.style.display = "inline-flex";
    renderAdminDashboardStats();
  } else if (viewName === "participant-dashboard") {
    headerTitle.innerText = "My Participant Dashboard";
    if (quickCreateBtn) quickCreateBtn.style.display = "none";
    renderParticipantDashboardStats();
  } else if (viewName === "events") {
    headerTitle.innerText = "Explore & Register Events";
    if (quickCreateBtn) quickCreateBtn.style.display = currentUser.role === "admin" ? "inline-flex" : "none";
    lastExplorerView = "events";
    renderEventsGrid();
  } else if (viewName === "create-event") {
    headerTitle.innerText = "Create New Event";
    if (quickCreateBtn) quickCreateBtn.style.display = "none";
    resetWizard();
  } else if (viewName === "participants") {
    headerTitle.innerText = "Attendee Database Registry";
    if (quickCreateBtn) quickCreateBtn.style.display = "inline-flex";
    populateEventFilters();
    renderParticipantsTable();
  } else if (viewName === "schedule") {
    headerTitle.innerText = "Event Calendar Agenda";
    if (quickCreateBtn) quickCreateBtn.style.display = currentUser.role === "admin" ? "inline-flex" : "none";
    renderCalendarSchedule();
  } else if (viewName === "notifications") {
    headerTitle.innerText = "Announcements Console";
    if (quickCreateBtn) quickCreateBtn.style.display = "inline-flex";
    populateBroadcastEventSelect();
    renderNotificationLogs();
  } else if (viewName === "profile") {
    headerTitle.innerText = "My Profile Settings";
    if (quickCreateBtn) quickCreateBtn.style.display = "none";
    renderProfileSettings();
  } else if (viewName === "event-detail") {
    headerTitle.innerText = "Event Details Desk";
    if (quickCreateBtn) quickCreateBtn.style.display = "none";
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Handles detail view back clicks
function handleDetailBackNavigation() {
  switchView(lastExplorerView);
}

// -------------------------------------------------------------
// ADMIN DASHBOARD
// -------------------------------------------------------------
function renderAdminDashboardStats() {
  document.getElementById("stat-total-events").innerText = events.length;
  document.getElementById("stat-total-registrations").innerText = registrations.length;
  
  const totalRev = registrations.reduce((sum, reg) => sum + (reg.pricePaid || 0), 0);
  document.getElementById("stat-total-revenue").innerText = `₹${totalRev.toLocaleString()}`;
  
  if (registrations.length === 0) {
    document.getElementById("stat-checkin-rate").innerText = "0%";
  } else {
    const checkedInCount = registrations.filter(r => r.checkedIn).length;
    const rate = Math.round((checkedInCount / registrations.length) * 100);
    document.getElementById("stat-checkin-rate").innerText = `${rate}%`;
  }

  // Logs
  const activityContainer = document.getElementById("activity-feed-container");
  activityContainer.innerHTML = "";
  
  const recentLogs = systemLogs.slice(0, 5);
  if (recentLogs.length === 0) {
    activityContainer.innerHTML = `<p class="text-muted" style="font-size:0.85rem; padding:12px;">No registration data found.</p>`;
  } else {
    recentLogs.forEach(log => {
      const item = document.createElement("div");
      item.className = "activity-item";
      item.innerHTML = `
        <div class="activity-dot ${log.type === 'success' ? 'success' : log.type === 'warning' ? 'warning' : 'info'}"></div>
        <div class="activity-details">
          <div class="activity-message">${log.message}</div>
          <div class="activity-time">${formatRelativeTime(log.timestamp)}</div>
        </div>
      `;
      activityContainer.appendChild(item);
    });
  }

  // Previews
  const dbEventsPreview = document.getElementById("dashboard-events-preview");
  dbEventsPreview.innerHTML = "";
  
  const activeEvents = events
    .filter(e => new Date(e.date) >= new Date().setHours(0,0,0,0))
    .sort((a,b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);
    
  if (activeEvents.length === 0) {
    dbEventsPreview.innerHTML = `<div style="grid-column: 1/-1; padding:24px; text-align:center; color:var(--text-secondary); background:rgba(0,0,0,0.15); border-radius:var(--radius-sm)">No events available.</div>`;
  } else {
    activeEvents.forEach(evt => {
      const card = createEventGridCard(evt);
      dbEventsPreview.appendChild(card);
    });
  }

  renderDashboardCharts();
}

function renderDashboardCharts() {
  const ctx = document.getElementById("registrationChart").getContext("2d");
  if (registrationChart) {
    registrationChart.destroy();
  }

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
  const labelColor = isDark ? "#94a3b8" : "#475569";

  const registrationDates = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    registrationDates[dateStr] = 0;
  }

  registrations.forEach(reg => {
    const rDate = reg.registeredAt.split(' ')[0];
    if (registrationDates.hasOwnProperty(rDate)) {
      registrationDates[rDate]++;
    }
  });

  const sortedDates = Object.keys(registrationDates).sort((a,b) => new Date(a) - new Date(b));
  const dataValues = sortedDates.map(date => registrationDates[date]);
  const displayLabels = sortedDates.map(date => {
    const parsed = new Date(date);
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  let sum = registrations.length - dataValues.reduce((a,b)=>a+b, 0);
  const cumulativeData = dataValues.map(val => {
    sum += val;
    return sum;
  });

  const primaryGradient = ctx.createLinearGradient(0, 0, 0, 250);
  primaryGradient.addColorStop(0, "rgba(99, 102, 241, 0.4)");
  primaryGradient.addColorStop(1, "rgba(99, 102, 241, 0.0)");

  registrationChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: displayLabels,
      datasets: [
        {
          label: "Registered Users",
          data: cumulativeData,
          borderColor: "#6366f1",
          borderWidth: 3,
          pointBackgroundColor: "#6366f1",
          pointHoverRadius: 6,
          fill: true,
          backgroundColor: primaryGradient,
          tension: 0.35,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 12,
          cornerRadius: 8,
          backgroundColor: isDark ? "#1e293b" : "#ffffff",
          titleColor: isDark ? "#ffffff" : "#0f172a",
          bodyColor: isDark ? "#94a3b8" : "#475569",
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
          borderWidth: 1,
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: labelColor, font: { family: 'Plus Jakarta Sans', size: 10 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: labelColor, font: { family: 'Plus Jakarta Sans', size: 10 }, stepSize: 1 }
        }
      }
    }
  });
}

// -------------------------------------------------------------
// PARTICIPANT DASHBOARD & TICKET REGISTRY
// -------------------------------------------------------------
function renderParticipantDashboardStats() {
  const userEmail = currentUser.email.toLowerCase();
  
  // Filter registered seats
  const myRegistrations = registrations.filter(r => r.email.toLowerCase() === userEmail);
  
  document.getElementById("stat-user-events").innerText = myRegistrations.length;
  
  const spent = myRegistrations.reduce((sum, reg) => sum + (reg.pricePaid || 0), 0);
  document.getElementById("stat-user-spent").innerText = `$${spent}`;
  
  const checkedIn = myRegistrations.filter(r => r.checkedIn).length;
  document.getElementById("stat-user-checkedin").innerText = checkedIn;
  
  if (myRegistrations.length === 0) {
    document.getElementById("stat-user-rate").innerText = "0%";
  } else {
    const rate = Math.round((checkedIn / myRegistrations.length) * 100);
    document.getElementById("stat-user-rate").innerText = `${rate}%`;
  }

  // Render personal registered tickets cards
  const gridContainer = document.getElementById("my-tickets-grid-container");
  gridContainer.innerHTML = "";

  if (myRegistrations.length === 0) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1/-1; padding:32px; text-align:center; color:var(--text-secondary); background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md);">
        No registration data found.
      </div>
    `;
    return;
  }

  myRegistrations.forEach(reg => {
    const evt = events.find(e => e.id === reg.eventId);
    if (!evt) return;

    const card = document.createElement("div");
    card.className = "event-card";
    
    const isVirtual = evt.locationType === "virtual";
    
    card.innerHTML = `
      <div class="event-banner" style="background: ${evt.gradient || 'linear-gradient(135deg,#0f172a,#334155)'}">
        <span class="event-category-badge">${evt.category}</span>
      </div>
      <div class="event-body">
        <h4 class="event-title">${evt.title}</h4>
        
        <div style="display:flex; gap:8px; margin-bottom: 12px; flex-wrap:wrap;">
          <span class="status-badge confirmed" style="font-size:0.65rem;">ACCESS RESERVED</span>
          <span class="status-badge ${reg.checkedIn ? 'confirmed' : 'pending'}" style="font-size:0.65rem;">
            ${reg.checkedIn ? 'Checked-In' : 'Not Checked-In'}
          </span>
        </div>

        <div class="event-details-list" style="border:none; padding:0;">
          <div class="event-detail-item">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span>${formatDateString(evt.date)} at ${evt.time}</span>
          </div>
          <div class="event-detail-item">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden; display:block; max-width:240px;">
              ${isVirtual ? "🌐 Zoom Video Meeting" : `📍 ${evt.location}`}
            </span>
          </div>
        </div>
      </div>
      <div class="event-footer">
        <button class="btn btn-secondary" onclick="showPersonalRegistrationBadge('${evt.id}')" style="width:100%;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
          Open Ticket Badge
        </button>
      </div>
    `;
    gridContainer.appendChild(card);
  });
}

function showPersonalRegistrationBadge(eventId) {
  const reg = registrations.find(r => r.eventId === eventId && r.email.toLowerCase() === currentUser.email.toLowerCase());
  if (!reg) return;

  const evt = events.find(e => e.id === eventId);
  if (!evt) return;

  openTicketModal(reg, evt);
}

// -------------------------------------------------------------
// EVENT VIEWS & DETAILS
// -------------------------------------------------------------
function renderEventsGrid() {
  const container = document.getElementById("events-grid-container");
  container.innerHTML = "";
  
  if (events.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; padding:48px; text-align:center; color:var(--text-secondary); background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md);">No events available.</div>`;
    return;
  }
  
  events.forEach(evt => {
    const card = createEventGridCard(evt);
    container.appendChild(card);
  });
}

function createEventGridCard(evt) {
  const card = document.createElement("div");
  card.className = "event-card";
  
  const isFree = evt.price === 0;
  const isVirtual = evt.locationType === "virtual";
  const capacityPercent = Math.min(100, Math.round((evt.registered / evt.capacity) * 100));
  
  let capacityColor = "var(--primary)";
  if (capacityPercent >= 90) capacityColor = "var(--danger)";
  else if (capacityPercent >= 75) capacityColor = "var(--warning)";
  
  // Check if current logged user already registered
  const isRegistered = registrations.some(r => r.eventId === evt.id && r.email.toLowerCase() === currentUser.email.toLowerCase());

  let actionButtonHTML = '';
  if (isRegistered) {
    actionButtonHTML = `
      <button class="btn btn-secondary" onclick="showPersonalRegistrationBadge('${evt.id}')" style="padding: 6px 12px; font-size: 0.8rem; background-color: var(--success-light); color: var(--success);">
        Open Ticket
      </button>
    `;
  } else {
    actionButtonHTML = `
      <button class="btn btn-primary" onclick="showEventDetail('${evt.id}', 'events')" style="padding: 6px 12px; font-size: 0.8rem;">
        Get Tickets
      </button>
    `;
  }
  
  card.innerHTML = `
    <div class="event-banner" style="background: ${evt.gradient || 'linear-gradient(135deg,#0f172a,#334155)'}">
      <span class="event-category-badge">${evt.category}</span>
    </div>
    <div class="event-body">
      <h4 class="event-title">${evt.title}</h4>
      <p class="event-desc">${evt.description}</p>
      
      <div style="margin-top: auto;">
        <!-- Slots status bar -->
        <div style="margin-bottom: 12px;">
          <div style="display:flex; justify-content:space-between; font-size: 0.75rem; color:var(--text-secondary); margin-bottom:4px;">
            <span>Registry Status</span>
            <span style="font-weight:600; color: ${capacityColor}">${evt.registered}/${evt.capacity} booked</span>
          </div>
          <div style="height:6px; width:100%; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden;">
            <div style="height:100%; width: ${capacityPercent}%; background:${capacityColor}; border-radius:3px;"></div>
          </div>
        </div>

        <div class="event-details-list">
          <div class="event-detail-item">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span>${formatDateString(evt.date)} at ${evt.time}</span>
          </div>
          <div class="event-detail-item">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden; display:block; max-width:240px;">
              ${isVirtual ? "🌐 Zoom Webinar Room" : `📍 ${evt.location}`}
            </span>
          </div>
        </div>
      </div>
    </div>
    <div class="event-footer">
      <span class="event-price ${isFree ? 'free' : ''}">${isFree ? 'FREE' : `$${evt.price}`}</span>
      ${actionButtonHTML}
    </div>
  `;
  
  return card;
}

function filterEventsList() {
  const searchQuery = document.getElementById("event-search-input").value.toLowerCase();
  const categoryFilter = document.getElementById("event-category-filter").value;
  const priceFilter = document.getElementById("event-price-filter").value;

  const originalEvents = getEvents();

  const filtered = originalEvents.filter(evt => {
    const matchesSearch = evt.title.toLowerCase().includes(searchQuery) ||
                          evt.description.toLowerCase().includes(searchQuery) ||
                          evt.location.toLowerCase().includes(searchQuery);
    const matchesCategory = categoryFilter === "All" || evt.category === categoryFilter;
    
    let matchesPrice = true;
    if (priceFilter === "Free") matchesPrice = evt.price === 0;
    if (priceFilter === "Paid") matchesPrice = evt.price > 0;
    
    return matchesSearch && matchesCategory && matchesPrice;
  });

  events = filtered;
  renderEventsGrid();
}

function showEventDetail(eventId, originView = "events") {
  const allEvents = getEvents();
  const evt = allEvents.find(e => e.id === eventId);
  if (!evt) return;

  lastExplorerView = originView;
  switchView("event-detail");

  const container = document.getElementById("event-detail-content");
  const isFree = evt.price === 0;
  const isVirtual = evt.locationType === "virtual";
  const capacityPercent = Math.min(100, Math.round((evt.registered / evt.capacity) * 100));
  const isFull = evt.registered >= evt.capacity;
  
  // Check if current user is registered
  const userRegistration = registrations.find(r => r.eventId === eventId && r.email.toLowerCase() === currentUser.email.toLowerCase());

  // Render Base HTML
  container.innerHTML = `
    <div class="event-detail-grid">
      
      <!-- Left Info Panel -->
      <div>
        <div class="event-info-cover" style="background: ${evt.gradient || 'linear-gradient(135deg,#0f172a,#334155)'}">
          <span class="event-category-badge" style="width: fit-content; margin-bottom: 12px;">${evt.category}</span>
          <h2 style="font-size: 1.8rem; text-shadow: 0 4px 10px rgba(0,0,0,0.3); font-family: var(--font-heading); color:#ffffff;">
            ${evt.title}
          </h2>
        </div>

        <div class="card">
          <h3 style="margin-bottom:12px; font-family: var(--font-heading);">Event Overview</h3>
          <p style="color:var(--text-secondary); line-height:1.6; font-size:0.95rem; margin-bottom:24px;">
            ${evt.description}
          </p>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; padding:16px; border-radius:var(--radius-sm); background:rgba(0,0,0,0.1); border:1px solid var(--border-color); font-size:0.85rem; margin-bottom:24px;">
            <div>
              <span class="text-muted" style="display:block; font-size:0.75rem; font-weight:600; text-transform:uppercase;">Date & Timing</span>
              <strong style="color:var(--text-primary);">${formatDateString(evt.date)} at ${evt.time} (${evt.duration || 'N/A'})</strong>
            </div>
            <div>
              <span class="text-muted" style="display:block; font-size:0.75rem; font-weight:600; text-transform:uppercase;">Venue Location</span>
              <strong style="color:var(--text-primary);">
                ${isVirtual ? `<a href="${evt.location}" target="_blank" style="color:var(--primary); word-break:break-all;">Click to Join Web Meeting</a>` : evt.location}
              </strong>
            </div>
          </div>
        </div>

        <!-- Hourly Schedule -->
        <div class="card">
          <h3 style="margin-bottom:12px; font-family: var(--font-heading);">Event Agenda Schedule</h3>
          <div class="agenda-timeline" id="event-detail-agenda">
            <!-- Populated via JS -->
          </div>
        </div>
      </div>

      <!-- Right Registration Form Panel -->
      <div class="reg-box">
        <div class="reg-price-tag">
          ${isFree ? 'FREE' : `$${evt.price}`}
          <span>/ per registration ticket</span>
        </div>

        <div style="margin-bottom:20px; font-size:0.85rem; color:var(--text-secondary);">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Booking slots</span>
            <strong>${evt.registered} / ${evt.capacity} seats</strong>
          </div>
          <div style="height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden;">
            <div style="height:100%; width:${capacityPercent}%; background:var(--primary);"></div>
          </div>
        </div>

        ${userRegistration ? `
          <!-- Alredy Registered state widget -->
          <div style="text-align:center; padding:20px; background:var(--success-light); border:1px solid rgba(16,185,129,0.2); border-radius:var(--radius-sm); display:flex; flex-direction:column; gap:16px;">
            <div>
              <h4 style="color:var(--success); margin-bottom:4px; font-family:var(--font-heading);">Seat Confirmed!</h4>
              <p style="font-size:0.8rem; color:var(--text-secondary);">You have successfully registered. Your ticket reference is ${userRegistration.id.toUpperCase()}.</p>
            </div>
            <button class="btn btn-primary" onclick="showPersonalRegistrationBadge('${evt.id}')" style="width:100%; font-size:0.8rem;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
              View My Ticket Badge
            </button>
          </div>
        ` : isFull ? `
          <div style="text-align:center; padding:16px; background:var(--danger-light); color:var(--danger); border-radius:var(--radius-sm); font-weight:600; border:1px solid rgba(239, 68, 68, 0.2);">
            This Event is Fully Booked
          </div>
        ` : `
          <form id="registration-form" onsubmit="handleRegistrationSubmit(event, '${evt.id}')">
            <div class="form-group">
              <label for="reg-name">Your Full Name</label>
              <!-- Prefilled and locked for registered profile -->
              <input type="text" id="reg-name" class="form-control" value="${currentUser.name}" readonly style="opacity:0.75; cursor:not-allowed;">
            </div>
            
            <div class="form-group">
              <label for="reg-email">Email Address</label>
              <input type="email" id="reg-email" class="form-control" value="${currentUser.email}" readonly style="opacity:0.75; cursor:not-allowed;">
            </div>

            <!-- Dynamic custom fields -->
            <div id="dynamic-custom-form-fields">
              <!-- Rendered via JS -->
            </div>

            <button type="submit" class="btn btn-primary" style="width:100%; padding:12px; margin-top:10px;">
              Register & Reserve Ticket
            </button>
          </form>
        `}
      </div>

    </div>
  `;

  // Render detail schedule sessions
  const agendaContainer = document.getElementById("event-detail-agenda");
  if (!evt.schedule || evt.schedule.length === 0) {
    agendaContainer.innerHTML = `<p class="text-muted" style="font-size:0.85rem; padding-left:12px;">No schedule items listed.</p>`;
    agendaContainer.style.paddingLeft = "0";
  } else {
    evt.schedule.forEach(item => {
      const agendaEl = document.createElement("div");
      agendaEl.className = "agenda-item";
      agendaEl.innerHTML = `
        <span class="agenda-time-span">${item.time}</span>
        <div class="agenda-title">${item.title}</div>
        <div class="agenda-speaker">Hosted by: <strong>${item.speaker}</strong> • Room: ${item.location}</div>
      `;
      agendaContainer.appendChild(agendaEl);
    });
  }

  // Render custom fields inputs
  const customFieldsContainer = document.getElementById("dynamic-custom-form-fields");
  if (customFieldsContainer && evt.customFields && evt.customFields.length > 0) {
    evt.customFields.forEach((field, index) => {
      const group = document.createElement("div");
      group.className = "form-group";
      
      const label = document.createElement("label");
      label.innerHTML = `${field.name} ${field.required ? '<span style="color:var(--danger)">*</span>' : ''}`;
      
      let inputEl;
      if (field.type === "select") {
        inputEl = document.createElement("select");
        inputEl.className = "form-control";
        inputEl.required = field.required;
        inputEl.id = `dyn-field-${index}`;
        
        const optDefault = document.createElement("option");
        optDefault.value = "";
        optDefault.innerText = "-- Choose Option --";
        inputEl.appendChild(optDefault);
        
        field.options.forEach(opt => {
          const optEl = document.createElement("option");
          optEl.value = opt;
          optEl.innerText = opt;
          inputEl.appendChild(optEl);
        });
      } else {
        inputEl = document.createElement("input");
        inputEl.type = field.type;
        inputEl.className = "form-control";
        inputEl.required = field.required;
        inputEl.id = `dyn-field-${index}`;
        inputEl.placeholder = field.placeholder || "";
      }
      
      group.appendChild(label);
      group.appendChild(inputEl);
      customFieldsContainer.appendChild(group);
    });
  }
}

function handleRegistrationSubmit(event, eventId) {
  event.preventDefault();
  
  const allEvents = getEvents();
  const activeRegistrations = getRegistrations();
  
  const evtIndex = allEvents.findIndex(e => e.id === eventId);
  if (evtIndex === -1) return;
  const evt = allEvents[evtIndex];

  if (evt.registered >= evt.capacity) {
    showToast("Sorry, this event is fully booked.", "danger");
    return;
  }

  // Custom fields solutions
  const customFieldsAnswers = {};
  if (evt.customFields && evt.customFields.length > 0) {
    for (let i = 0; i < evt.customFields.length; i++) {
      const field = evt.customFields[i];
      const inputEl = document.getElementById(`dyn-field-${i}`);
      if (inputEl) {
        customFieldsAnswers[field.name] = inputEl.value;
      }
    }
  }

  const newRegId = `reg-${Date.now()}`;
  const now = new Date();
  const formatNum = (n) => String(n).padStart(2, '0');
  const regTimestamp = `${now.getFullYear()}-${formatNum(now.getMonth() + 1)}-${formatNum(now.getDate())} ${formatNum(now.getHours())}:${formatNum(now.getMinutes())}:${formatNum(now.getSeconds())}`;

  const registrationEntry = {
    id: newRegId,
    eventId: eventId,
    name: currentUser.name,
    email: currentUser.email,
    ticketType: evt.price === 0 ? "General" : "Paid Admission",
    pricePaid: evt.price,
    status: "Confirmed",
    checkedIn: false,
    registeredAt: regTimestamp,
    customFields: customFieldsAnswers
  };

  evt.registered += 1;
  activeRegistrations.unshift(registrationEntry);
  
  saveRegistrations(activeRegistrations);
  saveEvents(allEvents);

  triggerNotificationLog("success", `${currentUser.name} registered for ${evt.title}`);

  loadStateFromStorage();
  
  openTicketModal(registrationEntry, evt);
  showEventDetail(eventId, lastExplorerView);
}

// -------------------------------------------------------------
// EVENT WIZARD (Admin Only)
// -------------------------------------------------------------
function resetWizard() {
  currentWizardStep = 1;
  wizardCustomFields = [];
  wizardSchedule = [];
  
  const form = document.getElementById("create-event-form");
  if (form) form.reset();
  
  const fieldsCont = document.getElementById("wizard-custom-fields-container");
  const agendaCont = document.getElementById("wizard-schedule-container");
  if (fieldsCont) fieldsCont.innerHTML = "";
  if (agendaCont) agendaCont.innerHTML = "";
  
  togglePriceInput();
  toggleLocationInputs();
  updateWizardStepsUI();
  updateWizardPreview();
}

function updateWizardStepsUI() {
  for (let i = 1; i <= 4; i++) {
    const content = document.getElementById(`wizard-step-${i}-content`);
    const indicator = document.getElementById(`indicator-step-${i}`);
    
    if (i === currentWizardStep) {
      if (content) content.classList.add("active");
      if (indicator) indicator.className = "step-indicator active";
    } else if (i < currentWizardStep) {
      if (content) content.classList.remove("active");
      if (indicator) indicator.className = "step-indicator completed";
    } else {
      if (content) content.classList.remove("active");
      if (indicator) indicator.className = "step-indicator";
    }
  }

  const prevBtn = document.getElementById("wizard-prev-btn");
  const nextBtn = document.getElementById("wizard-next-btn");

  if (currentWizardStep === 1) {
    if (prevBtn) prevBtn.style.visibility = "hidden";
  } else {
    if (prevBtn) prevBtn.style.visibility = "visible";
  }

  if (currentWizardStep === 4) {
    if (nextBtn) {
      nextBtn.innerHTML = `
        Complete & Launch Event
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
      `;
    }
  } else {
    if (nextBtn) {
      nextBtn.innerHTML = `
        Next Step
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
      `;
    }
  }
}

function wizardNext() {
  const activeContent = document.getElementById(`wizard-step-${currentWizardStep}-content`);
  const inputs = activeContent.querySelectorAll("[required]");
  
  let isValid = true;
  inputs.forEach(input => {
    if (!input.checkValidity()) {
      input.reportValidity();
      isValid = false;
    }
  });

  if (!isValid) return;

  if (currentWizardStep < 4) {
    currentWizardStep++;
    updateWizardStepsUI();
  } else {
    saveCreatedEvent();
  }
}

function wizardPrev() {
  if (currentWizardStep > 1) {
    currentWizardStep--;
    updateWizardStepsUI();
  }
}

function toggleLocationInputs() {
  const type = document.getElementById("new-event-loctype").value;
  const label = document.getElementById("location-label-txt");
  const input = document.getElementById("new-event-location");
  
  if (type === "virtual") {
    if (label) label.innerHTML = `Virtual Webinar URL <span style="color:var(--danger)">*</span>`;
    if (input) input.placeholder = "e.g. https://zoom.us/j/1234567";
  } else {
    if (label) label.innerHTML = `Venue Address <span style="color:var(--danger)">*</span>`;
    if (input) input.placeholder = "e.g. Suite 4, Madison Square Gardens, NY";
  }
}

function togglePriceInput() {
  const type = document.getElementById("new-event-tickettype").value;
  const group = document.getElementById("price-input-group");
  const input = document.getElementById("new-event-price");
  
  if (type === "paid") {
    if (group) group.style.display = "block";
    if (input) {
      input.setAttribute("required", "true");
      input.value = "49";
    }
  } else {
    if (group) group.style.display = "none";
    if (input) {
      input.removeAttribute("required");
      input.value = 0;
    }
  }
}

function updateWizardPreview() {
  const title = document.getElementById("new-event-title").value.trim() || "Event Title Placeholder";
  const desc = document.getElementById("new-event-description").value.trim() || "Your event description will appear here as you type.";
  const cat = document.getElementById("new-event-category").value;
  const grad = document.getElementById("new-event-banner").value;
  const date = document.getElementById("new-event-date").value;
  const locType = document.getElementById("new-event-loctype").value;
  const loc = document.getElementById("new-event-location").value.trim() || "Location Address";
  const cap = document.getElementById("new-event-capacity").value || "100";
  const ticketType = document.getElementById("new-event-tickettype").value;
  const price = document.getElementById("new-event-price").value || "0";

  document.getElementById("preview-card-title").innerText = title;
  document.getElementById("preview-card-desc").innerText = desc;
  document.getElementById("preview-card-category").innerText = cat;
  document.getElementById("preview-card-banner").style.background = grad;
  document.getElementById("preview-card-capacity").innerText = `Capacity: ${cap} seats`;
  
  if (date) {
    document.getElementById("preview-card-date").innerText = formatDateString(date);
  } else {
    document.getElementById("preview-card-date").innerText = "Date not set";
  }

  if (locType === "virtual") {
    document.getElementById("preview-card-location").innerText = "🌐 Online Zoom Room";
  } else {
    document.getElementById("preview-card-location").innerText = `📍 ${loc}`;
  }

  if (ticketType === "free" || parseInt(price) === 0) {
    document.getElementById("preview-card-price").innerText = "FREE";
    document.getElementById("preview-card-price").className = "event-price free";
  } else {
    document.getElementById("preview-card-price").innerText = `₹${price}`;
    document.getElementById("preview-card-price").className = "event-price";
  }
}

function addCustomFieldToWizard() {
  const nameInput = document.getElementById("field-builder-name");
  const typeSelect = document.getElementById("field-builder-type");

  const name = nameInput.value.trim();
  const type = typeSelect.value;

  if (!name) {
    showToast("Please enter a field name.", "warning");
    return;
  }

  if (wizardCustomFields.some(f => f.name.toLowerCase() === name.toLowerCase())) {
    showToast("A field with this name already exists.", "warning");
    return;
  }

  const newField = {
    name,
    type,
    required: false,
    options: type === "select" ? ["Option A", "Option B", "Option C"] : []
  };

  wizardCustomFields.push(newField);
  nameInput.value = "";
  renderWizardCustomFieldsList();
}

function removeCustomFieldFromWizard(index) {
  wizardCustomFields.splice(index, 1);
  renderWizardCustomFieldsList();
}

function renderWizardCustomFieldsList() {
  const container = document.getElementById("wizard-custom-fields-container");
  container.innerHTML = "";

  wizardCustomFields.forEach((field, index) => {
    const row = document.createElement("div");
    row.className = "custom-field-row";
    row.innerHTML = `
      <div style="flex-grow:1;">
        <strong>${field.name}</strong>
        <span class="custom-field-badge">${field.type}</span>
      </div>
      <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; margin:0; cursor:pointer;">
        <input type="checkbox" ${field.required ? 'checked' : ''} onchange="toggleWizardFieldRequired(${index})"> Required
      </label>
      <button type="button" class="btn-remove-field" onclick="removeCustomFieldFromWizard(${index})">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    `;
    container.appendChild(row);
  });
}

function toggleWizardFieldRequired(index) {
  wizardCustomFields[index].required = !wizardCustomFields[index].required;
}

function addAgendaToWizard() {
  const timeInput = document.getElementById("agenda-builder-time");
  const titleInput = document.getElementById("agenda-builder-title");
  const speakerInput = document.getElementById("agenda-builder-speaker");
  const roomInput = document.getElementById("agenda-builder-room");

  const timeVal = timeInput.value.trim();
  const titleVal = titleInput.value.trim();
  const speakerVal = speakerInput.value.trim();
  const roomVal = roomInput.value.trim();

  if (!timeVal || !titleVal) {
    showToast("Time Slot and Session Title are required.", "warning");
    return;
  }

  const newItem = {
    id: `sch-${Date.now()}`,
    time: timeVal,
    title: titleVal,
    speaker: speakerVal || "N/A",
    location: roomVal || "Main Hall"
  };

  wizardSchedule.push(newItem);
  
  timeInput.value = "";
  titleInput.value = "";
  speakerInput.value = "";
  roomInput.value = "";

  renderWizardScheduleList();
}

function removeAgendaFromWizard(index) {
  wizardSchedule.splice(index, 1);
  renderWizardScheduleList();
}

function renderWizardScheduleList() {
  const container = document.getElementById("wizard-schedule-container");
  container.innerHTML = "";

  wizardSchedule.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "schedule-builder-row";
    row.innerHTML = `
      <div style="font-size:0.8rem; font-weight:600; color:var(--primary);">${item.time}</div>
      <div style="font-size:0.85rem; font-weight:500;">${item.title}</div>
      <div style="font-size:0.75rem; color:var(--text-secondary);">Host: ${item.speaker} (${item.location})</div>
      <button type="button" class="btn-remove-field" onclick="removeAgendaFromWizard(${index})">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    `;
    container.appendChild(row);
  });
}

function saveCreatedEvent() {
  const allEvents = getEvents();

  const title = document.getElementById("new-event-title").value.trim();
  const cat = document.getElementById("new-event-category").value;
  const desc = document.getElementById("new-event-description").value.trim();
  const date = document.getElementById("new-event-date").value;
  const time = document.getElementById("new-event-time").value;
  const duration = document.getElementById("new-event-duration").value.trim() || "3 hours";
  const capacity = parseInt(document.getElementById("new-event-capacity").value);
  const locationType = document.getElementById("new-event-loctype").value;
  const location = document.getElementById("new-event-location").value.trim();
  const bannerGradient = document.getElementById("new-event-banner").value;
  
  const ticketType = document.getElementById("new-event-tickettype").value;
  const priceVal = ticketType === "free" ? 0 : parseInt(document.getElementById("new-event-price").value);

  const newEventId = `evt-${Date.now()}`;

  const eventObject = {
    id: newEventId,
    title,
    category: cat,
    description: desc,
    date,
    time,
    duration,
    locationType,
    location,
    capacity,
    registered: 0,
    price: priceVal,
    gradient: bannerGradient,
    status: "Active",
    customFields: wizardCustomFields,
    schedule: wizardSchedule
  };

  allEvents.push(eventObject);
  saveEvents(allEvents);

  loadStateFromStorage();
  triggerNotificationLog("success", `New Event '${title}' has been successfully published!`);
  switchView("events");
}

// -------------------------------------------------------------
// PARTICIPANT REGISTRY TABLE (Admin Only)
// -------------------------------------------------------------
function populateEventFilters() {
  const selectFilter = document.getElementById("db-event-filter");
  selectFilter.innerHTML = `<option value="All">All Registered Events</option>`;
  
  const allEvents = getEvents();
  allEvents.forEach(evt => {
    const opt = document.createElement("option");
    opt.value = evt.id;
    opt.innerText = evt.title;
    selectFilter.appendChild(opt);
  });
}

function renderParticipantsTable() {
  const container = document.getElementById("participants-tbody-container");
  container.innerHTML = "";
  
  if (registrations.length === 0) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">No participants registered yet.</td></tr>`;
    return;
  }

  const allEvents = getEvents();

  registrations.forEach(reg => {
    const evt = allEvents.find(e => e.id === reg.eventId) || { title: "Deleted Event" };
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong style="color:var(--text-primary); font-size:0.9rem;">${reg.name}</strong>
      </td>
      <td>
        <span style="color:var(--text-secondary);">${reg.email}</span>
      </td>
      <td>
        <span style="font-weight: 500; font-size: 0.8rem;">${evt.title}</span>
      </td>
      <td>
        <span class="status-badge ${reg.pricePaid === 0 ? 'confirmed' : 'pending'}" style="font-size:0.7rem;">
          ${reg.ticketType} (${reg.pricePaid === 0 ? 'Free' : `₹${reg.pricePaid}`})
        </span>
      </td>
      <td>
        <span style="font-size:0.8rem; color:var(--text-muted);">${reg.registeredAt.split(' ')[0]}</span>
      </td>
      <td>
        <span class="status-badge ${reg.checkedIn ? 'confirmed' : 'cancelled'}" id="badge-checkin-${reg.id}">
          ${reg.checkedIn ? 'Checked In' : 'Absent'}
        </span>
      </td>
      <td style="text-align: right;">
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn-action-small" onclick="toggleCheckinStatus('${reg.id}')" style="background-color: var(--primary-light); color: var(--primary);">
            ${reg.checkedIn ? 'Mark Absent' : 'Check-In'}
          </button>
          <button class="btn-action-small" onclick="resendAttendeeTicket('${reg.id}')" style="background-color: var(--success-light); color: var(--success);">
            Badge
          </button>
          <button class="btn-action-small" onclick="cancelAttendeeRegistration('${reg.id}')" style="background-color: var(--danger-light); color: var(--danger);">
            Cancel
          </button>
        </div>
      </td>
    `;
    container.appendChild(tr);
  });
}

function filterParticipantDatabase() {
  const searchQuery = document.getElementById("db-search-input").value.toLowerCase();
  const eventFilter = document.getElementById("db-event-filter").value;
  const checkinFilter = document.getElementById("db-checkin-filter").value;

  const originalRegistrations = getRegistrations();

  const filtered = originalRegistrations.filter(reg => {
    const matchesSearch = reg.name.toLowerCase().includes(searchQuery) ||
                          reg.email.toLowerCase().includes(searchQuery);
    const matchesEvent = eventFilter === "All" || reg.eventId === eventFilter;
    
    let matchesCheckin = true;
    if (checkinFilter === "checked-in") matchesCheckin = reg.checkedIn === true;
    if (checkinFilter === "absent") matchesCheckin = reg.checkedIn === false;
    
    return matchesSearch && matchesEvent && matchesCheckin;
  });

  registrations = filtered;
  renderParticipantsTable();
}

function toggleCheckinStatus(regId) {
  const allRegistrations = getRegistrations();
  const regIndex = allRegistrations.findIndex(r => r.id === regId);
  if (regIndex === -1) return;

  const reg = allRegistrations[regIndex];
  reg.checkedIn = !reg.checkedIn;
  
  saveRegistrations(allRegistrations);
  loadStateFromStorage();

  const checkinStateMsg = reg.checkedIn ? "checked in" : "marked absent";
  triggerNotificationLog("info", `${reg.name} was successfully ${checkinStateMsg}.`);

  filterParticipantDatabase();
}

function resendAttendeeTicket(regId) {
  const reg = registrations.find(r => r.id === regId);
  if (!reg) return;

  const allEvents = getEvents();
  const evt = allEvents.find(e => e.id === reg.eventId);
  if (!evt) return;

  openTicketModal(reg, evt);
  showToast(`Ticket retrieved for ${reg.name}.`, "info");
}

function cancelAttendeeRegistration(regId) {
  if (!confirm("Are you sure you want to cancel this registration?")) {
    return;
  }

  const allRegistrations = getRegistrations();
  const regIndex = allRegistrations.findIndex(r => r.id === regId);
  if (regIndex === -1) return;
  const reg = allRegistrations[regIndex];

  const allEvents = getEvents();
  const evtIndex = allEvents.findIndex(e => e.id === reg.eventId);
  
  if (evtIndex !== -1) {
    allEvents[evtIndex].registered = Math.max(0, allEvents[evtIndex].registered - 1);
  }

  allRegistrations.splice(regIndex, 1);
  
  saveRegistrations(allRegistrations);
  saveEvents(allEvents);

  loadStateFromStorage();
  triggerNotificationLog("warning", `Registration for ${reg.name} was cancelled.`);
  filterParticipantDatabase();
}

function exportParticipantsToCSV() {
  const allRegistrations = getRegistrations();
  const allEvents = getEvents();

  if (allRegistrations.length === 0) {
    showToast("Database is empty.", "warning");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Registration ID,Attendee Name,Email,Event Name,Ticket Type,Amount Paid,Registered Date,Check-in Status\n";
  
  allRegistrations.forEach(reg => {
    const evt = allEvents.find(e => e.id === reg.eventId) || { title: "N/A" };
    const row = [
      reg.id,
      `"${reg.name.replace(/"/g, '""')}"`,
      reg.email,
      `"${evt.title.replace(/"/g, '""')}"`,
      reg.ticketType,
      reg.pricePaid,
      reg.registeredAt,
      reg.checkedIn ? "Checked In" : "Absent"
    ];
    csvContent += row.join(",") + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const downloadLink = document.createElement("a");
  downloadLink.setAttribute("href", encodedUri);
  downloadLink.setAttribute("download", `infotechway_attendees_export_${Date.now()}.csv`);
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  showToast("CSV registry exported successfully!", "success");
}

// -------------------------------------------------------------
// EVENT CALENDAR / SCHEDULE
// -------------------------------------------------------------
function renderCalendarSchedule() {
  const container = document.getElementById("schedule-master-grid");
  container.innerHTML = "";

  const allEvents = getEvents();
  const sortedEvents = [...allEvents].sort((a,b) => new Date(a.date) - new Date(b.date));

  if (sortedEvents.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; padding:48px; text-align:center; color:var(--text-muted); background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md);">No events available.</div>`;
    return;
  }

  sortedEvents.forEach(evt => {
    const card = document.createElement("div");
    card.className = "schedule-card";
    
    let scheduleHTML = '';
    if (evt.schedule && evt.schedule.length > 0) {
      evt.schedule.forEach(session => {
        scheduleHTML += `
          <div style="padding: 10px; background: rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-bottom:8px; font-size:0.75rem;">
            <div style="display:flex; justify-content:space-between; font-weight:600; color:var(--primary); margin-bottom:2px;">
              <span>${session.time}</span>
              <span style="opacity:0.8;">${session.location}</span>
            </div>
            <div style="font-weight:500; color:var(--text-primary);">${session.title}</div>
            <div style="color:var(--text-muted); margin-top:2px;">Speaker: ${session.speaker}</div>
          </div>
        `;
      });
    } else {
      scheduleHTML = `<p class="text-muted" style="font-size:0.75rem; text-align:center; padding:12px;">No sessions scheduled.</p>`;
    }

    card.innerHTML = `
      <div class="schedule-card-header">
        <span class="event-category-badge" style="font-size:0.65rem;">${evt.category}</span>
        <span style="font-size: 0.75rem; font-weight:700; color:var(--primary);">${formatDateString(evt.date)}</span>
      </div>
      <h4 style="font-size:0.95rem; margin-bottom:12px; font-family: var(--font-heading); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
        ${evt.title}
      </h4>
      <div style="flex-grow:1; max-height:220px; overflow-y:auto; padding-right:4px; margin-bottom:16px;">
        ${scheduleHTML}
      </div>
      <button class="btn btn-secondary" onclick="showEventDetail('${evt.id}', 'schedule')" style="width:100%; padding:8px; font-size:0.75rem;">
        View Detail Desk
      </button>
    `;
    container.appendChild(card);
  });
}

// -------------------------------------------------------------
// NOTIFICATIONS AUDIT / ANNOUNCEMENT BROADCAST (Admin Only)
// -------------------------------------------------------------
function renderNotificationLogs() {
  const container = document.getElementById("logs-audit-container");
  container.innerHTML = "";

  if (systemLogs.length === 0) {
    container.innerHTML = `<p class="text-muted" style="padding:16px; font-size:0.85rem;">No registration data found.</p>`;
    return;
  }

  systemLogs.forEach(log => {
    const item = document.createElement("div");
    item.className = "activity-item";
    item.style.padding = "12px 0";
    item.innerHTML = `
      <div class="activity-dot ${log.type === 'success' ? 'success' : log.type === 'warning' ? 'warning' : 'info'}"></div>
      <div class="activity-details">
        <div class="activity-message" style="font-size: 0.85rem;">
          ${log.message}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
          <span class="activity-time" style="font-size:0.7rem;">${log.timestamp}</span>
          <span style="font-size:0.65rem; font-weight:700; text-transform:uppercase; color: ${log.type === 'success' ? 'var(--success)' : log.type === 'warning' ? 'var(--warning)' : 'var(--info)'}">${log.type}</span>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

function populateBroadcastEventSelect() {
  const select = document.getElementById("broadcast-event-select");
  if (!select) return;
  select.innerHTML = "";

  const allEvents = getEvents();
  allEvents.forEach((evt, idx) => {
    const opt = document.createElement("option");
    opt.value = evt.id;
    opt.innerText = `${evt.title} (${evt.registered} registered)`;
    if (idx === 0) opt.selected = true;
    select.appendChild(opt);
  });
}

function sendBroadcastAnnouncement(event) {
  event.preventDefault();

  const eventId = document.getElementById("broadcast-event-select").value;
  const subject = document.getElementById("broadcast-subject").value.trim();
  const message = document.getElementById("broadcast-message").value.trim();
  const delivery = document.getElementById("broadcast-medium").value;

  const allEvents = getEvents();
  const evt = allEvents.find(e => e.id === eventId);
  if (!evt) return;

  const allRegistrations = getRegistrations();
  const targetAttendees = allRegistrations.filter(r => r.eventId === eventId);

  if (targetAttendees.length === 0) {
    showToast(`Target event has no registered attendees yet.`, "warning");
    return;
  }

  const attendeeCount = targetAttendees.length;
  triggerNotificationLog("info", `Announcement Campaign '${subject}' broadcasted to ${attendeeCount} participants of ${evt.title}.`);

  document.getElementById("announcement-composer-form").reset();
  
  populateBroadcastEventSelect();
  renderNotificationLogs();
}

// -------------------------------------------------------------
// PROFILE & SECURITY PANEL (Both Roles)
// -------------------------------------------------------------
function renderProfileSettings() {
  document.getElementById("profile-info-name").value = currentUser.name;
  document.getElementById("profile-info-email").value = currentUser.email;
  
  document.getElementById("profile-card-name").innerText = currentUser.name;
  document.getElementById("profile-card-role").innerText = currentUser.role === "admin" ? "Organizer Admin" : "Attendee Participant";
  
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  document.getElementById("profile-card-avatar").innerText = initials;

  // Reset password form
  const pwdForm = document.getElementById("change-password-form");
  if (pwdForm) pwdForm.reset();
}

function updateProfileInfo() {
  const nameInput = document.getElementById("profile-info-name").value.trim();
  if (!nameInput) {
    showToast("Name cannot be empty.", "warning");
    return;
  }

  loadStateFromStorage();
  const userIdx = users.findIndex(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
  
  if (userIdx !== -1) {
    users[userIdx].name = nameInput;
    saveUsers(users);
    
    // Update session
    currentUser.name = nameInput;
    saveSession(currentUser);
    
    // Re-auth updates
    authenticateUser(currentUser);
    renderProfileSettings();
    showToast("Profile details updated successfully!", "success");
  }
}

function handlePasswordChangeSubmit(event) {
  event.preventDefault();
  
  const currentPwd = document.getElementById("change-pwd-current").value;
  const newPwd = document.getElementById("change-pwd-new").value;
  const confirmPwd = document.getElementById("change-pwd-confirm").value;

  if (newPwd !== confirmPwd) {
    showToast("New passwords do not match.", "warning");
    return;
  }

  if (currentUser.password !== currentPwd) {
    showToast("Incorrect current security password.", "danger");
    return;
  }

  loadStateFromStorage();
  const userIdx = users.findIndex(u => u.email.toLowerCase() === currentUser.email.toLowerCase());

  if (userIdx !== -1) {
    users[userIdx].password = newPwd;
    saveUsers(users);
    
    // Update session password
    currentUser.password = newPwd;
    saveSession(currentUser);
    
    document.getElementById("change-password-form").reset();
    showToast("Password updated successfully!", "success");
  }
}

// -------------------------------------------------------------
// TICKET MODAL OVERLAY & DYNAMIC QR GENERATOR
// -------------------------------------------------------------
function openTicketModal(registration, eventData) {
  const modal = document.getElementById("ticket-modal");
  
  document.getElementById("ticket-event-title").innerText = eventData.title;
  document.getElementById("ticket-event-category").innerText = eventData.category;
  document.getElementById("ticket-attendee-name").innerText = registration.name;
  document.getElementById("ticket-attendee-email").innerText = registration.email;
  document.getElementById("ticket-id").innerText = registration.id.toUpperCase();
  document.getElementById("ticket-type").innerText = registration.ticketType;
  document.getElementById("ticket-date-time").innerText = `${formatDateString(eventData.date)} at ${eventData.time}`;
  document.getElementById("ticket-location").innerText = eventData.locationType === 'virtual' ? "Virtual Webinar Link" : eventData.location;

  const banner = document.getElementById("ticket-gradient-banner");
  if (banner) banner.style.background = eventData.gradient || 'linear-gradient(135deg,#0f172a,#334155)';

  const qrContainer = document.getElementById("ticket-qr-container");
  if (qrContainer) qrContainer.innerHTML = generateMockQRCodeSVG(registration.id);

  modal.classList.add("active");
}

function closeTicketModal() {
  document.getElementById("ticket-modal").classList.remove("active");
}

function closeTicketModalOnBackdrop(event) {
  if (event.target === document.getElementById("ticket-modal")) {
    closeTicketModal();
  }
}

function generateMockQRCodeSVG(dataString) {
  const size = 120;
  const gridCount = 13;
  const pixelSize = size / gridCount;
  
  let rectsHTML = '';
  const drawFinder = (x, y) => {
    rectsHTML += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${3 * pixelSize}" height="${3 * pixelSize}" fill="#0f172a" />`;
    rectsHTML += `<rect x="${(x + 0.4) * pixelSize}" y="${(y + 0.4) * pixelSize}" width="${2.2 * pixelSize}" height="${2.2 * pixelSize}" fill="#ffffff" />`;
    rectsHTML += `<rect x="${(x + 0.8) * pixelSize}" y="${(y + 0.8) * pixelSize}" width="${1.4 * pixelSize}" height="${1.4 * pixelSize}" fill="#0f172a" />`;
  };

  drawFinder(0, 0);
  drawFinder(gridCount - 3, 0);
  drawFinder(0, gridCount - 3);

  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    hash = dataString.charCodeAt(i) + ((hash << 5) - hash);
  }

  for (let r = 0; r < gridCount; r++) {
    for (let c = 0; c < gridCount; c++) {
      const isTopLeftFinder = r < 3 && c < 3;
      const isTopRightFinder = r < 3 && c >= gridCount - 3;
      const isBottomLeftFinder = r >= gridCount - 3 && c < 3;
      
      if (!isTopLeftFinder && !isTopRightFinder && !isBottomLeftFinder) {
        const cellHash = Math.abs(Math.sin(hash + (r * 13) + (c * 37)));
        if (cellHash > 0.5) {
          rectsHTML += `<rect x="${c * pixelSize}" y="${r * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#0f172a" />`;
        }
      }
    }
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff" />
      ${rectsHTML}
    </svg>
  `;
}

// -------------------------------------------------------------
// TOAST ALERT LOGS DRAWERS
// -------------------------------------------------------------
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let iconSVG = '';
  if (type === 'success') {
    iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
  } else if (type === 'warning') {
    iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`;
  } else if (type === 'danger') {
    iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
  } else {
    iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
  }

  toast.innerHTML = `
    ${iconSVG}
    <div class="toast-message">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = "fadeIn 0.3s ease reverse";
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 300);
  }, 4000);
}

function triggerNotificationLog(type, message) {
  addLog(type, message);
  loadStateFromStorage();
  showToast(message, type);
}

// -------------------------------------------------------------
// SYSTEM UTILITY DESIGN SYSTEMS
// -------------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem("ep_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeUI(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("ep_theme", newTheme);
  updateThemeUI(newTheme);
  
  // Re-draw chart grids if active
  if (currentUser && currentUser.role === "admin" && document.getElementById("dashboard-view").classList.contains("active")) {
    renderDashboardCharts();
  }
}

function updateThemeUI(theme) {
  const btnText = document.getElementById("theme-text");
  const btnIcon = document.querySelector("#theme-toggle svg");
  
  if (!btnText || !btnIcon) return;
  
  if (theme === "dark") {
    btnText.innerText = "Light Mode";
    btnIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z" />`;
  } else {
    btnText.innerText = "Dark Mode";
    btnIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />`;
  }
}

function formatDateString(dateStr) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatRelativeTime(timestampStr) {
  const t = timestampStr.split(/[- :]/);
  const logDate = new Date(t[0], t[1]-1, t[2], t[3], t[4], t[5]);
  const now = new Date();
  
  const diffMs = now - logDate;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return "Yesterday";
  return formatDateString(timestampStr.split(' ')[0]);
}
