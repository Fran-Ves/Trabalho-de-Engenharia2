const express = require('express');
const router = express.Router();
const { createPool } = require('../db');

// POST add price for a station
router.post('/', async (req, res) => {
  const { station_id, fuel_type, price } = req.body;
  try {
    const pool = await createPool();
    await pool.query('INSERT INTO prices (station_id, fuel_type, price) VALUES (?, ?, ?)', [station_id, fuel_type, price]);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// GET latest prices per station (simple)
router.get('/latest', async (req, res) => {
  try {
    const pool = await createPool();
    const [rows] = await pool.query(`SELECT p.*, s.name as station_name, s.latitude, s.longitude
      FROM prices p
      JOIN stations s ON p.station_id = s.id
      WHERE p.id IN (
        SELECT MAX(id) FROM prices GROUP BY station_id, fuel_type
      )`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

module.exports = router;
