-- Rode este script no MySQL do servidor que JÁ TEM o banco h2o_sistema criado.
-- Ele só adiciona a tabela nova de horários bloqueados — não mexe em nada existente,
-- então pode rodar sem medo de duplicar tutores/pets/agendamentos.

USE h2o_sistema;

CREATE TABLE IF NOT EXISTS horarios_bloqueados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data DATE NOT NULL,
  horario TIME NOT NULL,
  setor ENUM('BANHO','CLINICA','LOJA') NOT NULL,
  motivo VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_bloqueio (data, horario, setor)
);
