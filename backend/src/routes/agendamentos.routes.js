const router = require('express').Router();
const pool = require('../config/database');

router.get('/', async (req,res)=>{
  const data=req.query.data || new Date().toISOString().slice(0,10);
  const setor=req.query.setor;
  let sql=`SELECT a.*,t.nome tutor,t.telefone,p.nome pet,p.especie pet_especie,
           EXISTS(SELECT 1 FROM alertas_clinica al WHERE al.agendamento_id=a.id AND al.lido=0) AS encaminhado,
           o.setor AS origem_setor, f.nome AS funcionario
           FROM agendamentos a
           JOIN tutores t ON t.id=a.tutor_id
           JOIN pets p ON p.id=a.pet_id
           LEFT JOIN agendamentos o ON o.id=a.origem_agendamento_id
           LEFT JOIN funcionarios f ON f.id=a.funcionario_id
           WHERE a.data=?`;
  const params=[data];
  if(setor){sql+=' AND a.setor=?';params.push(setor);}
  if(req.query.retirado==='1'){sql+=' AND a.retirado=1';}
  sql+=' ORDER BY a.horario';
  const [rows]=await pool.query(sql,params);
  res.json(rows);
});

router.post('/', async (req,res)=>{
  const {data,horario,tutor_id,pet_id,setor,servico,observacoes,valor_total,valor_transporte}=req.body;
  if(!data||!horario||!tutor_id||!pet_id||!setor||!servico)
    return res.status(400).json({erro:'Preencha os campos obrigatórios.'});
  const [[pet]]=await pool.query('SELECT especie FROM pets WHERE id=?',[pet_id]);
  if(!pet) return res.status(404).json({erro:'Pet não encontrado.'});
  const [r]=await pool.query(`
    INSERT INTO agendamentos
    (data,horario,tutor_id,pet_id,setor,servico,especie,status,observacoes,valor_total,valor_transporte)
    VALUES (?,?,?,?,?,?,?,'AGENDADO',?,?,?)
  `,[data,horario,tutor_id,pet_id,setor,servico,pet.especie,observacoes||null,valor_total||null,valor_transporte||null]);
  res.status(201).json({id:r.insertId});
});

// Edita um agendamento existente (data, horário, tutor, pet, serviço, valores, observações — não muda o setor)
router.patch('/:id', async (req,res)=>{
  const {data,horario,tutor_id,pet_id,servico,observacoes,valor_total,valor_transporte}=req.body;
  if(!data||!horario||!tutor_id||!pet_id||!servico)
    return res.status(400).json({erro:'Preencha os campos obrigatórios.'});
  const [[pet]]=await pool.query('SELECT especie FROM pets WHERE id=?',[pet_id]);
  if(!pet) return res.status(404).json({erro:'Pet não encontrado.'});
  await pool.query(`
    UPDATE agendamentos
    SET data=?,horario=?,tutor_id=?,pet_id=?,servico=?,especie=?,observacoes=?,valor_total=?,valor_transporte=?
    WHERE id=?
  `,[data,horario,tutor_id,pet_id,servico,pet.especie,observacoes||null,valor_total||null,valor_transporte||null,req.params.id]);
  res.json({ok:true});
});

// Exclui um agendamento
router.delete('/:id', async (req,res)=>{
  await pool.query('DELETE FROM agendamentos WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

router.patch('/:id/status', async (req,res)=>{
  const permitidos=['AGENDADO','ANDAMENTO','LIBERADO','CANCELADO'];
  if(!permitidos.includes(req.body.status))
    return res.status(400).json({erro:'Status inválido.'});
  const iniciaCronometro = req.body.status==='ANDAMENTO' ? ', iniciado_em=NOW()' : '';
  const finalizaCronometro = req.body.status==='LIBERADO' ? ', finalizado_em=NOW()' : '';
  await pool.query(`UPDATE agendamentos SET status=?${iniciaCronometro}${finalizaCronometro} WHERE id=?`,[req.body.status,req.params.id]);
  res.json({ok:true});
});

// Atribui (ou remove) o funcionário responsável pelo atendimento
router.patch('/:id/funcionario', async (req,res)=>{
  const {funcionario_id}=req.body;
  await pool.query('UPDATE agendamentos SET funcionario_id=? WHERE id=?',[funcionario_id||null,req.params.id]);
  res.json({ok:true});
});

// Marca/desmarca pagamento ou retirada (usado no Banho, Clínica e na lista da Loja)
router.patch('/:id/flag', async (req,res)=>{
  const {campo,valor}=req.body;
  const permitidos=['pago','retirado','desmarcado','tipo_th','tipo_tt','tipo_medicamentoso','levado_transporte','anotado','vacina','exame','outro_servico'];
  if(!permitidos.includes(campo))
    return res.status(400).json({erro:'Campo inválido.'});
  await pool.query(`UPDATE agendamentos SET ${campo}=? WHERE id=?`,[valor?1:0,req.params.id]);
  res.json({ok:true});
});

// Salva a observação digitada direto na linha da agenda
router.patch('/:id/observacoes', async (req,res)=>{
  await pool.query('UPDATE agendamentos SET observacoes=? WHERE id=?',[req.body.observacoes||null,req.params.id]);
  res.json({ok:true});
});

// Salva textos auxiliares (qual medicamento, qual vacina, qual exame, outro serviço)
router.patch('/:id/texto', async (req,res)=>{
  const {campo,valor}=req.body;
  const permitidos=['medicamento','vacina_qual','exame_qual','outro_servico_qual'];
  if(!permitidos.includes(campo))
    return res.status(400).json({erro:'Campo inválido.'});
  await pool.query(`UPDATE agendamentos SET ${campo}=? WHERE id=?`,[valor||null,req.params.id]);
  res.json({ok:true});
});

// Atualiza dados lançados pela Loja sem alterar o histórico do agendamento.
router.patch('/:id/loja', async (req,res)=>{
  const {loja_observacoes,loja_produtos,loja_valor}=req.body;
  const valor = loja_valor === '' || loja_valor == null ? 0 : Number(loja_valor);
  if(Number.isNaN(valor) || valor < 0)
    return res.status(400).json({erro:'Valor da loja inválido.'});

  await pool.query(`
    UPDATE agendamentos
       SET loja_observacoes=?, loja_produtos=?, loja_valor=?
     WHERE id=?
  `,[loja_observacoes||null,loja_produtos||null,valor,req.params.id]);
  res.json({ok:true});
});

// Lista de avisos da Loja: pets liberados no Banho ou Clínica, ainda não retirados
router.get('/prontos-retirada', async (req,res)=>{
  const data=req.query.data || new Date().toISOString().slice(0,10);
  const [rows]=await pool.query(`
    SELECT a.*,t.nome tutor,t.telefone,p.nome pet,p.especie pet_especie,
           f.nome AS funcionario
    FROM agendamentos a
    JOIN tutores t ON t.id=a.tutor_id
    JOIN pets p ON p.id=a.pet_id
    LEFT JOIN funcionarios f ON f.id=a.funcionario_id
    WHERE a.data=? AND a.setor IN ('BANHO','CLINICA') AND a.status='LIBERADO' AND a.retirado=0
    ORDER BY a.horario
  `,[data]);
  res.json(rows);
});

module.exports=router;
