const router = require('express').Router();
const pool = require('../config/database');
const {requireLoja,temAcessoLoja}=require('../middleware/auth.middleware');

// Lista os horários fechados de um dia/setor
router.get('/', async (req,res)=>{
  const {data,setor}=req.query;
  if(!data||!setor) return res.status(400).json({erro:'Informe data e setor.'});
  if(!temAcessoLoja(req.user)&&setor!==req.user.setor){
    return res.status(403).json({erro:'Acesso permitido apenas à agenda do seu setor.'});
  }
  const [rows]=await pool.query(
    'SELECT * FROM horarios_bloqueados WHERE data=? AND setor=?',
    [data,setor]
  );
  res.json(rows);
});

// Fecha um horário (ex: pausa, feriado, manutenção)
router.post('/', requireLoja, async (req,res)=>{
  const {data,horario,setor,motivo}=req.body;
  if(!data||!horario||!setor)
    return res.status(400).json({erro:'Data, horário e setor são obrigatórios.'});
  try{
    const [r]=await pool.query(
      'INSERT INTO horarios_bloqueados (data,horario,setor,motivo) VALUES (?,?,?,?)',
      [data,horario,setor,motivo||null]
    );
    res.status(201).json({id:r.insertId});
  }catch(err){
    if(err.code==='ER_DUP_ENTRY')
      return res.status(409).json({erro:'Esse horário já está bloqueado.'});
    throw err;
  }
});

// Reabre um horário fechado
router.delete('/:id', requireLoja, async (req,res)=>{
  const [[block]]=await pool.query('SELECT setor FROM horarios_bloqueados WHERE id=?',[req.params.id]);
  if(!block)return res.status(404).json({erro:'Horário bloqueado não encontrado.'});
  await pool.query('DELETE FROM horarios_bloqueados WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

module.exports=router;
