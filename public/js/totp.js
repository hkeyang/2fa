/**
 * totp.js — TOTP / HOTP 核心算法（RFC 4226 / RFC 6238）
 *
 * 纯前端实现，依赖浏览器内置的 Web Crypto API（crypto.subtle）。
 * 不发起任何网络请求，所有计算均在本地完成。
 *
 * 暴露全局对象：window.TOTP
 */
(function (global) {
  'use strict';

  const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  /**
   * 解码 Base32 字符串为字节数组（RFC 4648）。
   * 自动去除空白、转大写、忽略补位符 '='。
   * @param {string} input
   * @returns {Uint8Array}
   * @throws {Error} 含非法字符时抛错
   */
  function base32Decode(input) {
    const cleaned = String(input)
      .replace(/\s+/g, '')
      .toUpperCase()
      .replace(/=+$/, '');

    if (cleaned.length === 0) {
      throw new Error('密钥为空');
    }

    let bits = '';
    for (const char of cleaned) {
      const val = BASE32_ALPHABET.indexOf(char);
      if (val === -1) {
        throw new Error(`包含非法的 Base32 字符：${char}`);
      }
      bits += val.toString(2).padStart(5, '0');
    }

    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }

    if (bytes.length === 0) {
      throw new Error('密钥太短');
    }
    return new Uint8Array(bytes);
  }

  /**
   * 将计数器写成 8 字节大端 Uint8Array。
   * @param {number} counter
   * @returns {Uint8Array}
   */
  function counterToBytes(counter) {
    const buf = new Uint8Array(8);
    let value = BigInt(Math.floor(counter));
    for (let i = 7; i >= 0; i--) {
      buf[i] = Number(value & 0xffn);
      value >>= 8n;
    }
    return buf;
  }

  /**
   * 计算 HMAC。
   * @param {Uint8Array} keyBytes
   * @param {Uint8Array} msgBytes
   * @param {string} algorithm  'SHA-1' | 'SHA-256' | 'SHA-512'
   * @returns {Promise<Uint8Array>}
   */
  async function hmac(keyBytes, msgBytes, algorithm) {
    const cryptoKey = await global.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: { name: algorithm } },
      false,
      ['sign']
    );
    const sig = await global.crypto.subtle.sign('HMAC', cryptoKey, msgBytes);
    return new Uint8Array(sig);
  }

  /**
   * 动态截断（RFC 4226 §5.3），返回 31 位整数。
   * @param {Uint8Array} hmacBytes
   * @returns {number}
   */
  function dynamicTruncate(hmacBytes) {
    const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
    return (
      ((hmacBytes[offset] & 0x7f) << 24) |
      ((hmacBytes[offset + 1] & 0xff) << 16) |
      ((hmacBytes[offset + 2] & 0xff) << 8) |
      (hmacBytes[offset + 3] & 0xff)
    );
  }

  /**
   * 生成 HOTP（基于计数器）。
   * @param {string} secret  Base32 密钥
   * @param {number} counter
   * @param {{digits?: number, algorithm?: string}} [opts]
   * @returns {Promise<string>}
   */
  async function generateHOTP(secret, counter, opts = {}) {
    const digits = opts.digits || 6;
    const algorithm = opts.algorithm || 'SHA-1';

    const keyBytes = base32Decode(secret);
    const msgBytes = counterToBytes(counter);
    const hmacBytes = await hmac(keyBytes, msgBytes, algorithm);
    const binary = dynamicTruncate(hmacBytes);
    const otp = binary % 10 ** digits;
    return otp.toString().padStart(digits, '0');
  }

  /**
   * 生成 TOTP（基于时间）。
   * @param {string} secret  Base32 密钥
   * @param {{digits?: number, period?: number, algorithm?: string, timestamp?: number}} [opts]
   * @returns {Promise<string>}
   */
  async function generateTOTP(secret, opts = {}) {
    const period = opts.period || 30;
    const timestamp = opts.timestamp != null ? opts.timestamp : Date.now();
    const counter = Math.floor(timestamp / 1000 / period);
    return generateHOTP(secret, counter, opts);
  }

  /**
   * 当前周期已过去的毫秒数对应的剩余秒数。
   * @param {number} period
   * @param {number} [timestamp]
   * @returns {number} 剩余秒数（含小数）
   */
  function secondsRemaining(period, timestamp) {
    const now = (timestamp != null ? timestamp : Date.now()) / 1000;
    return period - (now % period);
  }

  /**
   * 解析 otpauth:// 链接，提取密钥与参数。
   * 形如：otpauth://totp/Issuer:account?secret=XXXX&issuer=Issuer&digits=6&period=30&algorithm=SHA1
   * @param {string} uri
   * @returns {{secret: string, label: string, issuer: string, digits: number, period: number, algorithm: string} | null}
   */
  function parseOtpauth(uri) {
    if (!/^otpauth:\/\//i.test(uri)) return null;
    try {
      const url = new URL(uri);
      const params = url.searchParams;
      const secret = params.get('secret');
      if (!secret) return null;

      const rawLabel = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      let issuer = params.get('issuer') || '';
      let label = rawLabel;
      if (rawLabel.includes(':')) {
        const [iss, acc] = rawLabel.split(':');
        if (!issuer) issuer = iss.trim();
        label = acc.trim();
      }

      const algoRaw = (params.get('algorithm') || 'SHA1').toUpperCase();
      const algorithm = algoRaw.replace(/^SHA(\d+)$/, 'SHA-$1');

      return {
        secret: secret.trim(),
        label: label || issuer || '未命名',
        issuer,
        digits: parseInt(params.get('digits') || '6', 10),
        period: parseInt(params.get('period') || '30', 10),
        algorithm,
      };
    } catch (_) {
      return null;
    }
  }

  global.TOTP = {
    base32Decode,
    generateHOTP,
    generateTOTP,
    secondsRemaining,
    parseOtpauth,
  };
})(window);
