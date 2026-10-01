const crypto = require('crypto');
const pool = require('../config/database');

const SESSION_COOKIE = 'h2o_session';

function getSessionToken(req) {
  const cookies = (req.headers.cookie || '').split(';');
  const cookie = cookies.find(item => item.trim().startsWith(`${SESSION_COOKIE}=`));
  return cookie ? cookie.trim().slice(SESSION_COOKIE.length + 1) : null;
}

function sessionHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setSessionCookie(res, token, secure) {
  const attributes=[`${SESSION_COOKIE}=${encodeURIComponent(token)}`,'Path=/api','HttpOnly','SameSite=Lax','Max-Age=43200'];
  if(secure)attributes.push('Secure');
  res.append('Set-Cookie',attributes.join('; '));
}

function clearSessionCookie(res, secure) {
  const attributes=[`${SESSION_COOKIE}=`,`Path=/api`,'HttpOnly','SameSite=Lax','Max-Age=0'];
  if(secure)attributes.push('Secure');
  res.append('Set-Cookie',attributes.join('; '));
}

async function requireAuth(req, res, next) {
  const token = getSessionToken(req);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }

  try {
    const [rows] = await pool.query(`
      SELECT u.id,u.username,u.setor,u.is_admin
        FROM auth_sessions s
        JOIN auth_users u ON u.id=s.user_id
       WHERE s.token_hash=? AND s.expires_at>NOW() AND u.active=1
       LIMIT 1
    `, [sessionHash(token)]);
    if (!rows.length) {
      clearSessionCookie(res, req.secure);
      return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }
    req.user = {...rows[0],isAdmin:Number(rows[0].is_admin)===1};
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ erro: 'Apenas o acesso principal da Loja tem permissão para esta operação.' });
  }
  next();
}

function requireLoja(req, res, next) {
  if (!temAcessoLoja(req.user)) {
    return res.status(403).json({ erro: 'Apenas usuários do setor Loja podem administrar esta área.' });
  }
  next();
}

function temAcessoLoja(user) {
  return user?.setor === 'LOJA' || user?.isAdmin === true;
}

module.exports = {
  clearSessionCookie,
  getSessionToken,
  requireAuth,
  requireAdmin,
  requireLoja,
  temAcessoLoja,
  sessionHash,
  setSessionCookie
};
