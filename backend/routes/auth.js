const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const SECRET = process.env.JWT_SECRET || 'bookleaf_secret_2024';
const DB_PATH = path.join(__dirname, '../data/bookleaf_sample_data.json');

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = readDB();

  // Check admin
  if (db.admin.email === email && db.admin.password === password) {
    const token = jwt.sign({ id: db.admin.id, role: 'admin', name: db.admin.name }, SECRET, { expiresIn: '24h' });
    return res.json({ token, role: 'admin', name: db.admin.name });
  }

  // Check authors
  const author = db.authors.find(a => a.email === email && a.password === password);
  if (author) {
    const token = jwt.sign({ id: author.id, role: 'author', name: author.name }, SECRET, { expiresIn: '24h' });
    return res.json({ token, role: 'author', name: author.name, authorId: author.id });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

module.exports = router;
