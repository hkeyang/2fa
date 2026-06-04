/**
 * app.js — 界面交互与状态管理
 *
 * 职责：
 *  - 读取用户输入（多行密钥 / otpauth 链接）
 *  - 调用 TOTP 模块实时生成验证码
 *  - 渲染结果卡片、倒计时进度环
 *  - 复制、清空、记住密钥、语言切换
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'totp.secrets';
  const STORAGE_REMEMBER = 'totp.remember';
  const STORAGE_LANGUAGE = 'totp.language';
  const STORAGE_SETTINGS = 'totp.settings';
  const DEFAULT_API_BASE = 'https://youxi.aisea.space';
  const DEFAULT_LANGUAGE = 'zh';

  const I18N = {
    zh: {
      langAttr: 'zh-CN',
      langToggle: 'EN',
      brandTag: '2FA 动态验证码',
      inputTitle: '输入 2FA 密钥',
      inputSubtitle: '支持 Base32 格式，每行一个密钥，输入即实时生成。',
      secretLabel: '密钥（每行一个）',
      secretPlaceholder: '例如：JBSWY3DPEHPK3PXP\n也可粘贴 otpauth:// 链接',
      advanced: '高级参数',
      digits: '位数',
      period: '周期（秒）',
      algorithm: '算法',
      remember: '在本机记住密钥',
      clear: '清空',
      privacyNotice: '全程在浏览器本地计算，密钥不会上传到任何服务器。可断网使用。',
      codesTitle: '动态验证码',
      emptyState: '在左侧输入密钥后，这里会实时显示验证码。',
      loadingSession: '正在读取接码资料...',
      customerPage: '客户接码页',
      unavailableTitle: '接码链接不可用',
      unavailableMeta: '请返回后台重新生成客户接码页链接。',
      tokenTitleWithLabel: (label) => `接码页 · ${label}`,
      tokenMeta: '三种验证码集中查看，无需手动输入长密钥、手机号或邮箱。',
      googleAuthTitle: 'Google 验证器',
      localRefresh: '本地 30 秒刷新',
      refreshIn: (seconds) => `${seconds}s 后刷新`,
      generatedLocal: '本地生成，点击验证码可复制。',
      copiedLocal: '点击验证码可复制。',
      invalidTotpSecret: '谷歌验证器密钥格式不正确。',
      totpMissing: '该产品没有配置 Google 验证器密钥。',
      notConfigured: '未配置',
      smsTitle: '手机验证码',
      configuredPhone: '已配置手机接码',
      noPhone: '未配置手机',
      viewSms: '查看短信',
      readSms: '读取中',
      smsHint: '点击后由后台读取最新短信并提取验证码。',
      smsReading: '后台正在读取最新短信...',
      smsRead: '已读取最新短信。',
      smsCodeReady: '点击验证码可复制。',
      smsFailed: '短信验证码读取失败',
      smsNotFound: '未找到',
      smsRawInvalid: '手机接码内容不是可嵌入网址，请在后台检查接码字段。',
      smsMissing: '该产品没有配置手机接码网址。',
      mailTitle: '恢复邮箱验证码',
      noMail: '未配置邮箱',
      readMail: '读取邮件',
      readMailLoading: '读取中',
      mailHint: '点击读取最新恢复邮件验证码。',
      mailMissing: '该产品没有配置恢复邮箱。',
      mailReading: '后台正在读取最新恢复邮件...',
      mailRead: '已读取最新恢复邮件。',
      mailCodeReady: '点击验证码可复制。',
      mailFailed: '恢复邮箱验证码读取失败',
      expired: '已过期',
      validDays: (days) => `有效 ${days} 天`,
      validDaysHours: (days, hours) => `有效 ${days} 天 ${hours} 小时`,
      validHoursMinutes: (hours, minutes) => `有效 ${hours} 小时 ${minutes} 分钟`,
      validMinutes: (minutes) => `有效 ${minutes} 分钟`,
      validLessMinute: '有效 <1 分钟',
      keyLabel: (idx) => `密钥 ${idx + 1}`,
      digitsMeta: (digits) => `${digits}位`,
      copyTitle: '点击复制',
      invalidSecret: '— 无效密钥 —',
      copied: (text) => `已复制：${text}`,
      copyFailed: '复制失败，请手动选择',
      webCryptoMissing: '当前浏览器不支持 Web Crypto，无法生成验证码',
      loadingStatus: '正在读取接码资料...',
      sessionFailed: '接码链接读取失败',
    },
    en: {
      langAttr: 'en',
      langToggle: '中文',
      brandTag: '2FA verification codes',
      inputTitle: 'Enter 2FA Secret',
      inputSubtitle: 'Supports Base32 secrets, one per line, with live code generation.',
      secretLabel: 'Secret key (one per line)',
      secretPlaceholder: 'Example: JBSWY3DPEHPK3PXP\nYou can also paste an otpauth:// URL',
      advanced: 'Advanced settings',
      digits: 'Digits',
      period: 'Period (seconds)',
      algorithm: 'Algorithm',
      remember: 'Remember secrets on this device',
      clear: 'Clear',
      privacyNotice: 'Codes are calculated locally in your browser. Secrets are never uploaded and work offline.',
      codesTitle: 'Live Codes',
      emptyState: 'Enter a secret on the left and live codes will appear here.',
      loadingSession: 'Loading verification details...',
      customerPage: 'Customer verification page',
      unavailableTitle: 'Verification link unavailable',
      unavailableMeta: 'Return to the admin panel and generate a new customer verification link.',
      tokenTitleWithLabel: (label) => `Verification page · ${label}`,
      tokenMeta: 'View all three verification codes without manually entering long secrets, phone numbers, or email addresses.',
      googleAuthTitle: 'Google Authenticator',
      localRefresh: 'Refreshes locally every 30 seconds',
      refreshIn: (seconds) => `Refreshes in ${seconds}s`,
      generatedLocal: 'Generated locally. Click the code to copy.',
      copiedLocal: 'Click the code to copy.',
      invalidTotpSecret: 'The Google Authenticator secret is invalid.',
      totpMissing: 'This product has no Google Authenticator secret configured.',
      notConfigured: 'Not configured',
      smsTitle: 'SMS Code',
      configuredPhone: 'SMS receiving is configured',
      noPhone: 'No phone configured',
      viewSms: 'View SMS',
      readSms: 'Reading',
      smsHint: 'Click to let the backend read the latest SMS and extract the code.',
      smsReading: 'Reading the latest SMS...',
      smsRead: 'Latest SMS read.',
      smsCodeReady: 'Click the code to copy.',
      smsFailed: 'Failed to read SMS code',
      smsNotFound: 'Not found',
      smsRawInvalid: 'The SMS receiving content is not an embeddable URL. Check the SMS field in the admin panel.',
      smsMissing: 'This product has no SMS receiving URL configured.',
      mailTitle: 'Recovery Email Code',
      noMail: 'No email configured',
      readMail: 'Read Email',
      readMailLoading: 'Reading',
      mailHint: 'Read the latest recovery email code.',
      mailMissing: 'This product has no recovery email configured.',
      mailReading: 'Reading the latest recovery email...',
      mailRead: 'Latest recovery email read.',
      mailCodeReady: 'Click the code to copy.',
      mailFailed: 'Failed to read recovery email code',
      expired: 'Expired',
      validDays: (days) => `Valid ${days} ${days === 1 ? 'day' : 'days'}`,
      validDaysHours: (days, hours) =>
        `Valid ${days} ${days === 1 ? 'day' : 'days'} ${hours} ${hours === 1 ? 'hour' : 'hours'}`,
      validHoursMinutes: (hours, minutes) =>
        `Valid ${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
      validMinutes: (minutes) => `Valid ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
      validLessMinute: 'Valid <1 minute',
      keyLabel: (idx) => `Secret ${idx + 1}`,
      digitsMeta: (digits) => `${digits} digits`,
      copyTitle: 'Click to copy',
      invalidSecret: '— Invalid secret —',
      copied: (text) => `Copied: ${text}`,
      copyFailed: 'Copy failed. Please select it manually.',
      webCryptoMissing: 'This browser does not support Web Crypto, so codes cannot be generated.',
      loadingStatus: 'Loading verification details...',
      sessionFailed: 'Failed to load verification link',
    },
  };

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
    languageToggle: document.getElementById('languageToggle'),
    toast: document.getElementById('toast'),
    tokenPanel: document.getElementById('tokenPanel'),
    tokenTitle: document.getElementById('tokenTitle'),
    tokenMeta: document.getElementById('tokenMeta'),
    tokenExpires: document.getElementById('tokenExpires'),
    tokenStatus: document.getElementById('tokenStatus'),
    tokenTotpCode: document.getElementById('tokenTotpCode'),
    tokenTotpCopy: document.getElementById('tokenTotpCopy'),
    tokenTotpCountdown: document.getElementById('tokenTotpCountdown'),
    tokenTotpMessage: document.getElementById('tokenTotpMessage'),
    tokenSmsOpen: document.getElementById('tokenSmsOpen'),
    tokenSmsCode: document.getElementById('tokenSmsCode'),
    tokenSmsState: document.getElementById('tokenSmsState'),
    tokenSmsMessage: document.getElementById('tokenSmsMessage'),
    tokenMailCode: document.getElementById('tokenMailCode'),
    tokenMailRefresh: document.getElementById('tokenMailRefresh'),
    tokenMailState: document.getElementById('tokenMailState'),
    tokenMailMessage: document.getElementById('tokenMailMessage'),
  };

  // 进度环周长（r=16）
  const RING_CIRCUMFERENCE = 2 * Math.PI * 16;
  el.countdownProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);

  let toastTimer = null;
  let verifierToken = '';
  let verifierSecret = '';
  let verifierExpiresAt = '';
  let verifierLastCounter = -1;
  let verifierProduct = null;
  let currentLanguage = DEFAULT_LANGUAGE;

  function t(key, ...args) {
    const value = I18N[currentLanguage][key] ?? I18N[DEFAULT_LANGUAGE][key] ?? key;
    return typeof value === 'function' ? value(...args) : value;
  }

  function applyLanguage() {
    document.documentElement.lang = t('langAttr');
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder));
    });
    el.languageToggle.textContent = t('langToggle');
    Array.from(el.digitsSelect.options).forEach((option) => {
      option.textContent = currentLanguage === 'en' ? `${option.value} digits` : `${option.value} 位`;
    });

    cards.forEach((card) => {
      card.meta.textContent = `${card.entry.algorithm} · ${t('digitsMeta', card.entry.digits)} · ${card.entry.period}s`;
      card.codeWrap.title = t('copyTitle');
    });

    if (verifierToken) {
      renderVerifierStaticText();
      tickVerifierMode();
    }
  }

  function renderVerifierStaticText() {
    if (!verifierToken) return;
    if (verifierProduct) {
      const label = displayVerifierLabel(verifierProduct.label);
      el.tokenTitle.textContent = label ? t('tokenTitleWithLabel', label) : t('customerPage');
      el.tokenMeta.textContent = t('tokenMeta');
    }
    if (verifierSecret) {
      el.tokenTotpMessage.textContent = t('generatedLocal');
    } else {
      el.tokenTotpCountdown.textContent = t('notConfigured');
      el.tokenTotpMessage.textContent = t('totpMissing');
    }
    if (verifierProduct?.capabilities?.sms) {
      if (!el.tokenSmsOpen.dataset.raw && el.tokenSmsCode.textContent !== t('readSms')) {
        el.tokenSmsCode.textContent = t('viewSms');
      }
      el.tokenSmsState.textContent = el.tokenSmsOpen.dataset.raw ? t('smsCodeReady') : '';
      el.tokenSmsMessage.textContent = el.tokenSmsOpen.dataset.raw ? t('smsRead') : t('smsHint');
    }
    const recoveryEmail = verifierProduct
      ? verifierProduct.recoveryEmail || verifierProduct.hotmailEmail || verifierProduct.mailEmail || verifierProduct.email || ''
      : '';
    if (recoveryEmail) {
      if (!el.tokenMailRefresh.dataset.raw && el.tokenMailCode.textContent !== t('readMailLoading')) {
        el.tokenMailCode.textContent = t('readMail');
      }
      el.tokenMailState.textContent = el.tokenMailRefresh.dataset.raw ? t('mailCodeReady') : '';
      el.tokenMailMessage.textContent = el.tokenMailRefresh.dataset.raw ? t('mailRead') : t('mailHint');
    }
  }

  function displayVerifierLabel(label) {
    const value = String(label || '').trim();
    if (!value) return '';
    const match = value.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);
    if (!match) return value;
    const [, name, domain] = match;
    const prefix = name.slice(0, Math.min(3, name.length));
    return `${prefix}***@${domain}`;
  }

  function apiBase() {
    const params = new URLSearchParams(window.location.search);
    return (params.get('apiBase') || DEFAULT_API_BASE).replace(/\/+$/, '');
  }

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
        label: t('keyLabel', idx),
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
    meta.textContent = `${entry.algorithm} · ${t('digitsMeta', entry.digits)} · ${entry.period}s`;

    info.appendChild(label);
    info.appendChild(meta);

    const codeWrap = document.createElement('button');
    codeWrap.type = 'button';
    codeWrap.className = 'code-card__code';
    codeWrap.title = t('copyTitle');

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
          codeText.textContent = t('invalidSecret');
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

  function tokenFromLocation() {
    return new URLSearchParams(window.location.search).get('token') || '';
  }

  function setTokenStatus(message, isError) {
    el.tokenStatus.textContent = message || '';
    el.tokenStatus.classList.toggle('is-visible', Boolean(message));
    el.tokenStatus.classList.toggle('is-error', Boolean(isError));
  }

  function normalizeVerifierSecret(value) {
    const parsed = window.TOTP.parseOtpauth(value);
    return parsed?.secret || String(value || '').trim();
  }

  function tokenSecondsRemaining() {
    return Math.ceil(window.TOTP.secondsRemaining(30));
  }

  function formatTokenCode(code) {
    if (!code) return '------';
    return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  }

  function setVerifierCodeButton(button, codeNode, rawCode, placeholder) {
    const raw = rawCode || '';
    button.dataset.raw = raw;
    button.classList.toggle('has-code', Boolean(raw));
    codeNode.textContent = raw ? formatTokenCode(raw) : placeholder;
  }

  async function refreshVerifierTotp(force) {
    if (!verifierSecret) return;
    const counter = Math.floor(Date.now() / 1000 / 30);
    const seconds = tokenSecondsRemaining();
    el.tokenTotpCountdown.textContent = t('refreshIn', seconds);
    if (!force && counter === verifierLastCounter) return;
    verifierLastCounter = counter;
    try {
      const code = await window.TOTP.generateTOTP(normalizeVerifierSecret(verifierSecret), {
        digits: 6,
        period: 30,
        algorithm: 'SHA-1',
      });
      el.tokenTotpCode.textContent = formatTokenCode(code);
      el.tokenTotpCopy.dataset.raw = code;
      el.tokenTotpCopy.classList.add('has-code');
      el.tokenTotpMessage.textContent = t('generatedLocal');
    } catch (_) {
      el.tokenTotpCode.textContent = '------';
      el.tokenTotpCopy.dataset.raw = '';
      el.tokenTotpCopy.classList.remove('has-code');
      el.tokenTotpMessage.textContent = t('invalidTotpSecret');
    }
  }

  function formatTokenExpiry(secondsLeft) {
    if (secondsLeft <= 0) return t('expired');
    const days = Math.floor(secondsLeft / 86400);
    const hours = Math.floor((secondsLeft % 86400) / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    if (days > 0 && hours > 0) return t('validDaysHours', days, hours);
    if (days > 0) return t('validDays', days);
    if (hours > 0) return t('validHoursMinutes', hours, minutes);
    if (minutes > 0) return t('validMinutes', minutes);
    return t('validLessMinute');
  }

  function tickVerifierMode() {
    if (!verifierToken) return;
    refreshVerifierTotp(false);
    if (verifierExpiresAt) {
      const secondsLeft = Math.max(0, Math.floor((new Date(verifierExpiresAt).getTime() - Date.now()) / 1000));
      el.tokenExpires.textContent = formatTokenExpiry(secondsLeft);
    }
  }

  function setupVerifierProduct(data) {
    const product = data.product || {};
    verifierProduct = product;
    verifierSecret = product.googleAuth || '';
    verifierExpiresAt = data.expiresAt || '';
    const label = displayVerifierLabel(product.label);
    el.tokenTitle.textContent = label ? t('tokenTitleWithLabel', label) : t('customerPage');
    el.tokenMeta.textContent = t('tokenMeta');
    el.tokenPanel.hidden = false;
    setTokenStatus('', false);

    if (product.capabilities?.totp && verifierSecret) {
      refreshVerifierTotp(true);
    } else {
      el.tokenTotpCode.textContent = '------';
      el.tokenTotpCopy.classList.remove('has-code');
      el.tokenTotpCountdown.textContent = t('notConfigured');
      el.tokenTotpMessage.textContent = t('totpMissing');
    }

    if (product.capabilities?.sms) {
      el.tokenSmsOpen.disabled = false;
      setVerifierCodeButton(el.tokenSmsOpen, el.tokenSmsCode, '', t('viewSms'));
      el.tokenSmsState.textContent = '';
      el.tokenSmsMessage.textContent = t('smsHint');
    } else {
      el.tokenSmsOpen.disabled = true;
      setVerifierCodeButton(el.tokenSmsOpen, el.tokenSmsCode, '', t('notConfigured'));
      el.tokenSmsState.textContent = '';
      el.tokenSmsMessage.textContent = product.smsRaw
        ? t('smsRawInvalid')
        : t('smsMissing');
    }

    const recoveryEmail = product.recoveryEmail || product.hotmailEmail || product.mailEmail || product.email || '';
    el.tokenMailRefresh.disabled = !recoveryEmail;
    setVerifierCodeButton(el.tokenMailRefresh, el.tokenMailCode, '', recoveryEmail ? t('readMail') : t('notConfigured'));
    el.tokenMailState.textContent = '';
    el.tokenMailMessage.textContent = recoveryEmail ? t('mailHint') : t('mailMissing');
  }

  async function refreshSmsCode() {
    if (!verifierToken || el.tokenSmsOpen.disabled) return;
    const cached = el.tokenSmsOpen.dataset.raw || '';
    if (cached && el.tokenSmsCode.textContent !== t('readSms')) {
      copyToClipboard(cached);
      return;
    }
    el.tokenSmsCode.textContent = t('readSms');
    el.tokenSmsMessage.textContent = t('smsReading');
    try {
      const response = await fetch(`${apiBase()}/api/verifier-sms-code?token=${encodeURIComponent(verifierToken)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || t('smsFailed'));
      setVerifierCodeButton(el.tokenSmsOpen, el.tokenSmsCode, data.code || '', t('smsNotFound'));
      el.tokenSmsState.textContent = data.code ? t('smsCodeReady') : '';
      el.tokenSmsMessage.textContent = data.message || t('smsRead');
    } catch (error) {
      setVerifierCodeButton(el.tokenSmsOpen, el.tokenSmsCode, '', t('smsNotFound'));
      el.tokenSmsState.textContent = '';
      el.tokenSmsMessage.textContent = error.message || t('smsFailed');
    }
  }

  async function loadVerifierSession() {
    document.body.classList.add('token-mode');
    el.tokenPanel.hidden = false;
    setTokenStatus(t('loadingStatus'), false);
    try {
      const response = await fetch(`${apiBase()}/api/verifier-session?token=${encodeURIComponent(verifierToken)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || t('sessionFailed'));
      setupVerifierProduct(data);
    } catch (error) {
      el.tokenTitle.textContent = t('unavailableTitle');
      el.tokenMeta.textContent = t('unavailableMeta');
      setTokenStatus(error.message || t('sessionFailed'), true);
    }
  }

  async function refreshMailCode() {
    if (!verifierToken || el.tokenMailRefresh.disabled) return;
    const cached = el.tokenMailRefresh.dataset.raw || '';
    if (cached && el.tokenMailCode.textContent !== t('readMailLoading')) {
      copyToClipboard(cached);
      return;
    }
    el.tokenMailCode.textContent = t('readMailLoading');
    el.tokenMailMessage.textContent = t('mailReading');
    try {
      const response = await fetch(`${apiBase()}/api/verifier-mail-code?token=${encodeURIComponent(verifierToken)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || t('mailFailed'));
      setVerifierCodeButton(el.tokenMailRefresh, el.tokenMailCode, data.code || '', t('smsNotFound'));
      el.tokenMailState.textContent = data.code ? t('mailCodeReady') : '';
      el.tokenMailMessage.textContent = data.message || t('mailRead');
    } catch (error) {
      setVerifierCodeButton(el.tokenMailRefresh, el.tokenMailCode, '', t('smsNotFound'));
      el.tokenMailState.textContent = '';
      el.tokenMailMessage.textContent = error.message || t('mailFailed');
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
      showToast(t('copied', text));
    } catch (_) {
      showToast(t('copyFailed'));
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
    document.documentElement.dataset.theme = 'light';

    const savedLanguage = localStorage.getItem(STORAGE_LANGUAGE);
    currentLanguage = savedLanguage === 'en' ? 'en' : DEFAULT_LANGUAGE;
    applyLanguage();

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

  /* ---------- 语言 ---------- */
  function toggleLanguage() {
    currentLanguage = currentLanguage === 'en' ? 'zh' : 'en';
    applyLanguage();
    try {
      localStorage.setItem(STORAGE_LANGUAGE, currentLanguage);
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

    el.languageToggle.addEventListener('click', toggleLanguage);
    el.tokenTotpCopy.addEventListener('click', () => {
      const raw = el.tokenTotpCopy.dataset.raw || '';
      if (raw) copyToClipboard(raw);
    });
    el.tokenMailRefresh.addEventListener('click', refreshMailCode);
    el.tokenSmsOpen.addEventListener('click', refreshSmsCode);
  }

  /* ---------- 启动 ---------- */
  function init() {
    if (!window.crypto || !window.crypto.subtle) {
      showToast(t('webCryptoMissing'));
      return;
    }
    loadState();
    bindEvents();
    verifierToken = tokenFromLocation();
    if (verifierToken) {
      loadVerifierSession();
      tickVerifierMode();
      setInterval(tickVerifierMode, 250);
      return;
    }
    onInputChange();
    tick();
    setInterval(tick, 250);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
