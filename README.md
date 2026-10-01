# Sistema Interno H2O

Sistema de agenda para clínica veterinária / pet shop, com três setores (Banho e Tosa,
Clínica e Loja), pensado para rodar num servidor interno e ser acessado por
computadores e tablets na mesma rede.

- Front-end: HTML, CSS e JavaScript puro (sem frameworks)
- Back-end: Node.js + Express 5
- Banco: MySQL / MariaDB
- Voz: reconhecimento de comandos por voz no navegador (Chrome/Edge)

---

## 1. Instalação do zero (recomendado)

Use este caminho se é a primeira instalação, ou se quiser começar limpo depois de
tantas atualizações incrementais.

### 1.1. Pré-requisitos
- **Node.js** (18 ou mais novo — teste com `node -v` no terminal)
- **MySQL** ou **MariaDB** instalado e rodando
- Um cliente MySQL (MySQL Workbench, DBeaver, ou linha de comando)

### 1.2. Copiar os arquivos
Extraia este zip inteiro numa pasta fixa no servidor, por exemplo:
```
E:\H2O Interno\h2o-sistema\
```
**Importante:** quando for atualizar no futuro, substitua as pastas `backend\src`
e `frontend` **inteiras** (arrastando por cima), nunca arquivo por arquivo — isso
evita ficar com uma mistura de versões antigas e novas, que foi a causa da maioria
dos erros que apareceram nas rodadas de teste.

### 1.3. Banco de dados (do zero)
Se você **já tem** um banco `h2o_sistema` de tentativas anteriores e quer recomeçar
limpo, apague ele primeiro:
```sql
DROP DATABASE IF EXISTS h2o_sistema;
```
Depois rode o arquivo `database/schema.sql` inteiro no MySQL Workbench (File > Open
SQL Script, selecione o arquivo, execute com o raio ⚡). Ele cria o banco
`h2o_sistema`, todas as tabelas, e alguns dados de exemplo (um tutor, um pet e dois
agendamentos de hoje).

**Atenção ao charset:** se for rodar por linha de comando em vez do Workbench, use:
```
mysql -u root -p --default-character-set=utf8mb4 < schema.sql
```
(sem isso, nomes com acento tipo "João" podem salvar errado no banco).

### 1.4. Configurar o backend
Dentro da pasta `backend`, copie `.env.example` para um arquivo novo chamado `.env`
(sem `.example` no final — cuidado com o Bloco de Notas, que às vezes salva como
`.env.txt` escondendo a extensão real; ative "Extensões de nome de arquivo" no
Explorador do Windows pra conferir).

Edite o `.env` com os dados do seu MySQL:
```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha_aqui
DB_NAME=h2o_sistema
```

### 1.5. Instalar dependências e rodar
Ainda dentro de `backend`:
```
npm install
npm run dev
```
Deve aparecer: `H2O: http://localhost:3000`

Abra esse endereço no navegador. Na primeira execução, crie o usuário e senha
administrativos da Loja no próprio servidor; essa configuração inicial é restrita
ao acesso local. A tela **Criar** permite cadastrar usuários de Banho e Clínica;
usuários da Loja são criados pela conta principal em **🔐 Acessos**.
As tabelas de usuários e sessões, incluindo a separação entre conta principal e
acessos operacionais, são preparadas automaticamente ao iniciar o backend.

### 1.6. Deixar rodando sempre (pm2, opcional)
Pra não depender de deixar o terminal aberto:
```
npm install -g pm2
pm2 start src/server.js --name h2o
pm2 save
```
No Windows, `pm2 startup` não funciona; para subir sozinho com o Windows, use
adicionalmente:
```
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```
Para reiniciar depois de qualquer atualização: `pm2 restart h2o`.

### 1.7. Acesso pela rede (outros computadores e tablets)
O servidor já escuta em `0.0.0.0`, então não precisa mudar nada no código. Só:
1. Descubra o IP da máquina servidora: `ipconfig` (campo "Endereço IPv4", tipo `192.168.0.50`)
2. Libere a porta 3000 no Firewall do Windows (Firewall do Windows Defender >
   Configurações avançadas > Regras de Entrada > Nova Regra > Porta > TCP 3000)
3. Nos outros dispositivos, acesse `http://192.168.0.50:3000` (trocando pelo IP real)

---

## 2. O que o sistema faz hoje

### 2.1. Setores
- Cada setor tem usuário e senha próprios. No primeiro acesso, crie a conta
  principal da Loja. Na tela inicial, **Criar** permite cadastrar acessos de
  Banho e Clínica; o acesso **Administrador**, com permissões completas, e os
  acessos da Loja são criados pela conta principal em **🔐 Acessos**.
  Cadastros públicos estão limitados a 10 por endereço IP a cada 15 minutos.
  Nomes de usuário novos podem conter quaisquer caracteres, com até 40
  caracteres; senhas novas devem ter exatamente 8 letras minúsculas. Nomes e
  senhas antigos continuam aceitos no login; redefina senhas em **🔐 Acessos**
  quando necessário. As senhas são armazenadas como hashes, e as sessões expiram
  após 12 horas.
