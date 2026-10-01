const router = require('express').Router();
const pool = require('../config/database');
const {temAcessoLoja}=require('../middleware/auth.middleware');

router.param('id',async(req,res,next,id)=>{
  try{
    const [[alerta]]=await pool.query(`
      SELECT al.id,al.sinalizado,a.setor
        FROM alertas_clinica al
        JOIN agendamentos a ON a.id=al.agendamento_id
       WHERE al.id=?
    `,[id]);
    if(!alerta)return res.status(404).json({erro:'Alerta não encontrado.'});
    const setorOposto=req.user.setor==='BANHO'?'CLINICA':'BANHO';
    const podeAcessar=temAcessoLoja(req.user)
      ||alerta.setor===req.user.setor
      ||(alerta.setor===setorOposto&&Number(alerta.sinalizado)===0);
    if(!podeAcessar)return res.status(403).json({erro:'Acesso permitido apenas aos alertas do seu setor.'});
    req.alerta=alerta;
    next();
  }catch(err){next(err)}
});

router.get('/', async (req,res)=>{
  const filtroSetor=temAcessoLoja(req.user)?'':'WHERE a.setor=? OR (a.setor=? AND al.sinalizado=0)';
  const params=temAcessoLoja(req.user)?[]:[req.user.setor,req.user.setor==='BANHO'?'CLINICA':'BANHO'];
  const [rows]=await pool.query(`
    SELECT al.*, a.data,a.horario,a.setor AS origem,a.servico,p.especie pet_especie,t.nome tutor,p.nome pet
    FROM alertas_clinica al
    JOIN agendamentos a ON a.id=al.agendamento_id
    JOIN tutores t ON t.id=a.tutor_id
    JOIN pets p ON p.id=a.pet_id
    ${filtroSetor}
    ORDER BY al.sinalizado ASC, al.created_at DESC
  `,params);
  res.json(rows);
});

// Encaminha um agendamento para o setor oposto (Banho <-> Clínica) sem criar outra marcação.
router.post('/', async (req,res)=>{
  const {agendamento_id,mensagem}=req.body;
  if(!agendamento_id||!mensagem) return res.status(400).json({erro:'Agendamento e mensagem são obrigatórios.'});

  const [[origem]]=await pool.query('SELECT * FROM agendamentos WHERE id=?',[agendamento_id]);
  if(!origem) return res.status(404).json({erro:'Agendamento não encontrado.'});
  if(!temAcessoLoja(req.user)&&origem.setor!==req.user.setor){
    return res.status(403).json({erro:'Só é possível encaminhar atendimentos do seu setor.'});
  }
  const destino = origem.setor==='BANHO' ? 'CLINICA' : origem.setor==='CLINICA' ? 'BANHO' : null;
  if(!destino) return res.status(400).json({erro:'Só é possível encaminhar entre Banho e Clínica.'});

  const horarioOrigem=origem.horario.toString().slice(0,5);
  const [alertaRes]=await pool.query(
    'INSERT INTO alertas_clinica (agendamento_id,mensagem) VALUES (?,?)',
    [agendamento_id,mensagem]
  );
  res.status(201).json({id:alertaRes.insertId,horario:horarioOrigem,destino});
});

router.patch('/:id/lido',async(req,res)=>{
  await pool.query('UPDATE alertas_clinica SET lido=1 WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

router.patch('/:id/sinalizado',async(req,res)=>{
  const valor = req.body.valor === undefined ? true : !!req.body.valor;
  await pool.query(
    'UPDATE alertas_clinica SET sinalizado=?, lido=CASE WHEN ?=1 THEN 1 ELSE lido END WHERE id=?',
    [valor?1:0,valor?1:0,req.params.id]
  );
  res.json({ok:true,sinalizado:valor});
});

module.exports=router;
