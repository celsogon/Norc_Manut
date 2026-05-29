const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'norc_manut_secret_key_2024';

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database('./norc_manut.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

// Initialize database tables
function initDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Equipment table
        db.run(`
            CREATE TABLE IF NOT EXISTS equipment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                serial_number TEXT UNIQUE NOT NULL,
                location TEXT,
                address TEXT,
                postal_code TEXT,
                phone TEXT,
                client_name TEXT,
                brand TEXT,
                description TEXT,
                installation_date DATE,
                last_maintenance DATE,
                next_maintenance DATE,
                status TEXT DEFAULT 'active',
                observations TEXT,
                extra_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Maintenance records table
        db.run(`
            CREATE TABLE IF NOT EXISTS maintenance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                equipment_id INTEGER NOT NULL,
                maintenance_type TEXT NOT NULL,
                description TEXT,
                performed_by TEXT,
                maintenance_date DATE DEFAULT CURRENT_DATE,
                next_maintenance_date DATE,
                cost REAL,
                status TEXT DEFAULT 'completed',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (equipment_id) REFERENCES equipment(id)
            )
        `);

        console.log('Database tables created successfully');
    });
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// ============ AUTH ROUTES ============

// Register
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Username or email already exists' });
                }
                return res.status(500).json({ error: 'Error registering user' });
            }
            res.json({ success: true, message: 'User registered successfully', userId: this.lastID });
        }
    );
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: { id: user.id, username: user.username, email: user.email }
        });
    });
});

// Get current user
app.get('/api/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// ============ EQUIPMENT ROUTES ============

// Get all equipment
app.get('/api/equipment', authenticateToken, (req, res) => {
    db.all('SELECT * FROM equipment ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching equipment' });
        }
        res.json({ equipment: rows });
    });
});

// Get single equipment
app.get('/api/equipment/:id', authenticateToken, (req, res) => {
    db.get('SELECT * FROM equipment WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching equipment' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Equipment not found' });
        }
        res.json({ equipment: row });
    });
});

// Create equipment
app.post('/api/equipment', authenticateToken, (req, res) => {
    const { name, serial_number, location, installation_date, observations } = req.body;

    if (!name || !serial_number || !location) {
        return res.status(400).json({ error: 'Name, serial number, and location are required' });
    }

    db.run(
        `INSERT INTO equipment (name, serial_number, location, installation_date, observations)
         VALUES (?, ?, ?, ?, ?)`,
        [name, serial_number, location, installation_date, observations],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Serial number already exists' });
                }
                return res.status(500).json({ error: 'Error creating equipment' });
            }
            res.json({ success: true, message: 'Equipment created', id: this.lastID });
        }
    );
});

// Update equipment
app.put('/api/equipment/:id', authenticateToken, (req, res) => {
    const { name, location, installation_date, last_maintenance, next_maintenance, status, observations } = req.body;

    db.run(
        `UPDATE equipment
         SET name = ?, location = ?, installation_date = ?, last_maintenance = ?,
             next_maintenance = ?, status = ?, observations = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, location, installation_date, last_maintenance, next_maintenance, status, observations, req.params.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error updating equipment' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Equipment not found' });
            }
            res.json({ success: true, message: 'Equipment updated' });
        }
    );
});

// Delete equipment
app.delete('/api/equipment/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM equipment WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error deleting equipment' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Equipment not found' });
        }
        res.json({ success: true, message: 'Equipment deleted' });
    });
});

// ============ MAINTENANCE ROUTES ============

// Get all maintenance records
app.get('/api/maintenance', authenticateToken, (req, res) => {
    db.all(`
        SELECT m.*, e.name as equipment_name, e.serial_number
        FROM maintenance m
        JOIN equipment e ON m.equipment_id = e.id
        ORDER BY m.maintenance_date DESC
    `, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching maintenance records' });
        }
        res.json({ maintenance: rows });
    });
});

// Get maintenance for specific equipment
app.get('/api/equipment/:id/maintenance', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM maintenance WHERE equipment_id = ? ORDER BY maintenance_date DESC',
        [req.params.id],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Error fetching maintenance records' });
            }
            res.json({ maintenance: rows });
        }
    );
});

