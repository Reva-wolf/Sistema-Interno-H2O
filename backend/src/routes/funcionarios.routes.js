const router = require('express').Router();
const pool = require('../config/database');

// Lista funcionários (opcionalmente filtrados por setor: BANHO ou CLINICA)
router.get('/', async (req,res)=>{
  const {setor}=req.query;
  const sql = setor
    ? 'SELECT * FROM funcionarios WHERE setor=? ORDER BY nome'
    : 'SELECT * FROM funcionarios ORDER BY setor,nome';
  const [rows] = await pool.query(sql, setor ? [setor] : []);
  res.json(rows);
});

// Cadastra um novo funcionário
router.post('/', async (req,res)=>{
  const {nome,setor}=req.body;
  if(!nome) return res.status(400).json({erro:'Nome do funcionário é obrigatório.'});
  if(!['BANHO','CLINICA'].includes(setor))
    return res.status(400).json({erro:'Setor deve ser BANHO ou CLINICA.'});
  const [r]=await pool.query('INSERT INTO funcionarios (nome,setor) VALUES (?,?)',[nome,setor]);
  res.status(201).json({id:r.insertId,nome,setor});
});

// Remove um funcionário (os agendamentos que já tinham ele atribuído ficam sem profissional, não são apagados)
router.delete('/:id', async (req,res)=>{
  await pool.query('DELETE FROM funcionarios WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

module.exports=router;
