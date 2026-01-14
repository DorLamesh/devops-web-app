const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');
const { jsonLogger, actionLogger } = require('./logger');
const mysql = require('mysql2/promise');

const app = express();
app.use(bodyParser.json());
// Allow cross-origin requests from frontend (localhost:3000)
app.use(cors({ origin: ['http://localhost:3000'] }));

function getIp(req){
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if(!username || !password) return res.status(400).json({ error: 'username and password required' });
  try{
    const [rows] = await pool.query('SELECT id, username, password_hash FROM users WHERE username = ? OR email = ?', [username, username]);
    if(rows.length === 0) return res.status(401).json({ error: 'invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if(!ok) return res.status(401).json({ error: 'invalid credentials' });
    const token = uuidv4();
    await pool.query('INSERT INTO tokens (token, user_id, created_at) VALUES (?, ?, NOW())', [token, user.id]);

    // Log login action (structured JSON)
    jsonLogger.json({ timestamp: new Date().toISOString(), user_id: user.id, action: 'login', ip: getIp(req) });
    actionLogger.info(JSON.stringify({ timestamp: new Date().toISOString(), user_id: user.id, action: 'login', ip: getIp(req) }));

    res.json({ token });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Signup route: create a new user and return a token
app.post('/signup', async (req, res) => {
  const { username, email, password, custom } = req.body || {};
  // simple validation
  if(!username || !password) return res.status(400).json({ error: 'username and password required' });

  // password rules: min 8 chars, at least one letter and one number
  const minLen = 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if(password.length < minLen || !hasLetter || !hasNumber){
    return res.status(400).json({ error: `password must be at least ${minLen} characters and include letters and numbers` });
  }

  // if client requests custom rule, require at least one special char
  if(custom === true || String(custom) === 'true'){
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if(!hasSpecial) return res.status(400).json({ error: 'password must include at least one special character when custom rule is enabled' });
  }

  try{
    // check uniqueness
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email || username]);
    if(existing.length > 0) return res.status(409).json({ error: 'username or email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email || null, hash]);
    const userId = result.insertId;

    // issue token and store
    const token = uuidv4();
    await pool.query('INSERT INTO tokens (token, user_id, created_at) VALUES (?, ?, NOW())', [token, userId]);

    jsonLogger.json({ timestamp: new Date().toISOString(), user_id: userId, action: 'signup', ip: getIp(req) });
    actionLogger.info(JSON.stringify({ timestamp: new Date().toISOString(), user_id: userId, action: 'signup', ip: getIp(req) }));

    res.json({ token });
  }catch(err){
    console.error('signup error', err);
    res.status(500).json({ error: 'server error' });
  }
});

// Protected endpoint example
app.get('/profile', async (req, res) => {
  const token = req.headers['x-auth-token'];
  if(!token) return res.status(401).json({ error: 'missing token' });
  try{
    const [rows] = await pool.query('SELECT u.id, u.username, u.email FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?', [token]);
    if(rows.length === 0) return res.status(401).json({ error: 'invalid token' });
    res.json({ user: rows[0] });
    if(rows.length > 0){
      actionLogger.info(JSON.stringify({ timestamp: new Date().toISOString(), user_id: rows[0].id, action: 'profile_view', ip: getIp(req) }));
    }
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Admin: list all users (protected — only admin user allowed)
app.get('/admin/users', async (req, res) => {
  const token = req.headers['x-auth-token'];
  if(!token) return res.status(401).json({ error: 'missing token' });
  try{
    const [trows] = await pool.query('SELECT u.id, u.username, u.email FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?', [token]);
    if(trows.length === 0) return res.status(401).json({ error: 'invalid token' });
    const caller = trows[0];
    // simple admin check: username === 'admin'
    if(caller.username !== 'admin') return res.status(403).json({ error: 'forbidden' });

    const [rows] = await pool.query('SELECT id, username, email, created_at FROM users');
    res.json({ users: rows });
    actionLogger.info(JSON.stringify({ timestamp: new Date().toISOString(), user_id: caller.id, action: 'admin_users_list', ip: getIp(req) }));
  }catch(err){
    console.error('admin/users error', err);
    res.status(500).json({ error: 'server error' });
  }
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
async function ensureDatabase(){
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 4000;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  try{
    // connect without database to ensure it exists
    const conn = await mysql.createConnection({ host, port, user, password });
    await conn.query('CREATE DATABASE IF NOT EXISTS appdb');
    await conn.end();

    // ensure tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tokens (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(255) UNIQUE,
        user_id BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // create default user if missing
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', ['admin']);
    if(rows.length === 0){
      const defaultPass = process.env.DEFAULT_ADMIN_PASSWORD || 'password1';
      const hash = await require('bcrypt').hash(defaultPass, 10);
      await pool.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', ['admin', 'admin@example.com', hash]);
      console.log('Default user created: admin');
    }
  }catch(err){
    console.error('Error ensuring database/tables:', err);
    // Do not exit; let server start and report errors on requests
  }
}

(async ()=>{
  await ensureDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend listening on ${PORT}`);
  });
})();
