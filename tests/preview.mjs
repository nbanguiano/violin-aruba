// Local browser test server. Never connects to Resend or sends email.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import endpoint from '../api/contact.mjs';
const root = resolve(import.meta.dirname, '..');
process.env.RESEND_API_KEY = 'local-mock-only';
process.env.CONTACT_FROM_EMAIL = 'website@notify.violinaruba.com';
globalThis.fetch = async (_url, options) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return JSON.parse(options.body).text.includes('SIMULATE_FAILURE')
        ? Response.json({ message: 'Simulated failure' }, { status: 503 })
        : Response.json({ id: 'local-mock-email' });
};
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };
createServer(async (req, res) => {
    try {
        if (req.url === '/api/contact') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const request = new Request(`http://127.0.0.1:18766${req.url}`, { method: req.method, headers: req.headers, ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) });
            const response = await endpoint.fetch(request);
            res.writeHead(response.status, Object.fromEntries(response.headers));
            return res.end(await response.text());
        }
        const path = resolve(root, '.' + (new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
        if (!path.startsWith(root + '/')) { res.writeHead(403); return res.end(); }
        const body = await readFile(path);
        res.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream' });
        res.end(body);
    } catch { res.writeHead(404); res.end(); }
}).listen(18766, '127.0.0.1', () => console.log('Mock email preview: http://127.0.0.1:18766'));
