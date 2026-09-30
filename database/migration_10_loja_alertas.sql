USE h2o_sistema;

-- Atualiza bancos já existentes sem apagar agendamentos.
-- Campos de valores presentes nas versões atuais.
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agendamentos' AND COLUMN_NAME='valor_total')=0,
  'ALTER TABLE agendamentos ADD COLUMN valor_total DECIMAL(10,2) NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agendamentos' AND COLUMN_NAME='valor_transporte')=0,
  'ALTER TABLE agendamentos ADD COLUMN valor_transporte DECIMAL(10,2) NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agendamentos' AND COLUMN_NAME='loja_observacoes')=0,
  'ALTER TABLE agendamentos ADD COLUMN loja_observacoes TEXT NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agendamentos' AND COLUMN_NAME='loja_produtos')=0,
  'ALTER TABLE agendamentos ADD COLUMN loja_produtos TEXT NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agendamentos' AND COLUMN_NAME='loja_valor')=0,
  'ALTER TABLE agendamentos ADD COLUMN loja_valor DECIMAL(10,2) NULL DEFAULT 0',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='alertas_clinica' AND COLUMN_NAME='sinalizado')=0,
  'ALTER TABLE alertas_clinica ADD COLUMN sinalizado BOOLEAN DEFAULT FALSE',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Compatibilidade com campos que versões anteriores do sistema já utilizam.
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agendamentos' AND COLUMN_NAME='vacina_qual')=0,
  'ALTER TABLE agendamentos ADD COLUMN vacina_qual VARCHAR(150) NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agendamentos' AND COLUMN_NAME='exame_qual')=0,
  'ALTER TABLE agendamentos ADD COLUMN exame_qual VARCHAR(150) NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agendamentos' AND COLUMN_NAME='outro_servico_qual')=0,
  'ALTER TABLE agendamentos ADD COLUMN outro_servico_qual VARCHAR(150) NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
