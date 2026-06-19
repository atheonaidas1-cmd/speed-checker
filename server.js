const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let lastData = null;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Endpoint to receive data
app.post('/collect', (req, res) => {
    const data = req.body;
    if (!data) {
        return res.status(400).json({ status: 'error', message: 'No data' });
    }

    // Add server-side IP from request headers
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    data.server_side_ip = clientIP;

    // Store in memory
    lastData = data;

    // Log to file
    try {
        const logEntry = `[${new Date().toISOString()}] ${JSON.stringify(data)}\n`;
        fs.appendFileSync('data.log', logEntry, 'utf8');
    } catch (err) {
        console.error('File write error:', err.message);
    }

    console.log('Received data:', JSON.stringify(data, null, 2));
    res.json({ status: 'success', message: 'Data logged' });
});

// Return the in-memory last data
app.get('/rawlog', (req, res) => {
    if (lastData) {
        res.json(lastData);
    } else {
        res.status(404).json({ status: 'error', message: 'No data captured yet' });
    }
});

// Serve the log file (if exists)
app.get('/log', (req, res) => {
    if (fs.existsSync('data.log')) {
        res.sendFile(path.join(__dirname, 'data.log'));
    } else {
        res.status(404).send('No log file yet');
    }
});

// Endpoint to log client IP directly
app.get('/ip', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('Direct IP check:', ip);
    res.json({ ip });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});