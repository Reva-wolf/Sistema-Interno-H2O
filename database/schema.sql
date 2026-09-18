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

CREATE TABLE IF NOT EXISTS agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data DATE NOT NULL,
  horario TIME NOT NULL,
  tutor_id INT NOT NULL,
  pet_id INT NOT NULL,
  setor ENUM('BANHO','CLINICA','LOJA') NOT NULL,
  origem_agendamento_id INT NULL,
  servico VARCHAR(100) NOT NULL,
  especie ENUM('CAO','GATO') NOT NULL,
  status ENUM('AGENDADO','ANDAMENTO','LIBERADO','CANCELADO') DEFAULT 'AGENDADO',
  pago BOOLEAN DEFAULT FALSE,
  retirado BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ag_tutor FOREIGN KEY (tutor_id) REFERENCES tutores(id),
  CONSTRAINT fk_ag_pet FOREIGN KEY (pet_id) REFERENCES pets(id),
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
