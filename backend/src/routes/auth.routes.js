const crypto = require('crypto');
const router = require('express').Router();
const pool = require('../config/database');
const {
  clearSessionCookie,
  getSessionToken,
  requireAuth,
  requireAdmin,
  sessionHash,
  setSessionCookie
} = require('../middleware/auth.middleware');

const SESSION_LIFETIME_HOURS = 12;
const PASSWORD_BYTES = 64;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;
const REGISTRATION_WINDOW_MS = 15 * 60 * 1000;
const MAX_REGISTRATIONS = 10;
const loginAttempts = new Map();
const registrationAttempts = new Map();

function validarCredenciais(username, password) {
  if (typeof username !== 'string' || !username.trim() || username.trim().length > 40) {
    return 'Informe um usuário com até 40 caracteres.';
  }
  if (typeof password !== 'string' || !/^[a-z]{8}$/.test(password)) {
    return 'A senha deve ter exatamente 8 letras minúsculas, sem números ou símbolos.';
  }
  return null;
}

function hashPassword(password, salt=crypto.randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: crypto.scryptSync(password, salt, PASSWORD_BYTES).toString('hex')
  };
}

function validarSetor(setor) {
  return ['LOJA','BANHO','CLINICA','ADMINISTRADOR'].includes(setor);
}

async function criarSessao(userId, res, secure, database=pool) {
  const token=crypto.randomBytes(32).toString('hex');
  await database.query(
    `INSERT INTO auth_sessions (token_hash,user_id,expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${SESSION_LIFETIME_HOURS} HOUR))`,
    [sessionHash(token),userId]
  );
  setSessionCookie(res,token,secure);
}

router.get('/status', async (req,res,next)=>{
  try{
    const [[result]]=await pool.query('SELECT COUNT(*) AS total FROM auth_users WHERE active=1');
    res.json({setupRequired:Number(result.total)===0});
  }catch(err){next(err)}
});

router.post('/setup', async (req,res,next)=>{
  const {username,password}=req.body;
  const validationError=validarCredenciais(username,password);
  if(validationError)return res.status(400).json({erro:validationError});
  const clientAddress=(req.ip||'').replace(/^::ffff:/,'');
  if(clientAddress!=='::1'&&!clientAddress.startsWith('127.')){
    return res.status(403).json({erro:'Faça a configuração inicial da Loja no próprio servidor, acessando http://localhost:3000.'});
  }

  let connection;
  let lockAcquired=false;
  try{
    connection=await pool.getConnection();
    const [[lock]]=await connection.query("SELECT GET_LOCK('h2o_auth_setup',10) AS acquired");
    lockAcquired=Number(lock.acquired)===1;
    if(!lockAcquired)return res.status(503).json({erro:'Não foi possível iniciar a configuração. Tente novamente.'});

    const [[count]]=await connection.query('SELECT COUNT(*) AS total FROM auth_users');
    if(Number(count.total)>0){
      return res.status(409).json({erro:'A configuração inicial já foi concluída.'});
    }

    const credentials=hashPassword(password);
    const [created]=await connection.query(
      'INSERT INTO auth_users (username,password_hash,password_salt,setor,is_admin) VALUES (?, ?, ?, ?, TRUE)',
      [username.trim(),credentials.hash,credentials.salt,'LOJA']
    );
    await criarSessao(created.insertId,res,req.secure,connection);
    res.status(201).json({user:{id:created.insertId,username:username.trim(),setor:'LOJA',isAdmin:true}});
  }catch(err){
    if(err.code==='ER_DUP_ENTRY')return res.status(409).json({erro:'Esse usuário já existe.'});
    next(err);
  }finally{
    if(connection){
      if(lockAcquired)await connection.query("SELECT RELEASE_LOCK('h2o_auth_setup')");
      connection.release();
    }
  }
});

