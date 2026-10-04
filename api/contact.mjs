import { createHash } from 'node:crypto';

const recipient = 'nicola@violinaruba.com';
const occasions = new Set(['Wedding or proposal', 'Private celebration', 'Restaurant or event', 'Something else']);
const attempts = new Map();
const maxBytes = 16000;

function reply(status, message, extra = {}) {
    return Response.json({ ok: status === 200, message }, {
        status,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra }
    });
}

async function readBody(request) {
    if (Number(request.headers.get('content-length')) > maxBytes) throw new RangeError();
    const reader = request.body?.getReader();
    if (!reader) throw new SyntaxError();
    const chunks = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
            await reader.cancel();
            throw new RangeError();
        }
        chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function contact(request) {
    if (request.method !== 'POST') return reply(405, 'Please use the contact form.', { Allow: 'POST' });
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) return reply(403, 'Please submit from this website.');
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
        return reply(415, 'Please use the contact form.');
    }
    let data;
    try { data = await readBody(request); }
    catch (error) { return reply(error instanceof RangeError ? 413 : 400, 'Please check your message and try again.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, 'Please check your message.');
    const limits = { name: 100, email: 150, occasion: 50, date: 10, venue: 150, message: 2000, website: 200, requestId: 36 };
    const fields = {};
    for (const [key, limit] of Object.entries(limits)) {
        if (typeof data[key] !== 'string' || data[key].length > limit) return reply(400, 'Please check your form fields.');
        fields[key] = data[key].trim();
    }
    const { name, email, occasion, date, venue, message, website, requestId } = fields;
    if (website) return reply(400, 'Please contact Nicola by email or WhatsApp.');
    if (!name || !message || !occasions.has(occasion) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ||
        [name, email, venue].some(value => /[\x00-\x1f\x7f]/.test(value)) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(message)) {
        return reply(400, 'Please check your form fields.');
    }
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) {
        return reply(400, 'Please check your event date.');
    }
    const key = process.env.RESEND_API_KEY;
    const from = process.env.CONTACT_FROM_EMAIL;
    if (!key || !from || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)) {
        return reply(503, 'Email is temporarily unavailable. Please use WhatsApp or email below.');
    }

    // Best-effort per-instance throttling. This is not a distributed rate limiter.
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.expires <= now) attempts.delete(ip);
    const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim();
    if (ip) {
        const hash = createHash('sha256').update(ip).digest('hex');
        const entry = attempts.get(hash) || { count: 0, expires: now + 600000 };
        if (entry.count >= 5 || (!attempts.has(hash) && attempts.size >= 10000)) {
            return reply(429, 'Please wait a few minutes, or contact Nicola on WhatsApp.', { 'Retry-After': '600' });
        }
        entry.count++;
        attempts.set(hash, entry);
    }
    const text = `New website enquiry\n\nName: ${name}\nEmail: ${email}\nOccasion: ${occasion}\nEvent date: ${date || 'To be decided'}\nVenue: ${venue || 'To be decided'}\n\n${message}\n\nReply to this email to contact ${name}.`;
    const body = JSON.stringify({ from: `Violin Aruba website <${from}>`, to: [recipient], reply_to: email, subject: 'New violin performance enquiry', text });
    // Stable for a retry of the same submission; changed details produce a different key.
    const idempotencyKey = createHash('sha256').update(requestId + body).digest('hex');
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `enquiry-${idempotencyKey}` },
            body,
            signal: AbortSignal.timeout(10000)
        });
        const outcome = await response.json().catch(() => null);
        if (!response.ok || typeof outcome?.id !== 'string' || !outcome.id) {
            console.error('Contact email provider rejected request', { status: response.status });
            return reply(502, 'We could not confirm your email was sent. Try again, or use WhatsApp below.');
        }
        return reply(200, 'Your enquiry has been sent.');
    } catch {
        console.error('Contact email provider unavailable');
        return reply(502, 'We could not confirm your email was sent. Try again, or use WhatsApp below.');
    }
}

export default { fetch: contact };
