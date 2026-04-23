/**
 * HTTP sunucusu + başlangıç sağlık kontrolü.
 */
require('dotenv').config();
const { app } = require('./app');
const { pool } = require('./config/database');

const port = Number(process.env.PORT) || 3000;

async function start() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[server] MySQL bağlantısı kurulamadı. .env ve veritabanı bilgilerini kontrol edin.');
    // eslint-disable-next-line no-console
    console.error(e.message);
    process.exit(1);
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[Fabrika ERP V2] http://127.0.0.1:${port}  (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
  });
}

start();
