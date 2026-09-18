const router = require('express').Router();
const pool = require('../config/database');

// Lista os horários fechados de um dia/setor
router.get('/', async (req,res)=>{
  const {data,setor}=req.query;
  if(!data||!setor) return res.status(400).json({erro:'Informe data e setor.'});
  const [rows]=await pool.query(
    'SELECT * FROM horarios_bloqueados WHERE data=? AND setor=?',
    [data,setor]
  );
  res.json(rows);
});

// Fecha um horário (ex: pausa, feriado, manutenção)
router.post('/', async (req,res)=>{
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
router.delete('/:id', async (req,res)=>{
  await pool.query('DELETE FROM horarios_bloqueados WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

module.exports=router;
