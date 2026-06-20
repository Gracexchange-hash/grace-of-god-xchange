require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-deploying';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
  console.error('Add them in Render -> Environment, or in your local .env file.');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- default/fallback services (used only if the table is empty) ---------- */
const defaultServices = [
  { id: 's1', title: 'Currency Exchange', desc: 'Convert major world currencies at competitive, transparent rates with same-day settlement.', icon: 'exchange', rate: '' },
  { id: 's2', title: 'Gift Card Trading', desc: 'Sell or buy gift cards from top brands with fast verification and instant payout.', icon: 'card', rate: '' },
  { id: 's3', title: 'Cryptocurrency Exchange', desc: 'Buy, sell and swap BTC, ETH, USDT and more with secure, fast crypto-to-cash transactions.', icon: 'crypto', rate: '' },
  { id: 's4', title: 'Digital Asset Trading', desc: 'Trade a wide range of digital assets with full transparency and dedicated support.', icon: 'asset', rate: '' },
];

/* ---------- one-time setup: seed services + admin user if tables are empty ---------- */
async function ensureSeeded() {
  const { data: existingServices, error: svcErr } = await supabase.from('services').select('id');
  if (svcErr) { console.error('Could not read services table:', svcErr.message); }
  else if (!existingServices || existingServices.length === 0) {
    const { error } = await supabase.from('services').insert(defaultServices);
    if (error) console.error('Could not seed default services:', error.message);
    else console.log('Seeded default services.');
  }

  const { data: existingAdmin, error: adminErr } = await supabase.from('admin_users').select('id').eq('id', 1);
  if (adminErr) { console.error('Could not read admin_users table:', adminErr.message); }
  else if (!existingAdmin || existingAdmin.length === 0) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe123!';
    const passwordHash = bcrypt.hashSync(defaultPassword, 10);
    const { error } = await supabase.from('admin_users').insert({
      id: 1,
      username: process.env.ADMIN_USERNAME || 'admin',
      password_hash: passwordHash,
    });
    if (error) console.error('Could not seed admin user:', error.message);
    else {
      console.log('---------------------------------------------------');
      console.log('Created default admin account.');
      console.log('Username:', process.env.ADMIN_USERNAME || 'admin');
      console.log('Password:', defaultPassword, '(change this immediately after first login)');
      console.log('---------------------------------------------------');
    }
  }
}
ensureSeeded();

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

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- public routes ---------- */
app.get('/api/services', async (req, res) => {
  const { data, error } = await supabase.from('services').select('*').order('id', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data && data.length ? data : defaultServices);
});

app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message } = req.body || {};
  if (!name || !email || !phone || !message) {
    return res.status(400).json({ error: 'name, email, phone and message are required' });
  }
  const { error } = await supabase.from('contacts').insert({
    id: newId(), name, email, phone, message, status: 'new',
  });
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ok: true });
});

app.post('/api/booking', async (req, res) => {
  const { name, email, phone, service, date, notes } = req.body || {};
  if (!name || !email || !phone || !service) {
    return res.status(400).json({ error: 'name, email, phone and service are required' });
  }
  const { error } = await supabase.from('bookings').insert({
    id: newId(), name, email, phone, service, date: date || '', notes: notes || '', status: 'pending',
  });
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ok: true });
});

/* ---------- admin auth ---------- */
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const { data: admin, error } = await supabase.from('admin_users').select('*').eq('id', 1).single();
  if (error || !admin || username !== admin.username || !bcrypt.compareSync(password || '', admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

app.post('/api/admin/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const { data: admin, error } = await supabase.from('admin_users').select('*').eq('id', 1).single();
  if (error || !admin || !bcrypt.compareSync(currentPassword || '', admin.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  const newHash = bcrypt.hashSync(newPassword, 10);
  const { error: updateErr } = await supabase.from('admin_users').update({ password_hash: newHash }).eq('id', 1);
  if (updateErr) return res.status(500).json({ error: updateErr.message });
  res.json({ ok: true });
});

/* ---------- admin: services ---------- */
app.put('/api/admin/services', requireAuth, async (req, res) => {
  const services = req.body;
  if (!Array.isArray(services)) return res.status(400).json({ error: 'Expected an array of services' });

  const { error: delErr } = await supabase.from('services').delete().neq('id', '__none__');
  if (delErr) return res.status(500).json({ error: delErr.message });

  if (services.length) {
    const { error: insErr } = await supabase.from('services').insert(services);
    if (insErr) return res.status(500).json({ error: insErr.message });
  }
  res.json({ ok: true });
});

/* ---------- admin: contacts ---------- */
app.get('/api/admin/contacts', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(c => ({ ...c, createdAt: c.created_at })));
});
app.patch('/api/admin/contacts/:id', requireAuth, async (req, res) => {
  const { error } = await supabase.from('contacts').update(req.body).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});
app.delete('/api/admin/contacts/:id', requireAuth, async (req, res) => {
  const { error } = await supabase.from('contacts').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

/* ---------- admin: bookings ---------- */
app.get('/api/admin/bookings', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(b => ({ ...b, createdAt: b.created_at })));
});
app.patch('/api/admin/bookings/:id', requireAuth, async (req, res) => {
  const { error } = await supabase.from('bookings').update(req.body).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});
app.delete('/api/admin/bookings/:id', requireAuth, async (req, res) => {
  const { error } = await supabase.from('bookings').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Grace Of God Xchange server running on http://localhost:${PORT}`);
});
