const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function init(){
  try{
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 4000;
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';

    // Create a short-lived connection without specifying a database so we can
    // ensure the database exists before creating a pool that connects to it.
    const conn = await mysql.createConnection({ host, port, user, password });
    await conn.query('CREATE DATABASE IF NOT EXISTS appdb');
    await conn.end();

    // Require the pool (which expects the database to exist) after creating DB.
    const pool = require('./db');

    // Ensure we're using the database
    await pool.query('USE appdb');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    // Create tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tokens (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(255) UNIQUE,
        user_id BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    // Insert default user if not exists
    const defaultUser = 'admin';
    const defaultEmail = 'admin@example.com';
    const defaultPass = 'password';
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [defaultUser]);
    if(rows.length === 0){
      const hash = await bcrypt.hash(defaultPass, 10);
      await pool.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [defaultUser, defaultEmail, hash]);
      console.log('Default user created:', defaultUser);
    } else {
      console.log('Default user exists');
    }

    console.log('DB init complete');
    process.exit(0);
  }catch(err){
    console.error('DB init failed', err);
    process.exit(1);
  }
}

init();
