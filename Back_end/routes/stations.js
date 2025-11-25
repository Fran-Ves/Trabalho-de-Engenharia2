const express = require('express');
const router = express.Router();
const { createPool } = require('../db');

// GET all stations
router.get('/', async (req, res) => {
  try {
    const pool = await createPool();
    const [rows] = await pool.query('SELECT * FROM stations');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// GET stations near (basic lat/lng box)
router.get('/near', async (req, res) => {
  // /api/stations/near?lat=...&lng=...&radius=km
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radiusKm = parseFloat(req.query.radius || 5); // km
  try {
    const pool = await createPool();
    
    const deg = radiusKm / 111; // 
    const minLat = lat - deg, maxLat = lat + deg;
    const minLng = lng - deg, maxLng = lng + deg;
    const [rows] = await pool.query(
      'SELECT *, ( (latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?) ) AS dist_sq FROM stations WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? ORDER BY dist_sq LIMIT 100',
      [lat, lat, lng, lng, minLat, maxLat, minLng, maxLng]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// POST create station
router.post('/', async (req, res) => {
  const { name, latitude, longitude, address } = req.body;
  try {
    const pool = await createPool();
    const [result] = await pool.query('INSERT INTO stations (name, latitude, longitude, address) VALUES (?, ?, ?, ?)', [name, latitude, longitude, address]);
    const id = result.insertId;
    const [rows] = await pool.query('SELECT * FROM stations WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

module.exports = router;
