const $=id=>document.getElementById(id);
let setor='BANHO';
let setorAberto=false;
let lojaVisao='AGENDA_BANHO';
let authUser=null;
let authSetupRequired=false;
let authStatusTimer=null;
const data=$('data'), fdata=$('fdata'), lista=$('lista');
const usuarioTemAcessoLoja=user=>user?.setor==='LOJA'||user?.isAdmin===true;
const horarios=['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00'];
let alertasPendentes=[];
let liberacoesPendentes=[];
let carregarAlertasEmAndamento=false;
let audioSirene=null, osciladorSirene=null, ganhoSirene=null, intervaloSirene=null, sireneAtivada=false, frequenciaAlta=false, assinaturaAlertas='', assinaturaEncaminhamentosAgenda='', assinaturaAvisosLoja='';
data.value=new Date().toISOString().slice(0,10); fdata.value=data.value;

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000'
 : /:(?:4173|5500|5501|5173)$/i.test(window.location.host) ? `${window.location.protocol}//${window.location.hostname}:3000` : '';
async function api(url,opt){
 const r=await fetch(API_BASE+url,{...opt,credentials:'include'});
 const text=await r.text();
 let j;
 try{ j=JSON.parse(text); }
 catch(e){
   const preview=text.replace(/\s+/g,' ').slice(0,160);
   throw Error(`Servidor não retornou JSON (${r.status}). Resposta: ${preview}`);
 }
 if(!r.ok){
  if(r.status===401&&authUser&&!url.startsWith('/api/auth/')){
   authUser=null;
   mostrarTelaAutenticacao('Sua sessão expirou. Entre novamente.');
  }
  throw Error(j.erro||j.error||`Erro HTTP ${r.status}`);
 }
 return j;
}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function moeda(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function formatarDataAgenda(valor){
 const partes=String(valor||'').slice(0,10).split('-');
 return partes.length===3?`${partes[2]}/${partes[1]}/${partes[0]}`:'';
}
function mostrarTelaAutenticacao(mensagem=''){
 clearInterval(authStatusTimer);
 setorAberto=false;
 document.querySelectorAll('.modal:not(.hidden)').forEach(modal=>modal.classList.add('hidden'));
 $('alertPopup').classList.add('hidden');
 pararSirene();
 $('authScreen').classList.remove('hidden');
 $('appHeader').classList.add('hidden');
 $('appMain').classList.add('hidden');
 $('authMsg').textContent=mensagem;
}
function selecionarModoAutenticacao(modo){
 const criar=modo==='criar';
 const primeiroAcesso=criar&&authSetupRequired;
 $('loginForm').classList.toggle('hidden',criar);
 $('setupForm').classList.toggle('hidden',!primeiroAcesso);
 $('registerForm').classList.toggle('hidden',!criar||primeiroAcesso);
 $('authLoginMode').classList.toggle('primary',!criar);
 $('authLoginMode').classList.toggle('secundario',criar);
 $('authLoginMode').setAttribute('aria-pressed',String(!criar));
 $('authCreateMode').classList.toggle('primary',criar);
 $('authCreateMode').classList.toggle('secundario',!criar);
 $('authCreateMode').setAttribute('aria-pressed',String(criar));
 $('authTitle').textContent=primeiroAcesso?'Criar primeiro acesso':criar?'Criar acesso':'Acesso ao sistema';
 $('authMsg').textContent='';
}
function abrirAplicacao(user){
 authUser=user;
 setor=usuarioTemAcessoLoja(user)?'LOJA':user.setor;
 setorAberto=true;
 $('authScreen').classList.add('hidden');
 $('appHeader').classList.remove('hidden');
 $('appMain').classList.remove('hidden');
 $('usuarioAtual').textContent=`${user.username} • ${{BANHO:'Banho',CLINICA:'Clínica',LOJA:'Loja',ADMINISTRADOR:'Administrador'}[user.setor]}`;
 $('setorAtual').textContent=`Setor: ${{BANHO:'Banho e Tosa',CLINICA:'Clínica',LOJA:'Loja',ADMINISTRADOR:'Administrador'}[user.setor]}`;
 $('btnFuncionarios').classList.toggle('hidden',!user.isAdmin);
 $('gerenciarAcessos').classList.toggle('hidden',!user.isAdmin);
 $('novo').classList.toggle('hidden',!usuarioTemAcessoLoja(user));
 $('lojaNav').classList.toggle('hidden',!usuarioTemAcessoLoja(user));
 $('lojaSummary').classList.toggle('hidden',!usuarioTemAcessoLoja(user));
 if(usuarioTemAcessoLoja(user))selecionarVisaoLoja('AGENDA_BANHO');
 else{
  $('titulo').textContent=`Agenda — ${{BANHO:'Banho e Tosa',CLINICA:'Clínica'}[user.setor]}`;
  $('subtitulo').textContent='20 horários';
  renderizar();
 }
 carregarAlertas();
 clearInterval(authStatusTimer);
 authStatusTimer=setInterval(carregarAlertas,5000);
}
async function iniciarSistema(){
 try{
  const session=await api('/api/auth/me');
  abrirAplicacao(session.user);
 }catch(err){
  if(!/sessão|login/i.test(err.message)){$('authMsg').textContent=err.message}
  mostrarTelaAutenticacao();
  try{
   const status=await api('/api/auth/status');
   authSetupRequired=status.setupRequired;
   selecionarModoAutenticacao(authSetupRequired?'criar':'entrar');
  }catch(statusError){$('authMsg').textContent='Não foi possível conectar ao servidor: '+statusError.message}
 }
}
async function enviarAutenticacao(event,url){
 event.preventDefault();
 $('authMsg').textContent='';
 const form=event.currentTarget;
 const values=Object.fromEntries(new FormData(form));
 try{
  const result=await api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
  form.reset();
  abrirAplicacao(result.user);
 }catch(err){$('authMsg').textContent=err.message}
}
$('loginForm').onsubmit=event=>enviarAutenticacao(event,'/api/auth/login');
$('setupForm').onsubmit=event=>enviarAutenticacao(event,'/api/auth/setup');
$('registerForm').onsubmit=event=>enviarAutenticacao(event,'/api/auth/register');
$('authLoginMode').onclick=()=>selecionarModoAutenticacao('entrar');
$('authCreateMode').onclick=()=>selecionarModoAutenticacao('criar');
function abrirSetor(novoSetor){
 if(!authUser||(!usuarioTemAcessoLoja(authUser)&&novoSetor!==authUser.setor))return;
 setor=novoSetor;
 setorAberto=true;
 $('appHeader').classList.remove('hidden');
 $('appMain').classList.remove('hidden');
 document.querySelectorAll('.tabs .tab').forEach(x=>x.classList.remove('active'));
 const nomes={BANHO:'Banho e Tosa',CLINICA:'Clínica',LOJA:'Loja'};
 $('setorAtual').textContent=`Setor: ${nomes[setor]}`;
 $('titulo').textContent=`Agenda — ${nomes[setor]}`;
 $('novo').classList.toggle('hidden',setor!=='LOJA');
 $('subtitulo').textContent=setor==='LOJA'?'Pets liberados e lançamentos da loja':'20 horários';
 $('lojaNav').classList.toggle('hidden',setor!=='LOJA');
 $('lojaSummary').classList.toggle('hidden',setor!=='LOJA');
 if(setor==='LOJA')selecionarVisaoLoja('AGENDA_BANHO');
 renderizar();
}
$('trocarSetor').onclick=sairDaConta;
async function sairDaConta(){
 try{await api('/api/auth/logout',{method:'POST'})}
 catch(err){console.error('Falha ao encerrar a sessão no servidor:',err)}
 authUser=null;
 mostrarTelaAutenticacao();
 $('loginForm').classList.remove('hidden');
 $('setupForm').classList.add('hidden');
 $('registerForm').classList.add('hidden');
 $('loginForm').reset();
 $('authMsg').textContent='';
 try{
  const status=await api('/api/auth/status');
  authSetupRequired=status.setupRequired;
  selecionarModoAutenticacao(authSetupRequired?'criar':'entrar');
 }catch(err){$('authMsg').textContent='Não foi possível verificar o servidor: '+err.message}
}
function obsCampo(x){
 const valor=esc(x.observacoes||'');
 return `<input type="text" class="obs-input" placeholder="Observações..." value="${valor}" onblur="salvarObservacao(${x.id},this.value)">`;
}
async function salvarObservacao(id,valor){
 try{await api(`/api/agendamentos/${id}/observacoes`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({observacoes:valor})})}
 catch(err){alert('Não foi possível salvar a observação: '+err.message)}
}
function textoCampo(id,campo,valorAtual,placeholder){
 const valor=esc(valorAtual||'');
 return `<input type="text" class="obs-input" placeholder="${placeholder}" value="${valor}" onblur="salvarTexto(${id},'${campo}',this.value)">`;
}
async function salvarTexto(id,campo,valor){
 try{await api(`/api/agendamentos/${id}/texto`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({campo,valor})})}
 catch(err){alert('Não foi possível salvar: '+err.message)}
}
function detalhesAtendimento(x){
 const detalhes=[];
 if(Number(x.tipo_th)===1)detalhes.push('TH');
 if(Number(x.tipo_tt)===1)detalhes.push('TT');
 if(Number(x.tipo_medicamentoso)===1)detalhes.push(`Medicamento: ${x.medicamento||'não informado'}`);
 if(Number(x.vacina)===1)detalhes.push(`Vacina: ${x.vacina_qual||'não informada'}`);
 if(Number(x.exame)===1)detalhes.push(`Exame: ${x.exame_qual||'não informado'}`);
 if(Number(x.outro_servico)===1)detalhes.push(`Outro: ${x.outro_servico_qual||'não informado'}`);
 if(Number(x.levado_transporte)===1)detalhes.push('Transporte realizado');
 return detalhes.length?`<div class="detalhes-atendimento"><b>Dados do atendimento:</b> ${detalhes.map(esc).join(' • ')}</div>`:'';
}
function lojaEditor(x){
 return `<div class="loja-editor" data-loja-id="${x.id}">
   <label>🛍️ Produtos / valores consumidos<textarea data-campo="loja_produtos" rows="3" placeholder="Ex.: Ração — R$ 25,00\nPetisco — R$ 8,00">${esc(x.loja_produtos||'')}</textarea></label>
   <div class="loja-editor-grid">
    <label>💵 Valor consumido na Loja (R$)<input data-campo="loja_valor" type="number" min="0" step="0.01" value="${x.loja_valor??0}"></label>
    <label>📝 Obs. da Loja<textarea data-campo="loja_observacoes" rows="3" placeholder="Observações sobre produtos, venda ou cobrança...">${esc(x.loja_observacoes||'')}</textarea></label>
   </div>
   <div class="loja-editor-footer"><button class="primary" onclick="salvarDadosLoja(${x.id},this.closest('.loja-editor'))">💾 Salvar lançamento da Loja</button><span class="muted" data-loja-msg></span></div>
  </div>`;
}
async function salvarDadosLoja(id,el){
 const payload={loja_produtos:el.querySelector('[data-campo="loja_produtos"]').value,loja_observacoes:el.querySelector('[data-campo="loja_observacoes"]').value,loja_valor:el.querySelector('[data-campo="loja_valor"]').value};
 const msg=el.querySelector('[data-loja-msg]');
 try{
  await api(`/api/agendamentos/${id}/loja`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  msg.textContent='Salvo ✓';
  setTimeout(()=>{msg.textContent=''},1800);
 }catch(err){msg.textContent='Erro: '+err.message}
}

function renderLinhaAgendamento(x,h,funcs,podeEncaminhar){
 const encaminhado=Number(x.encaminhado)===1;
 const cl=encaminhado?'roxo':(x.status==='LIBERADO'?'green':x.status==='ANDAMENTO'?'blue':'red');
 const next=x.status==='AGENDADO'?'ANDAMENTO':x.status==='ANDAMENTO'?'LIBERADO':null;
 const tagOrigem=x.origem_setor?`<br><span class="muted">🔄 Encaminhado ${x.origem_setor==='BANHO'?'do Banho':'da Clínica'}</span>`:'';
 const selFunc=`<select class="sel-func" onchange="atribuirFuncionario(${x.id},this.value)">
   <option value="">Sem profissional</option>
   ${funcs.map(f=>`<option value="${f.id}" ${x.funcionario_id==f.id?'selected':''}>${f.nome}</option>`).join('')}
  </select>`;
 const cronometro=(setor==='BANHO'&&x.status==='ANDAMENTO'&&x.iniciado_em)
  ?`<span class="muted" data-inicio="${new Date(x.iniciado_em).toISOString()}">⏱ 00:00</span>`:'';
 const duracaoFinal=(setor==='BANHO'&&x.status==='LIBERADO'&&x.iniciado_em&&x.finalizado_em)
  ?`<span class="muted">⏱ Levou ${formatarDuracao(x.iniciado_em,x.finalizado_em)}</span>`:'';
 const podeEditarAgendamento=usuarioTemAcessoLoja(authUser);
 const podeEditarFinanceiro=usuarioTemAcessoLoja(authUser);
 const extrasBanho=setor==='BANHO'?`
   <label class="chk"><input type="checkbox" ${Number(x.tipo_th)===1?'checked':''} onchange="flag(${x.id},'tipo_th',this.checked)"> TH</label>
   <label class="chk"><input type="checkbox" ${Number(x.tipo_tt)===1?'checked':''} onchange="flag(${x.id},'tipo_tt',this.checked)"> TT</label>
   <label class="chk"><input type="checkbox" ${Number(x.tipo_medicamentoso)===1?'checked':''} onchange="flag(${x.id},'tipo_medicamentoso',this.checked)"> M</label>
   ${textoCampo(x.id,'medicamento',x.medicamento,'Qual medicamento...')}
   <label class="chk"><input type="checkbox" ${Number(x.levado_transporte)===1?'checked':''} onchange="flag(${x.id},'levado_transporte',this.checked)"> 🚐 Levado (transporte)</label>
 `:'';
 const extrasClinica=setor==='CLINICA'?`
   <label class="chk"><input type="checkbox" ${Number(x.vacina)===1?'checked':''} onchange="flag(${x.id},'vacina',this.checked)"> 💉 Vacina</label>
   ${textoCampo(x.id,'vacina_qual',x.vacina_qual,'Qual vacina...')}
   <label class="chk"><input type="checkbox" ${Number(x.exame)===1?'checked':''} onchange="flag(${x.id},'exame',this.checked)"> 🧪 Exame</label>
   ${textoCampo(x.id,'exame_qual',x.exame_qual,'Qual exame...')}
   <label class="chk"><input type="checkbox" ${Number(x.outro_servico)===1?'checked':''} onchange="flag(${x.id},'outro_servico',this.checked)"> Outro</label>
   ${textoCampo(x.id,'outro_servico_qual',x.outro_servico_qual,'Qual...')}
 `:'';
 const encaminhadoDestino=Number(x.origem_agendamento_id)>0;
 return `<div class="row ${cl} ${encaminhadoDestino?'encaminhado-destino':''} ${Number(x.desmarcado)===1?'desmarcado':''}">
  <strong>${h}</strong><div><b>${esc(x.pet)}</b><br><span class="muted">${esc(x.tutor)} • ${esc(x.telefone||'')}</span>${tagOrigem}${x.remarcado_de?`<br><span class="tag-remarcado">📅 Remarcado de ${formatarDataAgenda(x.remarcado_de)}</span>`:''}${x.remarcado_para?`<br><span class="tag-remarcado">📅 Reagendado para ${formatarDataAgenda(x.remarcado_para)}</span>`:''}</div>
  <span>${x.especie==='GATO'?'🐱 Gato':'🐶 Cão'}</span><span>${x.servico}</span>
  <span>${encaminhado?'🟣 Encaminhado':label(x.status)}${Number(x.desmarcado)===1?`<br><span class="tag-desmarcado">🚫 Desmarcado em ${formatarDataAgenda(x.data)}</span>`:''}${x.funcionario?`<br><span class="muted">👤 ${esc(x.funcionario)}</span>`:''}${cronometro?`<br>${cronometro}`:''}${duracaoFinal?`<br>${duracaoFinal}`:''}</span>
  <div class="actions">${next?`<button onclick="status(${x.id},'${next}')">→ ${label(next)}</button>`:''}
  ${podeEncaminhar?`<button onclick="alerta(${x.id})">🚨 Encaminhar</button>`:''}
  ${selFunc}
  ${podeEditarFinanceiro?`
   <label class="chk"><input type="checkbox" ${Number(x.pago)===1?'checked':''} onchange="flag(${x.id},'pago',this.checked)"> 💰 Pago</label>
   <label class="chk"><input type="checkbox" ${Number(x.anotado)===1?'checked':''} onchange="flag(${x.id},'anotado',this.checked)"> 📒 Anotado (fiado)</label>
   <label class="chk"><input type="checkbox" ${Number(x.retirado)===1?'checked':''} onchange="flag(${x.id},'retirado',this.checked)"> ✅ Retirado</label>
  `:''}
  <label class="chk"><input type="checkbox" ${Number(x.desmarcado)===1?'checked':''} onchange="alterarDesmarcado(${x.id},this.checked)"> 🚫 Cliente desmarcou</label>
  ${extrasBanho}${extrasClinica}
  ${podeEditarAgendamento?`<button onclick="editarAgendamento(${x.id})">✏️ Editar</button>`:''}
  ${obsCampo(x)}
  </div>
 </div>`;
}
let ultimaAgenda=[];
async function agenda(){
 const podeEncaminhar=(setor==='BANHO'||setor==='CLINICA');
 const podeGerenciarHorarios=usuarioTemAcessoLoja(authUser);
 const [rows,bloqueios,funcs,alertas]=await Promise.all([
  api(`/api/agendamentos?data=${data.value}&setor=${setor}`),
  api(`/api/bloqueios?data=${data.value}&setor=${setor}`),
  podeEncaminhar?api(`/api/funcionarios?setor=${setor}`):Promise.resolve([]),
  podeEncaminhar?api('/api/alertas'):Promise.resolve([])
 ]);
 ultimaAgenda=rows;
 const desmarcados=rows.filter(x=>Number(x.desmarcado)===1);
 const by={};
 rows.filter(x=>Number(x.desmarcado)!==1).forEach(x=>{const h=x.horario.slice(0,5);(by[h]=by[h]||[]).push({...x,slotType:'agendamento',slotKey:`agendamento-${x.id}`})});
 const encaminhamentosPendentes=alertas.filter(x=>Number(x.sinalizado)!==1&&String(x.data).slice(0,10)===data.value&&(x.origem==='BANHO'?'CLINICA':'BANHO')===setor);
 encaminhamentosPendentes
  .forEach(x=>{
   const h=x.horario.toString().slice(0,5);
   (by[h]=by[h]||[]).push({...x,slotType:'encaminhamento',slotKey:`alerta-${x.id}`});
  });
 const assinaturaEncaminhamentos=alertas
  .filter(x=>String(x.data).slice(0,10)===data.value&&(x.origem===setor||(x.origem==='BANHO'?'CLINICA':'BANHO')===setor))
  .map(x=>`${x.id}:${Number(x.sinalizado)}:${Number(x.lido)}`).join(',');
 if(podeEncaminhar)assinaturaEncaminhamentosAgenda=assinaturaEncaminhamentos;
 const bloqueadoPor=Object.fromEntries(bloqueios.map(b=>[b.horario.slice(0,5),b]));
 lista.innerHTML=horarios.map(h=>{
  const grupo=by[h];
  if(grupo&&grupo.length){
   const ordenado=[...grupo].sort((a,b)=>{
    if(a.slotType!==b.slotType)return a.slotType==='agendamento'?-1:1;
    return a.slotType==='agendamento'?Number(a.id)-Number(b.id):new Date(a.created_at)-new Date(b.created_at);
   });
   const encaminhados=ordenado.filter(x=>x.slotType==='encaminhamento'||Number(x.origem_agendamento_id)>0);
   if(ordenado.length===1&&ordenado[0].slotType==='agendamento'&&!encaminhados.length)
    return renderLinhaAgendamento(ordenado[0],h,funcs,podeEncaminhar);
   const selecionado=encaminhados.length?encaminhados[encaminhados.length-1]:ordenado[ordenado.length-1];
   return `<div class="slot-stack">
    <div class="slot-tabs" role="tablist" aria-label="Agendamentos das ${h}">
     ${ordenado.map(x=>{
      const encaminhado=x.slotType==='encaminhamento'||Number(x.origem_agendamento_id)>0;
      const origem=(x.slotType==='encaminhamento'?x.origem:x.origem_setor)==='BANHO'?'Banho':'Clínica';
      const ativo=x.slotKey===selecionado.slotKey;
      return `<button type="button" role="tab" aria-selected="${ativo}" class="slot-tab ${encaminhado?'encaminhado':''} ${ativo?'active':''}" onclick="selecionarAgendamentoHorario('${h}','${x.slotKey}')">${encaminhado?'↪ '+origem+' → ':''}${esc(x.pet)}</button>`;
     }).join('')}
    </div>
    ${ordenado.map(x=>`<div class="slot-panel ${x.slotKey===selecionado.slotKey?'active':''}" data-slot-horario="${h}" data-slot-key="${x.slotKey}">${x.slotType==='encaminhamento'?renderLinhaEncaminhamento(x,h):renderLinhaAgendamento(x,h,funcs,podeEncaminhar)}</div>`).join('')}
   </div>`;
  }
  const b=bloqueadoPor[h];
  if(b){
   return `<div class="row gray">
    <strong>${h}</strong><span class="muted">${b.motivo?('Bloqueado: '+b.motivo):'Horário bloqueado'}</span><span>—</span><span>—</span>
    <span>🔒 Fechado</span>
    <div class="actions">${podeGerenciarHorarios?`<button onclick="desbloquear(${b.id})">🔓 Reabrir</button>`:''}</div>
   </div>`;
  }
  return `<div class="row yellow">
   <strong>${h}</strong><span class="muted">Horário disponível</span><span>—</span><span>—</span>
   <span>🟡 Livre</span>
   <div class="actions">${podeGerenciarHorarios?`<button onclick="bloquear('${h}')">🔒 Bloquear</button>`:''}</div>
  </div>`;
 }).join('')+(desmarcados.length?`
  <section class="desmarcados-agenda">
   <h3>🚫 Desmarcados em ${formatarDataAgenda(data.value)} — final dos horários</h3>
   ${desmarcados.map(x=>renderLinhaAgendamento(x,x.horario.slice(0,5),funcs,podeEncaminhar)).join('')}
  </section>`:'');
 $('total').textContent=rows.length;$('aguardando').textContent=rows.filter(x=>x.status==='AGENDADO').length;
 $('andamento').textContent=rows.filter(x=>x.status==='ANDAMENTO').length;$('liberados').textContent=rows.filter(x=>x.status==='LIBERADO').length;
}
function renderLinhaEncaminhamento(x,h){
 const origem=x.origem==='BANHO'?'Banho e Tosa':'Clínica';
 return `<div class="row encaminhado-destino">
  <strong>${h}</strong>
  <div><b>${esc(x.pet)}</b><br><span class="muted">${esc(x.tutor)} • Encaminhado de ${origem}</span></div>
  <span>${x.pet_especie==='GATO'?'🐱 Gato':'🐶 Cão'}</span>
  <span>${esc(x.servico||'Encaminhamento')}</span>
  <span>🟣 Encaminhamento recebido</span>
  <div class="actions"><button onclick="sinalizarAlerta(${x.id},true)">✅ Sinalizar recebido</button></div>
 </div>`;
}
function selecionarAgendamentoHorario(horario,slotKey){
 const paines=[...document.querySelectorAll(`.slot-panel[data-slot-horario="${horario}"]`)];
 paines.forEach(painel=>painel.classList.toggle('active',painel.dataset.slotKey===slotKey));
 const abas=[...document.querySelectorAll(`.slot-tabs[aria-label="Agendamentos das ${horario}"] .slot-tab`)];
 abas.forEach((aba,index)=>aba.classList.toggle('active',paines[index]?.dataset.slotKey===slotKey));
 abas.forEach((aba,index)=>aba.setAttribute('aria-selected',String(paines[index]?.dataset.slotKey===slotKey)));
}
function label(s){return {AGENDADO:'🔴 Aguardando',ANDAMENTO:'🔵 Em andamento',LIBERADO:'🟢 Liberado',CANCELADO:'Cancelado'}[s]||s}
async function bloquear(h){
 const motivo=prompt('Motivo do bloqueio (opcional):','');
 if(motivo===null)return;
 try{
  await api('/api/bloqueios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:data.value,horario:h+':00',setor,motivo:motivo||null})});
  agenda();
 }catch(err){alert(err.message)}
}
async function desbloquear(id){
 if(!confirm('Reabrir esse horário?'))return;
 await api(`/api/bloqueios/${id}`,{method:'DELETE'});
 agenda();
}
async function status(id,s){
 await api(`/api/agendamentos/${id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:s})});
 await agenda();
 if(s==='LIBERADO')await carregarAlertas();
}
let idAgendamentoRemarcar=null;
async function alterarDesmarcado(id,desmarcado){
 if(!desmarcado){
  try{await flag(id,'desmarcado',false)}
  catch(err){alert('Não foi possível atualizar a desmarcação: '+err.message);await agenda()}
  return;
 }
 idAgendamentoRemarcar=id;
 $('dataReagendamento').value='';
 $('reagendamentoMsg').textContent='';
 $('remarcarModal').classList.remove('hidden');
}
function cancelarReagendamento(){
 idAgendamentoRemarcar=null;
 $('remarcarModal').classList.add('hidden');
 agenda();
}
async function marcarComoDesmarcado(){
 if(idAgendamentoRemarcar===null)return;
 try{
  await flag(idAgendamentoRemarcar,'desmarcado',true);
  idAgendamentoRemarcar=null;
  $('remarcarModal').classList.add('hidden');
 }catch(err){$('reagendamentoMsg').textContent='Não foi possível marcar como desmarcado: '+err.message}
}
async function confirmarReagendamento(){
 if(idAgendamentoRemarcar===null)return;
 const novaData=$('dataReagendamento').value;
 if(!novaData){$('reagendamentoMsg').textContent='Escolha a nova data no calendário.';return}
 const agendamento=ultimaAgenda.find(x=>Number(x.id)===Number(idAgendamentoRemarcar));
 if(agendamento&&String(agendamento.data).slice(0,10)===novaData){
  $('reagendamentoMsg').textContent='Escolha um dia diferente da data atual.';
  return;
 }
 try{
  await api(`/api/agendamentos/${idAgendamentoRemarcar}/reagendar`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:novaData})});
  idAgendamentoRemarcar=null;
  $('remarcarModal').classList.add('hidden');
  await agenda();
 }catch(err){$('reagendamentoMsg').textContent='Não foi possível reagendar: '+err.message}
}
async function atribuirFuncionario(id,funcionarioId){
 await api(`/api/agendamentos/${id}/funcionario`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({funcionario_id:funcionarioId||null})});
 agenda();
}
function formatarDuracao(inicioISO,fimISO){
 const ms=new Date(fimISO)-new Date(inicioISO);
 const totalSeg=Math.max(0,Math.floor(ms/1000));
 const m=Math.floor(totalSeg/60),s=totalSeg%60;
 return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function atualizarCronometros(){
 document.querySelectorAll('[data-inicio]').forEach(el=>{
  const inicio=new Date(el.dataset.inicio);
  const diff=Math.max(0,Math.floor((Date.now()-inicio.getTime())/1000));
  const m=String(Math.floor(diff/60)).padStart(2,'0'),s=String(diff%60).padStart(2,'0');
  el.textContent=`⏱ ${m}:${s}`;
 });
}
setInterval(atualizarCronometros,1000);
async function flag(id,campo,valor){
 await api(`/api/agendamentos/${id}/flag`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({campo,valor})});
 if(usuarioTemAcessoLoja(authUser)&&['AGUARDANDO','FINALIZADOS'].includes(lojaVisao)){
  if(lojaVisao==='FINALIZADOS')await finalizadosLista();
  else await avisosLoja();
 }
 else await agenda();
 if(campo==='retirado')await carregarAlertas();
}
async function avisosLoja(){
 const avisos=await api(`/api/agendamentos/prontos-retirada?data=${data.value}`);
 renderAvisosLoja(avisos);
}
function renderAvisosLoja(avisos){
 assinaturaAvisosLoja=JSON.stringify(avisos.map(a=>[a.id,a.loja_valor,a.loja_produtos,a.loja_observacoes,a.pago,a.retirado]));
 const consumoLoja=avisos.reduce((s,a)=>s+Number(a.loja_valor||0),0);
 $('total').textContent=avisos.length;$('aguardando').textContent='—';$('andamento').textContent='—';$('liberados').textContent='—';$('lojaTotal').textContent=moeda(consumoLoja);
 lista.innerHTML=avisos.length?avisos.map(a=>`
  <div class="row green row-detalhada">
   <strong>${a.horario.slice(0,5)}</strong>
   <div><b>${esc(a.pet)}</b><br><span class="muted">${esc(a.tutor)} • ${esc(a.telefone||'')}</span></div>
   <span>${a.pet_especie==='GATO'?'🐱 Gato':'🐶 Cão'}</span>
   <span class="muted">Liberado ${a.setor==='BANHO'?'no Banho':'na Clínica'} — ${esc(a.servico)}${a.funcionario?`<br>👤 ${esc(a.funcionario)}`:''}</span>
   <span>🟢 Aguardando retirada<br>Atendimento: ${moeda(a.valor_total)}<br>Transporte: ${moeda(a.valor_transporte)}</span>
   <div class="actions loja-acoes">
    <label class="chk"><input type="checkbox" ${Number(a.pago)===1?'checked':''} onchange="flag(${a.id},'pago',this.checked)"> 💰 Pago</label>
    <button onclick="marcarRetirado(${a.id})">✅ Marcar como retirado</button>
   </div>
   <div class="row-extra">${detalhesAtendimento(a)}${a.observacoes?`<div class="detalhes-atendimento"><b>Observação da agenda:</b> ${esc(a.observacoes)}</div>`:''}${lojaEditor(a)}</div>
  </div>`).join(''):'<p class="muted" style="padding:16px">Nenhum pet liberado aguardando retirada.</p>';
}
async function marcarRetirado(id){ await flag(''+id,'retirado',true); }
async function finalizadosLista(){
 const [banho,clinica]=await Promise.all([
  api(`/api/agendamentos?data=${data.value}&setor=BANHO&retirado=1`),
  api(`/api/agendamentos?data=${data.value}&setor=CLINICA&retirado=1`)
 ]);
 const todos=[...banho,...clinica];
 const consumoLoja=todos.reduce((s,a)=>s+Number(a.loja_valor||0),0);
 $('total').textContent=todos.length;$('aguardando').textContent='—';$('andamento').textContent='—';$('liberados').textContent='—';$('lojaTotal').textContent=moeda(consumoLoja);
 const linha=x=>`
  <div class="row green row-detalhada">
   <strong>${x.horario.slice(0,5)}</strong>
   <div><b>${esc(x.pet)}</b><br><span class="muted">${esc(x.tutor)} • ${esc(x.telefone||'')}</span></div>
   <span>${x.pet_especie==='GATO'?'🐱 Gato':'🐶 Cão'}</span>
   <span class="muted">${esc(x.servico)}${x.funcionario?`<br>👤 ${esc(x.funcionario)}`:''}${(x.setor==='BANHO'&&x.iniciado_em&&x.finalizado_em)?`<br>⏱ Levou ${formatarDuracao(x.iniciado_em,x.finalizado_em)}`:''}</span>
   <span>✅ Retirado${Number(x.pago)===1?'<br>💰 Pago':''}<br>Atendimento: ${moeda(x.valor_total)}<br>Transporte: ${moeda(x.valor_transporte)}<br>Loja: ${moeda(x.loja_valor)}</span>
   <div class="actions loja-acoes">${obsCampo(x)}</div>
   <div class="row-extra">${detalhesAtendimento(x)}${x.observacoes?`<div class="detalhes-atendimento"><b>Observação da agenda:</b> ${esc(x.observacoes)}</div>`:''}${lojaEditor(x)}</div>
  </div>`;
 lista.innerHTML=`
  <h3 class="finalizados-titulo">🛁 Banho e Tosa</h3>
  ${banho.length?banho.map(linha).join(''):'<p class="muted" style="padding:4px">Nenhum finalizado nessa data.</p>'}
  <h3 class="finalizados-titulo">🩺 Clínica</h3>
  ${clinica.length?clinica.map(linha).join(''):'<p class="muted" style="padding:4px">Nenhum finalizado nessa data.</p>'}
 `;
}
function renderizar(){
 if(usuarioTemAcessoLoja(authUser)&&lojaVisao==='FINALIZADOS')return finalizadosLista();
 if(usuarioTemAcessoLoja(authUser)&&lojaVisao==='AGUARDANDO')return avisosLoja();
 return agenda();
}
function selecionarVisaoLoja(visao){
 lojaVisao=visao;
 if(visao==='AGENDA_BANHO')setor='BANHO';
 else if(visao==='AGENDA_CLINICA')setor='CLINICA';
 else setor='LOJA';
 document.querySelectorAll('.loja-subtab').forEach(botao=>{
  botao.classList.toggle('active',botao.dataset.lojaVisao===visao);
 });
 const titulos={
  AGENDA_BANHO:'Agenda Banho e Tosa',
  AGENDA_CLINICA:'Agenda Clínica',
  AGUARDANDO:'Loja — Aguardando retirada',
  FINALIZADOS:'Loja — Finalizados'
 };
 $('setorAtual').textContent=`Setor: Loja${visao.startsWith('AGENDA_')?` • ${visao==='AGENDA_BANHO'?'Banho e Tosa':'Clínica'}`:''}`;
 $('titulo').textContent=titulos[visao];
 $('novo').classList.toggle('hidden',!visao.startsWith('AGENDA_'));
 $('setorAgendamentoWrap').classList.toggle('hidden',!visao.startsWith('AGENDA_'));
 $('subtitulo').textContent=visao==='FINALIZADOS'?'Atendimentos retirados do Banho e da Clínica'
  :visao==='AGUARDANDO'?'Pets liberados aguardando retirada'
  :`20 horários • ${visao==='AGENDA_BANHO'?'Banho e Tosa':'Clínica'}`;
 renderizar();
}
document.querySelectorAll('.loja-subtab').forEach(botao=>{
 botao.onclick=()=>selecionarVisaoLoja(botao.dataset.lojaVisao);
});
async function popularSelectTutores(select){
 const ts=await api('/api/tutores'); select.innerHTML='<option value="">Selecione...</option>'+ts.map(t=>`<option value="${t.id}">${t.nome} — ${t.telefone||''}</option>`).join('');
}
async function carregarTutores(){ await popularSelectTutores($('tutor')); }
async function carregarPets(){
 const id=$('tutor').value; const ps=await api('/api/pets'); const filtrados=id?ps.filter(p=>p.tutor_id==id):ps;
 $('pet').innerHTML='<option value="">Selecione...</option>'+filtrados.map(p=>`<option value="${p.id}" data-e="${p.especie}">${p.nome} — ${p.especie==='GATO'?'🐱':'🐶'}</option>`).join('');
}
$('tutor').addEventListener('change',carregarPets);

// Cadastro rápido de novo tutor (a partir do modal de agendamento)
$('btnNovoTutor').onclick=()=>{$('formTutor').reset();$('formTutorMsg').textContent='';$('modalTutor').classList.remove('hidden')};
$('fecharNovoTutor').onclick=()=>$('modalTutor').classList.add('hidden');
$('formTutor').onsubmit=async e=>{
 e.preventDefault();
 const body=Object.fromEntries(new FormData(e.target));
 try{
  const t=await api('/api/tutores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  $('modalTutor').classList.add('hidden');
  await carregarTutores();
  $('tutor').value=t.id;
  await carregarPets();
 }catch(err){$('formTutorMsg').textContent=err.message}
};

// Cadastro rápido de novo pet (a partir do modal de agendamento)
$('btnNovoPet').onclick=async()=>{
 $('formPet').reset();$('formPetMsg').textContent='';
 await popularSelectTutores($('petTutorId'));
 if($('tutor').value)$('petTutorId').value=$('tutor').value;
 $('modalPet').classList.remove('hidden')
};
$('fecharNovoPet').onclick=()=>$('modalPet').classList.add('hidden');
$('formPet').onsubmit=async e=>{
 e.preventDefault();
 const body=Object.fromEntries(new FormData(e.target));
 try{
  const p=await api('/api/pets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  $('modalPet').classList.add('hidden');
  $('tutor').value=p.tutor_id;
  await carregarPets();
  $('pet').value=p.id;
  $('especie').value=p.especie==='GATO'?'🐱 Gato':'🐶 Cão';
 }catch(err){$('formPetMsg').textContent=err.message}
};
$('pet').addEventListener('change',()=>{$('especie').value=$('pet').selectedOptions[0]?.dataset.e==='GATO'?'🐱 Gato':$('pet').value?'🐶 Cão':''});
async function popularHorariosNovo(excluirId){
 const sel=$('novoHorario');
 const atual=sel.value;
 const setorAgendamento=$('setorAgendamento').value||setor;
 try{
  const d=fdata.value||data.value;
  const [ocupados,bloqueios]=await Promise.all([
   api(`/api/agendamentos?data=${d}&setor=${setorAgendamento}`),
   api(`/api/bloqueios?data=${d}&setor=${setorAgendamento}`)
  ]);
  const ocupadosSet=setorAgendamento==='CLINICA'
   ? new Set()
   : new Set(ocupados.filter(x=>x.id!==excluirId).map(x=>x.horario.slice(0,5)));
  const bloqueadosSet=new Set(bloqueios.map(b=>b.horario.slice(0,5)));
  sel.innerHTML=horarios.map(h=>{
   const ocupado=ocupadosSet.has(h),bloqueado=bloqueadosSet.has(h);
   const rotulo=ocupado?`${h} (ocupado)`:bloqueado?`${h} (bloqueado)`:h;
   return `<option value="${h}" ${(ocupado||bloqueado)?'disabled':''}>${rotulo}</option>`;
  }).join('');
  if(horarios.includes(atual)&&!ocupadosSet.has(atual)&&!bloqueadosSet.has(atual))sel.value=atual;
 }catch(err){
  sel.innerHTML=`<option value="">Erro ao carregar horários: ${err.message}</option>`;
 }
}
function popularServicos(valorAtual){
 const opcoes=$('setorAgendamento').value==='CLINICA'?['Consulta','Revisão']:['Banho','Banho e Tosa'];
 const lista=[...opcoes];
 if(valorAtual&&!lista.includes(valorAtual))lista.push(valorAtual);
 $('servicoSelect').innerHTML='<option value="">Selecione...</option>'+lista.map(s=>`<option value="${s}">${s}</option>`).join('');
 if(valorAtual)$('servicoSelect').value=valorAtual;
}
let editandoId=null;
$('novo').onclick=async()=>{
 if(!usuarioTemAcessoLoja(authUser))return;
 editandoId=null;
 $('modalAgendamentoTitulo').textContent='Novo agendamento';
 $('form').reset();$('formMsg').textContent='';
 $('setorAgendamento').value=setor==='CLINICA'?'CLINICA':'BANHO';
 $('setorAgendamentoWrap').classList.remove('hidden');
 fdata.value=data.value;
 popularServicos();
 $('modal').classList.remove('hidden');
 await carregarTutores();await carregarPets();await popularHorariosNovo();
};
fdata.onchange=()=>popularHorariosNovo(editandoId);
$('setorAgendamento').onchange=async()=>{
 popularServicos();
 await popularHorariosNovo(editandoId);
};
$('fechar').onclick=()=>{editandoId=null;$('modal').classList.add('hidden')};
$('form').onsubmit=async e=>{
 e.preventDefault();
 const body=Object.fromEntries(new FormData(e.target));
 try{
  if(editandoId){
   await api(`/api/agendamentos/${editandoId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }else{
   body.setor=$('setorAgendamento').value;
   await api('/api/agendamentos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }
  $('modal').classList.add('hidden');
  e.target.reset();
  editandoId=null;
  data.value=body.data;
  await renderizar();
 }catch(err){$('formMsg').textContent=err.message}
};
async function editarAgendamento(id){
 const x=ultimaAgenda.find(r=>r.id===id);
 if(!x)return;
 editandoId=id;
 $('setorAgendamento').value=x.setor;
 $('setorAgendamentoWrap').classList.add('hidden');
 $('modalAgendamentoTitulo').textContent='Editar agendamento';
 $('formMsg').textContent='';
 fdata.value=(x.data+'').slice(0,10);
 $('modal').classList.remove('hidden');
 await carregarTutores();
 $('tutor').value=x.tutor_id;
 await carregarPets();
 $('pet').value=x.pet_id;
 $('especie').value=x.especie==='GATO'?'🐱 Gato':'🐶 Cão';
 popularServicos(x.servico);
 await popularHorariosNovo(editandoId);
 $('novoHorario').value=x.horario.slice(0,5);
 $('valorTotal').value=x.valor_total??'';
 $('valorTransporte').value=x.valor_transporte??'';
 $('form').observacoes.value=x.observacoes||'';
}
document.querySelectorAll('.tab[data-setor]').forEach(b=>b.onclick=()=>{
 if(!usuarioTemAcessoLoja(authUser))return;
 document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
 b.classList.add('active');
 setor=b.dataset.setor;
 const titulos={BANHO:'Banho e Tosa',CLINICA:'Clínica',LOJA:'Loja'};
 $('setorAtual').textContent=`Setor: ${titulos[setor]}`;
 $('titulo').textContent='Agenda — '+titulos[setor];
 $('novo').classList.toggle('hidden',setor!=='LOJA');
 $('lojaNav').classList.toggle('hidden',setor!=='LOJA');
 $('lojaSummary').classList.toggle('hidden',setor!=='LOJA');
 if(setor==='LOJA'){
 selecionarVisaoLoja('AGENDA_BANHO');
  return;
 }
 $('subtitulo').textContent='20 horários';
 renderizar();
});
data.onchange=()=>{renderizar();carregarAlertas()};
async function alerta(id){
 const destino=setor==='BANHO'?'Clínica':'Banho e Tosa';
 const mensagem=prompt(`Digite o alerta para encaminhar para ${destino}:`,'Solicitar avaliação.');
 if(!mensagem)return;
 const r=await api('/api/alertas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agendamento_id:id,mensagem})});
 await carregarAlertas();
 $('subtitulo').textContent=`Encaminhado para ${destino} às ${r.horario}.`;
 setTimeout(()=>{if(setor==='BANHO'||setor==='CLINICA')$('subtitulo').textContent='20 horários'},3000);
}
function atualizarPopupAlertas(alertas,liberacoes){
 alertasPendentes=alertas.filter(x=>Number(x.sinalizado)!==1);
 liberacoesPendentes=liberacoes.filter(x=>Number(x.loja_aceito)!==1);
 const assinatura=`${alertasPendentes.map(x=>x.id).join(',')}|${liberacoesPendentes.map(x=>x.id).join(',')}`;
 $('lojaCount').textContent=liberacoesPendentes.length;
 $('lojaTab').classList.toggle('tab-alerta',liberacoesPendentes.length>0);
 $('alertCount').textContent=alertasPendentes.length+liberacoesPendentes.length;
 if(!alertasPendentes.length&&!liberacoesPendentes.length){
  $('alertPopup').classList.add('hidden');
  assinaturaAlertas='';
  pararSirene();
  return;
 }
 $('alertPopup').classList.remove('hidden');
 if(assinatura!==assinaturaAlertas){
  assinaturaAlertas=assinatura;
  const avisosEncaminhamento=alertasPendentes.map(x=>`
   <article class="alert-popup-item">
    <div><b>${esc(x.pet)}</b> — ${esc(x.tutor)}</div>
    <p>${esc(x.mensagem)}</p>
    <small>Encaminhamento: ${x.origem==='BANHO'?'Banho e Tosa → Clínica':'Clínica → Banho e Tosa'} • ${String(x.horario||'').slice(0,5)} • ${new Date(x.created_at).toLocaleString('pt-BR')}</small>
    <button type="button" class="btn-atender" onclick="sinalizarAlerta(${x.id},true)">✅ Sinalizar e encerrar alerta</button>
   </article>`).join('');
  const avisosLoja=liberacoesPendentes.map(x=>`
   <article class="alert-popup-item alert-popup-loja">
    <div><b>🏪 Loja — ${esc(x.pet)}</b> • ${esc(x.tutor)}</div>
    <p>Liberado ${x.setor==='BANHO'?'no Banho e Tosa':'na Clínica'}; aguardando retirada.</p>
    <small>${String(x.horario||'').slice(0,5)} • ${esc(x.servico)}${x.funcionario?` • ${esc(x.funcionario)}`:''}</small>
    <button type="button" class="btn-atender btn-aceitar" onclick="aceitarNaLoja(${x.id})">✅ Aceitar na Loja</button>
   </article>`).join('');
  $('alertPopupList').innerHTML=avisosEncaminhamento+avisosLoja;
 }
 if(sireneAtivada){
  $('sireneStatus').textContent='Sirene ativada neste dispositivo.';
  $('ativarSirene').classList.add('hidden');
 }else{
  $('sireneStatus').textContent='Ative o som para ouvir a sirene neste dispositivo.';
  $('ativarSirene').classList.remove('hidden');
 }
 tocarSirene();
}
async function aceitarNaLoja(id){
 try{
  await api(`/api/agendamentos/${id}/flag`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({campo:'loja_aceito',valor:true})});
  liberacoesPendentes=liberacoesPendentes.filter(x=>Number(x.id)!==Number(id));
  atualizarPopupAlertas(alertasPendentes,liberacoesPendentes);
  await carregarAlertas();
 }catch(err){
  alert('Não foi possível aceitar o atendimento na Loja: '+err.message);
 }
}
function pararSirene(){
 if(intervaloSirene){clearInterval(intervaloSirene);intervaloSirene=null}
 if(osciladorSirene){osciladorSirene.stop();osciladorSirene.disconnect();osciladorSirene=null}
 if(ganhoSirene){ganhoSirene.disconnect();ganhoSirene=null}
}
function tocarSirene(){
 if(!sireneAtivada||!audioSirene||audioSirene.state!=='running'||(!alertasPendentes.length&&!liberacoesPendentes.length)||osciladorSirene)return;
 try{
  osciladorSirene=audioSirene.createOscillator();
  ganhoSirene=audioSirene.createGain();
  osciladorSirene.type='sawtooth';
  osciladorSirene.frequency.value=720;
  ganhoSirene.gain.value=0.055;
  osciladorSirene.connect(ganhoSirene);
  ganhoSirene.connect(audioSirene.destination);
  osciladorSirene.start();
  intervaloSirene=setInterval(()=>{
   frequenciaAlta=!frequenciaAlta;
   osciladorSirene.frequency.setTargetAtTime(frequenciaAlta?1050:720,audioSirene.currentTime,0.12);
  },550);
  $('sireneStatus').textContent='Sirene ativada neste dispositivo.';
  $('ativarSirene').classList.add('hidden');
 }catch(err){
  console.error('Não foi possível iniciar a sirene:',err);
  $('sireneStatus').textContent='Não foi possível iniciar a sirene. Tente ativar o som novamente.';
  pararSirene();
 }
}
async function ativarSirene(){
 const AudioContextDisponivel=window.AudioContext||window.webkitAudioContext;
 if(!AudioContextDisponivel){
  $('sireneStatus').textContent='Este navegador não oferece suporte à sirene.';
  $('ativarSirene').disabled=true;
  return;
 }
 try{
  audioSirene=audioSirene||new AudioContextDisponivel();
  if(audioSirene.state==='suspended')await audioSirene.resume();
  sireneAtivada=audioSirene.state==='running';
  if(sireneAtivada)tocarSirene();
 }catch(err){
  console.error('Não foi possível ativar o áudio da sirene:',err);
  $('sireneStatus').textContent='Não foi possível ativar o áudio. Verifique as permissões do navegador.';
 }
}
document.addEventListener('pointerdown',ativarSirene,{once:true});
document.addEventListener('keydown',ativarSirene,{once:true});
$('ativarSirene').onclick=ativarSirene;
async function carregarAlertas(){
 if(carregarAlertasEmAndamento)return null;
 carregarAlertasEmAndamento=true;
 try{
  const [resultadoAlertas,resultadoLiberacoes]=await Promise.allSettled([
   api('/api/alertas'),
   usuarioTemAcessoLoja(authUser)
    ?api(`/api/agendamentos/prontos-retirada?data=${encodeURIComponent(data.value)}`)
    :Promise.resolve([])
  ]);
  if(resultadoAlertas.status==='rejected')throw resultadoAlertas.reason;
  if(resultadoLiberacoes.status==='rejected')console.error('Não foi possível atualizar os avisos da Loja:',resultadoLiberacoes.reason);
  const alertas=resultadoAlertas.value;
  const liberacoes=resultadoLiberacoes.status==='fulfilled'?resultadoLiberacoes.value:liberacoesPendentes;
  const encaminhamentos=alertas.filter(x=>String(x.data).slice(0,10)===data.value&&(x.origem===setor||(x.origem==='BANHO'?'CLINICA':'BANHO')===setor));
  const novaAssinatura=encaminhamentos.map(x=>`${x.id}:${Number(x.sinalizado)}:${Number(x.lido)}`).join(',');
  const atualizarAgenda=setorAberto&&(setor==='BANHO'||setor==='CLINICA')&&novaAssinatura!==assinaturaEncaminhamentosAgenda;
  if(atualizarAgenda)await agenda();
  atualizarPopupAlertas(alertas,liberacoes);
  if(setorAberto&&usuarioTemAcessoLoja(authUser)&&lojaVisao==='AGUARDANDO'&&resultadoLiberacoes.status==='fulfilled'){
   const assinaturaLoja=JSON.stringify(liberacoes.map(a=>[a.id,a.loja_valor,a.loja_produtos,a.loja_observacoes,a.pago,a.retirado]));
   if(assinaturaLoja!==assinaturaAvisosLoja)renderAvisosLoja(liberacoes);
  }
  return alertas;
 }catch(err){
  console.error('Não foi possível atualizar os alertas e liberações da Loja:',err);
  return null;
 }finally{
  carregarAlertasEmAndamento=false;
 }
}
async function abrirAlertas(){
 const a=await carregarAlertas();
 if(!a)return;
 $('alertList').innerHTML=a.length?a.map(x=>{
   const sinalizado=Number(x.sinalizado)===1;
   return `<div class="alert ${sinalizado?'sinalizado':''}">
     <button class="btn-sinalizar" onclick="sinalizarAlerta(${x.id},${!sinalizado})">${sinalizado?'✅ Sinalizado':'🚩 Sinalizar'}</button>
     <b>${esc(x.pet)}</b> — ${esc(x.tutor)}<br>
     <span>${esc(x.mensagem)}</span><br>
     <small>${new Date(x.created_at).toLocaleString('pt-BR')} • ${esc(x.origem)}</small>
   </div>`;
 }).join(''):'<p class="muted">Nenhum alerta.</p>';
 $('alertModal').classList.remove('hidden');
}
$('alertasTab').onclick=abrirAlertas;
$('fecharAlertas').onclick=()=> $('alertModal').classList.add('hidden');
async function sinalizarAlerta(id,valor){
 try{
  await api(`/api/alertas/${id}/sinalizado`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({valor})});
  await carregarAlertas();
  if(!$('alertModal').classList.contains('hidden'))await abrirAlertas();
 }catch(err){
  alert('Não foi possível sinalizar o alerta: '+err.message);
 }
}
async function ler(id){await api(`/api/alertas/${id}/lido`,{method:'PATCH'});await abrirAlertas()}
$('voiceButton').onclick=()=>{if(!('SpeechRecognition'in window||'webkitSpeechRecognition'in window)){alert('Reconhecimento de voz não disponível neste navegador. No tablet Android, testar Chrome.');return} const R=window.SpeechRecognition||window.webkitSpeechRecognition;const r=new R();r.lang='pt-BR';r.continuous=false;r.interimResults=false;
r.onstart=()=>{$('voiceButton').textContent='🔴 Ouvindo...';$('vozStatus').textContent='Pode falar...'};
r.onerror=e=>{
 const mensagens={
  'no-speech':'Não ouvi nada. Clique em Voz e tente falar mais perto do microfone.',
  'audio-capture':'Nenhum microfone encontrado neste dispositivo.',
  'not-allowed':'Permissão de microfone negada. Libere o microfone nas configurações do navegador.',
  'network':'Erro de rede no reconhecimento de voz. Tente de novo.',
  'aborted':'Reconhecimento cancelado.'
 };
 $('vozStatus').textContent=mensagens[e.error]||('Erro no microfone: '+e.error);
};
r.onend=()=>{$('voiceButton').textContent='🎙️ Voz'};
r.onresult=e=>processarComandoVoz(e.results[0][0].transcript);
r.start()};

function normalizarTexto(t){return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()}
function falar(msg){try{const u=new SpeechSynthesisUtterance(msg);u.lang='pt-BR';speechSynthesis.speak(u)}catch(e){}}
function clicarAba(setorAlvo){
 if(usuarioTemAcessoLoja(authUser)&&['BANHO','CLINICA','LOJA'].includes(setorAlvo)){
  selecionarVisaoLoja(setorAlvo==='CLINICA'?'AGENDA_CLINICA':setorAlvo==='BANHO'?'AGENDA_BANHO':'AGUARDANDO');
  return;
 }
 if(['BANHO','CLINICA','LOJA'].includes(setorAlvo)){abrirSetor(setorAlvo);return}
 const btn=document.querySelector(`.tab[data-setor="${setorAlvo}"]`);
 if(btn)btn.click();
}
function modalMaisRecenteAberto(){const abertos=[...document.querySelectorAll('.modal:not(.hidden)')];return abertos[abertos.length-1]||null}
function fecharTodosModais(){document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden'))}
function processarComandoVoz(textoOriginal){
 const t=normalizarTexto(textoOriginal);
 $('vozStatus').textContent=`"${textoOriginal}"`;
 if(t.includes('banho')){clicarAba('BANHO');falar('Abrindo agenda do banho e tosa')}
 else if(t.includes('clinica')){clicarAba('CLINICA');falar('Abrindo agenda da clínica')}
 else if(t.includes('loja')){clicarAba('LOJA');falar('Abrindo loja')}
 else if(t.includes('novo agendamento')||t.includes('agendar')||t==='novo'){$('novo').click();falar('Abrindo novo agendamento')}
 else if(t.includes('funcionario')){$('btnFuncionarios').click();falar('Abrindo funcionários')}
 else if(t.includes('alerta')){$('alertasTab').click();falar('Abrindo alertas')}
 else if(t.includes('fechar')||t.includes('cancelar')){fecharTodosModais();falar('Fechado')}
 else if(t.includes('salvar')||t.includes('confirmar')){
  const modalAberto=modalMaisRecenteAberto();
  const form=modalAberto?modalAberto.querySelector('form'):null;
  if(form){form.requestSubmit?form.requestSubmit():form.dispatchEvent(new Event('submit',{cancelable:true}));falar('Salvando')}
  else falar('Nenhum formulário aberto para salvar')
 }
 else falar('Comando não reconhecido. Diga banho, clínica, loja, novo agendamento, funcionários, alertas, fechar ou salvar.');
}
// Gestão de funcionários (modal)
async function carregarListaFuncionarios(setorLista,elId){
 const fs=await api(`/api/funcionarios?setor=${setorLista}`);
 $(elId).innerHTML=fs.length?fs.map(f=>`<div class="func-item"><span>${f.nome}</span><button onclick="removerFuncionario(${f.id})" title="Remover">×</button></div>`).join(''):'<p class="muted">Nenhum cadastrado.</p>';
}
async function abrirFuncionarios(){
 await carregarListaFuncionarios('BANHO','listaFuncBanho');
 await carregarListaFuncionarios('CLINICA','listaFuncClinica');
 document.querySelectorAll('#funcModal .func-form').forEach(form=>form.classList.toggle('hidden',!authUser?.isAdmin));
 $('funcModal').classList.remove('hidden');
}
async function removerFuncionario(id){
 if(!confirm('Remover esse funcionário? Os agendamentos que já tinham ele atribuído ficam sem profissional.'))return;
 await api(`/api/funcionarios/${id}`,{method:'DELETE'});
 abrirFuncionarios();
 agenda();
}
$('btnFuncionarios').onclick=abrirFuncionarios;
$('fecharFuncionarios').onclick=()=>$('funcModal').classList.add('hidden');
$('formFuncBanho').onsubmit=async e=>{
 e.preventDefault();
 const body=Object.fromEntries(new FormData(e.target));body.setor='BANHO';
 await api('/api/funcionarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 e.target.reset();
 await carregarListaFuncionarios('BANHO','listaFuncBanho');
 agenda();
};
$('formFuncClinica').onsubmit=async e=>{
 e.preventDefault();
 const body=Object.fromEntries(new FormData(e.target));body.setor='CLINICA';
 await api('/api/funcionarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 e.target.reset();
 await carregarListaFuncionarios('CLINICA','listaFuncClinica');
 agenda();
};

async function carregarAcessos(){
 const usuarios=await api('/api/auth/users');
 $('listaAcessos').innerHTML=usuarios.length?usuarios.map(user=>`
  <div class="access-user ${Number(user.active)===1?'':'inactive'}">
   <div><b>${esc(user.username)}</b><span>${{BANHO:'Banho',CLINICA:'Clínica',LOJA:'Loja',ADMINISTRADOR:'Administrador'}[user.setor]||esc(user.setor)}${Number(user.active)===1?'':' • Inativo'}${Number(user.is_admin)===1?' • Acesso completo':''}</span></div>
   <div class="access-user-actions">
    ${Number(user.is_admin)===1?'<span class="muted">Acesso principal</span>':''}
    <button type="button" class="secundario" onclick="redefinirSenhaAcesso(${user.id},'${esc(user.username)}')">${Number(user.active)===1?'🔑 Redefinir senha':'♻️ Reativar acesso'}</button>
    ${Number(user.active)===1&&Number(user.id)!==Number(authUser?.id)?`<button type="button" class="danger-button" onclick="desativarAcesso(${user.id},'${esc(user.username)}')">Desativar</button>`:''}
   </div>
  </div>`).join(''):'<p class="muted">Nenhum acesso cadastrado.</p>';
}
async function abrirAcessos(){
 $('acessoMsg').textContent='';
 try{
  await carregarAcessos();
  $('acessosModal').classList.remove('hidden');
 }catch(err){$('acessoMsg').textContent='Não foi possível carregar os acessos: '+err.message}
}
$('gerenciarAcessos').onclick=abrirAcessos;
$('fecharAcessos').onclick=()=>$('acessosModal').classList.add('hidden');
$('formAcesso').onsubmit=async event=>{
 event.preventDefault();
 $('acessoMsg').textContent='';
 const form=event.currentTarget;
 const values=Object.fromEntries(new FormData(form));
 try{
  await api('/api/auth/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
  form.reset();
  $('acessoMsg').textContent='Acesso criado.';
  await carregarAcessos();
 }catch(err){$('acessoMsg').textContent=err.message}
}
async function redefinirSenhaAcesso(id,username){
 const novaSenha=window.prompt('Informe a nova senha para o usuário (exatamente 8 letras minúsculas):');
 if(novaSenha===null)return;
 try{
  await api(`/api/auth/users/${id}/password`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:novaSenha})});
  $('acessoMsg').textContent='Senha atualizada. As sessões anteriores desse usuário foram encerradas.';
  await carregarAcessos();
 }catch(err){$('acessoMsg').textContent=err.message}
}
async function desativarAcesso(id,username){
 if(!confirm(`Desativar o acesso de ${username}?`))return;
 try{
  await api(`/api/auth/users/${id}`,{method:'DELETE'});
  $('acessoMsg').textContent='Acesso desativado.';
  await carregarAcessos();
 }catch(err){$('acessoMsg').textContent=err.message}
}

iniciarSistema();
