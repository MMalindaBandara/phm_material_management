const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'phm_material_management_secret_key_98765';

app.use(cors());
app.use(express.json());

const isProd = process.env.DATABASE_URL ? true : false;
let dbQuery;
let db; // SQLite database instance if not in production

if (isProd) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const translateSql = (sql) => {
    let index = 1;
    let converted = sql
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
      .replace(/\?/g, () => `$${index++}`);

    if (/INSERT OR IGNORE/i.test(converted)) {
      converted = converted.replace(/INSERT OR IGNORE/i, 'INSERT');
      if (converted.endsWith(';')) {
        converted = converted.slice(0, -1) + ' ON CONFLICT DO NOTHING;';
      } else {
        converted = converted + ' ON CONFLICT DO NOTHING';
      }
    }
    return converted;
  };

  dbQuery = {
    async run(sql, params = []) {
      let converted = translateSql(sql);
      if (/^\s*insert\s+/i.test(converted) && !/returning\s+/i.test(converted)) {
        if (converted.endsWith(';')) {
          converted = converted.slice(0, -1) + ' RETURNING id;';
        } else {
          converted = converted + ' RETURNING id';
        }
      }
      const res = await pool.query(converted, params);
      const row = res.rows[0];
      return { id: row ? row.id : null, changes: res.rowCount };
    },
    async get(sql, params = []) {
      const res = await pool.query(translateSql(sql), params);
      return res.rows[0] || null;
    },
    async all(sql, params = []) {
      const res = await pool.query(translateSql(sql), params);
      return res.rows;
    },
    async exec(sql) {
      await pool.query(translateSql(sql));
    }
  };
} else {
  const dbPath = path.join(__dirname, 'database.db');
  db = new sqlite3.Database(dbPath);

  dbQuery = {
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, changes: this.changes });
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
}

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Database Schema Setup (Section 18 alignment)
async function initDb() {
  try {
    // Recreate Spec-Compliant Tables if they do not exist
    await dbQuery.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        designation TEXT NOT NULL,
        branch TEXT NOT NULL,
        unit TEXT NOT NULL,
        contact_number TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('EEMMPHMD1', 'DECPHMD1', 'General')) NOT NULL,
        status TEXT CHECK(status IN ('Pending', 'Active', 'Suspended')) DEFAULT 'Pending',
        created_date TEXT NOT NULL,
        approved_by TEXT,
        approved_date TEXT
      );
    `);

    await dbQuery.exec(`
      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        location TEXT DEFAULT 'PHM D1 Branch',
        status TEXT CHECK(status IN ('Active', 'Inactive')) DEFAULT 'Active'
      );
    `);

    await dbQuery.exec(`
      CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        uom TEXT NOT NULL,
        grade_code TEXT NOT NULL,
        price REAL NOT NULL,
        status TEXT CHECK(status IN ('Active', 'Inactive')) DEFAULT 'Active',
        UNIQUE(code, grade_code)
      );
    `);

    await dbQuery.exec(`
      CREATE TABLE IF NOT EXISTS inventory_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL,
        material_id INTEGER NOT NULL,
        quantity_allocated REAL DEFAULT 0.0,
        quantity_on_hand REAL DEFAULT 0.0,
        unit_price REAL NOT NULL,
        value REAL DEFAULT 0.0,
        last_updated_date TEXT,
        UNIQUE(store_id, material_id),
        FOREIGN KEY (store_id) REFERENCES stores(id),
        FOREIGN KEY (material_id) REFERENCES materials(id)
      );
    `);

    await dbQuery.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_number TEXT UNIQUE NOT NULL,
        job_name TEXT NOT NULL,
        unit TEXT,
        cost_code TEXT,
        responsible_person TEXT,
        job_status TEXT CHECK(job_status IN ('Active', 'Completed', 'Closed')) DEFAULT 'Active',
        approval_status TEXT CHECK(approval_status IN ('Pending Approval', 'Approved', 'Rejected')) DEFAULT 'Pending Approval'
      );
    `);

    await dbQuery.exec(`
      CREATE TABLE IF NOT EXISTS external_stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        cost_code TEXT,
        approval_status TEXT CHECK(approval_status IN ('Pending Approval', 'Approved', 'Rejected')) DEFAULT 'Pending Approval',
        status TEXT CHECK(status IN ('Active', 'Inactive')) DEFAULT 'Active'
      );
    `);

    await dbQuery.exec(`
      CREATE TABLE IF NOT EXISTS inflow_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL,
        material_id INTEGER NOT NULL,
        inflow_method TEXT CHECK(inflow_method IN ('Direct Purchase', 'Transfer', 'Return')) NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        total_value REAL NOT NULL,
        reference_number TEXT,
        job_id INTEGER,
        external_store_id INTEGER,
        receipt_status TEXT CHECK(receipt_status IN ('Pending', 'Confirmed', 'Rejected', 'Received', 'Cancelled')) DEFAULT 'Pending',
        approval_status TEXT CHECK(approval_status IN ('Pending Approval', 'Approved', 'Rejected')) DEFAULT 'Pending Approval',
        created_by INTEGER NOT NULL,
        approved_by INTEGER,
        created_date TEXT NOT NULL,
        approved_date TEXT,
        remarks TEXT,
        revised_quantity REAL,
        FOREIGN KEY (store_id) REFERENCES stores(id),
        FOREIGN KEY (material_id) REFERENCES materials(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (external_store_id) REFERENCES external_stores(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
    `);

    await dbQuery.exec(`
      CREATE TABLE IF NOT EXISTS outflow_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL,
        material_id INTEGER NOT NULL,
        outflow_method TEXT CHECK(outflow_method IN ('Disposal or sale', 'Issue by Issue Order', 'Issue by Waybill before Issue Order is created', 'Issue by Waybill for approved jobs', 'Issue to external stores')) NOT NULL,
        quantity REAL NOT NULL,
        reference_number TEXT,
        job_id INTEGER,
        external_store_id INTEGER,
        waybill_number TEXT,
        waybill_date TEXT,
        issue_order_number TEXT,
        issue_order_date TEXT,
        issue_order_status TEXT CHECK(issue_order_status IN ('Pending', 'Issue Order Updated')),
        temporary_job_reference TEXT,
        approval_status TEXT CHECK(approval_status IN ('Draft', 'Pending Approval', 'Approved', 'Rejected', 'Cancelled')) DEFAULT 'Pending Approval',
        created_by INTEGER NOT NULL,
        approved_by INTEGER,
        created_date TEXT NOT NULL,
        approved_date TEXT,
        remarks TEXT,
        FOREIGN KEY (store_id) REFERENCES stores(id),
        FOREIGN KEY (material_id) REFERENCES materials(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (external_store_id) REFERENCES external_stores(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
    `);

    await dbQuery.exec(`
      CREATE TABLE IF NOT EXISTS pending_issue_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outflow_id INTEGER UNIQUE NOT NULL,
        store_id INTEGER NOT NULL,
        waybill_number TEXT NOT NULL,
        waybill_date TEXT NOT NULL,
        material_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        job_id INTEGER,
        temporary_job_reference TEXT,
        unit TEXT,
        cost_code TEXT,
        person_receiving TEXT,
        issue_order_status TEXT CHECK(issue_order_status IN ('Pending', 'Submitted for Update', 'Updated', 'Rejected')) DEFAULT 'Pending',
        issue_order_number TEXT,
        issue_order_date TEXT,
        updated_by INTEGER,
        update_submitted_date TEXT,
        update_approved_by INTEGER,
        update_approved_date TEXT,
        remarks TEXT,
        FOREIGN KEY (outflow_id) REFERENCES outflow_transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (store_id) REFERENCES stores(id),
        FOREIGN KEY (material_id) REFERENCES materials(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      );
    `);

    await dbQuery.exec(`
      CREATE TABLE IF NOT EXISTS approval_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        related_tx_type TEXT CHECK(related_tx_type IN ('INFLOW', 'OUTFLOW', 'JOB', 'EXTERNAL_STORE', 'USER', 'WAYBILL_UPDATE', 'CANCELLATION')) NOT NULL,
        related_tx_id INTEGER NOT NULL,
        submitted_by INTEGER,
        approved_by INTEGER,
        approval_status TEXT CHECK(approval_status IN ('Approved', 'Rejected', 'Cancelled')) NOT NULL,
        comment TEXT,
        date_time TEXT NOT NULL
      );
    `);

    await dbQuery.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        read_status INTEGER DEFAULT 0,
        created_date TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Insert Default Stores
    await dbQuery.run("INSERT OR IGNORE INTO stores (id, name, location, status) VALUES (1, 'Habarana Store', 'Habarana', 'Active')");
    await dbQuery.run("INSERT OR IGNORE INTO stores (id, name, location, status) VALUES (2, 'Heyyanthuduwa Store', 'Heyyanthuduwa', 'Active')");

    // Insert Spec-Compliant default Users
    const date = new Date().toISOString().split('T')[0];
    const hash = bcrypt.hashSync("password123", 10);
    
    await dbQuery.run(`
      INSERT OR IGNORE INTO users (username, password_hash, role, name, designation, branch, unit, contact_number, status, created_date) 
      VALUES ('eemmphmd1', ?, 'EEMMPHMD1', 'EEM M. P. H. M. D1', 'Approving Officer', 'PHM D1 Branch', 'Management Unit', '0771234567', 'Active', ?)
    `, [hash, date]);

    await dbQuery.run(`
      INSERT OR IGNORE INTO users (username, password_hash, role, name, designation, branch, unit, contact_number, status, created_date) 
      VALUES ('decphmd1', ?, 'DECPHMD1', 'DEC P. H. M. D1', 'Data Entry Officer', 'PHM D1 Branch', 'Data Entry Unit', '0777654321', 'Active', ?)
    `, [hash, date]);

    // Ensure revised_quantity column exists in inflow_transactions (safe migration)
    await dbQuery.exec("ALTER TABLE inflow_transactions ADD COLUMN revised_quantity REAL;").catch(() => {});

    console.log("Database initialized and spec-compliant seed data inserted.");
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

