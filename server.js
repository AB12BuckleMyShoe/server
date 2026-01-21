const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

// TEMPORARY ROUTE — RUN ONCE TO CREATE TABLE
app.get('/create-subscribers-table', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    res.send('Subscribers table created successfully.');
  } catch (err) {
    console.error('Table creation error:', err);
    res.status(500).send('Error creating table.');
  }
});

// SUBSCRIBE ROUTE
app.post('/api/subscribe', async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const result = await pool.query(
      'INSERT INTO subscribers (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at',
      [name || null, email]
    );

    return res.status(201).json({
      message: 'Subscribed successfully.',
      subscriber: result.rows[0],
    });
  } catch (err) {
    console.error('Subscribe route error:', err);

    if (err.code === '23505') {
      return res.status(409).json({ error: 'This email is already subscribed.' });
    }

    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET ALL SUBSCRIBERS
app.get('/api/subscribers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subscribers ORDER BY id ASC');
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Get subscribers error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE SUBSCRIBER
app.delete('/api/subscribers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM subscribers WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Subscriber not found.' });
    }

    return res.status(200).json({
      message: 'Subscriber deleted successfully.',
      subscriber: result.rows[0],
    });
  } catch (err) {
    console.error('Delete subscriber error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// UPDATE SUBSCRIBER
app.put('/api/subscribers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    if (!name && !email) {
      return res.status(400).json({ error: 'At least one field (name or email) is required.' });
    }

    const result = await pool.query(
      `UPDATE subscribers
       SET name = COALESCE($1, name),
           email = COALESCE($2, email)
       WHERE id = $3
       RETURNING *`,
      [name || null, email || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Subscriber not found.' });
    }

    return res.status(200).json({
      message: 'Subscriber updated successfully.',
      subscriber: result.rows[0],
    });
  } catch (err) {
    console.error('Update subscriber error:', err);

    if (err.code === '23505') {
      return res.status(409).json({ error: 'This email is already subscribed.' });
    }

    return res.status(500).json({ error: 'Internal server error.' });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
