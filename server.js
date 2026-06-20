require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-deploying';
const DATA_DIR = path.join(__dirname, 'data');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- tiny JSON-file data store ---------- */
function readData(file, fallback) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return fallback;
  }
}
function writeData(file, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

/* seed default services if none exist */
const defaultServices = [
  { id: 's1', title: 'Currency Exchange', desc: 'Convert major world currencies at competitive, transparent rates with same-day settlement.', icon: 'exchange', rate: '' },
  { id: 's2', title: 'Gift Card Trading', desc: 'Sell or buy gift cards from top brands with fast verification and instant payout.', icon: 'card', rate: '' },
  { id: 's3', title: 'Cryptocurrency Exchange', desc: 'Buy, sell and swap BTC, ETH, USDT and more with secure, fast crypto-to-cash transactions.', icon: 'crypto', rate: '' },
  { id: 's4', title: 'Digital Asset Trading', desc: 'Trade a wide range of digital assets with full transparency and dedicated support.', icon: 'asset', rate: '' },
];
if (!fs.existsSync(path.join(DATA_DIR, 'services.json'))) writeData('services.json', defaultServices);
if (!fs.existsSync(path.join(DATA_DIR, 'contacts.json'))) writeData('contacts.json', []);
if (!fs.existsSync(path.join(DATA_DIR, 'bookings.json'))) writeData('bookings.json', []);

/* seed default admin user (username: admin / password: set via env on first run) */
if (!fs.existsSync(path.join(DATA_DIR, 'admin.json'))) {
  const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe123!';
  const passwordHash = bcrypt.hashSync(defaultPassword, 10);
  writeData('admin.json', { username: process.env.ADMIN_USERNAME || 'admin', passwordHash });
  console.log('---------------------------------------------------');
  console.log('Created default admin account.');
  console.log('Username:', process.env.ADMIN_USERNAME || 'admin');
  console.log('Password:', defaultPassword, '(change this immediately after first login)');
  console.log('---------------------------------------------------');
}

/* ---------- auth middleware ---------- */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/* ---------- public routes ---------- */
app.get('/api/services', (req, res) => {
  res.json(readData('services.json', defaultServices));
});

app.post('/api/contact', (req, res) => {
  const { name, email, phone, message } = req.body || {};
  if (!name || !email || !phone || !message) {
    return res.status(400).json({ error: 'name, email, phone and message are required' });
  }
  const contacts = readData('contacts.json', []);
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name, email, phone, message,
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  contacts.unshift(entry);
  writeData('contacts.json', contacts);
  res.status(201).json({ ok: true });
});

app.post('/api/booking', (req, res) => {
  const { name, email, phone, service, date, notes } = req.body || {};
  if (!name || !email || !phone || !service) {
    return res.status(400).json({ error: 'name, email, phone and service are required' });
  }
  const bookings = readData('bookings.json', []);
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name, email, phone, service, date: date || '', notes: notes || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  bookings.unshift(entry);
  writeData('bookings.json', bookings);
  res.status(201).json({ ok: true });
});

/* ---------- admin auth ---------- */
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const admin = readData('admin.json', null);
  if (!admin || username !== admin.username || !bcrypt.compareSync(password || '', admin.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

app.post('/api/admin/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const admin = readData('admin.json', null);
  if (!admin || !bcrypt.compareSync(currentPassword || '', admin.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  admin.passwordHash = bcrypt.hashSync(newPassword, 10);
  writeData('admin.json', admin);
  res.json({ ok: true });
});

/* ---------- admin: services ---------- */
app.put('/api/admin/services', requireAuth, (req, res) => {
  const services = req.body;
  if (!Array.isArray(services)) return res.status(400).json({ error: 'Expected an array of services' });
  writeData('services.json', services);
  res.json({ ok: true });
});

/* ---------- admin: contacts ---------- */
app.get('/api/admin/contacts', requireAuth, (req, res) => {
  res.json(readData('contacts.json', []));
});
app.patch('/api/admin/contacts/:id', requireAuth, (req, res) => {
  const contacts = readData('contacts.json', []);
  const idx = contacts.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  contacts[idx] = { ...contacts[idx], ...req.body };
  writeData('contacts.json', contacts);
  res.json({ ok: true });
});
app.delete('/api/admin/contacts/:id', requireAuth, (req, res) => {
  let contacts = readData('contacts.json', []);
  contacts = contacts.filter(c => c.id !== req.params.id);
  writeData('contacts.json', contacts);
  res.json({ ok: true });
});

/* ---------- admin: bookings ---------- */
app.get('/api/admin/bookings', requireAuth, (req, res) => {
  res.json(readData('bookings.json', []));
});
app.patch('/api/admin/bookings/:id', requireAuth, (req, res) => {
  const bookings = readData('bookings.json', []);
  const idx = bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  bookings[idx] = { ...bookings[idx], ...req.body };
  writeData('bookings.json', bookings);
  res.json({ ok: true });
});
app.delete('/api/admin/bookings/:id', requireAuth, (req, res) => {
  let bookings = readData('bookings.json', []);
  bookings = bookings.filter(b => b.id !== req.params.id);
  writeData('bookings.json', bookings);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Grace Of God Xchange server running on http://localhost:${PORT}`);
});
