import test from 'node:test';
import assert from 'node:assert/strict';
import endpoint from '../api/contact.mjs';

const valid = { name: 'Test Visitor', email: 'visitor@example.com', occasion: 'Wedding or proposal', date: '2027-04-12', venue: 'Aruba', message: 'Please tell me about availability.', website: '', requestId: '12345678-1234-4234-8234-123456789012' };
function request(data = valid, options = {}) {
    return new Request('https://violin-aruba.vercel.app/api/contact', {
        method: 'POST', headers: { origin: 'https://violin-aruba.vercel.app', 'content-type': 'application/json', ...options.headers },
        body: JSON.stringify(data), ...options
    });
}

test('contact endpoint: validation, fixed destination, retries, and provider failures', async t => {
    const oldFetch = globalThis.fetch;
    const oldKey = process.env.RESEND_API_KEY;
    const oldFrom = process.env.CONTACT_FROM_EMAIL;
    const calls = [];
    process.env.RESEND_API_KEY = 'test-only-secret';
    process.env.CONTACT_FROM_EMAIL = 'website@notify.violinaruba.com';
    globalThis.fetch = async (...args) => { calls.push(args); return Response.json({ id: 'mock-email-id' }); };
    t.after(() => {
        globalThis.fetch = oldFetch;
        if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
        if (oldFrom === undefined) delete process.env.CONTACT_FROM_EMAIL; else process.env.CONTACT_FROM_EMAIL = oldFrom;
    });
    await t.test('unsupported methods and foreign origins never send', async () => {
        assert.equal((await endpoint.fetch(new Request('https://violin-aruba.vercel.app/api/contact'))).status, 405);
        assert.equal((await endpoint.fetch(request(valid, { headers: { origin: 'https://bad.example', 'content-type': 'application/json' } }))).status, 403);
        assert.equal(calls.length, 0);
    });
    await t.test('rejects invalid fields, malformed dates, honeypot, and injection', async () => {
        for (const patch of [{ email: 'invalid' }, { email: 'x@example.com\r\nBcc: victim@example.com' }, { name: '' }, { name: 'a\nb' }, { message: 'a'.repeat(2001) }, { date: '2027-02-30' }, { occasion: 'invalid' }, { website: 'spam' }, { requestId: 'bad' }, { message: null }]) {
            assert.equal((await endpoint.fetch(request({ ...valid, ...patch }))).status, 400, JSON.stringify(patch));
        }
        assert.equal((await endpoint.fetch(request(null))).status, 400);
        assert.equal((await endpoint.fetch(request(valid, { body: '{bad' }))).status, 400);
        assert.equal((await endpoint.fetch(request(valid, { body: 'x'.repeat(16001) }))).status, 413);
        assert.equal(calls.length, 0);
    });
    await t.test('sends only to Nicola and uses visitor Reply-To; retry is idempotent', async () => {
        const response = await endpoint.fetch(request({ ...valid, to: 'attacker@example.com', from: 'other@example.com' }));
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const [url, options] = calls.at(-1);
        assert.equal(url, 'https://api.resend.com/emails');
        const payload = JSON.parse(options.body);
        assert.deepEqual(payload.to, ['nicola@violinaruba.com']);
        assert.equal(payload.from, 'Violin Aruba website <website@notify.violinaruba.com>');
        assert.equal(payload.reply_to, valid.email);
        assert.match(payload.text, /Event date: 2027-04-12/);
        assert.equal(payload.html, undefined);
        const key = options.headers['Idempotency-Key'];
        await endpoint.fetch(request());
        assert.equal(calls.at(-1)[1].headers['Idempotency-Key'], key);
        await endpoint.fetch(request({ ...valid, message: 'Changed details' }));
        assert.notEqual(calls.at(-1)[1].headers['Idempotency-Key'], key);
    });
    await t.test('missing configuration does not send', async () => {
        const count = calls.length;
        delete process.env.RESEND_API_KEY;
        assert.equal((await endpoint.fetch(request())).status, 503);
        process.env.RESEND_API_KEY = 'test-only-secret';
        assert.equal(calls.length, count);
    });
    await t.test('provider rejection, malformed success, timeout never claim success', async () => {
        for (const mock of [async () => Response.json({ message: 'private diagnostic' }, { status: 403 }), async () => Response.json({}), async () => { throw new Error('timeout'); }]) {
            globalThis.fetch = mock;
            const response = await endpoint.fetch(request());
            assert.equal(response.status, 502);
            const result = await response.json();
            assert.equal(result.ok, false);
            assert.doesNotMatch(JSON.stringify(result), /private diagnostic|test-only-secret/);
        }
    });
    await t.test('per-instance limit blocks repeated requests from the trusted IP header', async () => {
        globalThis.fetch = async () => Response.json({ id: 'mock-email-id' });
        for (let i = 0; i < 6; i++) {
            const response = await endpoint.fetch(request(valid, { headers: { origin: 'https://violin-aruba.vercel.app', 'content-type': 'application/json', 'x-vercel-forwarded-for': '192.0.2.44' } }));
            assert.equal(response.status, i < 5 ? 200 : 429);
        }
    });
});
