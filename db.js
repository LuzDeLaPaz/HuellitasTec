const mysql = require('mysql2');

// ── Conexión a TiDB Cloud (compatible con mysql2, requiere SSL obligatorio)
// Todas las credenciales vienen de variables de entorno definidas en Render
const pool = mysql.createPool({
  host:     process.env.DB_HOST,       // ej: gateway01.us-east-1.prod.aws.tidbcloud.com
  port:     parseInt(process.env.DB_PORT) || 4000,  // TiDB usa el puerto 4000, no 3306
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // TiDB Cloud SIEMPRE requiere SSL — sin esto la conexión es rechazada
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  },

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Pruebo la conexión al arrancar
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Error al conectar con TiDB Cloud:', err.message);
    console.error('   Verifica las variables de entorno DB_HOST, DB_USER, DB_PASSWORD y DB_NAME en Render.');
    return;
  }
  console.log('✅ Conectado a TiDB Cloud correctamente.');
  connection.release();
});

module.exports = pool;