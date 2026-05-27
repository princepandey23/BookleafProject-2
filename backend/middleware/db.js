const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/bookleaf_sample_data.json');

function readDB() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { readDB, writeDB };
