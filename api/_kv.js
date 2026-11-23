/* Upstash Redis / Vercel KV REST istemcisi (ortam değişkenleri: KV_REST_API_URL, KV_REST_API_TOKEN) */
'use strict';
const URL0 = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const configured = () => !!(URL0 && TOKEN);
async function cmd(...args) {
  const r = await fetch(URL0, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > 1.5e6) throw new Error('too large'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}
const NOT_CONFIGURED = 'Bulut özellikleri yapılandırılmamış: Vercel projesine Upstash Redis (KV) entegrasyonu ekleyin.';
module.exports = { configured, cmd, readBody, send, NOT_CONFIGURED };
