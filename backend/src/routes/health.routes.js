const router = require('express').Router();
const pool = require('../config/database');

router.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, banco: 'conectado' });
  } catch (error) {
    res.status(500).json({ ok: false, banco: 'erro', detalhe: error.message });
  }
});

module.exports = router;
