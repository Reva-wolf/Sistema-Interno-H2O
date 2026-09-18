const router = require('express').Router();
const pool = require('../config/database');

router.get('/', async (req,res)=>{
  const [rows] = await pool.query('SELECT * FROM tutores ORDER BY nome');
  res.json(rows);
});

router.post('/', async (req,res)=>{
  const {nome, telefone} = req.body;
  if(!nome) return res.status(400).json({erro:'Nome do tutor é obrigatório.'});
  const [r] = await pool.query('INSERT INTO tutores (nome,telefone) VALUES (?,?)',[nome,telefone||null]);
  res.status(201).json({id:r.insertId,nome,telefone});
});

module.exports=router;
