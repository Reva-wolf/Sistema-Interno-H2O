const $=id=>document.getElementById(id);
let setor='BANHO';
const data=$('data'), fdata=$('fdata'), lista=$('lista');
const horarios=['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00'];
data.value=new Date().toISOString().slice(0,10); fdata.value=data.value;

async function api(url,opt){const r=await fetch(url,opt);const j=await r.json();if(!r.ok)throw Error(j.erro||'Erro');return j}
async function agenda(){
 const podeEncaminhar=(setor==='BANHO'||setor==='CLINICA');
 const [rows,bloqueios]=await Promise.all([
  api(`/api/agendamentos?data=${data.value}&setor=${setor}`),
  api(`/api/bloqueios?data=${data.value}&setor=${setor}`)
 ]);
 const by=Object.fromEntries(rows.map(x=>[x.horario.slice(0,5),x]));
 const bloqueadoPor=Object.fromEntries(bloqueios.map(b=>[b.horario.slice(0,5),b]));
 lista.innerHTML=horarios.map(h=>{
  const x=by[h];
  if(x){
   const encaminhado=Number(x.encaminhado)===1;
   const cl=encaminhado?'red':(x.status==='LIBERADO'?'green':x.status==='ANDAMENTO'?'blue':'red');
   const next=x.status==='AGENDADO'?'ANDAMENTO':x.status==='ANDAMENTO'?'LIBERADO':null;
   const tagOrigem=x.origem_setor?`<br><span class="muted">🔄 Encaminhado ${x.origem_setor==='BANHO'?'do Banho':'da Clínica'}</span>`:'';
   return `<div class="row ${cl}">
    <strong>${h}</strong><div><b>${x.pet}</b><br><span class="muted">${x.tutor} • ${x.telefone||''}</span>${tagOrigem}</div>
    <span>${x.especie==='GATO'?'🐱 Gato':'🐶 Cão'}</span><span>${x.servico}</span>
    <span>${encaminhado?'🔴 Encaminhado':label(x.status)}</span>
    <div class="actions">${next?`<button onclick="status(${x.id},'${next}')">→ ${label(next)}</button>`:''}
    ${podeEncaminhar?`<button onclick="alerta(${x.id})">🚨 Encaminhar</button>`:''}
    <label class="chk"><input type="checkbox" ${Number(x.pago)===1?'checked':''} onchange="flag(${x.id},'pago',this.checked)"> 💰 Pago</label>
    <label class="chk"><input type="checkbox" ${Number(x.retirado)===1?'checked':''} onchange="flag(${x.id},'retirado',this.checked)"> ✅ Retirado</label>
    </div>
   </div>`;
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
async function flag(id,campo,valor){
 await api(`/api/agendamentos/${id}/flag`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({campo,valor})});
 if(setor!=='LOJA')agenda();
}
async function avisosLoja(){
 const avisos=await api(`/api/agendamentos/prontos-retirada?data=${data.value}`);
 $('total').textContent=avisos.length;$('aguardando').textContent='—';$('andamento').textContent='—';$('liberados').textContent='—';
 lista.innerHTML=avisos.length?avisos.map(a=>`
  <div class="row green">
   <strong>${a.horario.slice(0,5)}</strong>
   <div><b>${a.pet}</b><br><span class="muted">${a.tutor} • ${a.telefone||''}</span></div>
   <span>${a.pet_especie==='GATO'?'🐱 Gato':'🐶 Cão'}</span>
   <span class="muted">Liberado ${a.setor==='BANHO'?'no Banho':'na Clínica'} — ${a.servico}</span>
   <span>🟢 Avisar cliente</span>
   <div class="actions">
    <label class="chk"><input type="checkbox" ${Number(a.pago)===1?'checked':''} onchange="flag(${a.id},'pago',this.checked)"> 💰 Pago</label>
    <button onclick="marcarRetirado(${a.id})">✅ Cliente avisado / Retirado</button>
   </div>
  </div>`).join(''):'<p class="muted" style="padding:16px">Nenhum pet liberado aguardando retirada.</p>';
}
async function marcarRetirado(id){ await flag(id,'retirado',true); avisosLoja(); }
function renderizar(){ setor==='LOJA'?avisosLoja():agenda(); }
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
async function popularHorariosNovo(){
 const d=fdata.value||data.value;
 const [ocupados,bloqueios]=await Promise.all([
  api(`/api/agendamentos?data=${d}&setor=${setor}`),
  api(`/api/bloqueios?data=${d}&setor=${setor}`)
 ]);
 const ocupadosSet=new Set(ocupados.map(x=>x.horario.slice(0,5)));
 const bloqueadosSet=new Set(bloqueios.map(b=>b.horario.slice(0,5)));
 const sel=$('novoHorario');
 const atual=sel.value;
 sel.innerHTML=horarios.map(h=>{
  const ocupado=ocupadosSet.has(h),bloqueado=bloqueadosSet.has(h);
  const rotulo=ocupado?`${h} (ocupado)`:bloqueado?`${h} (bloqueado)`:h;
  return `<option value="${h}" ${(ocupado||bloqueado)?'disabled':''}>${rotulo}</option>`;
 }).join('');
 if(horarios.includes(atual)&&!ocupadosSet.has(atual)&&!bloqueadosSet.has(atual))sel.value=atual;
}
$('novo').onclick=async()=>{fdata.value=data.value;$('modal').classList.remove('hidden');await carregarTutores();await carregarPets();await popularHorariosNovo()};
fdata.onchange=popularHorariosNovo;
$('fechar').onclick=()=> $('modal').classList.add('hidden');
$('form').onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));body.setor=setor;
 try{await api('/api/agendamentos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});$('modal').classList.add('hidden');e.target.reset();data.value=body.data;agenda()}catch(err){$('formMsg').textContent=err.message}};
document.querySelectorAll('.tab[data-setor]').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
 b.classList.add('active');
 setor=b.dataset.setor;
 $('titulo').textContent='Agenda — '+(setor==='BANHO'?'Banho e Tosa':setor==='CLINICA'?'Clínica':'Loja');
 $('novo').style.display=setor==='LOJA'?'none':'';
 $('subtitulo').textContent=setor==='LOJA'?'Avisos de retirada':'20 horários';
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
async function carregarAlertas(){const a=await api('/api/alertas');$('alertCount').textContent=a.filter(x=>!x.lido).length}
$('alertasTab').onclick=async()=>{const a=await api('/api/alertas');$('alertList').innerHTML=a.length?a.map(x=>`<div class="alert"><button onclick="ler(${x.id})">✓</button><b>${x.pet}</b> — ${x.tutor}<br><span>${x.mensagem}</span><br><small>${new Date(x.created_at).toLocaleString('pt-BR')}</small></div>`).join(''):'<p class="muted">Nenhum alerta.</p>';$('alertModal').classList.remove('hidden')};
$('fecharAlertas').onclick=()=> $('alertModal').classList.add('hidden');
async function ler(id){await api(`/api/alertas/${id}/lido`,{method:'PATCH'});$('alertasTab').click();carregarAlertas()}
$('voiceButton').onclick=()=>{if(!('SpeechRecognition'in window||'webkitSpeechRecognition'in window)){alert('Reconhecimento de voz não disponível neste navegador. No tablet Android, testar Chrome.');return} const R=window.SpeechRecognition||window.webkitSpeechRecognition;const r=new R();r.lang='pt-BR';r.start();r.onresult=e=>alert('Comando reconhecido: '+e.results[0][0].transcript+'\n\nA interpretação dos comandos será ligada na Parte 5.')};
agenda();carregarAlertas();
