const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const DB_PATH = path.join(__dirname, '../data/bookleaf_sample_data.json');

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

function getRoyaltyStatus(royalty, book) {
  if (!royalty) return 'none';
  if (royalty.royalty_pending === 0) return 'green';
  const lastPayout = royalty.last_payout_date ? new Date(royalty.last_payout_date) : null;
  const daysSince = lastPayout ? Math.floor((new Date() - lastPayout) / (1000 * 60 * 60 * 24)) : null;
  const pubDate = book.publication_date ? new Date(book.publication_date) : null;
  const daysSincePub = pubDate ? Math.floor((new Date() - pubDate) / (1000 * 60 * 60 * 24)) : null;
  if (!lastPayout && daysSincePub > 90) return 'red';
  if (daysSince > 90) return 'red';
  return 'yellow';
}

function buildAuthorData(authorId, db) {
  const author = db.authors.find(a => a.id === authorId);
  if (!author) return null;
  const books = db.books.filter(b => b.author_id === authorId).map(book => {
    const royalty = db.royalties.find(r => r.book_id === book.id) || null;
    return { ...book, royalty, royalty_status: getRoyaltyStatus(royalty, book) };
  });
  const summary = {
    total_books: books.length,
    total_earned: books.reduce((s, b) => s + (b.royalty?.total_royalty_earned || 0), 0),
    total_paid: books.reduce((s, b) => s + (b.royalty?.royalty_paid || 0), 0),
    total_pending: books.reduce((s, b) => s + (b.royalty?.royalty_pending || 0), 0),
  };
  const overall_status = summary.total_pending === 0 ? 'green' :
    books.some(b => b.royalty_status === 'red') ? 'red' : 'yellow';
  return { author: { id: author.id, name: author.name, email: author.email, city: author.city }, books, summary, overall_status };
}

// Get all authors overview
router.get('/authors', authMiddleware, adminOnly, (req, res) => {
  const db = readDB();
  const { city, status, search } = req.query;
  let authors = db.authors.map(a => buildAuthorData(a.id, db));

  if (city) authors = authors.filter(a => a.author.city.toLowerCase() === city.toLowerCase());
  if (search) authors = authors.filter(a => a.author.name.toLowerCase().includes(search.toLowerCase()));
  if (status) {
    if (status === 'paid') authors = authors.filter(a => a.overall_status === 'green');
    else if (status === 'pending') authors = authors.filter(a => a.overall_status === 'yellow');
    else if (status === 'overdue') authors = authors.filter(a => a.overall_status === 'red');
  }

  res.json(authors);
});

// Get single author detail
router.get('/author/:id', authMiddleware, adminOnly, (req, res) => {
  const db = readDB();
  const data = buildAuthorData(req.params.id, db);
  if (!data) return res.status(404).json({ error: 'Author not found' });
  res.json(data);
});

// Get notification log
router.get('/notifications', authMiddleware, adminOnly, (req, res) => {
  const db = readDB();
  res.json(db.notification_log || []);
});

// Add notification log entry (called from webhook callback)
router.post('/notifications', authMiddleware, adminOnly, (req, res) => {
  const db = readDB();
  db.notification_log = db.notification_log || [];
  const entry = {
    id: `N${Date.now()}`,
    author_id: req.body.author_id,
    author_name: req.body.author_name,
    status: req.body.status,
    email_content: req.body.email_content || '',
    timestamp: new Date().toISOString(),
  };
  db.notification_log.unshift(entry);
  writeDB(db);
  res.json({ success: true, entry });
});

// Get cities list
router.get('/cities', authMiddleware, adminOnly, (req, res) => {
  const db = readDB();
  const cities = [...new Set(db.authors.map(a => a.city))].sort();
  res.json(cities);
});

module.exports = router;
