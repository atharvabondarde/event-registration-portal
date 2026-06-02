// mockData.js - Database & Storage Layer for the InfotechWay Event Portal

const INITIAL_USERS = [
  {
    email: "admin@infotechway.com",
    password: "admin123",
    name: "System Admin",
    role: "admin"
  }
];

const INITIAL_EVENTS = [];

const INITIAL_REGISTRATIONS = [];

const INITIAL_LOGS = [];

// Helper functions to manage LocalStorage state
function initializeDatabase() {
  if (!localStorage.getItem("ep_events")) {
    localStorage.setItem("ep_events", JSON.stringify(INITIAL_EVENTS));
  }
  if (!localStorage.getItem("ep_registrations")) {
    localStorage.setItem("ep_registrations", JSON.stringify(INITIAL_REGISTRATIONS));
  }
  if (!localStorage.getItem("ep_logs")) {
    localStorage.setItem("ep_logs", JSON.stringify(INITIAL_LOGS));
  }
  if (!localStorage.getItem("ep_users")) {
    localStorage.setItem("ep_users", JSON.stringify(INITIAL_USERS));
  }
}

function getEvents() {
  initializeDatabase();
  return JSON.parse(localStorage.getItem("ep_events"));
}

function saveEvents(events) {
  localStorage.setItem("ep_events", JSON.stringify(events));
}

function getRegistrations() {
  initializeDatabase();
  return JSON.parse(localStorage.getItem("ep_registrations"));
}

function saveRegistrations(registrations) {
  localStorage.setItem("ep_registrations", JSON.stringify(registrations));
}

function getLogs() {
  initializeDatabase();
  return JSON.parse(localStorage.getItem("ep_logs"));
}

function saveLogs(logs) {
  localStorage.setItem("ep_logs", JSON.stringify(logs));
}

function addLog(type, message) {
  const logs = getLogs();
  const now = new Date();
  const formatNum = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${formatNum(now.getMonth() + 1)}-${formatNum(now.getDate())} ${formatNum(now.getHours())}:${formatNum(now.getMinutes())}:${formatNum(now.getSeconds())}`;
  
  logs.unshift({
    id: `log-${Date.now()}`,
    timestamp,
    type,
    message
  });
  
  // Cap logs at 50 to keep things clean
  if (logs.length > 50) {
    logs.pop();
  }
  
  saveLogs(logs);
}

// User Profile Database Helpers
function getUsers() {
  initializeDatabase();
  return JSON.parse(localStorage.getItem("ep_users"));
}

function saveUsers(users) {
  localStorage.setItem("ep_users", JSON.stringify(users));
}

function getSession() {
  const sessionStr = localStorage.getItem("ep_session");
  return sessionStr ? JSON.parse(sessionStr) : null;
}

function saveSession(session) {
  if (session) {
    localStorage.setItem("ep_session", JSON.stringify(session));
  } else {
    localStorage.removeItem("ep_session");
  }
}
