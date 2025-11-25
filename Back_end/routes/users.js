const express = require('express');
const router = express.Router();
const { createPool } = require('../db');

router.post('/register', async (req, res) => {
  const { username } = req.body;
  try {
    const pool = await createPool();
    const [result] = await pool.query('INSERT INTO users (username) VALUES (?)', [username]);
    res.json({ id: result.insertId, username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

module.exports = router;
