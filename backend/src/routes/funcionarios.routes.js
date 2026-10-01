const router = require('express').Router();
const pool = require('../config/database');
const {requireAdmin,requireLoja,temAcessoLoja}=require('../middleware/auth.middleware');

// Lista funcionários (opcionalmente filtrados por setor: BANHO ou CLINICA)
router.get('/', async (req,res)=>{
  const {setor}=req.query;
  if(!temAcessoLoja(req.user)&&setor&&setor!==req.user.setor){
    return res.status(403).json({erro:'Acesso permitido apenas aos funcionários do seu setor.'});
  }
  if(!temAcessoLoja(req.user)&&!setor){
    return res.status(403).json({erro:'Informe o seu setor.'});
  }
  const sql = setor
    ? 'SELECT * FROM funcionarios WHERE setor=? ORDER BY nome'
    : 'SELECT * FROM funcionarios ORDER BY setor,nome';
  const [rows] = await pool.query(sql, setor ? [setor] : []);
  res.json(rows);
});

// Cadastra um novo funcionário
router.post('/', requireAdmin, async (req,res)=>{
  const {nome,setor}=req.body;
  if(!nome) return res.status(400).json({erro:'Nome do funcionário é obrigatório.'});
  if(!['BANHO','CLINICA'].includes(setor))
    return res.status(400).json({erro:'Setor deve ser BANHO ou CLINICA.'});
  const [r]=await pool.query('INSERT INTO funcionarios (nome,setor) VALUES (?,?)',[nome,setor]);
  res.status(201).json({id:r.insertId,nome,setor});
});

// Remove um funcionário (os agendamentos que já tinham ele atribuído ficam sem profissional, não são apagados)
router.delete('/:id', requireLoja, async (req,res)=>{
  const [[employee]]=await pool.query('SELECT setor FROM funcionarios WHERE id=?',[req.params.id]);
  if(!employee)return res.status(404).json({erro:'Funcionário não encontrado.'});
  await pool.query('DELETE FROM funcionarios WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

module.exports=router;
