const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory store for the most recent data (fallback if file write fails)
let lastData = null;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

app.post('/collect', (req, res) => {
    const data = req.body;
    if (!data) {
        return res.status(400).json({ status: 'error', message: 'No data' });
    }

    // Store in memory
    lastData = data;

    // Try to write to file – but if it fails, we still have memory
    try {
        const logEntry = `[${new Date().toISOString()}] ${JSON.stringify(data)}\n`;
        fs.appendFileSync('data.log', logEntry, 'utf8');
    } catch (err) {
        console.error('File write failed:', err.message);
    }

    console.log('Received data:', JSON.stringify(data, null, 2));
    res.json({ status: 'success', message: 'Data logged' });
});

// Endpoint that returns the in-memory data (always works)
app.get('/rawlog', (req, res) => {
    if (lastData) {
        res.json(lastData);
    } else {
        res.status(404).json({ status: 'error', message: 'No data captured yet' });
    }
});

// Original /log endpoint (may fail if file not writable)
app.get('/log', (req, res) => {
    if (fs.existsSync('data.log')) {
        res.sendFile(path.join(__dirname, 'data.log'));
    } else {
        res.status(404).send('No log file yet');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});