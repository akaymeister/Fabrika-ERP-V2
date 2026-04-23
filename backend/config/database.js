/**
 * MySQL connection pool. Tek giriş noktası; tüm sorgular buradan.
 * PostgreSQL alternatifi: JSON/UUID, zengin indeks, gelişmiş locking —
 * mevcut proje MySQL ile uyumlu olsun diye MySQL tercih edildi.
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  namedPlaceholders: true,
  dateStrings: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

module.exports = { pool };
