/* Bulut kaydı: POST {code?, data} → {code} · GET ?code=XXXXXX → {data} */
'use strict';
const { configured, cmd, readBody, send, NOT_CONFIGURED } = require('./_kv.js');
const crypto = require('crypto');
const CODE_RE = /^[A-Z0-9]{8}$/;
const TTL = 60 * 60 * 24 * 180; // 180 gün

module.exports = async (req, res) => {
  if (!configured()) return send(res, 501, { error: NOT_CONFIGURED });
  try {
    if (req.method === 'GET') {
      const code = String((req.query && req.query.code) || new URL(req.url, 'http://x').searchParams.get('code') || '').toUpperCase();
      if (!CODE_RE.test(code)) return send(res, 400, { error: 'Geçersiz kod' });
      const v = await cmd('GET', 'save:' + code);
      if (!v) return send(res, 404, { error: 'Kayıt bulunamadı' });
      return send(res, 200, { data: JSON.parse(v) });
    }
    if (req.method === 'POST') {
      const b = await readBody(req);
      if (!b || typeof b.data !== 'object' || b.data === null || b.data.v !== 3) return send(res, 400, { error: 'Geçersiz kayıt' });
      const txt = JSON.stringify(b.data);
      if (txt.length > 1e6) return send(res, 413, { error: 'Kayıt çok büyük' });
      let code = typeof b.code === 'string' && CODE_RE.test(b.code) ? b.code : null;
      if (!code) code = crypto.randomBytes(6).toString('base64').replace(/[^A-Za-z0-9]/g, '').toUpperCase().padEnd(8, 'X').slice(0, 8);
      await cmd('SET', 'save:' + code, txt, 'EX', String(TTL));
      return send(res, 200, { code });
    }
    return send(res, 405, { error: 'Yöntem desteklenmiyor' });
  } catch (e) {
    return send(res, 500, { error: 'Sunucu hatası' });
  }
};
