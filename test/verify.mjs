/**
 * verify.mjs — 用 RFC 6238 官方测试向量校验 TOTP 算法实现是否正确。
 * 运行：node test/verify.mjs
 *
 * 这里用 Node 的 crypto 重新实现一遍同样的逻辑，确保算法本身无误；
 * 前端 totp.js 与此使用完全相同的步骤（仅 API 不同：Web Crypto vs Node crypto）。
 */
import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input) {
  const cleaned = String(input).replace(/\s+/g, '').toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (const ch of cleaned) {
    const val = BASE32_ALPHABET.indexOf(ch);
    if (val === -1) throw new Error('非法字符: ' + ch);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret, { digits = 8, period = 30, algorithm = 'sha1', timestamp }) {
  const key = base32Decode(secret);
  const counter = Math.floor(timestamp / 1000 / period);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac(algorithm, key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

/* RFC 6238 Appendix B 测试向量
   SHA-1   seed: "12345678901234567890"
   转 Base32 => GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ */
const SEED_SHA1_B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const cases = [
  { time: 59, expected: '94287082' },
  { time: 1111111109, expected: '07081804' },
  { time: 1111111111, expected: '14050471' },
  { time: 1234567890, expected: '89005924' },
  { time: 2000000000, expected: '69279037' },
  { time: 20000000000, expected: '65353130' },
];

let pass = 0;
for (const c of cases) {
  const got = generateTOTP(SEED_SHA1_B32, {
    digits: 8,
    period: 30,
    algorithm: 'sha1',
    timestamp: c.time * 1000,
  });
  const ok = got === c.expected;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  t=${c.time}  期望=${c.expected}  实际=${got}`);
}

console.log(`\n结果：${pass}/${cases.length} 通过`);
process.exit(pass === cases.length ? 0 : 1);
