// routes/api.js (improved image proxy + levels)
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const axios = require('axios');

/**
 * Helper: validate remote URL
 * - must be valid absolute URL
 * - must use http or https
 * Note: this is a simple validation. For production you may want
 * to further restrict domains / block private IP ranges to avoid SSRF.
 */
function isValidHttpUrl(s) {
    try {
        const u = new URL(s);
        return (u.protocol === 'http:' || u.protocol === 'https:');
    } catch (e) {
        return false;
    }
}

// GET /api/levels -> return JSON list of levels from models/levels.json
router.get('/levels', (req, res) => {
    try {
        const p = path.join(__dirname, '..', 'models', 'levels.json');
        const json = fs.readFileSync(p, 'utf8');
        res.type('json').send(json);
    } catch (err) {
        console.error('[api/levels] read error', err);
        res.status(500).json({ error: 'failed to read levels' });
    }
});

/**
 * GET /api/image-proxy?url=<remote-url>
 * - Validate URL
 * - Fetch remote resource as stream
 * - Ensure response is image/* before piping to client
 * - Add caching headers
 */
router.get('/image-proxy', async (req, res) => {
    const remoteUrl = req.query.url;
    if (!remoteUrl) return res.status(400).send('Missing url query parameter');

    if (!isValidHttpUrl(remoteUrl)) {
        return res.status(400).send('Invalid url (must be absolute http(s) URL)');
    }

    // OPTIONAL: Basic allowlist example (uncomment to restrict to known hosts)
    // const allowedHosts = ['loremflickr.com', 'images.unsplash.com'];
    // const host = new URL(remoteUrl).host;
    // if (!allowedHosts.includes(host)) return res.status(403).send('Host not allowed');

    try {
        const response = await axios({
            method: 'get',
            url: remoteUrl,
            responseType: 'stream',
            timeout: 15000,
            maxContentLength: 10 * 1024 * 1024, // 10 MB
            validateStatus: status => status >= 200 && status < 400, // allow 3xx (axios will follow redirects)
            headers: {
                'User-Agent': 'p5-puzzle-proxy/1.0'
            }
        });

        const contentType = response.headers['content-type'] || '';
        if (!contentType.startsWith('image/')) {
            console.warn('[api/image-proxy] reject non-image content-type:', contentType, 'for url:', remoteUrl);
            // drain the stream
            response.data.destroy();
            return res.status(422).send('Remote resource is not an image');
        }

        // Set caching so browser may reuse images for some time
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
        res.setHeader('Content-Type', contentType);

        // pipe stream to client; add error handlers
        response.data.on('error', (err) => {
            console.error('[api/image-proxy] stream error', err && err.message);
            if (!res.headersSent) res.status(502).send('Error reading remote image');
        });

        response.data.pipe(res);
    } catch (err) {
        // improve error logging
        const message = err && (err.message || err.toString());
        console.error('[api/image-proxy] fetch failed for url:', remoteUrl, 'err:', message);

        // Distinguish common error types
        if (err.code === 'ECONNABORTED') return res.status(504).send('Remote request timed out');
        if (err.response && err.response.status) return res.status(502).send('Upstream returned status ' + err.response.status);
        return res.status(502).send('Failed to fetch remote image');
    }
});

module.exports = router;