initDb();

// Helper to push notifications
async function pushNotification(userId, title, message) {
  try {
    const date = new Date().toLocaleString();
    await dbQuery.run(
      "INSERT INTO notifications (user_id, title, message, read_status, created_date) VALUES (?, ?, ?, 0, ?)",
      [userId, title, message, date]
    );
  } catch (err) {
    console.error("Failed to push notification:", err);
  }
}

// Helper to notify all approvers
async function notifyAllApprovers(title, message) {
  try {
    const approvers = await dbQuery.all("SELECT id FROM users WHERE role = 'EEMMPHMD1'");
    for (let appr of approvers) {
      await pushNotification(appr.id, title, message);
    }
  } catch (err) {
    console.error("Failed to notify approvers:", err);
  }
}

// Authentication Middlewares
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalid or expired' });
    req.user = user;
    next();
  });
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

// ----------------------------------------------------
// AUTHENTICATION APIs (Section 2 & 3 alignment)
// ----------------------------------------------------

app.post('/api/auth/register', async (req, res) => {
  const { name, designation, branch, unit, contact_number, username, password, role } = req.body;
  if (!name || !designation || !branch || !unit || !contact_number || !username || !password || !role) {
    return res.status(400).json({ error: 'All registration fields are mandatory' });
  }

  if (!['EEMMPHMD1', 'DECPHMD1', 'General'].includes(role)) {
    return res.status(400).json({ error: 'Invalid user role specified' });
  }

  try {
    const existing = await dbQuery.get("SELECT * FROM users WHERE username = ?", [username.toLowerCase().trim()]);
    if (existing) return res.status(400).json({ error: 'Username is already taken' });

    // Validate password rules (Section 3.2: 8 chars, 1 number, 1 capital)
    const pwRegex = /^(?=.*[0-9])(?=.*[A-Z]).{8,}$/;
    if (!pwRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters, include at least one number, and one capital letter' 
      });
    }

    const hash = bcrypt.hashSync(password, 10);
    const date = new Date().toISOString().split('T')[0];

    const result = await dbQuery.run(
      `INSERT INTO users (name, designation, branch, unit, contact_number, username, password_hash, role, status, created_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
      [name.trim(), designation.trim(), branch.trim(), unit.trim(), contact_number.trim(), username.toLowerCase().trim(), hash, role, date]
    );

    // Section 16.1 Notification to Approving Officer
    await notifyAllApprovers(
      "New User Registration Request",
      `User ${username} (${role}) has requested registration and is pending your activation.`
    );

    res.status(201).json({ 
      message: 'Registration submitted. Account will remain inactive until approved by EEMMPHMD1.' 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  try {
    const user = await dbQuery.get("SELECT * FROM users WHERE username = ?", [username.toLowerCase().trim()]);
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    if (user.status !== 'Active') {
      return res.status(403).json({ error: `Your account status is: ${user.status}. Access is restricted.` });
    }

    const passMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passMatch) return res.status(401).json({ error: 'Invalid username or password' });

    const forcePasswordChange = password === 'test123';

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        forcePasswordChange
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Passwords are required' });

  // Validate rules
  const pwRegex = /^(?=.*[0-9])(?=.*[A-Z]).{8,}$/;
  if (!pwRegex.test(newPassword)) {
    return res.status(400).json({ 
      error: 'New password must be at least 8 characters, include at least one number, and one capital letter' 
    });
  }

  try {
    const user = await dbQuery.get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Incorrect old password' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await dbQuery.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/pending-users', authenticateToken, requireRole(['EEMMPHMD1']), async (req, res) => {
  try {
    const list = await dbQuery.all("SELECT id, name, designation, branch, unit, contact_number, username, role, status FROM users WHERE status = 'Pending'");
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/approve-user', authenticateToken, requireRole(['EEMMPHMD1']), async (req, res) => {
  const { userId, action } = req.body;
  if (!userId || !action) return res.status(400).json({ error: 'User ID and action are required' });

  try {
    const targetStatus = action === 'Approve' ? 'Active' : 'Suspended';
    const date = new Date().toISOString().split('T')[0];
    await dbQuery.run(
      "UPDATE users SET status = ?, approved_by = ?, approved_date = ? WHERE id = ?",
      [targetStatus, req.user.username, date, userId]
    );

    // Section 16.3 Notification to General/DataEntry User
    await pushNotification(
      userId,
      "Account Access Update",
      `Your account has been successfully approved and activated by ${req.user.username}.`
    );

    res.json({ message: `User status successfully updated to ${targetStatus}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// NOTIFICATION APIs (Section 16 alignment)
// ----------------------------------------------------
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const list = await dbQuery.all(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50",
      [req.user.id]
    );
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await dbQuery.run("UPDATE notifications SET read_status = 1 WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// JOBS MODULE APIs (Section 6 & 18.5 alignment)
// ----------------------------------------------------

app.get('/api/jobs', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    let list;
    if (userRole === 'General') {
      list = await dbQuery.all("SELECT * FROM jobs WHERE approval_status = 'Approved' ORDER BY job_number ASC");
    } else {
      list = await dbQuery.all("SELECT * FROM jobs ORDER BY job_number ASC");
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jobs', authenticateToken, requireRole(['DECPHMD1', 'EEMMPHMD1']), async (req, res) => {
  const { job_number, job_name, unit, cost_code, responsible_person } = req.body;
  if (!job_number || !job_name) {
    return res.status(400).json({ error: 'Job number and job name are required' });
  }

  try {
    const approvalStatus = req.user.role === 'EEMMPHMD1' ? 'Approved' : 'Pending Approval';
    const result = await dbQuery.run(
      `INSERT INTO jobs (job_number, job_name, unit, cost_code, responsible_person, job_status, approval_status)
       VALUES (?, ?, ?, ?, ?, 'Active', ?)`,
      [job_number.trim(), job_name.trim(), unit ? unit.trim() : null, cost_code ? cost_code.trim() : null, responsible_person ? responsible_person.trim() : null, approvalStatus]
    );

    if (req.user.role === 'DECPHMD1') {
      await notifyAllApprovers(
        "New Job Creation Submitted",
        `Job ${job_number} has been submitted for validation by ${req.user.username}.`
      );
    }

    res.status(201).json({ message: 'Job created successfully', id: result.id });
  } catch (err) {
    res.status(500).json({ error: 'Job number already exists or database error.' });
  }
});

app.put('/api/jobs/:id', authenticateToken, requireRole(['DECPHMD1', 'EEMMPHMD1']), async (req, res) => {
  const { job_number, job_name, unit, cost_code, responsible_person, job_status } = req.body;
  if (!job_number || !job_name) return res.status(400).json({ error: 'Job number and name are required' });

  try {
    const existing = await dbQuery.get("SELECT * FROM jobs WHERE job_number = ? AND id != ?", [job_number.trim(), req.params.id]);
    if (existing) return res.status(400).json({ error: 'Job number is already taken' });

    await dbQuery.run(
      `UPDATE jobs SET job_number = ?, job_name = ?, unit = ?, cost_code = ?, responsible_person = ?, job_status = ?
       WHERE id = ?`,
      [job_number.trim(), job_name.trim(), unit, cost_code, responsible_person, job_status || 'Active', req.params.id]
    );

    res.json({ message: 'Job details updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/jobs/:id/approve', authenticateToken, requireRole(['EEMMPHMD1']), async (req, res) => {
  const { action } = req.body; // 'Approve' or 'Reject'
  if (!action) return res.status(400).json({ error: 'Action is required' });

  try {
    const job = await dbQuery.get("SELECT * FROM jobs WHERE id = ?", [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const finalStatus = action === 'Approve' ? 'Approved' : 'Rejected';
    await dbQuery.run("UPDATE jobs SET approval_status = ? WHERE id = ?", [finalStatus, req.params.id]);

    res.json({ message: `Job request successfully ${finalStatus}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/jobs/:id/close', authenticateToken, requireRole(['EEMMPHMD1']), async (req, res) => {
  try {
    const job = await dbQuery.get("SELECT * FROM jobs WHERE id = ?", [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    await dbQuery.run("UPDATE jobs SET job_status = 'Closed' WHERE id = ?", [req.params.id]);
    res.json({ message: 'Job closed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// EXTERNAL STORES MODULE APIs (Section 7.3 & 18.6 alignment)
// ----------------------------------------------------

app.get('/api/external-stores', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    let list;
    if (userRole === 'General') {
      list = await dbQuery.all("SELECT * FROM external_stores WHERE approval_status = 'Approved' AND status = 'Active' ORDER BY name ASC");
    } else {
      list = await dbQuery.all("SELECT * FROM external_stores ORDER BY name ASC");
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/external-stores', authenticateToken, requireRole(['DECPHMD1', 'EEMMPHMD1']), async (req, res) => {
  const { name, cost_code } = req.body;
  if (!name) return res.status(400).json({ error: 'External store name is required' });

  try {
    const approvalStatus = req.user.role === 'EEMMPHMD1' ? 'Approved' : 'Pending Approval';
    const result = await dbQuery.run(
      "INSERT INTO external_stores (name, cost_code, approval_status, status) VALUES (?, ?, ?, 'Active')",
      [name.trim(), cost_code ? cost_code.trim() : null, approvalStatus]
    );

    if (req.user.role === 'DECPHMD1') {
      await notifyAllApprovers(
        "New External Store Submitted",
        `External Store ${name} has been submitted for validation by ${req.user.username}.`
      );
    }

    res.status(201).json({ message: 'External store created successfully', id: result.id });
  } catch (err) {
    res.status(500).json({ error: 'External store already exists or database error.' });
  }
});

app.patch('/api/external-stores/:id/approve', authenticateToken, requireRole(['EEMMPHMD1']), async (req, res) => {
  const { action } = req.body;
  if (!action) return res.status(400).json({ error: 'Action is required' });

  try {
    const finalStatus = action === 'Approve' ? 'Approved' : 'Rejected';
    await dbQuery.run("UPDATE external_stores SET approval_status = ? WHERE id = ?", [finalStatus, req.params.id]);
    res.json({ message: `External Store successfully ${finalStatus}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// EXCEL STORE INITIALIZATION (Section 5 alignment)
// ----------------------------------------------------

// Fuzzy header helper for Excel import
function getFuzzyValue(row, possibleKeys, defaultValue = undefined) {
  const keys = Object.keys(row);
  for (let pk of possibleKeys) {
    const pkNorm = pk.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    for (let k of keys) {
      const kNorm = k.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      if (kNorm === pkNorm) {
        return row[k];
      }
    }
  }
  return defaultValue;
}

app.post('/api/stores/import', authenticateToken, requireRole(['DECPHMD1']), upload.single('file'), async (req, res) => {
  const { storeId } = req.body;
  if (!storeId) return res.status(400).json({ error: 'storeId is required' });
  if (!req.file) return res.status(400).json({ error: 'Excel file is required' });

  const filePath = req.file.path;

  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) throw new Error("Excel sheet contains no records.");

    // Validate duplicate material codes in the excel sheet first (Section 5.3)
    const keysInSheet = data.map(r => {
      const rawCode = getFuzzyValue(r, ['Material Code', 'Material code', 'code', 'MaterialNo', 'Material No', 'Part No', 'Part Number']);
      const rawGrade = getFuzzyValue(r, ['Grade Code', 'Grade code', 'grade', 'Condition', 'Status', 'Grade'], 'NEW');
      const code = rawCode !== undefined ? String(rawCode).trim().toLowerCase() : '';
      const grade = rawGrade !== undefined ? String(rawGrade).trim().toLowerCase() : 'new';
      return code ? `${code}_${grade}` : '';
    }).filter(Boolean);

    const uniqueKeys = new Set(keysInSheet);
    if (keysInSheet.length !== uniqueKeys.size) {
      throw new Error("Initial import spreadsheet contains duplicate Material Codes with the same Grade Code.");
    }

    await dbQuery.exec("BEGIN TRANSACTION");

    const date = new Date().toISOString().split('T')[0];
    const targetStoreId = parseInt(storeId);
    let rowsProcessed = 0;

    for (let row of data) {
      const rawCode = getFuzzyValue(row, ['Material Code', 'Material code', 'code', 'MaterialNo', 'Material No', 'Part No', 'Part Number']);
      const rawName = getFuzzyValue(row, ['Material Name', 'Material name', 'name', 'Description', 'Material Description', 'Item Description', 'Item Name']);
      
      if (rawCode === undefined || rawName === undefined) {
        continue;
      }

      const code = String(rawCode).trim();
      const name = String(rawName).trim();
      if (!code || !name) {
        continue;
      }

      const uom = String(getFuzzyValue(row, ['Major UOM', 'Major uom', 'uom', 'Unit', 'Unit of Measure', 'Measurement'], 'NO.')).trim();
      const grade = String(getFuzzyValue(row, ['Grade Code', 'Grade code', 'grade', 'Condition', 'Status', 'Grade'], 'NEW')).trim();
      
      const qtyAlloc = parseFloat(getFuzzyValue(row, ['Quantity Allocated', 'quantity_allocated', 'Allocated Quantity', 'Allocated', 'Qty Allocated', 'Allocated Qty'], 0.0) || 0.0);
      const qtyOnHand = parseFloat(getFuzzyValue(row, ['Quantity On Hand', 'quantity_on_hand', 'OnHand Quantity', 'OnHand', 'Qty On Hand', 'OnHand Qty', 'On Hand'], 0.0) || 0.0);
      const price = parseFloat(getFuzzyValue(row, ['Unit Price', 'unit_price', 'price', 'Rate', 'Unit Rate', 'Cost'], 0.0) || 0.0);
      const val = parseFloat(getFuzzyValue(row, ['Value', 'value', 'Total Value', 'Amount', 'Total Amount'], (qtyOnHand * price)) || 0.0);

      // 1. Create or update material master
      let material = await dbQuery.get("SELECT * FROM materials WHERE code = ? AND grade_code = ?", [code, grade]);
      let materialId;
      if (material) {
        materialId = material.id;
        await dbQuery.run(
          "UPDATE materials SET name = ?, uom = ?, price = ? WHERE id = ?",
          [name, uom, price, materialId]
        );
      } else {
        const matInsert = await dbQuery.run(
          "INSERT INTO materials (code, name, uom, grade_code, price, status) VALUES (?, ?, ?, ?, ?, 'Active')",
          [code, name, uom, grade, price]
        );
        materialId = matInsert.id;
      }

      // 2. Insert Inflow Transaction for this item (Receipt status: Pending, Approval: Pending Approval)
      // Save quantity_allocated in remarks as a serialized JSON string so it can be applied on EEMMPHMD1 approval
      const remarksJson = JSON.stringify({
        type: 'INITIAL_IMPORT',
        qtyAlloc: qtyAlloc,
        text: 'Initial store inventory balance import'
      });

      await dbQuery.run(
        `INSERT INTO inflow_transactions (store_id, material_id, inflow_method, quantity, unit_price, total_value, reference_number, receipt_status, approval_status, created_by, created_date, remarks)
         VALUES (?, ?, 'Direct Purchase', ?, ?, ?, 'INITIAL_IMPORT', 'Pending', 'Pending Approval', ?, ?, ?)`,
        [targetStoreId, materialId, qtyOnHand, price, val, req.user.id, date, remarksJson]
      );

      rowsProcessed++;
    }

    await dbQuery.exec("COMMIT");
    fs.unlinkSync(filePath);
    res.json({ message: `Store initialized successfully from Excel! Processed ${rowsProcessed} rows.` });
  } catch (err) {
    await dbQuery.exec("ROLLBACK").catch(() => {});
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// DASHBOARD ANALYTICS API
// ----------------------------------------------------
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const materialsCount = await dbQuery.get("SELECT COUNT(*) as count FROM materials WHERE status = 'Active'");
    const jobsCount = await dbQuery.get("SELECT COUNT(*) as count FROM jobs WHERE job_status = 'Active' AND approval_status = 'Approved'");
    
    // Sum of pending validations (treating INITIAL_IMPORT inflows as store-level batches)
    const pendingInitialImportStores = await dbQuery.get("SELECT COUNT(DISTINCT store_id) as count FROM inflow_transactions WHERE reference_number = 'INITIAL_IMPORT' AND approval_status = 'Pending Approval'");
    const pendingRegularInflows = await dbQuery.get("SELECT COUNT(*) as count FROM inflow_transactions WHERE (reference_number IS NULL OR reference_number != 'INITIAL_IMPORT') AND approval_status = 'Pending Approval'");
    const pendingOutflows = await dbQuery.get("SELECT COUNT(*) as count FROM outflow_transactions WHERE approval_status = 'Pending Approval'");
    const pendingWaybillUpdates = await dbQuery.get("SELECT COUNT(*) as count FROM pending_issue_orders WHERE issue_order_status = 'Submitted for Update'");
    const pendingJobs = await dbQuery.get("SELECT COUNT(*) as count FROM jobs WHERE approval_status = 'Pending Approval'");
    const pendingStores = await dbQuery.get("SELECT COUNT(*) as count FROM external_stores WHERE approval_status = 'Pending Approval'");
    
    const pendingApprovals = (pendingInitialImportStores.count || 0) + 
                             (pendingRegularInflows.count || 0) + 
                             (pendingOutflows.count || 0) + 
                             (pendingWaybillUpdates.count || 0) + 
                             (pendingJobs.count || 0) + 
                             (pendingStores.count || 0);

    const pendingWaybills = await dbQuery.get("SELECT COUNT(*) as count FROM pending_issue_orders WHERE issue_order_status = 'Pending'");

    const storeBalances = await dbQuery.all(`
      SELECT s.name as store_name, 
             COALESCE(SUM(ib.quantity_on_hand), 0.0) as total_qty, 
             COALESCE(SUM(ib.value), 0.0) as total_value
      FROM stores s
      LEFT JOIN inventory_balances ib ON s.id = ib.store_id
      GROUP BY s.id
    `);

    res.json({
      totalMaterials: materialsCount.count || 0,
      activeJobs: jobsCount.count || 0,
      pendingApprovals,
      pendingWaybillIssueOrders: pendingWaybills.count || 0,
      storeBalances
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/materials', authenticateToken, async (req, res) => {
  try {
    const list = await dbQuery.all("SELECT * FROM materials ORDER BY code ASC");
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// TRANSACTION APIs (Section 7, 8, 9, 10, 11 alignment)
// ----------------------------------------------------

// Submit Inflow Transaction (Single Item)
app.post('/api/transactions/inflow', authenticateToken, requireRole(['DECPHMD1']), async (req, res) => {
  const { store_id, material_id, inflow_method, quantity, unit_price, reference_number, job_id, external_store_id, remarks, status } = req.body;
  if (!store_id || !material_id || !inflow_method || !quantity || !unit_price) {
    return res.status(400).json({ error: 'All core transaction parameters are required' });
  }

  const date = new Date().toISOString().split('T')[0];
  const txStatus = status === 'Draft' ? 'Draft' : 'Pending Approval';
  const totalValue = quantity * unit_price;

  try {
    const result = await dbQuery.run(
      `INSERT INTO inflow_transactions (store_id, material_id, inflow_method, quantity, unit_price, total_value, reference_number, job_id, external_store_id, receipt_status, approval_status, created_by, created_date, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?)`,
      [store_id, material_id, inflow_method, quantity, unit_price, totalValue, reference_number || null, job_id || null, external_store_id || null, txStatus, req.user.id, date, remarks || '']
    );

    if (txStatus === 'Pending Approval') {
      await notifyAllApprovers(
        "New Material Inflow Submitted",
        `Inflow transaction for material ID ${material_id} submitted for approval by ${req.user.username}.`
      );
    }

    res.status(201).json({ message: 'Inflow transaction submitted successfully', transactionId: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/transactions/inflow/:id/receipt-status', authenticateToken, requireRole(['DECPHMD1']), async (req, res) => {
  const { receipt_status, revised_quantity } = req.body;
  if (!receipt_status) return res.status(400).json({ error: 'Receipt status is required' });
  if (!['Pending', 'Confirmed', 'Rejected', 'Received', 'Cancelled'].includes(receipt_status)) {
    return res.status(400).json({ error: 'Invalid receipt status' });
  }

  try {
    await dbQuery.exec("BEGIN TRANSACTION");

    const tx = await dbQuery.get("SELECT * FROM inflow_transactions WHERE id = ?", [req.params.id]);
    if (!tx) throw new Error("Inflow transaction not found");
    if (tx.approval_status !== 'Approved') {
      throw new Error("Cannot update receipt status on a transaction that is not approved by EEMMPHMD1");
    }
    if (tx.receipt_status === 'Received' && receipt_status !== 'Cancelled') {
      throw new Error("Cannot update receipt status once it has already been Received, unless cancelling it");
    }
    if (tx.receipt_status === 'Cancelled') {
      throw new Error("Cannot update receipt status of a Cancelled transaction");
    }

    const finalQty = revised_quantity !== undefined ? parseFloat(revised_quantity) : tx.quantity;
    const finalValue = finalQty * tx.unit_price;
    const date = new Date().toISOString().split('T')[0];

    await dbQuery.run(
      `UPDATE inflow_transactions 
       SET receipt_status = ?, revised_quantity = ?, quantity = ?, total_value = ?
       WHERE id = ?`,
      [receipt_status, finalQty, finalQty, finalValue, req.params.id]
    );

    if (receipt_status === 'Received') {
      await dbQuery.run(
        `INSERT INTO inventory_balances (store_id, material_id, quantity_on_hand, unit_price, value, last_updated_date) 
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(store_id, material_id) DO UPDATE SET quantity_on_hand = quantity_on_hand + ?, value = (quantity_on_hand + ?) * unit_price, last_updated_date = ?`,
        [tx.store_id, tx.material_id, finalQty, tx.unit_price, finalValue, date, finalQty, finalQty, date]
      );

      await pushNotification(
        tx.created_by,
        "Material Inflow Received",
        `Material receipt updated to Received. Inventory updated with ${finalQty} units.`
      );
    } else if (receipt_status === 'Cancelled' && tx.receipt_status === 'Received') {
      // Deduct quantity from inventory
      const bal = await dbQuery.get("SELECT quantity_on_hand, unit_price FROM inventory_balances WHERE store_id = ? AND material_id = ?", [tx.store_id, tx.material_id]);
      if (bal) {
        const newQty = bal.quantity_on_hand - tx.quantity;
        const newValue = newQty * bal.unit_price;
        await dbQuery.run(
          "UPDATE inventory_balances SET quantity_on_hand = ?, value = ?, last_updated_date = ? WHERE store_id = ? AND material_id = ?",
          [newQty, newValue, date, tx.store_id, tx.material_id]
        );
      }

      await pushNotification(
        tx.created_by,
        "Material Inflow Cancelled",
        `Material receipt updated to Cancelled. Inventory reduced by ${tx.quantity} units.`
      );
    }

    await dbQuery.exec("COMMIT");
    res.json({ message: `Receipt status successfully updated to ${receipt_status}` });
  } catch (err) {
    await dbQuery.exec("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  }
});

// Submit Outflow Transaction (Single Item)
app.post('/api/transactions/outflow', authenticateToken, requireRole(['DECPHMD1']), async (req, res) => {
  const { store_id, material_id, outflow_method, quantity, reference_number, job_id, external_store_id, waybill_number, waybill_date, issue_order_number, issue_order_date, temporary_job_reference, remarks, status } = req.body;
  if (!store_id || !material_id || !outflow_method || !quantity) {
    return res.status(400).json({ error: 'Store, material, method, and quantity are required' });
  }

  if (status !== 'Draft') {
    if (outflow_method === 'Issue by Issue Order' && !issue_order_number) {
      return res.status(400).json({ error: 'Issue Order number is required.' });
    }
    if ((outflow_method === 'Issue by Waybill before Issue Order is created' || outflow_method === 'Issue by Waybill for approved jobs') && !waybill_number) {
      return res.status(400).json({ error: 'Waybill number is required.' });
    }
  }

  const date = new Date().toISOString().split('T')[0];
  const txStatus = status === 'Draft' ? 'Draft' : 'Pending Approval';

  try {
    if (job_id) {
      const job = await dbQuery.get("SELECT job_status, approval_status FROM jobs WHERE id = ?", [job_id]);
      if (job) {
        if (job.approval_status !== 'Approved') {
          return res.status(400).json({ error: 'Selected Job is pending approval and cannot receive material issues.' });
        }
        if (job.job_status !== 'Active') {
          return res.status(400).json({ error: `Selected Job is ${job.job_status} and cannot receive material issues.` });
        }
      }
    }

    if (external_store_id) {
      const extStore = await dbQuery.get("SELECT status, approval_status FROM external_stores WHERE id = ?", [external_store_id]);
      if (extStore) {
        if (extStore.approval_status !== 'Approved') {
          return res.status(400).json({ error: 'Selected External Store is pending approval.' });
        }
        if (extStore.status !== 'Active') {
          return res.status(400).json({ error: `Selected External Store is ${extStore.status}.` });
        }
      }
    }

    // Check sufficient balance first
    const bal = await dbQuery.get("SELECT quantity_on_hand FROM inventory_balances WHERE store_id = ? AND material_id = ?", [store_id, material_id]);
    const currentQty = bal ? bal.quantity_on_hand : 0.0;
    if (txStatus !== 'Draft' && currentQty < quantity) {
      return res.status(400).json({ error: `Insufficient inventory balance. Available quantity: ${currentQty}` });
    }

    const ioStatus = outflow_method === 'Issue by Waybill before Issue Order is created' ? 'Pending' : null;

    const result = await dbQuery.run(
      `INSERT INTO outflow_transactions (store_id, material_id, outflow_method, quantity, reference_number, job_id, external_store_id, waybill_number, waybill_date, issue_order_number, issue_order_date, issue_order_status, temporary_job_reference, approval_status, created_by, created_date, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [store_id, material_id, outflow_method, quantity, reference_number || null, job_id || null, external_store_id || null, waybill_number || null, waybill_date || null, issue_order_number || null, issue_order_date || null, ioStatus, temporary_job_reference || null, txStatus, req.user.id, date, remarks || '']
    );

    if (txStatus === 'Pending Approval') {
      await notifyAllApprovers(
        "New Material Outflow Submitted",
        `Outflow transaction for material ID ${material_id} submitted for approval by ${req.user.username}.`
      );
    }

    res.status(201).json({ message: 'Outflow transaction submitted successfully', transactionId: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/transactions/waybill/:txId', authenticateToken, requireRole(['DECPHMD1']), async (req, res) => {
  const { issue_order_number, issue_order_date, job_id, remarks } = req.body;
  if (!issue_order_number || !issue_order_date) {
    return res.status(400).json({ error: 'Issue order number and date are required' });
  }

  try {
    if (job_id) {
      const job = await dbQuery.get("SELECT job_status, approval_status FROM jobs WHERE id = ?", [job_id]);
      if (job) {
        if (job.approval_status !== 'Approved') {
          return res.status(400).json({ error: 'Selected Job is pending approval and cannot receive material issues.' });
        }
        if (job.job_status !== 'Active') {
          return res.status(400).json({ error: `Selected Job is ${job.job_status} and cannot receive material issues.` });
        }
      }
    }

    await dbQuery.exec("BEGIN TRANSACTION");

    const date = new Date().toISOString().split('T')[0];
    const updateResult = await dbQuery.run(
      `UPDATE pending_issue_orders 
       SET issue_order_status = 'Submitted for Update', issue_order_number = ?, issue_order_date = ?, 
           job_id = ?, updated_by = ?, update_submitted_date = ?, remarks = ?
       WHERE id = ?`,
      [issue_order_number, issue_order_date, job_id || null, req.user.id, date, remarks || '', req.params.txId]
    );

    if (updateResult.changes === 0) throw new Error("Pending Waybill record not found");

    // Also update parent outflow transaction record parameters
    const pendingInfo = await dbQuery.get("SELECT outflow_id FROM pending_issue_orders WHERE id = ?", [req.params.txId]);
    await dbQuery.run(
      `UPDATE outflow_transactions 
       SET issue_order_number = ?, issue_order_date = ?, job_id = ?, remarks = ?
       WHERE id = ?`,
      [issue_order_number, issue_order_date, job_id || null, remarks || '', pendingInfo.outflow_id]
    );

    await notifyAllApprovers(
      "Pending Waybill Issue Order Update Submitted",
      `Issue Order updates for Waybill transaction submitted by ${req.user.username}.`
    );

    await dbQuery.exec("COMMIT");
    res.json({ message: 'Waybill updated with Issue Order details and submitted for approval.' });
  } catch (err) {
    await dbQuery.exec("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// Get Pending Review Approvals (Section 15.7 & 12 alignment)
app.get('/api/transactions/pending-approvals', authenticateToken, requireRole(['EEMMPHMD1']), async (req, res) => {
  try {
    const rawInflows = await dbQuery.all(`
      SELECT t.*, s.name as store_name, m.code as material_code, m.name as material_name, m.uom, u.username as creator_name, j.job_number, ext.name as external_store_name
      FROM inflow_transactions t
      JOIN stores s ON t.store_id = s.id
      JOIN materials m ON t.material_id = m.id
      JOIN users u ON t.created_by = u.id
      LEFT JOIN jobs j ON t.job_id = j.id
      LEFT JOIN external_stores ext ON t.external_store_id = ext.id
      WHERE t.approval_status = 'Pending Approval'
    `);

    // Group INITIAL_IMPORT transactions by store
    const inflows = [];
    const initialImportsByStore = {};

    for (let tx of rawInflows) {
      if (tx.reference_number === 'INITIAL_IMPORT') {
        if (!initialImportsByStore[tx.store_id]) {
          initialImportsByStore[tx.store_id] = {
            id: tx.id,
            store_id: tx.store_id,
            store_name: tx.store_name,
            inflow_method: 'Initial Import Batch',
            quantity: 0,
            unit_price: 0,
            total_value: 0,
            reference_number: 'INITIAL_IMPORT',
            receipt_status: 'Pending',
            approval_status: 'Pending Approval',
            creator_name: tx.creator_name,
            created_by: tx.created_by,
            created_date: tx.created_date,
            remarks: 'Initial inventory import batch',
            is_batch: true,
            items: []
          };
        }
        const batch = initialImportsByStore[tx.store_id];
        batch.quantity += tx.quantity;
        batch.total_value += tx.total_value;
        batch.items.push(tx);
      } else {
        inflows.push(tx);
      }
    }

    for (let storeId in initialImportsByStore) {
      const batch = initialImportsByStore[storeId];
      batch.remarks = `Initial inventory import batch containing ${batch.items.length} items.`;
      inflows.push(batch);
    }

    const outflows = await dbQuery.all(`
      SELECT t.*, s.name as store_name, m.code as material_code, m.name as material_name, m.uom, m.price as unit_price, u.username as creator_name, j.job_number, ext.name as external_store_name
      FROM outflow_transactions t
      JOIN stores s ON t.store_id = s.id
      JOIN materials m ON t.material_id = m.id
      JOIN users u ON t.created_by = u.id
      LEFT JOIN jobs j ON t.job_id = j.id
      LEFT JOIN external_stores ext ON t.external_store_id = ext.id
      WHERE t.approval_status = 'Pending Approval'
    `);

    const waybills = await dbQuery.all(`
      SELECT pio.*, s.name as store_name, m.code as material_code, m.name as material_name, m.uom, u.username as creator_name, j.job_number
      FROM pending_issue_orders pio
      JOIN stores s ON pio.store_id = s.id
      JOIN materials m ON pio.material_id = m.id
      JOIN users u ON pio.updated_by = u.id
      LEFT JOIN jobs j ON pio.job_id = j.id
      WHERE pio.issue_order_status = 'Submitted for Update'
    `);

    const jobs = await dbQuery.all("SELECT * FROM jobs WHERE approval_status = 'Pending Approval'");
    const externalStores = await dbQuery.all("SELECT * FROM external_stores WHERE approval_status = 'Pending Approval'");

    res.json({ inflows, outflows, waybills, jobs, externalStores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve / Reject transaction (Inflow, Outflow, Waybill Updates, Cancellations)
app.post('/api/transactions/approve', authenticateToken, requireRole(['EEMMPHMD1']), async (req, res) => {
  const { transactionId, transactionType, action, comment } = req.body;
  if (!transactionId || !transactionType || !action) {
    return res.status(400).json({ error: 'Transaction ID, Type, and Action are required' });
  }

  const date = new Date().toISOString().split('T')[0];
  const finalStatus = action === 'Approve' ? 'Approved' : 'Rejected';

  try {
    await dbQuery.exec("BEGIN TRANSACTION");

    if (transactionType === 'INFLOW') {
      const tx = await dbQuery.get("SELECT * FROM inflow_transactions WHERE id = ?", [transactionId]);
      if (!tx || tx.approval_status !== 'Pending Approval') throw new Error("Invalid inflow transaction ID");

      if (action === 'Approve') {
        if (tx.reference_number === 'INITIAL_IMPORT') {
          // Fetch ALL pending initial import transactions for this store
          const batchTxs = await dbQuery.all(
            "SELECT * FROM inflow_transactions WHERE store_id = ? AND reference_number = 'INITIAL_IMPORT' AND approval_status = 'Pending Approval'",
            [tx.store_id]
          );

          for (let batchTx of batchTxs) {
            // Parse qtyAlloc from remarks JSON
            let qtyAlloc = 0;
            try {
              const parsed = JSON.parse(batchTx.remarks);
              if (parsed && parsed.qtyAlloc !== undefined) {
                qtyAlloc = parseFloat(parsed.qtyAlloc) || 0;
              }
            } catch (e) {}

            // Update transaction to Approved and Received
            await dbQuery.run(
              "UPDATE inflow_transactions SET approval_status = ?, receipt_status = 'Received', approved_by = ?, approved_date = ? WHERE id = ?",
              [finalStatus, req.user.id, date, batchTx.id]
            );

            // Immediately update/insert inventory balance
            await dbQuery.run(
              `INSERT INTO inventory_balances (store_id, material_id, quantity_allocated, quantity_on_hand, unit_price, value, last_updated_date)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(store_id, material_id) DO UPDATE SET quantity_allocated = ?, quantity_on_hand = ?, unit_price = ?, value = ?, last_updated_date = ?`,
               [batchTx.store_id, batchTx.material_id, qtyAlloc, batchTx.quantity, batchTx.unit_price, batchTx.total_value, date, qtyAlloc, batchTx.quantity, batchTx.unit_price, batchTx.total_value, date]
            );
          }

          await pushNotification(tx.created_by, `Initial Import Approved`, `Your initial inventory import batch containing ${batchTxs.length} items has been approved.`);
        } else {
          // Regular inflow approval
          await dbQuery.run(
            "UPDATE inflow_transactions SET approval_status = ?, receipt_status = 'Pending', approved_by = ?, approved_date = ? WHERE id = ?",
            [finalStatus, req.user.id, date, transactionId]
          );

          await pushNotification(tx.created_by, `Inflow Transaction Approved`, `Your inflow entry for material ID ${tx.material_id} has been approved. Awaiting physical receipt confirmation.`);
        }
      } else {
        // Rejected
        if (tx.reference_number === 'INITIAL_IMPORT') {
          // Reject all pending initial imports for this store
          await dbQuery.run(
            "UPDATE inflow_transactions SET approval_status = 'Rejected', receipt_status = 'Rejected', approved_by = ?, approved_date = ? WHERE store_id = ? AND reference_number = 'INITIAL_IMPORT' AND approval_status = 'Pending Approval'",
            [req.user.id, date, tx.store_id]
          );
          await pushNotification(tx.created_by, `Initial Import Rejected`, `Your initial inventory import batch has been rejected.`);
        } else {
          await dbQuery.run(
            "UPDATE inflow_transactions SET approval_status = ?, receipt_status = 'Rejected', approved_by = ?, approved_date = ? WHERE id = ?",
            [finalStatus, req.user.id, date, transactionId]
          );

          await pushNotification(tx.created_by, `Inflow Transaction Rejected`, `Your inflow entry for material ID ${tx.material_id} has been rejected.`);
        }
      }

    } else if (transactionType === 'OUTFLOW') {
      const tx = await dbQuery.get("SELECT * FROM outflow_transactions WHERE id = ?", [transactionId]);
      if (!tx || tx.approval_status !== 'Pending Approval') throw new Error("Invalid outflow transaction ID");

      await dbQuery.run(
        "UPDATE outflow_transactions SET approval_status = ?, approved_by = ?, approved_date = ? WHERE id = ?",
        [finalStatus, req.user.id, date, transactionId]
      );

      if (action === 'Approve') {
        const bal = await dbQuery.get("SELECT * FROM inventory_balances WHERE store_id = ? AND material_id = ?", [tx.store_id, tx.material_id]);
        const currentQty = bal ? bal.quantity_on_hand : 0.0;
        const currentAlloc = bal ? bal.quantity_allocated : 0.0;

        if (tx.issue_order_number) {
          // Direct issue order reference -> update stock balance directly
          if (currentQty < tx.quantity) throw new Error("Insufficient stock balance on approval");

          const newQty = currentQty - tx.quantity;
          await dbQuery.run(
            `INSERT INTO inventory_balances (store_id, material_id, quantity_allocated, quantity_on_hand, unit_price, value, last_updated_date)
             VALUES (?, ?, 0, ?, ?, ?, ?)
             ON CONFLICT(store_id, material_id) DO UPDATE SET quantity_on_hand = ?, value = ? * unit_price, last_updated_date = ?`,
            [tx.store_id, tx.material_id, newQty, tx.unit_price || bal.unit_price || 0.0, newQty * (tx.unit_price || bal.unit_price || 0.0), date, newQty, newQty, date]
          );
        } else {
          // No direct issue order -> count as allocated balance
          const availableQty = currentQty - currentAlloc;
          if (availableQty < tx.quantity) throw new Error(`Insufficient available stock for allocation. Available (On Hand - Allocated): ${availableQty}`);

          const newAlloc = currentAlloc + tx.quantity;
          await dbQuery.run(
            `INSERT INTO inventory_balances (store_id, material_id, quantity_allocated, quantity_on_hand, unit_price, value, last_updated_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(store_id, material_id) DO UPDATE SET quantity_allocated = ?, last_updated_date = ?`,
            [tx.store_id, tx.material_id, newAlloc, currentQty, tx.unit_price || bal.unit_price || 0.0, currentQty * (tx.unit_price || bal.unit_price || 0.0), date, newAlloc, date]
          );

          // Section 10.1: If Waybill (either before IO or for approved job), add to pending waybills list
          if (tx.outflow_method === 'Issue by Waybill before Issue Order is created' || tx.outflow_method === 'Issue by Waybill for approved jobs') {
            const wbDate = tx.waybill_date || date;
            await dbQuery.run(
              `INSERT INTO pending_issue_orders (outflow_id, store_id, waybill_number, waybill_date, material_id, quantity, job_id, temporary_job_reference, issue_order_status, remarks)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
              [transactionId, tx.store_id, tx.waybill_number, wbDate, tx.material_id, tx.quantity, tx.job_id, tx.temporary_job_reference, tx.remarks]
            );
          }
        }
      }

      await pushNotification(tx.created_by, `Outflow Transaction ${finalStatus}`, `Your outflow entry has been ${finalStatus}.`);

    } else if (transactionType === 'WAYBILL_UPDATE') {
      const pio = await dbQuery.get("SELECT * FROM pending_issue_orders WHERE id = ?", [transactionId]);
      if (!pio) throw new Error("Pending Waybill not found");

      const targetStatus = action === 'Approve' ? 'Updated' : 'Rejected';

      await dbQuery.run(
        "UPDATE pending_issue_orders SET issue_order_status = ?, update_approved_by = ?, update_approved_date = ? WHERE id = ?",
        [targetStatus, req.user.id, date, transactionId]
      );

      if (action === 'Approve') {
        const bal = await dbQuery.get("SELECT * FROM inventory_balances WHERE store_id = ? AND material_id = ?", [pio.store_id, pio.material_id]);
        if (!bal) throw new Error("Inventory balance not found for Waybill material");
        if (bal.quantity_on_hand < pio.quantity) throw new Error("Insufficient stock on hand to link Issue Order");

        const newQtyOnHand = bal.quantity_on_hand - pio.quantity;
        const newQtyAlloc = Math.max(0.0, bal.quantity_allocated - pio.quantity);

        await dbQuery.run(
          "UPDATE inventory_balances SET quantity_on_hand = ?, quantity_allocated = ?, value = ? * unit_price, last_updated_date = ? WHERE store_id = ? AND material_id = ?",
          [newQtyOnHand, newQtyAlloc, newQtyOnHand, date, pio.store_id, pio.material_id]
        );

        // Remove from Pending Issue Orders list
        await dbQuery.run("DELETE FROM pending_issue_orders WHERE id = ?", [transactionId]);
        
        // Update parent outflow transaction's issue order status
        await dbQuery.run(
          "UPDATE outflow_transactions SET issue_order_status = 'Issue Order Updated' WHERE id = ?",
          [pio.outflow_id]
        );
      } else {
        // Reset status to Pending in pending table so Data Entry can correct
        await dbQuery.run(
          "UPDATE pending_issue_orders SET issue_order_status = 'Pending' WHERE id = ?",
          [transactionId]
        );
      }

      await pushNotification(pio.updated_by, `Waybill Update ${finalStatus}`, `Your Issue Order update for Waybill ${pio.waybill_number} was ${finalStatus}.`);

    } else if (transactionType === 'CANCELLATION') {
      const tx = await dbQuery.get("SELECT * FROM outflow_transactions WHERE id = ?", [transactionId]);
      if (!tx || tx.approval_status !== 'Pending Approval') throw new Error("Invalid transaction for cancellation approval");

      if (action === 'Approve') {
        await dbQuery.run("UPDATE outflow_transactions SET approval_status = 'Cancelled' WHERE id = ?", [transactionId]);
        
        // Revert stock or allocation
        if (tx.issue_order_number) {
          // Revert stock (add back quantities)
          await dbQuery.run(
            "UPDATE inventory_balances SET quantity_on_hand = quantity_on_hand + ?, value = (quantity_on_hand + ?) * unit_price, last_updated_date = ? WHERE store_id = ? AND material_id = ?",
            [tx.quantity, tx.quantity, date, tx.store_id, tx.material_id]
          );
        } else {
          // Revert allocation
          await dbQuery.run(
            "UPDATE inventory_balances SET quantity_allocated = MAX(0.0, quantity_allocated - ?), last_updated_date = ? WHERE store_id = ? AND material_id = ?",
            [tx.quantity, date, tx.store_id, tx.material_id]
          );
        }

        // Remove from pending issue orders if it was a Waybill
        await dbQuery.run("DELETE FROM pending_issue_orders WHERE outflow_id = ?", [transactionId]);
      } else {
        // Restore to Approved status
        await dbQuery.run("UPDATE outflow_transactions SET approval_status = 'Approved' WHERE id = ?", [transactionId]);
      }
    }

    // Insert to approval history log
    await dbQuery.run(
      `INSERT INTO approval_history (related_tx_type, related_tx_id, submitted_by, approved_by, approval_status, comment, date_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [transactionType, transactionId, null, req.user.id, finalStatus, comment || '', new Date().toLocaleString()]
    );

    await dbQuery.exec("COMMIT");
    res.json({ message: `Approval completed. Action: ${finalStatus}` });
  } catch (err) {
    await dbQuery.exec("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  }
});

// Draft Cancellation request
app.post('/api/transactions/cancel-request', authenticateToken, requireRole(['DECPHMD1']), async (req, res) => {
  const { transactionId, transactionType } = req.body; // Inflow / Outflow
  if (!transactionId || !transactionType) return res.status(400).json({ error: 'Transaction ID and type are required' });

  try {
    await dbQuery.exec("BEGIN TRANSACTION");

    if (transactionType === 'OUTFLOW') {
      await dbQuery.run("UPDATE outflow_transactions SET approval_status = 'Pending Approval' WHERE id = ?", [transactionId]);
    } else {
      await dbQuery.run("UPDATE inflow_transactions SET approval_status = 'Pending Approval' WHERE id = ?", [transactionId]);
    }

    await notifyAllApprovers(
      "Cancellation Request Submitted",
      `Cancellation request submitted for transaction ID ${transactionId} (${transactionType}).`
    );

    await dbQuery.exec("COMMIT");
    res.json({ message: 'Cancellation request sent to EEMMPHMD1' });
  } catch (err) {
    await dbQuery.exec("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// GET rejected entries for correction (DECPHMD1)
app.get('/api/transactions/rejected', authenticateToken, requireRole(['DECPHMD1']), async (req, res) => {
  try {
    const inflows = await dbQuery.all(`
      SELECT t.*, s.name as store_name, m.code as material_code, m.name as material_name, m.uom, m.grade_code,
             COALESCE(ah.comment, '') as reject_comment
      FROM inflow_transactions t
      JOIN stores s ON t.store_id = s.id
      JOIN materials m ON t.material_id = m.id
      LEFT JOIN approval_history ah ON ah.related_tx_type = 'INFLOW' AND ah.related_tx_id = t.id AND ah.approval_status = 'Rejected'
      WHERE t.approval_status = 'Rejected' AND t.created_by = ?
      GROUP BY t.id
      ORDER BY t.id DESC
    `, [req.user.id]);

    const outflows = await dbQuery.all(`
      SELECT t.*, s.name as store_name, m.code as material_code, m.name as material_name, m.uom, m.grade_code, m.price as unit_price,
             COALESCE(ah.comment, '') as reject_comment
      FROM outflow_transactions t
      JOIN stores s ON t.store_id = s.id
      JOIN materials m ON t.material_id = m.id
      LEFT JOIN approval_history ah ON ah.related_tx_type = 'OUTFLOW' AND ah.related_tx_id = t.id AND ah.approval_status = 'Rejected'
      WHERE t.approval_status = 'Rejected' AND t.created_by = ?
      GROUP BY t.id
      ORDER BY t.id DESC
    `, [req.user.id]);

    res.json({ inflows, outflows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE rejected entry
app.delete('/api/transactions/rejected/:id', authenticateToken, requireRole(['DECPHMD1']), async (req, res) => {
  const { type } = req.query;
  if (!type) return res.status(400).json({ error: 'Transaction type is required' });

  try {
    await dbQuery.exec("BEGIN TRANSACTION");
    if (type === 'inflow') {
      const tx = await dbQuery.get("SELECT * FROM inflow_transactions WHERE id = ? AND created_by = ?", [req.params.id, req.user.id]);
      if (!tx || tx.approval_status !== 'Rejected') throw new Error("Rejected inflow not found or unauthorized");
      
      await dbQuery.run("DELETE FROM inflow_transactions WHERE id = ?", [req.params.id]);
    } else {
      const tx = await dbQuery.get("SELECT * FROM outflow_transactions WHERE id = ? AND created_by = ?", [req.params.id, req.user.id]);
      if (!tx || tx.approval_status !== 'Rejected') throw new Error("Rejected outflow not found or unauthorized");
      
      await dbQuery.run("DELETE FROM outflow_transactions WHERE id = ?", [req.params.id]);
    }
    await dbQuery.exec("COMMIT");
    res.json({ message: 'Rejected transaction deleted successfully' });
  } catch (err) {
    await dbQuery.exec("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  }
});

// PUT (Edit and resubmit) rejected entry
app.put('/api/transactions/rejected/:id', authenticateToken, requireRole(['DECPHMD1']), async (req, res) => {
  const { type } = req.query;
  if (!type) return res.status(400).json({ error: 'Transaction type is required' });

  const { material_id, quantity, unit_price, remarks, reference_number, job_id, external_store_id, waybill_number, waybill_date, issue_order_number, issue_order_date, temporary_job_reference } = req.body;

  try {
    await dbQuery.exec("BEGIN TRANSACTION");

    if (type === 'inflow') {
      const tx = await dbQuery.get("SELECT * FROM inflow_transactions WHERE id = ? AND created_by = ?", [req.params.id, req.user.id]);
      if (!tx || tx.approval_status !== 'Rejected') throw new Error("Rejected inflow not found or unauthorized");

      const finalQty = parseFloat(quantity);
      const finalPrice = parseFloat(unit_price);
      const totalValue = finalQty * finalPrice;
      const date = new Date().toISOString().split('T')[0];

      await dbQuery.run(
        `UPDATE inflow_transactions 
         SET material_id = ?, quantity = ?, unit_price = ?, total_value = ?, remarks = ?, reference_number = ?, job_id = ?, external_store_id = ?, 
             approval_status = 'Pending Approval', receipt_status = 'Pending', created_date = ?
         WHERE id = ?`,
        [material_id, finalQty, finalPrice, totalValue, remarks || '', reference_number || null, job_id || null, external_store_id || null, date, req.params.id]
      );
    } else {
      const tx = await dbQuery.get("SELECT * FROM outflow_transactions WHERE id = ? AND created_by = ?", [req.params.id, req.user.id]);
      if (!tx || tx.approval_status !== 'Rejected') throw new Error("Rejected outflow not found or unauthorized");

      const finalQty = parseFloat(quantity);
      const date = new Date().toISOString().split('T')[0];

      // Verify sufficient stock for outflow
      const bal = await dbQuery.get("SELECT quantity_on_hand FROM inventory_balances WHERE store_id = ? AND material_id = ?", [tx.store_id, material_id]);
      const currentQty = bal ? bal.quantity_on_hand : 0.0;
      if (currentQty < finalQty) {
        throw new Error(`Insufficient inventory balance. Available quantity: ${currentQty}`);
      }

      await dbQuery.run(
        `UPDATE outflow_transactions 
         SET material_id = ?, quantity = ?, remarks = ?, reference_number = ?, job_id = ?, external_store_id = ?, 
             waybill_number = ?, waybill_date = ?, issue_order_number = ?, issue_order_date = ?, temporary_job_reference = ?, 
             approval_status = 'Pending Approval', created_date = ?
         WHERE id = ?`,
        [material_id, finalQty, remarks || '', reference_number || null, job_id || null, external_store_id || null, waybill_number || null, waybill_date || null, issue_order_number || null, issue_order_date || null, temporary_job_reference || null, date, req.params.id]
      );
    }

    await notifyAllApprovers(
      "Resubmitted Rejected Transaction",
      `A rejected ${type} transaction (ID ${req.params.id}) has been corrected and resubmitted by ${req.user.username}.`
    );

    await dbQuery.exec("COMMIT");
    res.json({ message: 'Transaction successfully corrected and resubmitted for approval!' });
  } catch (err) {
    await dbQuery.exec("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  }
});

// GET Inflow Summarized Report
app.get('/api/reports/inflows-summary', authenticateToken, async (req, res) => {
  const { storeId, externalStoreId, inflowMethod } = req.query;
  if (!storeId) return res.status(400).json({ error: 'storeId is required' });

  try {
    const methods = ['Direct Purchase', 'Transfer', 'Return'];
    const summary = [];

    for (let method of methods) {
      if (inflowMethod && inflowMethod !== 'All' && inflowMethod !== method) {
        continue;
      }

      let q = `
        SELECT 
          SUM(CASE WHEN t.receipt_status = 'Pending' AND t.approval_status = 'Approved' THEN t.quantity ELSE 0 END) as pending_qty,
          SUM(CASE WHEN t.receipt_status = 'Confirmed' AND t.approval_status = 'Approved' THEN t.quantity ELSE 0 END) as confirmed_qty,
          SUM(CASE WHEN t.receipt_status = 'Rejected' AND t.approval_status = 'Approved' THEN t.quantity ELSE 0 END) as rejected_qty,
          SUM(CASE WHEN t.receipt_status = 'Received' AND t.approval_status = 'Approved' THEN t.quantity ELSE 0 END) as received_qty
        FROM inflow_transactions t
        WHERE t.store_id = ? AND t.inflow_method = ?
      `;
      const params = [storeId, method];
      if (externalStoreId && externalStoreId !== 'All' && method === 'Transfer') {
        q += ` AND t.external_store_id = ?`;
        params.push(externalStoreId);
      }

      const totals = await dbQuery.get(q, params);

      // Present stock balance of materials that were received under this inflow method
      let balQ = `
        SELECT COALESCE(SUM(ib.quantity_on_hand), 0.0) as present_stock
        FROM inventory_balances ib
        WHERE ib.store_id = ? AND ib.material_id IN (
          SELECT DISTINCT material_id 
          FROM inflow_transactions 
          WHERE store_id = ? AND inflow_method = ?
      `;
      const balParams = [storeId, storeId, method];
      if (externalStoreId && externalStoreId !== 'All' && method === 'Transfer') {
        balQ += ` AND external_store_id = ?`;
        balParams.push(externalStoreId);
      }
      balQ += `)`;

      const balResult = await dbQuery.get(balQ, balParams);

      summary.push({
        method,
        pending: totals.pending_qty || 0,
        confirmed: totals.confirmed_qty || 0,
        rejected: totals.rejected_qty || 0,
        received: totals.received_qty || 0,
        presentStock: balResult.present_stock || 0
      });
    }

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// REPORTS MODULE APIs (Section 15 alignment)
// ----------------------------------------------------

// 1. Inventory Balances Report (Section 15.1 alignment)
app.get('/api/reports/balances', authenticateToken, async (req, res) => {
  const { storeId } = req.query;
  try {
    let query = `
      SELECT ib.quantity_allocated, ib.quantity_on_hand, ib.unit_price, ib.value, m.code, m.name, m.uom, m.grade_code, s.name as store_name
      FROM inventory_balances ib
      JOIN materials m ON ib.material_id = m.id
      JOIN stores s ON ib.store_id = s.id
    `;
    const params = [];
    if (storeId) {
      query += ` WHERE ib.store_id = ?`;
      params.push(storeId);
    }
    query += ` ORDER BY m.code ASC`;

    const list = await dbQuery.all(query, params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Pending Issue Orders Report (Section 15.4 alignment)
app.get('/api/reports/pending-issue-orders', authenticateToken, async (req, res) => {
  try {
    const list = await dbQuery.all(`
      SELECT pio.*, s.name as store_name, m.code as material_code, m.name as material_name, m.uom, u.username as creator_name, j.job_number
      FROM pending_issue_orders pio
      JOIN stores s ON pio.store_id = s.id
      JOIN materials m ON pio.material_id = m.id
      LEFT JOIN users u ON pio.updated_by = u.id
      LEFT JOIN jobs j ON pio.job_id = j.id
      ORDER BY pio.id DESC
    `);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Material Inflows Report (Section 15.2 alignment)
app.get('/api/reports/inflows', authenticateToken, async (req, res) => {
  const { storeId, code, method, status, receiptStatus, externalStoreId } = req.query;
  try {
    let query = `
      SELECT t.*, s.name as store_name, m.code as material_code, m.name as material_name, m.uom, u.username as creator_name, j.job_number, ext.name as external_store_name
      FROM inflow_transactions t
      JOIN stores s ON t.store_id = s.id
      JOIN materials m ON t.material_id = m.id
      JOIN users u ON t.created_by = u.id
      LEFT JOIN jobs j ON t.job_id = j.id
      LEFT JOIN external_stores ext ON t.external_store_id = ext.id
      WHERE 1=1
    `;
    const params = [];
    if (storeId) { query += ` AND t.store_id = ?`; params.push(storeId); }
    if (code) { query += ` AND m.code = ?`; params.push(code); }
    if (method && method !== 'All') { query += ` AND t.inflow_method = ?`; params.push(method); }
    if (status) { query += ` AND t.approval_status = ?`; params.push(status); }
    if (receiptStatus) { query += ` AND t.receipt_status = ?`; params.push(receiptStatus); }
    if (externalStoreId && externalStoreId !== 'All') { query += ` AND t.external_store_id = ?`; params.push(externalStoreId); }

    query += ` ORDER BY t.id DESC`;
    const list = await dbQuery.all(query, params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Material Outflows Report (Section 15.3 alignment)
app.get('/api/reports/outflows', authenticateToken, async (req, res) => {
  const { storeId, code, method, jobNumber } = req.query;
  try {
    let query = `
      SELECT t.*, s.name as store_name, m.code as material_code, m.name as material_name, m.uom, u.username as creator_name, j.job_number
      FROM outflow_transactions t
      JOIN stores s ON t.store_id = s.id
      JOIN materials m ON t.material_id = m.id
      JOIN users u ON t.created_by = u.id
      LEFT JOIN jobs j ON t.job_id = j.id
      WHERE 1=1
    `;
    const params = [];
    if (storeId) { query += ` AND t.store_id = ?`; params.push(storeId); }
    if (code) { query += ` AND m.code = ?`; params.push(code); }
    if (method) { query += ` AND t.outflow_method = ?`; params.push(method); }
    if (jobNumber) { query += ` AND j.job_number = ?`; params.push(jobNumber); }

    query += ` ORDER BY t.id DESC`;
    const list = await dbQuery.all(query, params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Job-wise Material Report (Section 15.6 alignment)
app.get('/api/reports/job-materials', authenticateToken, async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'Job ID is required' });

  try {
    const job = await dbQuery.get("SELECT * FROM jobs WHERE id = ?", [jobId]);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Materials issued under normal approved Outflows
    const outflows = await dbQuery.all(`
      SELECT m.code, m.name, m.uom, SUM(t.quantity) as total_qty, t.outflow_method
      FROM outflow_transactions t
      JOIN materials m ON t.material_id = m.id
      WHERE t.job_id = ? AND t.approval_status = 'Approved'
      GROUP BY m.id, t.outflow_method
    `, [jobId]);

    // Materials returned back from the job site
    const returns = await dbQuery.all(`
      SELECT m.code, m.name, m.uom, SUM(t.quantity) as total_qty
      FROM inflow_transactions t
      JOIN materials m ON t.material_id = m.id
      WHERE t.job_id = ? AND t.inflow_method = 'Return' AND t.approval_status = 'Approved'
      GROUP BY m.id
    `, [jobId]);

    // Pending waybill items under the job
    const pendingWaybills = await dbQuery.all(`
      SELECT m.code, m.name, m.uom, SUM(pio.quantity) as total_qty
      FROM pending_issue_orders pio
      JOIN materials m ON pio.material_id = m.id
      WHERE pio.job_id = ? AND pio.issue_order_status = 'Pending'
      GROUP BY m.id
    `, [jobId]);

    res.json({ job, outflows, returns, pendingWaybills });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static assets from the client build
app.use(express.static(path.join(__dirname, 'client', 'dist')));

// Fallback to React SPA index.html for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PHM Material Management spec-aligned backend running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
