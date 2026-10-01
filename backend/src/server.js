const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const healthRoutes = require('./routes/health.routes');
const tutoresRoutes = require('./routes/tutores.routes');
const petsRoutes = require('./routes/pets.routes');
const agendamentosRoutes = require('./routes/agendamentos.routes');
const alertasRoutes = require('./routes/alertas.routes');
const bloqueiosRoutes = require('./routes/bloqueios.routes');
const funcionariosRoutes = require('./routes/funcionarios.routes');
const authRoutes = require('./routes/auth.routes');
const { requireAuth } = require('./middleware/auth.middleware');
const { ensureSchemaCompatibility } = require('./config/database');

const app=express();
const PORT=Number(process.env.PORT||3000);
app.disable('x-powered-by');

app.use(cors({
  origin(origin,callback){
    if(!origin||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)){
      callback(null,true);
      return;
    }
    callback(new Error('Origem não permitida.'));
  },
  credentials:true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname,'../../frontend')));

app.get('/api',(req,res)=>res.json({sistema:'Sistema Interno H2O',versao:'1.1'}));
// Qualquer endpoint /api que não exista deve responder JSON, nunca index.html.
app.use('/api/health',healthRoutes);
app.use('/api/auth',authRoutes);
app.use('/api/tutores',requireAuth,tutoresRoutes);
app.use('/api/pets',requireAuth,petsRoutes);
app.use('/api/agendamentos',requireAuth,agendamentosRoutes);
app.use('/api/alertas',requireAuth,alertasRoutes);
app.use('/api/bloqueios',requireAuth,bloqueiosRoutes);
app.use('/api/funcionarios',requireAuth,funcionariosRoutes);

// 404 da API em JSON para evitar "Unexpected token '<'" no frontend.
app.use('/api', (req,res)=>res.status(404).json({erro:`Endpoint não encontrado: ${req.method} ${req.originalUrl}`}));

app.get('/*splat',(req,res)=>res.sendFile(path.join(__dirname,'../../frontend/index.html')));

// Middleware de erro: garante que qualquer falha (ex: banco de dados) volte como JSON,
// nunca como página HTML — evita o erro "Unexpected token '<'" no front-end.
app.use((err,req,res,next)=>{
  console.error(err);
  res.status(500).json({erro: err.sqlMessage || err.message || 'Erro interno do servidor.'});
});

(async()=>{
  try{
    await ensureSchemaCompatibility();
    app.listen(PORT,'0.0.0.0',()=>console.log(`H2O: http://localhost:${PORT}`));
  }catch(err){
    console.error('[H2O] Falha ao preparar o banco de dados:', err.message);
    process.exit(1);
  }
})();
