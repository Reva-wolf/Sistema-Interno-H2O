const router = require('express').Router();
const pool = require('../config/database');

// Grade fixa de horários do dia (mesma usada no front-end)
const HORARIOS=['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00'];

router.get('/', async (req,res)=>{
  const [rows]=await pool.query(`
    SELECT al.*, a.data,a.horario,a.setor AS origem,t.nome tutor,p.nome pet
    FROM alertas_clinica al
    JOIN agendamentos a ON a.id=al.agendamento_id
    JOIN tutores t ON t.id=a.tutor_id
    JOIN pets p ON p.id=a.pet_id
    ORDER BY al.lido ASC, al.created_at DESC
  `);
  res.json(rows);
});

// Encaminha um agendamento para o setor oposto (Banho <-> Clínica):
// registra o alerta (fica no histórico da aba 🚨 Alertas) e já cria um
// agendamento de verdade no setor de destino, no primeiro horário livre
// a partir do horário de origem.
router.post('/', async (req,res)=>{
  const {agendamento_id,mensagem}=req.body;
  if(!agendamento_id||!mensagem) return res.status(400).json({erro:'Agendamento e mensagem são obrigatórios.'});

  const [[origem]]=await pool.query('SELECT * FROM agendamentos WHERE id=?',[agendamento_id]);
  if(!origem) return res.status(404).json({erro:'Agendamento não encontrado.'});
  const destino = origem.setor==='BANHO' ? 'CLINICA' : origem.setor==='CLINICA' ? 'BANHO' : null;
  if(!destino) return res.status(400).json({erro:'Só é possível encaminhar entre Banho e Clínica.'});

  const [alertaRes]=await pool.query(
    'INSERT INTO alertas_clinica (agendamento_id,mensagem) VALUES (?,?)',
    [agendamento_id,mensagem]
  );

  const [ocupados]=await pool.query('SELECT horario FROM agendamentos WHERE data=? AND setor=?',[origem.data,destino]);
  const [bloqueios]=await pool.query('SELECT horario FROM horarios_bloqueados WHERE data=? AND setor=?',[origem.data,destino]);
  const indisponiveis=new Set([...ocupados,...bloqueios].map(r=>r.horario.toString().slice(0,5)));
  const horarioOrigem=origem.horario.toString().slice(0,5);
  const posOrigem=HORARIOS.indexOf(horarioOrigem);
  const ordemBusca=posOrigem>=0?[...HORARIOS.slice(posOrigem),...HORARIOS.slice(0,posOrigem)]:HORARIOS;
  const horarioEscolhido=ordemBusca.find(h=>!indisponiveis.has(h))||horarioOrigem;

  const servico=destino==='CLINICA'?'Encaminhado do Banho':'Encaminhado da Clínica';
  const [novo]=await pool.query(`
    INSERT INTO agendamentos
    (data,horario,tutor_id,pet_id,setor,origem_agendamento_id,servico,especie,status,observacoes)
    VALUES (?,?,?,?,?,?,?,?,'AGENDADO',?)
  `,[origem.data,horarioEscolhido+':00',origem.tutor_id,origem.pet_id,destino,agendamento_id,servico,origem.especie,mensagem]);

  res.status(201).json({id:alertaRes.insertId,agendamento_destino_id:novo.insertId,horario:horarioEscolhido,destino});
});

router.patch('/:id/lido',async(req,res)=>{
  await pool.query('UPDATE alertas_clinica SET lido=1 WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

module.exports=router;
