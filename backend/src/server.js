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

const app=express();
const PORT=Number(process.env.PORT||3000);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname,'../../frontend')));

app.get('/api',(req,res)=>res.json({sistema:'Sistema Interno H2O',versao:'1.1'}));
app.use('/api/health',healthRoutes);
app.use('/api/tutores',tutoresRoutes);
app.use('/api/pets',petsRoutes);
app.use('/api/agendamentos',agendamentosRoutes);
app.use('/api/alertas',alertasRoutes);
app.use('/api/bloqueios',bloqueiosRoutes);

app.get('/*splat',(req,res)=>res.sendFile(path.join(__dirname,'../../frontend/index.html')));

// Middleware de erro: garante que qualquer falha (ex: banco de dados) volte como JSON,
// nunca como página HTML — evita o erro "Unexpected token '<'" no front-end.
app.use((err,req,res,next)=>{
  console.error(err);
  res.status(500).json({erro: err.sqlMessage || err.message || 'Erro interno do servidor.'});
});

app.listen(PORT,'0.0.0.0',()=>console.log(`H2O: http://localhost:${PORT}`));