- A conta principal da **Loja** e o setor **Administrador** administram
  agendamentos, acessos, funcionários, bloqueios de horários e registros
  financeiros. Banho e Clínica acessam somente a própria agenda, atualizam o
  atendimento e encaminham entre setores; não podem criar agendamentos,
  gerenciar funcionários ou bloquear horários.
- Usuários operacionais da **Loja** podem consultar e administrar as agendas,
  editar atendimentos e registrar retiradas. Somente uma conta principal pode
  criar, redefinir ou desativar acessos e cadastrar funcionários. Crie outros
  acessos completos selecionando o setor **Administrador** em **🔐 Acessos**.
  Mantenha ao menos um acesso principal ativo; essa distinção é mantida pelo
  campo `auth_users.is_admin`.
- **🏪 Loja**: as abas **🛁 Agenda Banho** e **🩺 Agenda Clínica** mostram as duas
  agendas e permitem criar horários para o setor selecionado. A Loja também reúne
  os avisos de retirada e os finalizados.
- **🛁 Banho e Tosa** e **🩺 Clínica**: cada usuário acessa somente a agenda do seu
  setor. O botão de criar horário fica exclusivamente na Loja.
- Qualquer pet
  liberado no Banho ou na Clínica aparece aqui automaticamente (a lista se
  atualiza a cada 5 segundos), pra avisar o cliente que já pode retirar. Dentro
  da Loja, as abas **Aguardando retirada** e **Finalizados** reúnem atendimentos
  dos dois setores; os finalizados são os que já foram retirados.

### 2.2. Cores da agenda
- 🟡 Amarelo = horário livre
- 🔴 Vermelho = aguardando
- 🟣 Roxo = encaminhado
- 🔵 Azul = em andamento
- 🟢 Verde = liberado
- ⚪ Cinza = horário bloqueado manualmente

### 2.3. Cadastro rápido
No formulário de "Novo agendamento", os botões "＋ novo" ao lado de Tutor e Pet
abrem um cadastro rápido sem precisar sair da tela.

### 2.4. Bloquear horários
Em qualquer horário livre (Banho ou Clínica), o botão "🔒 Bloquear" fecha aquele
horário (com motivo opcional — pausa, feriado, manutenção). "🔓 Reabrir" libera de
novo.

### 2.5. Desmarcação e reagendamento
Nas agendas de Banho e Clínica, a opção **🚫 Cliente desmarcou** mantém o
agendamento no dia original, no fim da lista e em rosa claro. Pelo calendário,
também é possível criar um novo horário em outra data: o registro desmarcado mostra
para qual dia foi reagendado, e o novo horário indica a data de origem. A opção de
excluir não aparece nas agendas.

### 2.6. Encaminhamento entre Banho e Clínica
O botão "🚨 Encaminhar" existe nas duas agendas. Ao encaminhar, o sistema:
- Registra o alerta sem criar outro agendamento. Na agenda de destino, ele aparece
  como uma mini-aba roxa sobre o horário original, ao lado do agendamento que já
  existe; as mini-abas podem ser selecionadas para alternar a visualização.
- Marca o agendamento de origem em vermelho ("Encaminhado") até o alerta ser
  marcado como lido na aba 🚨 Alertas
- O alerta pode ser sinalizado pelo pop-up, pelo histórico de Alertas ou na
  mini-aba do encaminhamento recebido
- Encaminhamentos pendentes e pets liberados no Banho ou na Clínica aparecem em
  um pop-up sobre a tela e tocam uma sirene; encaminhamentos podem ser sinalizados
  no pop-up e a Loja pode aceitar a chegada por ali sem marcar o pet como retirado.
  O navegador exige interação para liberar o áudio; ao abrir o sistema,
  clique/toque uma vez na tela ou use **Ativar sirene** no pop-up.

### 2.7. Pagamento e retirada
Cada agendamento (Banho ou Clínica) tem dois checkboxes independentes:
💰 **Pago** e ✅ **Retirado**. Quando o status vira "Liberado", ele entra
automaticamente na agenda da Loja. Aceitar o aviso no pop-up confirma o recebimento
pela Loja; o item continua em **Aguardando retirada** até ser marcado como retirado.

### 2.8. Funcionários
Botão **👤 Funcionários** no topo abre uma tela para cadastrar/remover
funcionários, com listas separadas para Banho e Clínica. Cada agendamento tem uma
caixa de seleção para escolher quem atendeu — o nome aparece direto na linha da
agenda. Remover um funcionário não apaga nenhum agendamento, só tira a atribuição.

