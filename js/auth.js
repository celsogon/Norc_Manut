// Authentication functions using localStorage

const USERS_KEY = 'norc_manut_users';
const CURRENT_USER_KEY = 'norc_manut_current_user';

// Get all users from storage
function getUsers() {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
}

// Save users to storage
function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// Hash password (simple hash for demo - use proper hashing in production)
function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

// Register a new user
function register(username, password, email) {
    const users = getUsers();

    // Check if username already exists
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return { success: false, message: 'Nome de utilizador já existe' };
    }

    // Check if email already exists
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        return { success: false, message: 'Email já está registado' };
    }

    // Create new user
    const newUser = {
        id: Date.now(),
        username: username,
        password: hashPassword(password),
        email: email,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    return { success: true, message: 'Conta criada com sucesso' };
}

// Login function
function login(username, password) {
    const users = getUsers();
    const passwordHash = hashPassword(password);

    const user = users.find(u =>
        u.username.toLowerCase() === username.toLowerCase() &&
        u.password === passwordHash
    );

    if (user) {
        // Store current user (without password)
        const sessionUser = {
            id: user.id,
            username: user.username,
            email: user.email
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
        return { success: true, message: 'Login bem-sucedido' };
    }

    return { success: false, message: 'Nome de utilizador ou palavra-passe incorretos' };
}

// Logout function
function logout() {
    localStorage.removeItem(CURRENT_USER_KEY);
    window.location.href = 'index.html';
}

// Check if user is logged in
function isLoggedIn() {
    return localStorage.getItem(CURRENT_USER_KEY) !== null;
}

// Get current logged in user
function getCurrentUser() {
    const user = localStorage.getItem(CURRENT_USER_KEY);
    return user ? JSON.parse(user) : null;
}

// Protect page - call this on dashboard pages
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// Change password
function changePassword(oldPassword, newPassword) {
    const users = getUsers();
    const currentUser = getCurrentUser();

    if (!currentUser) {
        return { success: false, message: 'Nenhum utilizador sessão' };
    }

    const oldPasswordHash = hashPassword(oldPassword);
    const userIndex = users.findIndex(u =>
        u.id === currentUser.id && u.password === oldPasswordHash
    );

    if (userIndex === -1) {
        return { success: false, message: 'Palavra-passe atual incorreta' };
    }

    users[userIndex].password = hashPassword(newPassword);
    saveUsers(users);

    return { success: true, message: 'Palavra-passe alterada com sucesso' };
}

// Delete account
function deleteAccount(password) {
    const users = getUsers();
    const currentUser = getCurrentUser();

    if (!currentUser) {
        return { success: false, message: 'Nenhum utilizador em sessão' };
    }

    const passwordHash = hashPassword(password);
    const userIndex = users.findIndex(u =>
        u.id === currentUser.id && u.password === passwordHash
    );

    if (userIndex === -1) {
        return { success: false, message: 'Palavra-passe incorreta' };
    }

    users.splice(userIndex, 1);
    saveUsers(users);
    logout();

    return { success: true, message: 'Conta eliminada' };
}