router.post('/register', async (req,res,next)=>{
  const {username,password,setor}=req.body;
  const validationError=validarCredenciais(username,password);
  if(validationError)return res.status(400).json({erro:validationError});
  if(!['BANHO','CLINICA'].includes(setor)){
    return res.status(400).json({erro:'A criação pela tela inicial está disponível somente para Banho e Clínica.'});
  }

  const now=Date.now();
  const key=req.ip||'unknown';
  const attempts=registrationAttempts.get(key);
  if(attempts&&now-attempts.startedAt<REGISTRATION_WINDOW_MS&&attempts.count>=MAX_REGISTRATIONS){
    return res.status(429).json({erro:'Muitos acessos criados neste endereço. Aguarde 15 minutos e tente novamente.'});
  }

  try{
    const [[loja]]=await pool.query("SELECT COUNT(*) AS total FROM auth_users WHERE setor='LOJA' AND active=1");
    if(Number(loja.total)===0){
      return res.status(409).json({erro:'Configure primeiro o acesso administrador da Loja neste servidor.'});
    }

    const credentials=hashPassword(password);
    const [created]=await pool.query(
      'INSERT INTO auth_users (username,password_hash,password_salt,setor) VALUES (?, ?, ?, ?)',
      [username.trim(),credentials.hash,credentials.salt,setor]
    );
    const current=attempts&&now-attempts.startedAt<REGISTRATION_WINDOW_MS
      ?attempts
      :{startedAt:now,count:0};
    current.count++;
    registrationAttempts.set(key,current);
    if(registrationAttempts.size>5000){
      for(const [ip,entry] of registrationAttempts){
        if(now-entry.startedAt>=REGISTRATION_WINDOW_MS)registrationAttempts.delete(ip);
      }
    }
    await criarSessao(created.insertId,res,req.secure);
    res.status(201).json({user:{id:created.insertId,username:username.trim(),setor}});
  }catch(err){
    if(err.code==='ER_DUP_ENTRY')return res.status(409).json({erro:'Esse usuário já existe.'});
    next(err);
  }
});

router.post('/login', async (req,res,next)=>{
  const {username,password}=req.body;
  if(typeof username!=='string'||!username.trim()||username.trim().length>40||typeof password!=='string'||password.length>128){
    return res.status(400).json({erro:'Informe usuário e senha.'});
  }
  const now=Date.now();
  const key=req.ip||'unknown';
  const attempts=loginAttempts.get(key);
  if(attempts&&now-attempts.startedAt<LOGIN_WINDOW_MS&&attempts.count>=MAX_LOGIN_ATTEMPTS){
    return res.status(429).json({erro:'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.'});
  }
  try{
    const [[user]]=await pool.query(
      'SELECT id,username,password_hash,password_salt,setor,is_admin FROM auth_users WHERE username=? AND active=1',
      [username.trim()]
    );
    const supplied=hashPassword(password,user?.password_salt||'invalid-user-salt').hash;
    const expected=user?.password_hash||'0'.repeat(PASSWORD_BYTES*2);
    const passwordMatches=crypto.timingSafeEqual(Buffer.from(supplied,'hex'),Buffer.from(expected,'hex'));
    if(!user||!passwordMatches){
      const current=attempts&&now-attempts.startedAt<LOGIN_WINDOW_MS?attempts:{startedAt:now,count:0};
      current.count++;
      loginAttempts.set(key,current);
      if(loginAttempts.size>5000){
        for(const [ip,entry] of loginAttempts)if(now-entry.startedAt>=LOGIN_WINDOW_MS)loginAttempts.delete(ip);
      }
      return res.status(401).json({erro:'Usuário ou senha incorretos.'});
    }

    loginAttempts.delete(key);
    await criarSessao(user.id,res,req.secure);
    res.json({user:{id:user.id,username:user.username,setor:user.setor,isAdmin:Number(user.is_admin)===1}});
  }catch(err){next(err)}
});

router.post('/logout',requireAuth,async (req,res,next)=>{
  try{
    const token=getSessionToken(req);
    if(token)await pool.query('DELETE FROM auth_sessions WHERE token_hash=?',[sessionHash(token)]);
    clearSessionCookie(res,req.secure);
    res.json({ok:true});
  }catch(err){next(err)}
});

