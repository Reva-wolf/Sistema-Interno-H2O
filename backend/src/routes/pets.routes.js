const router = require('express').Router();
const pool = require('../config/database');
const {temAcessoLoja}=require('../middleware/auth.middleware');

router.get('/', async (req,res)=>{
  if(!temAcessoLoja(req.user))return res.status(403).json({erro:'Somente a Loja ou o Administrador pode consultar todos os pets.'});
  const [rows] = await pool.query(`
    SELECT p.*, t.nome AS tutor, t.telefone
    FROM pets p JOIN tutores t ON t.id=p.tutor_id
    ORDER BY p.nome
  `);
  res.json(rows);
});

router.post('/', async (req,res)=>{
  if(!temAcessoLoja(req.user))return res.status(403).json({erro:'Somente a Loja ou o Administrador pode cadastrar pets.'});
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
