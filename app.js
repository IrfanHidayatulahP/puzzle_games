// app.js
const express = require('express');
const path = require('path');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve multiple static directories:
// - /controllers -> client js files
// - /views -> index.html + style.css (we will serve index.html explicitly too)
// - /assets -> images & audio
app.use('/controllers', express.static(path.join(__dirname, 'controllers')));
app.use('/views', express.static(path.join(__dirname, 'views')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// API router mounted on /api
app.use('/api', apiRouter);

// Root route serve the index.html from /views
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// start
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
