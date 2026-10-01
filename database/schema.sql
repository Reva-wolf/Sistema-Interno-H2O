CREATE DATABASE IF NOT EXISTS h2o_sistema
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE h2o_sistema;

CREATE TABLE IF NOT EXISTS tutores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  telefone VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tutor_id INT NOT NULL,
  nome VARCHAR(80) NOT NULL,
  especie ENUM('CAO','GATO') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pet_tutor FOREIGN KEY (tutor_id) REFERENCES tutores(id)
);

CREATE TABLE IF NOT EXISTS funcionarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  setor ENUM('BANHO','CLINICA') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(40) NOT NULL UNIQUE,
  password_hash CHAR(128) NOT NULL,
  password_salt CHAR(32) NOT NULL,
  setor ENUM('LOJA','BANHO','CLINICA','ADMINISTRADOR') NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  INDEX idx_auth_session_expiry (expires_at)
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data DATE NOT NULL,
  horario TIME NOT NULL,
  tutor_id INT NOT NULL,
  pet_id INT NOT NULL,
  setor ENUM('BANHO','CLINICA','LOJA') NOT NULL,
  origem_agendamento_id INT NULL,
  funcionario_id INT NULL,
  servico VARCHAR(100) NOT NULL,
  especie ENUM('CAO','GATO') NOT NULL,
  status ENUM('AGENDADO','ANDAMENTO','LIBERADO','CANCELADO') DEFAULT 'AGENDADO',
  iniciado_em DATETIME NULL,
  finalizado_em DATETIME NULL,
  pago BOOLEAN DEFAULT FALSE,
  retirado BOOLEAN DEFAULT FALSE,
  desmarcado BOOLEAN DEFAULT FALSE,
  remarcado_de DATE NULL,
  remarcado_para DATE NULL,
  valor_total DECIMAL(10,2) NULL,
  valor_transporte DECIMAL(10,2) NULL,
  tipo_th BOOLEAN DEFAULT FALSE,
  tipo_tt BOOLEAN DEFAULT FALSE,
  tipo_medicamentoso BOOLEAN DEFAULT FALSE,
  medicamento VARCHAR(150) NULL,
  levado_transporte BOOLEAN DEFAULT FALSE,
  anotado BOOLEAN DEFAULT FALSE,
  vacina BOOLEAN DEFAULT FALSE,
  vacina_qual VARCHAR(150) NULL,
  exame BOOLEAN DEFAULT FALSE,
  exame_qual VARCHAR(150) NULL,
  outro_servico BOOLEAN DEFAULT FALSE,
  outro_servico_qual VARCHAR(150) NULL,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ag_tutor FOREIGN KEY (tutor_id) REFERENCES tutores(id),
  CONSTRAINT fk_ag_pet FOREIGN KEY (pet_id) REFERENCES pets(id),
  CONSTRAINT fk_ag_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE SET NULL,
  INDEX idx_agenda_data_setor (data, setor),
  INDEX idx_agenda_horario (data, horario)
);

INSERT INTO tutores (nome, telefone) VALUES
('João da Silva', '(54) 99999-0000'),
('Maria Oliveira', '(54) 98888-0000');

INSERT INTO pets (tutor_id, nome, especie) VALUES
(1, 'Thor', 'CAO'),
(2, 'Mel', 'GATO');

INSERT INTO agendamentos
(data, horario, tutor_id, pet_id, setor, servico, especie, status, observacoes)
VALUES
(CURDATE(), '08:00:00', 1, 1, 'BANHO', 'Banho + Tosa', 'CAO', 'ANDAMENTO', NULL),
(CURDATE(), '08:30:00', 2, 2, 'CLINICA', 'Consulta', 'GATO', 'AGENDADO', NULL);

-- Parte 3: tabela de alertas da Bath&Tosa para a Clínica
CREATE TABLE IF NOT EXISTS alertas_clinica (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agendamento_id INT NOT NULL,
  mensagem TEXT NOT NULL,
  lido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alerta_agendamento
    FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id)
    ON DELETE CASCADE,
  INDEX idx_alerta_lido (lido)
);

-- Parte 4: horários fechados/bloqueados (pausa, feriado, manutenção etc.)
CREATE TABLE IF NOT EXISTS horarios_bloqueados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data DATE NOT NULL,
  horario TIME NOT NULL,
  setor ENUM('BANHO','CLINICA','LOJA') NOT NULL,
  motivo VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_bloqueio (data, horario, setor)
);
