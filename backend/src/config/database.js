const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function ensureColumn(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [table, column]
  );

  if (Number(rows[0].total) === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[H2O] Coluna criada automaticamente: ${table}.${column}`);
  }
}

async function ensureSchemaCompatibility() {
  // Mantém bancos já existentes compatíveis com versões novas do sistema.
  await ensureColumn('agendamentos', 'valor_total', 'DECIMAL(10,2) NULL');
  await ensureColumn('agendamentos', 'valor_transporte', 'DECIMAL(10,2) NULL');
  await ensureColumn('agendamentos', 'vacina_qual', 'VARCHAR(150) NULL');
  await ensureColumn('agendamentos', 'exame_qual', 'VARCHAR(150) NULL');
  await ensureColumn('agendamentos', 'outro_servico_qual', 'VARCHAR(150) NULL');
  await ensureColumn('agendamentos', 'loja_observacoes', 'TEXT NULL');
  await ensureColumn('agendamentos', 'loja_produtos', 'TEXT NULL');
  await ensureColumn('agendamentos', 'loja_valor', 'DECIMAL(10,2) NULL DEFAULT 0');
  await ensureColumn('agendamentos', 'loja_aceito', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn('agendamentos', 'remarcado_de', 'DATE NULL');
  await ensureColumn('agendamentos', 'remarcado_para', 'DATE NULL');
  await ensureColumn('alertas_clinica', 'sinalizado', 'BOOLEAN DEFAULT FALSE');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(40) NOT NULL UNIQUE,
      password_hash CHAR(128) NOT NULL,
      password_salt CHAR(32) NOT NULL,
      setor ENUM('LOJA','BANHO','CLINICA','ADMINISTRADOR') NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [[setorColumn]] = await pool.query(`
    SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'auth_users'
       AND COLUMN_NAME = 'setor'
  `);
  if (!String(setorColumn.COLUMN_TYPE).includes("'ADMINISTRADOR'")) {
    await pool.query(
      "ALTER TABLE auth_users MODIFY COLUMN setor ENUM('LOJA','BANHO','CLINICA','ADMINISTRADOR') NOT NULL"
    );
  }
  await ensureColumn('auth_users', 'is_admin', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await pool.query("UPDATE auth_users SET is_admin=1 WHERE setor='ADMINISTRADOR'");
  const [[admin]] = await pool.query(
    'SELECT id FROM auth_users WHERE is_admin=1 AND active=1 LIMIT 1'
  );
  if (!admin) {
    const [[firstLojaUser]] = await pool.query(
      "SELECT id FROM auth_users WHERE setor='LOJA' AND active=1 ORDER BY id LIMIT 1"
    );
    if (firstLojaUser) {
      await pool.query('UPDATE auth_users SET is_admin=1 WHERE id=?', [firstLojaUser.id]);
      console.log(`[H2O] Acesso principal da Loja atribuído ao usuário ${firstLojaUser.id}`);
    }
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id INT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
      INDEX idx_auth_session_expiry (expires_at)
    )
  `);
  await pool.query('DELETE FROM auth_sessions WHERE expires_at<=NOW()');
}

module.exports = pool;
module.exports.ensureSchemaCompatibility = ensureSchemaCompatibility;
