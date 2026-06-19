const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // allow large canvas data
app.use(express.static(path.join(__dirname))); // serve index.html

// Endpoint to receive data
app.post('/collect', (req, res) => {
    const data = req.body;
    if (!data) {
        return res.status(400).json({ status: 'error', message: 'No data' });
    }

    // Append to log file (data.log) – will be written inside the Render container
    const logEntry = `[${new Date().toISOString()}] ${JSON.stringify(data)}\n`;
    fs.appendFileSync('data.log', logEntry, 'utf8');

    // Also log to console for Render logs
    console.log('Received data:', JSON.stringify(data, null, 2));

    res.json({ status: 'success', message: 'Data logged' });
});

// Serve the log file if needed (optional)
app.get('/log', (req, res) => {
    if (fs.existsSync('data.log')) {
        res.sendFile(path.join(__dirname, 'data.log'));
    } else {
        res.status(404).send('No log yet');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});