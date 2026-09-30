const $=id=>document.getElementById(id);
let setor='BANHO';
const data=$('data'), fdata=$('fdata'), lista=$('lista');
const horarios=['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00'];
data.value=new Date().toISOString().slice(0,10); fdata.value=data.value;

const API_BASE = (window.location.protocol === 'file:' || /:(?:5500|5501|5173)$/i.test(window.location.host)) ? 'http://localhost:3000' : '';
async function api(url,opt){
 const r=await fetch(API_BASE+url,opt);
 const text=await r.text();
 let j;
 try{ j=JSON.parse(text); }
 catch(e){
   const preview=text.replace(/\s+/g,' ').slice(0,160);
   throw Error(`Servidor não retornou JSON (${r.status}). Resposta: ${preview}`);
 }
 if(!r.ok)throw Error(j.erro||j.error||`Erro HTTP ${r.status}`);
 return j;
}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function moeda(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
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
 const cl=encaminhado?'red':(x.status==='LIBERADO'?'green':x.status==='ANDAMENTO'?'blue':'red');
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
 return `<div class="row ${cl}">
  <strong>${h}</strong><div><b>${x.pet}</b><br><span class="muted">${x.tutor} • ${x.telefone||''}</span>${tagOrigem}</div>
  <span>${x.especie==='GATO'?'🐱 Gato':'🐶 Cão'}</span><span>${x.servico}</span>
  <span>${encaminhado?'🔴 Encaminhado':label(x.status)}${Number(x.desmarcado)===1?'<br><span class="muted">🚫 Cliente desmarcou</span>':''}${x.funcionario?`<br><span class="muted">👤 ${x.funcionario}</span>`:''}${cronometro?`<br>${cronometro}`:''}${duracaoFinal?`<br>${duracaoFinal}`:''}</span>
  <div class="actions">${next?`<button onclick="status(${x.id},'${next}')">→ ${label(next)}</button>`:''}
  ${podeEncaminhar?`<button onclick="alerta(${x.id})">🚨 Encaminhar</button>`:''}
  ${selFunc}
  <label class="chk"><input type="checkbox" ${Number(x.pago)===1?'checked':''} onchange="flag(${x.id},'pago',this.checked)"> 💰 Pago</label>
  <label class="chk"><input type="checkbox" ${Number(x.anotado)===1?'checked':''} onchange="flag(${x.id},'anotado',this.checked)"> 📒 Anotado (fiado)</label>
  <label class="chk"><input type="checkbox" ${Number(x.retirado)===1?'checked':''} onchange="flag(${x.id},'retirado',this.checked)"> ✅ Retirado</label>
  <label class="chk"><input type="checkbox" ${Number(x.desmarcado)===1?'checked':''} onchange="flag(${x.id},'desmarcado',this.checked)"> 🚫 Cliente desmarcou</label>
  ${extrasBanho}${extrasClinica}
  <button onclick="editarAgendamento(${x.id})">✏️ Editar</button>
  <button onclick="excluirAgendamento(${x.id})" class="perigo">🗑️ Excluir</button>
  ${obsCampo(x)}
  </div>
 </div>`;
}
let ultimaAgenda=[];
async function agenda(){
 const podeEncaminhar=(setor==='BANHO'||setor==='CLINICA');
 const [rows,bloqueios,funcs]=await Promise.all([
  api(`/api/agendamentos?data=${data.value}&setor=${setor}`),
  api(`/api/bloqueios?data=${data.value}&setor=${setor}`),
  podeEncaminhar?api(`/api/funcionarios?setor=${setor}`):Promise.resolve([])
 ]);
 ultimaAgenda=rows;
 const by={};
 rows.forEach(x=>{const h=x.horario.slice(0,5);(by[h]=by[h]||[]).push(x)});
 const bloqueadoPor=Object.fromEntries(bloqueios.map(b=>[b.horario.slice(0,5),b]));
 lista.innerHTML=horarios.map(h=>{
  const grupo=by[h];
  if(grupo&&grupo.length){
   return grupo.map(x=>renderLinhaAgendamento(x,h,funcs,podeEncaminhar)).join('');
  }
  const b=bloqueadoPor[h];
  if(b){
   return `<div class="row gray">
    <strong>${h}</strong><span class="muted">${b.motivo?('Bloqueado: '+b.motivo):'Horário bloqueado'}</span><span>—</span><span>—</span>
    <span>🔒 Fechado</span>
    <div class="actions"><button onclick="desbloquear(${b.id})">🔓 Reabrir</button></div>
   </div>`;
  }
  return `<div class="row yellow">
   <strong>${h}</strong><span class="muted">Horário disponível</span><span>—</span><span>—</span>
   <span>🟡 Livre</span>
   <div class="actions"><button onclick="bloquear('${h}')">🔒 Bloquear</button></div>
  </div>`;
 }).join('');
 $('total').textContent=rows.length;$('aguardando').textContent=rows.filter(x=>x.status==='AGENDADO').length;
 $('andamento').textContent=rows.filter(x=>x.status==='ANDAMENTO').length;$('liberados').textContent=rows.filter(x=>x.status==='LIBERADO').length;
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
async function status(id,s){await api(`/api/agendamentos/${id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:s})});agenda()}
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
 if(setor==='LOJA')avisosLoja();
 else if(setor==='FINALIZADOS')finalizadosLista();
 else agenda();
}
async function avisosLoja(){
 const avisos=await api(`/api/agendamentos/prontos-retirada?data=${data.value}`);
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
    <button onclick="marcarRetirado(${a.id})">✅ Cliente avisado / Retirado</button>
   </div>
   <div class="row-extra">${detalhesAtendimento(a)}${a.observacoes?`<div class="detalhes-atendimento"><b>Observação da agenda:</b> ${esc(a.observacoes)}</div>`:''}${lojaEditor(a)}</div>
  </div>`).join(''):'<p class="muted" style="padding:16px">Nenhum pet liberado aguardando retirada.</p>';
}
async function marcarRetirado(id){ await flag(''+id,'retirado',true); avisosLoja(); }
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
 if(setor==='LOJA')return avisosLoja();
 if(setor==='FINALIZADOS')return finalizadosLista();
 return agenda();
}
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
 try{
  const d=fdata.value||data.value;
  const [ocupados,bloqueios]=await Promise.all([
   api(`/api/agendamentos?data=${d}&setor=${setor}`),
   api(`/api/bloqueios?data=${d}&setor=${setor}`)
  ]);
  const ocupadosSet=setor==='CLINICA'
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
 const opcoes=setor==='CLINICA'?['Consulta','Revisão']:['Banho','Banho e Tosa'];
 const lista=[...opcoes];
 if(valorAtual&&!lista.includes(valorAtual))lista.push(valorAtual);
 $('servicoSelect').innerHTML='<option value="">Selecione...</option>'+lista.map(s=>`<option value="${s}">${s}</option>`).join('');
 if(valorAtual)$('servicoSelect').value=valorAtual;
}
let editandoId=null;
$('novo').onclick=async()=>{
 editandoId=null;
 $('modalAgendamentoTitulo').textContent='Novo agendamento';
 $('form').reset();$('formMsg').textContent='';
 fdata.value=data.value;
 popularServicos();
 $('modal').classList.remove('hidden');
 await carregarTutores();await carregarPets();await popularHorariosNovo();
};
fdata.onchange=()=>popularHorariosNovo(editandoId);
$('fechar').onclick=()=>{editandoId=null;$('modal').classList.add('hidden')};
$('form').onsubmit=async e=>{
 e.preventDefault();
 const body=Object.fromEntries(new FormData(e.target));
 try{
  if(editandoId){
   await api(`/api/agendamentos/${editandoId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }else{
   body.setor=setor;
   await api('/api/agendamentos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }
  $('modal').classList.add('hidden');
  e.target.reset();
  editandoId=null;
  data.value=body.data;
  renderizar();
 }catch(err){$('formMsg').textContent=err.message}
};
async function editarAgendamento(id){
 const x=ultimaAgenda.find(r=>r.id===id);
 if(!x)return;
 editandoId=id;
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
async function excluirAgendamento(id){
 if(!confirm('Tem certeza que deseja excluir esse agendamento? Essa ação não pode ser desfeita.'))return;
 await api(`/api/agendamentos/${id}`,{method:'DELETE'});
 renderizar();
}
document.querySelectorAll('.tab[data-setor]').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
 b.classList.add('active');
 setor=b.dataset.setor;
 const titulos={BANHO:'Banho e Tosa',CLINICA:'Clínica',LOJA:'Loja',FINALIZADOS:'Finalizados'};
 $('titulo').textContent='Agenda — '+titulos[setor];
 $('novo').style.display=(setor==='LOJA'||setor==='FINALIZADOS')?'none':'';
 $('subtitulo').textContent=setor==='LOJA'?'Pets liberados e lançamentos da loja':setor==='FINALIZADOS'?'Histórico completo de atendimentos e retiradas':'20 horários';
 renderizar();
});
data.onchange=renderizar;
async function alerta(id){
 const destino=setor==='BANHO'?'Clínica':'Banho e Tosa';
 const mensagem=prompt(`Digite o alerta para encaminhar para ${destino}:`,'Solicitar avaliação.');
 if(!mensagem)return;
 const r=await api('/api/alertas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agendamento_id:id,mensagem})});
 carregarAlertas();
 agenda();
 alert(`Encaminhado para ${destino} às ${r.horario}.`);
}
async function carregarAlertas(){
 const a=await api('/api/alertas');
 $('alertCount').textContent=a.filter(x=>Number(x.sinalizado)!==1).length;
}
async function abrirAlertas(){
 const a=await api('/api/alertas');
 $('alertCount').textContent=a.filter(x=>Number(x.sinalizado)!==1).length;
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
 await api(`/api/alertas/${id}/sinalizado`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({valor})});
 await abrirAlertas();
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
function clicarAba(setorAlvo){const btn=document.querySelector(`.tab[data-setor="${setorAlvo}"]`);if(btn)btn.click()}
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
agenda();carregarAlertas();

// Gestão de funcionários (modal)
async function carregarListaFuncionarios(setorLista,elId){
 const fs=await api(`/api/funcionarios?setor=${setorLista}`);
 $(elId).innerHTML=fs.length?fs.map(f=>`<div class="func-item"><span>${f.nome}</span><button onclick="removerFuncionario(${f.id})" title="Remover">×</button></div>`).join(''):'<p class="muted">Nenhum cadastrado.</p>';
}
async function abrirFuncionarios(){
 await carregarListaFuncionarios('BANHO','listaFuncBanho');
 await carregarListaFuncionarios('CLINICA','listaFuncClinica');
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