### 2.8. Cronômetro do Banho
Quando um agendamento do Banho entra em "Em andamento", aparece um cronômetro
(⏱ mm:ss) contando ao vivo na tela, para controle de quanto tempo cada banho está
levando. Só existe no Banho (não na Clínica).

### 2.9. Comandos de voz
Botão **🎙️ Voz** no canto superior direito. Clique, fale o comando e o sistema
executa. Comandos reconhecidos (funciona com frases naturais, não precisa ser
exato):
| Diga algo como... | Ação |
|---|---|
| "Banho e tosa" | Abre a agenda do Banho |
| "Clínica" | Abre a agenda da Clínica |
| "Loja" | Abre a Loja |
| "Novo agendamento" / "Agendar" | Abre o formulário de novo agendamento |
| "Funcionários" | Abre a tela de funcionários |
| "Alertas" | Abre a tela de alertas |
| "Fechar" / "Cancelar" | Fecha a tela/formulário aberto |
| "Salvar" / "Confirmar" | Envia o formulário aberto no momento |

O sistema também **responde falando** (usa a voz do próprio navegador) para
confirmar o que entendeu. Funciona em Chrome e Edge; no tablet Android, use o
Chrome. Se o navegador não suportar, aparece um aviso ao clicar no botão.

---

## 3. Se você já tem uma instalação rodando (atualização incremental)

Se preferir não recriar o banco do zero, os scripts de migração em `database/`
podem ser rodados em ordem, um de cada vez — cada um só adiciona o que falta,
sem apagar dados:
1. `migration_04_bloqueios.sql` — horários bloqueados
2. `migration_05_pagamento_retirada.sql` — pago / retirado
3. `migration_06_encaminhamento_real.sql` — encaminhamento como agendamento real
4. `migration_07_funcionarios.sql` — funcionários e cronômetro

Se rodar um deles e aparecer erro de "Duplicate" (coluna ou tabela já existe), é
sinal de que aquela migração específica já tinha sido aplicada antes — pode
ignorar esse erro e seguir para a próxima.

**De novo:** ao atualizar o código, troque as pastas `backend/src` e `frontend`
inteiras, nunca arquivo por arquivo.

---

## 4. Resolução de problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `npm error... package.json` | Rodou `npm` na pasta errada | Entre em `backend` antes: `cd backend` |
| `Access denied for user ''@'localhost'` | `.env` não existe, tem nome errado (`.env.txt`, `.env.env`) ou está vazio | Confira com `dir /a` dentro de `backend`; recrie o `.env` a partir do `.env.example` |
| `Cannot PATCH /api/agendamentos/ID/loja` ou `Servidor não retornou JSON (404)` ao salvar dados da Loja | O front-end atualizado está chamando a rota da Loja, mas o processo do backend ainda está usando uma versão antiga sem essa rota | Copie as pastas `backend/src` e `frontend` atualizadas para a instalação em execução e reinicie o backend (`npm run dev` ou `pm2 restart h2o`). Depois, recarregue a página com `Ctrl+Shift+R` |
| `Campo inválido` ao clicar em **Aceitar na Loja** | O backend em execução ainda não reconhece a confirmação de recebimento pela Loja | Atualize `backend/src/routes/agendamentos.routes.js` e `backend/src/config/database.js` no servidor, reinicie o backend (`npm run dev` ou `pm2 restart h2o`) e recarregue a página com `Ctrl+Shift+R` |
| `Unexpected token '<', "<!DOCTYPE"...` no Console | O front-end pediu algo em uma rota que devolveu a página HTML em vez de JSON — geralmente porque um arquivo do **backend** não foi atualizado junto com os do frontend | Substitua as pastas `backend/src` e `frontend` inteiras, reinicie o servidor |
| `Table 'h2o_sistema.xxx' doesn't exist` / `Unknown column` | O banco não tem a tabela/coluna mais nova | Rode `database/schema.sql` do zero (veja seção 1.3) ou a migração específica que falta (seção 3) |
| Campo Horário do formulário vem vazio | Alguma chamada de dados falhou (geralmente ligado ao erro acima) — a partir desta versão o próprio campo mostra a mensagem de erro em vez de ficar em branco | Leia a mensagem de erro que aparece dentro do próprio campo |
| `pm2` não é reconhecido | Ainda não foi instalado, ou o terminal não foi reaberto depois de instalar | `npm install -g pm2`, feche e reabra o terminal |
| Agendamento salvo não aparece na tela | Foi criado com um horário fora da grade de 30 em 30 minutos (só podia acontecer na versão antiga do formulário, que usava campo de hora livre) | A partir desta versão o campo é uma lista fixa, não deixa mais escolher horário inválido |

Sempre que travar em algo que não está nessa lista: aperte **F12** no navegador,
vá na aba **Console**, dê **Ctrl+Shift+R** para recarregar sem cache, e veja a
mensagem de erro em vermelho — ela quase sempre diz exatamente o que está
faltando.
