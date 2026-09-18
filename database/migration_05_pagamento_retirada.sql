-- Rode este script no MySQL do servidor que JÁ TEM o banco h2o_sistema criado.
-- Adiciona duas colunas na tabela agendamentos (pago e retirado) — não apaga nem duplica nada.

USE h2o_sistema;

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS pago BOOLEAN DEFAULT FALSE AFTER status,
  ADD COLUMN IF NOT EXISTS retirado BOOLEAN DEFAULT FALSE AFTER pago;
