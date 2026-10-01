const router = require('express').Router();
const pool = require('../config/database');
const {temAcessoLoja}=require('../middleware/auth.middleware');

router.get('/', async (req,res)=>{
  if(!temAcessoLoja(req.user))return res.status(403).json({erro:'Somente a Loja ou o Administrador pode consultar todos os tutores.'});
  const [rows] = await pool.query('SELECT * FROM tutores ORDER BY nome');
  res.json(rows);
});

router.post('/', async (req,res)=>{
  if(!temAcessoLoja(req.user))return res.status(403).json({erro:'Somente a Loja ou o Administrador pode cadastrar tutores.'});
  const {nome, telefone} = req.body;
  if(!nome) return res.status(400).json({erro:'Nome do tutor é obrigatório.'});
  const [r] = await pool.query('INSERT INTO tutores (nome,telefone) VALUES (?,?)',[nome,telefone||null]);
  res.status(201).json({id:r.insertId,nome,telefone});
});

module.exports=router;
