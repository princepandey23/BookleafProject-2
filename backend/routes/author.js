const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');

const DB_PATH = path.join(__dirname, '../data/bookleaf_sample_data.json');

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

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

// Get author dashboard data (own data only)
router.get('/dashboard', authMiddleware, (req, res) => {
  if (req.user.role !== 'author') return res.status(403).json({ error: 'Author access only' });
  const db = readDB();
  const authorId = req.user.id;
  const author = db.authors.find(a => a.id === authorId);
  if (!author) return res.status(404).json({ error: 'Author not found' });

  const books = db.books.filter(b => b.author_id === authorId).map(book => {
    const royalty = db.royalties.find(r => r.book_id === book.id) || null;
    return {
      ...book,
      royalty,
      royalty_status: getRoyaltyStatus(royalty, book)
    };
  });

  const summary = {
    total_books: books.length,
    total_earned: books.reduce((s, b) => s + (b.royalty?.total_royalty_earned || 0), 0),
    total_paid: books.reduce((s, b) => s + (b.royalty?.royalty_paid || 0), 0),
    total_pending: books.reduce((s, b) => s + (b.royalty?.royalty_pending || 0), 0),
  };

  res.json({ author: { id: author.id, name: author.name, email: author.email, city: author.city }, books, summary });
});

module.exports = router;
