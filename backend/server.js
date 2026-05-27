const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/author', require('./routes/author'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/webhook', require('./routes/webhook'));

// Catch-all for frontend
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ BookLeaf Server running at: http://localhost:${PORT}`);
  console.log(`\n📚 Test Credentials:`);
  console.log(`   Author  → arjun@example.com  / author123`);
  console.log(`   Admin   → admin@bookleaf.com / admin123\n`);
});
