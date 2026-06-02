// mockData.js - Database & Storage Layer for the InfotechWay Event Portal (MongoDB Backend)

let _memEvents = [];
let _memRegistrations = [];
let _memLogs = [];
let _memUsers = [];
let _isInitialized = false;

// Helper to get API URL base
function getApiBase() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname
    ? 'http://localhost:3000'
    : '';
}

// Fetch all state from our Express backend API
async function loadServerState() {
  try {
    const response = await fetch(`${getApiBase()}/api/state`);
    if (!response.ok) throw new Error("Failed to fetch state from API");
    const data = await response.json();
    
    _memEvents = data.events || [];
    _memRegistrations = data.registrations || [];
    _memLogs = data.logs || [];
    
    // Inject default admin user if none exist in DB
    if (!data.users || data.users.length === 0) {
      _memUsers = [{
        email: "admin@infotechway.com",
        password: "admin123",
        name: "System Admin",
        role: "admin"
      }];
      _isInitialized = true;
      syncStateToServer(); // push default user
    } else {
      _memUsers = data.users;
      _isInitialized = true;
    }
  } catch (error) {
    console.error("Database connection error:", error);
    // Fallback to empty state if backend is down
    _memEvents = [];
    _memRegistrations = [];
    _memLogs = [];
    _memUsers = [];
    _isInitialized = true;
  }
}

// Push all state to Express backend API
function syncStateToServer() {
  if (!_isInitialized) return; // Don't sync before initial load
  
  fetch(`${getApiBase()}/api/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      events: _memEvents,
      registrations: _memRegistrations,
      logs: _memLogs,
      users: _memUsers
    })
  }).catch(error => console.error("Failed to sync state to database:", error));
}

// Override initializeDatabase (no longer needed for localStorage except session)
function initializeDatabase() {
  // We don't initialize localStorage tables anymore!
}

// Data Getters (Synchronous from memory)
function getEvents() { return _memEvents; }
function getRegistrations() { return _memRegistrations; }
function getLogs() { return _memLogs; }
function getUsers() { return _memUsers; }

// Data Setters (Update memory and sync to backend)
function saveEvents(events) { 
  _memEvents = events;
  syncStateToServer(); 
}

function saveRegistrations(registrations) { 
  _memRegistrations = registrations;
  syncStateToServer(); 
}

function saveLogs(logs) { 
  _memLogs = logs;
  syncStateToServer(); 
}

function saveUsers(users) { 
  _memUsers = users;
  syncStateToServer(); 
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
  
  if (logs.length > 50) logs.pop();
  saveLogs(logs);
}

// Session Management (Keep in localStorage for persistence)
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
