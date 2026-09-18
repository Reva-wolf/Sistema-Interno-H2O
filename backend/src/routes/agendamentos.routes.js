const router = require('express').Router();
const pool = require('../config/database');

router.get('/', async (req,res)=>{
  const data=req.query.data || new Date().toISOString().slice(0,10);
  const setor=req.query.setor;
  let sql=`SELECT a.*,t.nome tutor,t.telefone,p.nome pet,p.especie pet_especie,
           EXISTS(SELECT 1 FROM alertas_clinica al WHERE al.agendamento_id=a.id AND al.lido=0) AS encaminhado,
           o.setor AS origem_setor
           FROM agendamentos a
           JOIN tutores t ON t.id=a.tutor_id
           JOIN pets p ON p.id=a.pet_id
           LEFT JOIN agendamentos o ON o.id=a.origem_agendamento_id
           WHERE a.data=?`;
  const params=[data];
  if(setor){sql+=' AND a.setor=?';params.push(setor);}
  sql+=' ORDER BY a.horario';
  const [rows]=await pool.query(sql,params);
  res.json(rows);
});

router.post('/', async (req,res)=>{
  const {data,horario,tutor_id,pet_id,setor,servico,observacoes}=req.body;
  if(!data||!horario||!tutor_id||!pet_id||!setor||!servico)
    return res.status(400).json({erro:'Preencha os campos obrigatórios.'});
  const [[pet]]=await pool.query('SELECT especie FROM pets WHERE id=?',[pet_id]);
  if(!pet) return res.status(404).json({erro:'Pet não encontrado.'});
  const [r]=await pool.query(`
    INSERT INTO agendamentos
    (data,horario,tutor_id,pet_id,setor,servico,especie,status,observacoes)
    VALUES (?,?,?,?,?,?,?,'AGENDADO',?)
  `,[data,horario,tutor_id,pet_id,setor,servico,pet.especie,observacoes||null]);
  res.status(201).json({id:r.insertId});
});

router.patch('/:id/status', async (req,res)=>{
  const permitidos=['AGENDADO','ANDAMENTO','LIBERADO','CANCELADO'];
  if(!permitidos.includes(req.body.status))
    return res.status(400).json({erro:'Status inválido.'});
  await pool.query('UPDATE agendamentos SET status=? WHERE id=?',[req.body.status,req.params.id]);
  res.json({ok:true});
});

// Marca/desmarca pagamento ou retirada (usado no Banho, Clínica e na lista da Loja)
router.patch('/:id/flag', async (req,res)=>{
  const {campo,valor}=req.body;
  const permitidos=['pago','retirado'];
  if(!permitidos.includes(campo))
    return res.status(400).json({erro:'Campo inválido.'});
  await pool.query(`UPDATE agendamentos SET ${campo}=? WHERE id=?`,[valor?1:0,req.params.id]);
  res.json({ok:true});
});

// Lista de avisos da Loja: pets liberados no Banho ou Clínica, ainda não retirados
router.get('/prontos-retirada', async (req,res)=>{
  const data=req.query.data || new Date().toISOString().slice(0,10);
  const [rows]=await pool.query(`
    SELECT a.id,a.horario,a.setor,a.servico,a.pago,a.retirado,
           t.nome tutor,t.telefone,p.nome pet,p.especie pet_especie
    FROM agendamentos a
    JOIN tutores t ON t.id=a.tutor_id
    JOIN pets p ON p.id=a.pet_id
    WHERE a.data=? AND a.setor IN ('BANHO','CLINICA') AND a.status='LIBERADO' AND a.retirado=0
    ORDER BY a.horario
  `,[data]);
  res.json(rows);
});

module.exports=router;
