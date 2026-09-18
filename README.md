# Sistema Interno H2O — Consolidado (Partes 1–3)

Sistema integrado de Agenda, Banho e Tosa e Clínica.

## Stack
- Front-end: HTML, CSS e JavaScript puro
- Back-end: Node.js + Express 5
- Banco: MySQL
- Preparado para acesso por Windows e Android na mesma rede

## Estrutura
- `frontend/` — interface (agenda, cadastro de tutores/pets, alertas)
- `backend/` — API REST (Express)
- `database/schema.sql` — script único com todas as tabelas (tutores, pets, agendamentos, alertas_clinica) e dados de exemplo

## Instalação
1. No terminal, entre em `backend` e instale as dependências:
   ```bash
   npm install
   ```
2. Copie `.env.example` para `.env` e ajuste usuário/senha do MySQL.
3. Execute `database/schema.sql` no MySQL (cria o banco `h2o_sistema` e já inclui a tabela de alertas da Parte 3).
4. Inicie o servidor:
   ```bash
   npm run dev
   ```
5. Acesse: `http://localhost:3000`

Para acessar de outro computador/tablet na mesma rede local, use o IP da máquina servidora em vez de `localhost` (o servidor já escuta em `0.0.0.0`).

## O que foi corrigido nesta revisão
- **Bug crítico:** `app.get('*', ...)` no `server.js` quebrava o servidor (erro `Missing parameter name`) porque o Express 5 não aceita mais curinga `'*'` sem nome de parâmetro. Corrigido para `app.get('/*splat', ...)`, sintaxe válida no Express 5. Sem esse ajuste, o servidor nem chegava a subir.
- Removida a rota antiga `agenda.routes.js` (Parte 1), que ficou duplicada e sem uso depois que `agendamentos.routes.js` (Parte 2/3) assumiu o mesmo papel com filtro por setor.
- Unificado `schema.sql` + `patch_03.sql` em um único script, para não precisar rodar dois arquivos na ordem certa.
- Corrigido texto do alerta de voz, que estava com barras invertidas duplicadas (`\\n\\n` viraria texto literal em vez de quebra de linha).
- Ligados os botões "＋ novo" de Tutor e Pet (existiam no HTML, mas não tinham nenhum código JavaScript conectado — cliques não faziam nada).
- Adicionado middleware de erro no backend: qualquer falha (ex: banco fora do ar, credenciais erradas) agora volta como JSON, nunca mais como página HTML quebrada.
- Adicionado `charset: 'utf8mb4'` na conexão do banco, para evitar acentuação corrompida (ex: "João" virando "JoÃ£o") quando o `schema.sql` é importado por um cliente com charset diferente.

## Parte 4: cores da agenda, bloqueio de horários e encaminhamento cruzado
- **Cores:** Livre = 🟡 amarelo · Aguardando = 🔴 vermelho · Em andamento = 🔵 azul · Liberado = 🟢 verde · Bloqueado = ⚪ cinza.
- **Bloquear horário:** em qualquer horário livre (Banho ou Clínica), o botão "🔒 Bloquear" fecha aquele horário (com motivo opcional). O botão "🔓 Reabrir" libera de novo. Útil para pausas, feriados, manutenção etc.
- **Encaminhamento cruzado:** o botão "🚨 Encaminhar" agora existe tanto no Banho quanto na Clínica. Ao encaminhar, o agendamento de origem fica vermelho ("Encaminhado") em ambas as telas — mesmo sendo agendamentos diferentes — até alguém marcar o alerta como lido na aba 🚨 Alertas.
- Banco: nova tabela `horarios_bloqueados` (só adiciona, não mexe nas tabelas existentes). Se você **já tem o banco criado**, rode `database/migration_04_bloqueios.sql`.

## Parte 5: pagamento, retirada e aviso automático na Loja
- Nas agendas de **Banho** e **Clínica**, cada agendamento agora tem dois checkboxes: **💰 Pago** e **✅ Retirado**, marcados independentemente.
- Quando um agendamento (Banho ou Clínica) fica **Liberado**, ele aparece automaticamente na aba **🏪 Loja** — não como uma grade de horários, mas como uma lista simples de "avisar cliente" (pet, tutor, telefone, de onde veio, se já está pago).
- Marcando **"✅ Cliente avisado / Retirado"** na Loja, o item some da lista (mas o agendamento de origem continua no histórico do Banho/Clínica, só que marcado como retirado).
- Banco: mais duas colunas em `agendamentos` (`pago`, `retirado`). Se você **já tem o banco criado**, rode `database/migration_05_pagamento_retirada.sql`. Se for instalação nova, `database/schema.sql` já vem completo com tudo (Partes 1 a 5).

## Parte 6: encaminhamento vira um atendimento de verdade
- Antes, encaminhar de Banho pra Clínica (ou vice-versa) só deixava um aviso. Agora **cria um agendamento de verdade no setor de destino**, no mesmo horário se estiver livre — ou automaticamente no próximo horário livre do dia, se já tiver algo marcado ali (sem sobrescrever nada).
- Esse novo agendamento tem status normal (Aguardando → Em andamento → Liberado), checkboxes de Pago/Retirado, e mostra uma etiqueta "🔄 Encaminhado do Banho/da Clínica" pra deixar claro de onde veio.
- Continua ficando vermelho e marcado "Encaminhado" enquanto ninguém dá baixa no alerta (aba 🚨 Alertas).
- Banco: mais uma coluna em `agendamentos` (`origem_agendamento_id`). Se você **já tem o banco criado**, rode `database/migration_06_encaminhamento_real.sql`.

## Próximas partes
- Usuários e permissões (login por funcionário)
- Comandos de voz nos tablets
- Expandir o módulo Loja (vendas avulsas, produtos)