router.get('/me',requireAuth,(req,res)=>{
  res.json({user:req.user});
});

router.get('/users',requireAuth,requireAdmin,async (req,res,next)=>{
  try{
    const [users]=await pool.query('SELECT id,username,setor,is_admin,active,created_at FROM auth_users ORDER BY setor,username');
    res.json(users);
  }catch(err){next(err)}
});

router.post('/users',requireAuth,requireAdmin,async (req,res,next)=>{
  const {username,password,setor}=req.body;
  const validationError=validarCredenciais(username,password);
  if(validationError)return res.status(400).json({erro:validationError});
  if(!validarSetor(setor))return res.status(400).json({erro:'Selecione um setor válido.'});

  try{
    const credentials=hashPassword(password);
    const isAdmin=setor==='ADMINISTRADOR';
    const [created]=await pool.query(
      'INSERT INTO auth_users (username,password_hash,password_salt,setor,is_admin) VALUES (?, ?, ?, ?, ?)',
      [username.trim(),credentials.hash,credentials.salt,setor,isAdmin?1:0]
    );
    res.status(201).json({id:created.insertId,username:username.trim(),setor,is_admin:isAdmin});
  }catch(err){
    if(err.code==='ER_DUP_ENTRY')return res.status(409).json({erro:'Esse usuário já existe.'});
    next(err);
  }
});

router.patch('/users/:id/password',requireAuth,requireAdmin,async (req,res,next)=>{
  const {password}=req.body;
  if(typeof password!=='string'||!/^[a-z]{8}$/.test(password)){
    return res.status(400).json({erro:'A senha deve ter exatamente 8 letras minúsculas, sem números ou símbolos.'});
  }
  try{
    const credentials=hashPassword(password);
    const [updated]=await pool.query(
      'UPDATE auth_users SET password_hash=?,password_salt=?,active=1 WHERE id=?',
      [credentials.hash,credentials.salt,req.params.id]
    );
    if(!updated.affectedRows)return res.status(404).json({erro:'Usuário não encontrado ou inativo.'});
    await pool.query('DELETE FROM auth_sessions WHERE user_id=?',[req.params.id]);
    res.json({ok:true});
  }catch(err){next(err)}
});

router.delete('/users/:id',requireAuth,requireAdmin,async (req,res,next)=>{
  if(Number(req.params.id)===Number(req.user.id)){
    return res.status(400).json({erro:'Não é possível desativar o próprio acesso.'});
  }
  let connection;
  let lockAcquired=false;
  try{
    connection=await pool.getConnection();
    const [[lock]]=await connection.query("SELECT GET_LOCK('h2o_auth_admin_delete',10) AS acquired");
    lockAcquired=Number(lock.acquired)===1;
    if(!lockAcquired)return res.status(503).json({erro:'Não foi possível atualizar os acessos principais. Tente novamente.'});

    const [[target]]=await connection.query('SELECT id,setor,is_admin,active FROM auth_users WHERE id=?',[req.params.id]);
    if(!target||Number(target.active)!==1)return res.status(404).json({erro:'Usuário não encontrado ou inativo.'});
    if(Number(target.is_admin)===1){
      const [[count]]=await connection.query('SELECT COUNT(*) AS total FROM auth_users WHERE is_admin=1 AND active=1');
      if(Number(count.total)<=1){
        return res.status(409).json({erro:'Mantenha pelo menos um acesso principal ativo.'});
      }
    }
    await connection.query('UPDATE auth_users SET active=0 WHERE id=?',[req.params.id]);
    await connection.query('DELETE FROM auth_sessions WHERE user_id=?',[req.params.id]);
    res.json({ok:true});
  }catch(err){next(err)}
  finally{
    if(connection){
      if(lockAcquired)await connection.query("SELECT RELEASE_LOCK('h2o_auth_admin_delete')");
      connection.release();
    }
  }
});

module.exports=router;
