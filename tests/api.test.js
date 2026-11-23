/* Bulut kaydı ve sıralama API'si — sahte Redis ile */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Readable } = require('stream');

const db = new Map();
process.env.KV_REST_API_URL = 'https://kv.example';
process.env.KV_REST_API_TOKEN = 'x';
globalThis.fetch = async (url, o) => {
  const [c, k, ...a] = JSON.parse(o.body);
  let result = null;
  if (c === 'SET') { db.set(k, a[0]); result = 'OK'; }
  else if (c === 'GET') result = db.has(k) ? db.get(k) : null;
  else if (c === 'LPUSH') { const l = db.get(k) || []; l.unshift(a[0]); db.set(k, l); result = l.length; }
  else if (c === 'LTRIM') { const l = db.get(k) || []; db.set(k, l.slice(+a[0], +a[1] + 1)); result = 'OK'; }
  else if (c === 'LRANGE') result = (db.get(k) || []).slice(+a[0], +a[1] + 1);
  return { json: async () => ({ result }) };
};
const save = require('../api/save.js'), lb = require('../api/leaderboard.js');
function call(h, method, url, body) {
  return new Promise(resolve => {
    const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
    req.method = method; req.url = url; req.query = Object.fromEntries(new URL(url, 'http://x').searchParams);
    const res = { statusCode: 200, setHeader() {}, end(t) { resolve({ code: this.statusCode, json: JSON.parse(t) }); } };
    h(req, res);
  });
}
test('kayıt gönder ve geri al', async () => {
  const r = await call(save, 'POST', '/api/save', { data: { v: 3, money: 5 } });
  assert.strictEqual(r.code, 200); assert.match(r.json.code, /^[A-Z0-9]{8}$/);
  const g = await call(save, 'GET', '/api/save?code=' + r.json.code);
  assert.strictEqual(g.json.data.money, 5);
  const bad = await call(save, 'POST', '/api/save', { data: { v: 1 } });
  assert.strictEqual(bad.code, 400);
});
test('sıralama: zor zorluk ve az hafta önde', async () => {
  await call(lb, 'POST', '/api/leaderboard', { name: 'A', weeks: 150, difficulty: 'normal', value: 5e9 });
  await call(lb, 'POST', '/api/leaderboard', { name: 'B', weeks: 120, difficulty: 'normal', value: 1e9 });
  const r = await call(lb, 'POST', '/api/leaderboard', { name: '<C>', weeks: 200, difficulty: 'hard', value: 1e9 });
  assert.deepStrictEqual(r.json.items.map(x => x.name), ['C', 'B', 'A']);
  const bad = await call(lb, 'POST', '/api/leaderboard', { name: 'D', weeks: 2 });
  assert.strictEqual(bad.code, 400);
});
