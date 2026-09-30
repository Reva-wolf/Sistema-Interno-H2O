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
  await ensureColumn('alertas_clinica', 'sinalizado', 'BOOLEAN DEFAULT FALSE');
}

module.exports = pool;
module.exports.ensureSchemaCompatibility = ensureSchemaCompatibility;
