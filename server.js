const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

const csvFilePath = path.join(__dirname, 'ratings.csv');

// Create CSV file with headers if it doesn't exist
if (!fs.existsSync(csvFilePath)) {
  fs.writeFileSync(csvFilePath, 'yoghurt,rating,timestamp\n');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let ratings = [];  // In-memory store (optional)

// POST endpoint to submit rating
app.post('/submit-rating', (req, res) => {
  const { yoghurt, rating } = req.body;

  if (!yoghurt || !rating) {
    return res.status(400).json({ error: 'Missing yoghurt or rating' });
  }

  const timestamp = new Date().toISOString();
  ratings.push({ yoghurt, rating: Number(rating), timestamp });

  // Append rating to CSV file
  const row = `"${yoghurt.replace(/"/g, '""')}",${rating},${timestamp}\n`;
  fs.appendFile(csvFilePath, row, (err) => {
    if (err) {
      console.error('Error writing to CSV:', err);
      return res.status(500).json({ error: 'Failed to save rating' });
    }

    console.log('New rating saved to CSV:', row.trim());
    res.status(200).json({ message: 'Rating submitted successfully' });
  });
});

// Optional endpoint to get all ratings in JSON
app.get('/ratings', (req, res) => {
  res.json(ratings);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});