const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Path to CSV file (optional fallback)
const csvFilePath = path.join(__dirname, 'ratings.csv');

// Create CSV file with headers if it doesn't exist
if (!fs.existsSync(csvFilePath)) {
  fs.writeFileSync(csvFilePath, 'yoghurt,rating,timestamp\n');
}

// PostgreSQL connection pool for Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Render-hosted DB
  },
});

// Ensure ratings table exists
pool.query(`
  CREATE TABLE IF NOT EXISTS ratings (
    id SERIAL PRIMARY KEY,
    yoghurt TEXT NOT NULL,
    rating INT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`).then(() => {
  console.log('✅ PostgreSQL ratings table is ready.');
}).catch(err => {
  console.error('❌ Error creating ratings table:', err);
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory ratings (not persisted, just for /ratings route)
let ratings = [];

// POST endpoint to submit a rating
app.post('/submit-rating', async (req, res) => {
  const { yoghurt, rating } = req.body;

  if (!yoghurt || !rating) {
    return res.status(400).json({ error: 'Missing yoghurt or rating' });
  }

  const timestamp = new Date().toISOString();
  ratings.push({ yoghurt, rating: Number(rating), timestamp });

  // Save to CSV (optional fallback)
  const row = `"${yoghurt.replace(/"/g, '""')}",${rating},${timestamp}\n`;
  fs.appendFile(csvFilePath, row, err => {
    if (err) {
      console.error('⚠️ Error writing to CSV:', err);
    } else {
      console.log('📝 New rating saved to CSV:', row.trim());
    }
  });

  // Save to PostgreSQL
  try {
    await pool.query(
      'INSERT INTO ratings (yoghurt, rating, timestamp) VALUES ($1, $2, $3)',
      [yoghurt, Number(rating), timestamp]
    );
    console.log(`✅ Saved rating ${rating} for "${yoghurt}" in database`);
    res.status(200).json({ message: 'Rating submitted successfully' });
  } catch (err) {
    console.error('❌ Error saving rating to DB:', err);
    res.status(500).json({ error: 'Failed to save rating to database' });
  }
});

// In-memory ratings fallback (not persistent)
app.get('/ratings', (req, res) => {
  res.json(ratings);
});

// Fetch all ratings from PostgreSQL
app.get('/ratings-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT yoghurt, rating, timestamp FROM ratings ORDER BY timestamp DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching ratings from DB:', err);
    res.status(500).json({ error: 'Failed to fetch ratings from database' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
