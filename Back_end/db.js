// db.js
const mysql = require('mysql2/promise');

let pool;

async function createPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'db',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Roginha123',
      database: process.env.DB_NAME || 'postosdb',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

module.exports = { createPool };
