const router = require('express').Router();
const pool = require('../config/database');

router.get('/', async (req,res)=>{
  const [rows] = await pool.query(`
    SELECT p.*, t.nome AS tutor, t.telefone
    FROM pets p JOIN tutores t ON t.id=p.tutor_id
    ORDER BY p.nome
  `);
  res.json(rows);
});

router.post('/', async (req,res)=>{
  const {tutor_id,nome,especie} = req.body;
  if(!tutor_id || !nome || !['CAO','GATO'].includes(especie))
    return res.status(400).json({erro:'Tutor, nome do pet e espécie são obrigatórios.'});
  const [r]=await pool.query(
    'INSERT INTO pets (tutor_id,nome,especie) VALUES (?,?,?)',
    [tutor_id,nome,especie]
  );
  res.status(201).json({id:r.insertId,tutor_id,nome,especie});
});

module.exports=router;
