/* Sıralama: POST {name, weeks, difficulty, value} · GET → {items} (en az hafta, eşitlikte yüksek hisse değeri) */
'use strict';
const { configured, cmd, readBody, send, NOT_CONFIGURED } = require('./_kv.js');
const DIFFS = ['easy', 'normal', 'hard'];

async function list() {
  const raw = (await cmd('LRANGE', 'lb', '0', '999')) || [];
  const items = raw.map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
  items.sort((a, b) => (DIFFS.indexOf(b.difficulty) - DIFFS.indexOf(a.difficulty)) || a.weeks - b.weeks || b.value - a.value);
  return items.slice(0, 25);
}
module.exports = async (req, res) => {
  if (!configured()) return send(res, 501, { error: NOT_CONFIGURED });
  try {
    if (req.method === 'GET') return send(res, 200, { items: await list() });
    if (req.method === 'POST') {
      const b = await readBody(req);
      const name = String(b.name || 'Anonim').replace(/[<>&"]/g, '').trim().slice(0, 20) || 'Anonim';
      const weeks = Math.round(Number(b.weeks));
      const value = Math.max(0, Math.min(1e13, Math.round(Number(b.value) || 0)));
      const difficulty = DIFFS.includes(b.difficulty) ? b.difficulty : 'normal';
      if (!(weeks >= 20 && weeks <= 5000)) return send(res, 400, { error: 'Geçersiz skor' });
      await cmd('LPUSH', 'lb', JSON.stringify({ name, weeks, value, difficulty, at: Date.now() }));
      await cmd('LTRIM', 'lb', '0', '999');
      return send(res, 200, { items: await list() });
    }
    return send(res, 405, { error: 'Yöntem desteklenmiyor' });
  } catch (e) {
    return send(res, 500, { error: 'Sunucu hatası' });
  }
};
