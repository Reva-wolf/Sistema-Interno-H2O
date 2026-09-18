-- Rode este script no MySQL do servidor que JÁ TEM o banco h2o_sistema criado.
-- Adiciona uma coluna em agendamentos para saber que um agendamento nasceu
-- de um encaminhamento vindo de outro setor (Banho <-> Clínica).

USE h2o_sistema;

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS origem_agendamento_id INT NULL AFTER setor;