// Create maintenance record
app.post('/api/maintenance', authenticateToken, (req, res) => {
    const { equipment_id, maintenance_type, description, performed_by, next_maintenance_date, cost, status } = req.body;

    if (!equipment_id || !maintenance_type) {
        return res.status(400).json({ error: 'Equipment ID and maintenance type are required' });
    }

    db.run(
        `INSERT INTO maintenance (equipment_id, maintenance_type, description, performed_by, next_maintenance_date, cost, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [equipment_id, maintenance_type, description, performed_by, next_maintenance_date, cost, status || 'completed'],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error creating maintenance record' });
            }

            // Update equipment's last maintenance date
            if (status === 'completed') {
                db.run(
                    'UPDATE equipment SET last_maintenance = CURRENT_DATE, next_maintenance = ? WHERE id = ?',
                    [next_maintenance_date, equipment_id]
                );
            }

            res.json({ success: true, message: 'Maintenance record created', id: this.lastID });
        }
    );
});

// ============ DASHBOARD STATS ============

app.get('/api/stats', authenticateToken, (req, res) => {
    db.get('SELECT COUNT(*) as total FROM equipment', [], (err, totalResult) => {
        if (err) return res.status(500).json({ error: 'Error fetching stats' });

        db.get("SELECT COUNT(*) as pending FROM equipment WHERE next_maintenance <= date('now')", [], (err, pendingResult) => {
            if (err) return res.status(500).json({ error: 'Error fetching stats' });

            db.get("SELECT COUNT(*) as completed FROM maintenance WHERE status = 'completed' AND strftime('%Y-%m', maintenance_date) = strftime('%Y-%m', 'now')", [], (err, completedResult) => {
                if (err) return res.status(500).json({ error: 'Error fetching stats' });

                res.json({
                    stats: {
                        totalEquipment: totalResult.total,
                        pendingMaintenance: pendingResult.pending,
                        completedMaintenance: completedResult.completed,
                        alerts: pendingResult.pending
                    }
                });
            });
        });
    });
});

// ============ IMPORT ROUTES ============

// Convert Excel date serial to JS date
function excelDateToJSDate(serial) {
    if (!serial || serial === 1 || serial === 0) return null;
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    const year = date_info.getFullYear();
    const month = String(date_info.getMonth() + 1).padStart(2, '0');
    const day = String(date_info.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Import equipment from Excel
app.post('/api/import', authenticateToken, (req, res) => {
    const XLSX = require('xlsx');
    const fs = require('fs');
    const path = require('path');

    try {
        const excelPath = path.join(__dirname, '..', 'Dados_Github_ma.xlsx');

        if (!fs.existsSync(excelPath)) {
            return res.status(404).json({ error: 'Excel file not found. Please place Dados_Github_ma.xlsx in the project folder.' });
        }

        const workbook = XLSX.readFile(excelPath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        let imported = 0;
        let skipped = 0;
        let errors = [];

        // Fields to extract from Excel and store in extra_data
        const mainFields = ['maquina', 'serie', 'local', 'morada', 'codpost', 'telefone', 'nome', 'marca', 'design', 'situacao', 'instal', 'obs'];
        const allFields = Object.keys(data[0] || {}).filter(k => !mainFields.includes(k));

        // Process in batches
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO equipment (name, serial_number, location, address, postal_code, phone, client_name, brand, description, status, installation_date, observations, extra_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        data.forEach((row, index) => {
            try {
                const serialNumber = (row.serie || '').trim();
                const name = row.maquina || row.design || 'Unknown';
                const location = row.local || '';
                const address = row.morada || '';
                const postalCode = row.codpost || '';
                const phone = row.telefone || '';
                const clientName = row.nome || '';
                const brand = row.marca || '';
                const description = row.design || '';
                const status = row.situacao === 'em reparação' ? 'maintenance' :
                               row.situacao === ' ' || !row.situacao ? 'active' : 'inactive';
                const installationDate = excelDateToJSDate(row.instal);
                const observations = row.obs || '';

                // Store all other fields as JSON
                const extraData = {};
                allFields.forEach(field => {
                    if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                        extraData[field] = row[field];
                    }
                });
                const extraDataJSON = JSON.stringify(extraData);

                if (serialNumber && serialNumber.length > 5) {
                    stmt.run(name, serialNumber, location, address, postalCode, phone, clientName, brand, description, status, installationDate, observations, extraDataJSON, function(err) {
                        if (err) {
                            errors.push(`Row ${index + 2}: ${err.message}`);
                        }
                    });
                    imported++;
                } else {
                    skipped++;
                }
            } catch (e) {
                errors.push(`Row ${index + 2}: ${e.message}`);
            }
        });

        stmt.finalize(() => {
            res.json({
                success: true,
                message: `Importação concluída: ${imported} registados, ${skipped} ignorados`,
                imported,
                skipped,
                errors: errors.slice(0, 10),
                availableFields: allFields
            });
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Error importing data: ' + error.message });
    }
});

// Check import status
app.get('/api/import/status', authenticateToken, (req, res) => {
    const excelPath = path.join(__dirname, '..', 'Dados_Github_ma.xlsx');
    const fs = require('fs');

    if (fs.existsSync(excelPath)) {
        const stats = fs.statSync(excelPath);
        res.json({ ready: true, path: excelPath, size: stats.size });
    } else {
        res.json({ ready: false });
    }
});

// Get available columns from imported data
app.get('/api/columns', authenticateToken, (req, res) => {
    // Get one sample of extra_data to extract columns
    db.get('SELECT extra_data FROM equipment WHERE extra_data IS NOT NULL AND extra_data != "{}" LIMIT 1', [], (err, row) => {
        if (err || !row) {
            // Return default columns
            return res.json({
                columns: [
                    { key: 'name', label: 'Nome', default: true },
                    { key: 'serial_number', label: 'Nº Série', default: true },
                    { key: 'location', label: 'Localização', default: true },
                    { key: 'client_name', label: 'Cliente', default: true },
                    { key: 'brand', label: 'Marca', default: true },
                    { key: 'status', label: 'Estado', default: true },
                    { key: 'installation_date', label: 'Data Instalação', default: false }
                ]
            });
        }

        try {
            const extraData = JSON.parse(row.extra_data);
            const extraColumns = Object.keys(extraData).map(key => ({
                key: `extra_${key}`,
                label: key,
                default: false
            }));

            res.json({
                columns: [
                    { key: 'name', label: 'Nome', default: true },
                    { key: 'serial_number', label: 'Nº Série', default: true },
                    { key: 'location', label: 'Localização', default: true },
                    { key: 'client_name', label: 'Cliente', default: true },
                    { key: 'brand', label: 'Marca', default: true },
                    { key: 'status', label: 'Estado', default: true },
                    { key: 'installation_date', label: 'Data Instalação', default: false },
                    { key: 'address', label: 'Morada', default: false },
                    { key: 'postal_code', label: 'Código Postal', default: false },
                    { key: 'phone', label: 'Telefone', default: false },
                    { key: 'description', label: 'Descrição', default: false },
                    ...extraColumns
                ]
            });
        } catch (e) {
            res.json({ columns: [] });
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});