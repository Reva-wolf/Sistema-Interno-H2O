const router = require('express').Router();
const pool = require('../config/database');
const {temAcessoLoja}=require('../middleware/auth.middleware');

router.param('id',async (req,res,next,id)=>{
  try{
    const [[appointment]]=await pool.query('SELECT id,setor FROM agendamentos WHERE id=?',[id]);
    if(!appointment)return res.status(404).json({erro:'Agendamento não encontrado.'});
    if(!temAcessoLoja(req.user)&&appointment.setor!==req.user.setor){
      return res.status(403).json({erro:'Este agendamento pertence a outro setor.'});
    }
    req.agendamento=appointment;
    next();
  }catch(err){next(err)}
});

router.get('/', async (req,res)=>{
  const data=req.query.data || new Date().toISOString().slice(0,10);
  const setor=req.query.setor||(temAcessoLoja(req.user)?null:req.user.setor);
  if(!temAcessoLoja(req.user)&&setor!==req.user.setor){
    return res.status(403).json({erro:'Acesso permitido apenas à agenda do seu setor.'});
  }
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
  if(!temAcessoLoja(req.user)){
    return res.status(403).json({erro:'Os agendamentos são criados somente pela Loja.'});
  }
  if(!['BANHO','CLINICA'].includes(setor)){
    return res.status(400).json({erro:'Escolha Banho ou Clínica para o agendamento.'});
  }
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
  if(!temAcessoLoja(req.user)){
    return res.status(403).json({erro:'Somente a Loja pode editar os dados do agendamento.'});
  }
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

router.patch('/:id/reagendar', async (req,res)=>{
  const {data}=req.body;
  if(typeof data!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(data)){
    return res.status(400).json({erro:'Informe uma data válida para o reagendamento.'});
  }
  const [ano,mes,dia]=data.split('-').map(Number);
  const dataEscolhida=new Date(Date.UTC(ano,mes-1,dia));
  if(dataEscolhida.getUTCFullYear()!==ano||dataEscolhida.getUTCMonth()!==mes-1||dataEscolhida.getUTCDate()!==dia){
    return res.status(400).json({erro:'Informe uma data válida para o reagendamento.'});
  }

  const connection=await pool.getConnection();
  try{
    await connection.beginTransaction();
    const [[agendamento]]=await connection.query(`
      SELECT *,DATE_FORMAT(data,'%Y-%m-%d') AS data_atual
        FROM agendamentos
       WHERE id=? AND setor IN ('BANHO','CLINICA')
       FOR UPDATE
    `,[req.params.id]);
    if(!agendamento){
      await connection.rollback();
      return res.status(404).json({erro:'Agendamento não encontrado.'});
    }
    if(String(agendamento.data_atual).slice(0,10)===data){
      await connection.rollback();
      return res.status(400).json({erro:'Escolha um dia diferente da data atual.'});
    }
    if(Number(agendamento.desmarcado)===1){
      await connection.rollback();
      return res.status(409).json({erro:'Este agendamento já foi desmarcado.'});
    }

    await connection.query(`
      UPDATE agendamentos
         SET desmarcado=TRUE, remarcado_para=?
       WHERE id=?
    `,[data,req.params.id]);
    const [novoAgendamento]=await connection.query(`
      INSERT INTO agendamentos
        (data,horario,tutor_id,pet_id,setor,servico,especie,status,
         observacoes,valor_total,valor_transporte,tipo_th,tipo_tt,
         tipo_medicamentoso,medicamento,levado_transporte,anotado,vacina,
         vacina_qual,exame,exame_qual,outro_servico,outro_servico_qual,remarcado_de)
      VALUES
        (?,?,?,?,?, ?,?,'AGENDADO',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,[
      data,agendamento.horario,agendamento.tutor_id,agendamento.pet_id,
      agendamento.setor,agendamento.servico,agendamento.especie,
      agendamento.observacoes,agendamento.valor_total,agendamento.valor_transporte,
      agendamento.tipo_th,agendamento.tipo_tt,agendamento.tipo_medicamentoso,
      agendamento.medicamento,agendamento.levado_transporte,agendamento.anotado,
      agendamento.vacina,agendamento.vacina_qual,agendamento.exame,
      agendamento.exame_qual,agendamento.outro_servico,agendamento.outro_servico_qual,
      agendamento.data_atual
    ]);
    await connection.commit();
    res.json({ok:true,data,id:novoAgendamento.insertId});
  }catch(err){
    await connection.rollback();
    throw err;
  }finally{
    connection.release();
  }
});

// Exclui um agendamento
router.delete('/:id', async (req,res)=>{
  if(!temAcessoLoja(req.user)){
    return res.status(403).json({erro:'Somente a Loja pode excluir agendamentos.'});
  }
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
  if(funcionario_id&&!temAcessoLoja(req.user)){
    const [[funcionario]]=await pool.query('SELECT setor FROM funcionarios WHERE id=?',[funcionario_id]);
    if(!funcionario||funcionario.setor!==req.user.setor){
      return res.status(403).json({erro:'Você só pode atribuir funcionários do seu setor.'});
    }
  }
  await pool.query('UPDATE agendamentos SET funcionario_id=? WHERE id=?',[funcionario_id||null,req.params.id]);
  res.json({ok:true});
});

// Marca/desmarca pagamento ou retirada (usado no Banho, Clínica e na lista da Loja)
router.patch('/:id/flag', async (req,res)=>{
  const {campo,valor}=req.body;
  const permitidos=['pago','retirado','loja_aceito','desmarcado','tipo_th','tipo_tt','tipo_medicamentoso','levado_transporte','anotado','vacina','exame','outro_servico'];
  if(!permitidos.includes(campo))
    return res.status(400).json({erro:'Campo inválido.'});
  if(!temAcessoLoja(req.user)&&['pago','retirado','loja_aceito','anotado'].includes(campo)){
    return res.status(403).json({erro:'Essa atualização é permitida somente à Loja.'});
  }
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
  if(!temAcessoLoja(req.user)){
    return res.status(403).json({erro:'Apenas a Loja pode atualizar os dados de consumo.'});
  }
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
  if(!temAcessoLoja(req.user)){
    return res.status(403).json({erro:'Apenas a Loja pode consultar os atendimentos aguardando retirada.'});
  }
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
