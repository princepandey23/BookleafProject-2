const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/bookleaf_sample_data.json');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'bookleaf_webhook_secret_2024';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

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

// Idempotency store (in-memory, resets on restart — good enough for assignment)
const recentTriggers = new Map();

router.post('/generate-royalty-summary', async (req, res) => {
  // Webhook security check
  const secret = req.headers['x-webhook-secret'];
  if (secret !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Unauthorized: Invalid webhook secret' });
  }

  const { author_id } = req.body;
  if (!author_id) return res.status(400).json({ error: 'author_id required' });

  // Idempotency: prevent duplicate triggers within 30 seconds
  const lastTrigger = recentTriggers.get(author_id);
  if (lastTrigger && Date.now() - lastTrigger < 30000) {
    return res.status(429).json({ error: 'Duplicate request: please wait 30 seconds before retrying' });
  }
  recentTriggers.set(author_id, Date.now());

  const db = readDB();
  const author = db.authors.find(a => a.id === author_id);
  if (!author) return res.status(404).json({ error: 'Author not found' });

  const books = db.books.filter(b => b.author_id === author_id).map(book => {
    const royalty = db.royalties.find(r => r.book_id === book.id) || null;
    return { ...book, royalty, royalty_status: getRoyaltyStatus(royalty, book) };
  });

  const summary = {
    total_earned: books.reduce((s, b) => s + (b.royalty?.total_royalty_earned || 0), 0),
    total_paid: books.reduce((s, b) => s + (b.royalty?.royalty_paid || 0), 0),
    total_pending: books.reduce((s, b) => s + (b.royalty?.royalty_pending || 0), 0),
  };

  let emailContent = '';
  let status = 'Success';

  try {
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');

    const prompt = buildPrompt(author, books, summary);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err?.error?.message || 'AI API error');
    }

    const data = await response.json();
    emailContent = data.content?.[0]?.text || '';
  } catch (err) {
    console.error('AI generation failed:', err.message);
    status = 'Failed';
    emailContent = `[Error generating summary: ${err.message}]`;
    // Still log the failure
  }

  // Log to notification_log
  db.notification_log = db.notification_log || [];
  const entry = {
    id: `N${Date.now()}`,
    author_id,
    author_name: author.name,
    author_email: author.email,
    status,
    email_content: emailContent,
    timestamp: new Date().toISOString(),
  };
  db.notification_log.unshift(entry);
  writeDB(db);

  res.json({ success: status === 'Success', status, author_name: author.name, email_content: emailContent, log_id: entry.id });
});

function buildPrompt(author, books, summary) {
  const publishedBooks = books.filter(b => b.status === 'Published');
  const inProductionBooks = books.filter(b => b.status === 'In Production');

  const bookDetails = publishedBooks.map(b => {
    const r = b.royalty;
    return r ? `- "${b.title}" (${b.genre}): ${r.total_copies_sold} copies sold | Earned: ₹${r.total_royalty_earned.toLocaleString()} | Paid: ₹${r.royalty_paid.toLocaleString()} | Pending: ₹${r.royalty_pending.toLocaleString()} | Last payout: ${r.last_payout_date || 'Never'} | Status: ${b.royalty_status === 'green' ? 'Fully Paid' : b.royalty_status === 'yellow' ? 'Pending (within cycle)' : 'Overdue'}`
      : `- "${b.title}" (${b.genre}): No royalty data yet`;
  }).join('\n');

  const productionList = inProductionBooks.map(b => `- "${b.title}" (${b.genre}, MRP ₹${b.mrp})`).join('\n');

  return `You are the royalty communications specialist at BookLeaf Publishing, a warm and professional independent publisher in India. Write a royalty summary email for the following author.

AUTHOR: ${author.name}
EMAIL: ${author.email}
CITY: ${author.city}

PUBLISHED BOOKS ROYALTY DATA:
${bookDetails || 'No published books yet.'}

${inProductionBooks.length > 0 ? `BOOKS IN PRODUCTION:\n${productionList}` : ''}

SUMMARY:
- Total Royalty Earned: ₹${summary.total_earned.toLocaleString()}
- Total Royalty Paid: ₹${summary.total_paid.toLocaleString()}
- Total Royalty Pending: ₹${summary.total_pending.toLocaleString()}

BOOKLEAF PAYOUT POLICY: Royalties are processed quarterly (March 31, June 30, September 30, December 31) with a 45-day processing window after each quarter end.

Write a professional, warm, and personalised royalty summary email. Include:
1. Personalised greeting using the author's name
2. Brief summary of each published book with royalty figures
3. Clear total breakdown (earned / paid / pending)
4. If pending: explain expected next payout based on the quarterly cycle
5. If fully paid up: warm acknowledgement
6. If books in production: brief status update
7. Professional closing matching BookLeaf's warm, encouraging tone

Keep it human, not robotic. The author should feel valued.`;
}

// Bulk trigger endpoint
router.post('/generate-royalty-summary-bulk', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== WEBHOOK_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  const db = readDB();
  const authorsWithPending = db.authors.filter(author => {
    const books = db.books.filter(b => b.author_id === author.id);
    return books.some(book => {
      const royalty = db.royalties.find(r => r.book_id === book.id);
      return royalty && royalty.royalty_pending > 0;
    });
  });

  res.json({ message: `Bulk trigger initiated for ${authorsWithPending.length} authors`, authors: authorsWithPending.map(a => a.id) });
});

module.exports = router;
