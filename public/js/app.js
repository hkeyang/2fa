/**
 * app.js — 界面交互与状态管理
 *
 * 职责：
 *  - 读取用户输入（多行密钥 / otpauth 链接）
 *  - 调用 TOTP 模块实时生成验证码
 *  - 渲染结果卡片、倒计时进度环
 *  - 复制、清空、记住密钥、主题切换
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'totp.secrets';
  const STORAGE_REMEMBER = 'totp.remember';
  const STORAGE_THEME = 'totp.theme';
  const STORAGE_SETTINGS = 'totp.settings';

  // DOM 引用
  const el = {
    keyInput: document.getElementById('keyInput'),
    codeList: document.getElementById('codeList'),
    emptyState: document.getElementById('emptyState'),
    countdownNum: document.getElementById('countdownNum'),
    countdownProgress: document.getElementById('countdownProgress'),
    digitsSelect: document.getElementById('digitsSelect'),
    periodSelect: document.getElementById('periodSelect'),
    algoSelect: document.getElementById('algoSelect'),
    rememberToggle: document.getElementById('rememberToggle'),
    clearBtn: document.getElementById('clearBtn'),
    themeToggle: document.getElementById('themeToggle'),
    toast: document.getElementById('toast'),
  };

  // 进度环周长（r=16）
  const RING_CIRCUMFERENCE = 2 * Math.PI * 16;
  el.countdownProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);

  let toastTimer = null;

  /** 当前界面选择的全局参数（otpauth 链接可在单条上覆盖） */
  function currentSettings() {
    return {
      digits: parseInt(el.digitsSelect.value, 10),
      period: parseInt(el.periodSelect.value, 10),
      algorithm: el.algoSelect.value,
    };
  }

  /**
   * 解析输入框内容为条目数组。
   * 每行可以是裸密钥，也可以是 otpauth:// 链接。
   * @returns {Array<{label: string, secret: string, digits: number, period: number, algorithm: string}>}
   */
  function parseEntries() {
    const settings = currentSettings();
    const lines = el.keyInput.value
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    return lines.map((line, idx) => {
      const parsed = window.TOTP.parseOtpauth(line);
      if (parsed) {
        return {
          label: parsed.label,
          secret: parsed.secret,
          digits: parsed.digits,
          period: parsed.period,
          algorithm: parsed.algorithm,
        };
      }
      return {
        label: `密钥 ${idx + 1}`,
        secret: line,
        digits: settings.digits,
        period: settings.period,
        algorithm: settings.algorithm,
      };
    });
  }

  /** 把 6 位码格式化为 "123 456" 便于阅读 */
  function formatCode(code) {
    if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`;
    if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`;
    return code;
  }

  /** 构建单个结果卡片 DOM */
  function buildCard(entry) {
    const li = document.createElement('li');
    li.className = 'code-card';

    const info = document.createElement('div');
    info.className = 'code-card__info';

    const label = document.createElement('span');
    label.className = 'code-card__label';
    label.textContent = entry.label;

    const meta = document.createElement('span');
    meta.className = 'code-card__meta';
    meta.textContent = `${entry.algorithm} · ${entry.digits}位 · ${entry.period}s`;

    info.appendChild(label);
    info.appendChild(meta);

    const codeWrap = document.createElement('button');
    codeWrap.type = 'button';
    codeWrap.className = 'code-card__code';
    codeWrap.title = '点击复制';

    const codeText = document.createElement('span');
    codeText.className = 'code-card__digits';
    codeText.textContent = '······';

    const copyIcon = document.createElement('span');
    copyIcon.className = 'code-card__copy';
    copyIcon.setAttribute('aria-hidden', 'true');
    copyIcon.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

    codeWrap.appendChild(codeText);
    codeWrap.appendChild(copyIcon);

    li.appendChild(info);
    li.appendChild(codeWrap);

    // 复制（保存真实数字，不含空格）
    codeWrap.addEventListener('click', () => {
      const raw = codeWrap.dataset.raw || '';
      if (!raw || raw.includes('—')) return;
      copyToClipboard(raw);
    });

    return { li, codeText, codeWrap, label, meta };
  }

  // 卡片缓存：key = 索引，避免每秒重建 DOM
  let cards = [];

  /** 根据输入重建卡片骨架 */
  function rebuildCards(entries) {
    el.codeList.innerHTML = '';
    cards = entries.map((entry) => {
      const card = buildCard(entry);
      el.codeList.appendChild(card.li);
      return { ...card, entry };
    });

    const hasEntries = entries.length > 0;
    el.emptyState.style.display = hasEntries ? 'none' : '';
    el.codeList.style.display = hasEntries ? '' : 'none';
  }

  /** 刷新所有卡片的验证码（异步并行） */
  async function refreshCodes() {
    await Promise.all(
      cards.map(async (card) => {
        const { entry, codeText, codeWrap } = card;
        try {
          const code = await window.TOTP.generateTOTP(entry.secret, {
            digits: entry.digits,
            period: entry.period,
            algorithm: entry.algorithm,
          });
          codeText.textContent = formatCode(code);
          codeWrap.dataset.raw = code;
          codeWrap.classList.remove('is-error');
        } catch (err) {
          codeText.textContent = '— 无效密钥 —';
          codeWrap.dataset.raw = '—';
          codeWrap.classList.add('is-error');
        }
      })
    );
  }

  /** 更新倒计时进度环（取所有条目中最小周期作为显示基准） */
  function updateCountdown() {
    const periods = cards.map((c) => c.entry.period).filter(Boolean);
    const period = periods.length ? Math.min(...periods) : currentSettings().period;
    const remaining = window.TOTP.secondsRemaining(period);
    const displaySec = Math.ceil(remaining);

    el.countdownNum.textContent = String(displaySec);

    const ratio = remaining / period;
    const offset = RING_CIRCUMFERENCE * (1 - ratio);
    el.countdownProgress.style.strokeDashoffset = String(offset);

    // 最后 5 秒变色提醒
    el.countdownProgress.classList.toggle('is-warning', remaining <= 5);

    return remaining;
  }

  // 记录上一周期的计数，用于跨周期触发刷新
  let lastCounter = -1;

  /** 主循环：每 250ms 跑一次，保证进度环平滑且周期切换即时刷新 */
  function tick() {
    const remaining = updateCountdown();

    const periods = cards.map((c) => c.entry.period).filter(Boolean);
    const period = periods.length ? Math.min(...periods) : currentSettings().period;
    const counter = Math.floor(Date.now() / 1000 / period);

    if (counter !== lastCounter) {
      lastCounter = counter;
      refreshCodes();
    }
  }

  /** 输入变化时：重建卡片 + 立即刷新一次 */
  function onInputChange() {
    const entries = parseEntries();
    rebuildCards(entries);
    lastCounter = -1; // 强制下一 tick 刷新
    refreshCodes();
    saveIfRemember();
  }

  /* ---------- 复制 ---------- */
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast(`已复制：${text}`);
    } catch (_) {
      showToast('复制失败，请手动选择');
    }
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove('is-visible');
    }, 1800);
  }

  /* ---------- 持久化 ---------- */
  function saveIfRemember() {
    if (!el.rememberToggle.checked) return;
    try {
      localStorage.setItem(STORAGE_KEY, el.keyInput.value);
    } catch (_) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(currentSettings()));
    } catch (_) {}
  }

  function loadState() {
    // 主题
    const savedTheme = localStorage.getItem(STORAGE_THEME);
    if (savedTheme) {
      document.documentElement.dataset.theme = savedTheme;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.dataset.theme = 'dark';
    }

    // 设置
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || 'null');
      if (s) {
        if (s.digits) el.digitsSelect.value = String(s.digits);
        if (s.period) el.periodSelect.value = String(s.period);
        if (s.algorithm) el.algoSelect.value = s.algorithm;
      }
    } catch (_) {}

    // 记住的密钥
    const remember = localStorage.getItem(STORAGE_REMEMBER) === '1';
    el.rememberToggle.checked = remember;
    if (remember) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) el.keyInput.value = saved;
    }
  }

  /* ---------- 主题 ---------- */
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_THEME, next);
    } catch (_) {}
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    el.keyInput.addEventListener('input', onInputChange);

    [el.digitsSelect, el.periodSelect, el.algoSelect].forEach((sel) => {
      sel.addEventListener('change', () => {
        saveSettings();
        onInputChange();
      });
    });

    el.rememberToggle.addEventListener('change', () => {
      try {
        localStorage.setItem(STORAGE_REMEMBER, el.rememberToggle.checked ? '1' : '0');
        if (el.rememberToggle.checked) {
          saveIfRemember();
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (_) {}
    });

    el.clearBtn.addEventListener('click', () => {
      el.keyInput.value = '';
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
      onInputChange();
      el.keyInput.focus();
    });

    el.themeToggle.addEventListener('click', toggleTheme);
  }

  /* ---------- 启动 ---------- */
  function init() {
    if (!window.crypto || !window.crypto.subtle) {
      showToast('当前浏览器不支持 Web Crypto，无法生成验证码');
      return;
    }
    loadState();
    bindEvents();
    onInputChange();
    tick();
    setInterval(tick, 250);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
