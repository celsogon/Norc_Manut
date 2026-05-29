// Authentication functions using backend API

const API_URL = 'http://localhost:3000/api';
const TOKEN_KEY = 'norc_manut_token';
const USER_KEY = 'norc_manut_user';

// Get token from storage
function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

// Save token and user to storage
function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Register a new user via API
async function register(username, password, email) {
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, message: data.error };
        }

        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexão com o servidor' };
    }
}

// Login function via API
async function login(username, password) {
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, message: data.error };
        }

        // Save session
        saveSession(data.token, data.user);

        return { success: true, message: 'Login bem-sucedido' };
    } catch (error) {
        return { success: false, message: 'Erro de conexão com o servidor' };
    }
}

// Logout function
function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = 'index.html';
}

// Check if user is logged in
function isLoggedIn() {
    return getToken() !== null;
}

// Get current logged in user
function getCurrentUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
}

// Get auth headers
function getAuthHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Protect page - call this on protected pages
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// ============ EQUIPMENT API FUNCTIONS ============

// Get all equipment
async function getEquipment() {
    try {
        const response = await fetch(`${API_URL}/equipment`, {
            headers: getAuthHeaders()
        });

        if (response.status === 401 || response.status === 403) {
            logout();
            return [];
        }

        const data = await response.json();
        return data.equipment || [];
    } catch (error) {
        console.error('Error fetching equipment:', error);
        return [];
    }
}

// Get single equipment
async function getEquipmentById(id) {
    try {
        const response = await fetch(`${API_URL}/equipment/${id}`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();
        return data.equipment || null;
    } catch (error) {
        console.error('Error fetching equipment:', error);
        return null;
    }
}

// Create equipment
async function createEquipment(equipment) {
    try {
        const response = await fetch(`${API_URL}/equipment`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(equipment)
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, message: data.error };
        }

        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexão' };
    }
}

// Update equipment
async function updateEquipment(id, equipment) {
    try {
        const response = await fetch(`${API_URL}/equipment/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(equipment)
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, message: data.error };
        }

        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexão' };
    }
}

// Delete equipment
async function deleteEquipment(id) {
    try {
        const response = await fetch(`${API_URL}/equipment/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, message: data.error };
        }

        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexão' };
    }
}

// ============ MAINTENANCE API FUNCTIONS ============

// Get all maintenance records
async function getMaintenance() {
    try {
        const response = await fetch(`${API_URL}/maintenance`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();
        return data.maintenance || [];
    } catch (error) {
        console.error('Error fetching maintenance:', error);
        return [];
    }
}

// Get maintenance for equipment
async function getEquipmentMaintenance(equipmentId) {
    try {
        const response = await fetch(`${API_URL}/equipment/${equipmentId}/maintenance`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();
        return data.maintenance || [];
    } catch (error) {
        console.error('Error fetching maintenance:', error);
        return [];
    }
}

// Create maintenance record
async function createMaintenance(maintenance) {
    try {
        const response = await fetch(`${API_URL}/maintenance`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(maintenance)
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, message: data.error };
        }

        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexão' };
    }
}

// ============ STATS API FUNCTIONS ============

async function getStats() {
    try {
        const response = await fetch(`${API_URL}/stats`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();
        return data.stats || { totalEquipment: 0, pendingMaintenance: 0, completedMaintenance: 0, alerts: 0 };
    } catch (error) {
        console.error('Error fetching stats:', error);
        return { totalEquipment: 0, pendingMaintenance: 0, completedMaintenance: 0, alerts: 0 };
    }
}

// ============ IMPORT FUNCTIONS ============

async function importEquipment() {
    try {
        const response = await fetch(`${API_URL}/import`, {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, message: data.error };
        }

        return { success: true, message: data.message, imported: data.imported, skipped: data.skipped };
    } catch (error) {
        return { success: false, message: 'Erro de conexão' };
    }
}

async function checkImportStatus() {
    try {
        const response = await fetch(`${API_URL}/import/status`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();
        return data;
    } catch (error) {
        return { ready: false };
    }
}