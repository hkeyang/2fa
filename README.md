# 2FA 验证码生成器

一个纯前端、离线可用的 **2FA / TOTP 动态验证码生成器**。在浏览器本地根据 Base32 密钥实时计算 6 位动态码，原理与 Google Authenticator、Microsoft Authenticator 一致，基于 [RFC 6238 (TOTP)](https://datatracker.ietf.org/doc/html/rfc6238) / [RFC 4226 (HOTP)](https://datatracker.ietf.org/doc/html/rfc4226)。

## 功能特性

- **实时生成**：输入密钥即时出码，每 30 秒（可配置）自动刷新。
- **多密钥**：每行一个密钥，同时管理多个账号。
- **otpauth 链接**：直接粘贴 `otpauth://totp/...` 链接，自动解析名称与参数。
- **可配置参数**：位数（6/7/8）、周期（30/60s）、算法（SHA-1/256/512）。
- **一键复制**：点击验证码即复制到剪贴板。
- **倒计时进度环**：直观显示距离下次刷新的剩余时间。
- **深 / 浅主题**：自动跟随系统，可手动切换并记忆。
- **本地记忆**：可选在本机 localStorage 保存密钥，方便下次使用。
- **隐私安全**：全程本地计算，密钥不上传任何服务器，可断网运行。

## 目录结构

```
2FA/
├── index.html        # 页面结构
├── styles.css        # 设计系统 + 样式（CSS 变量驱动，双主题）
├── js/
│   ├── totp.js       # 核心算法：Base32 解码 / HOTP / TOTP / otpauth 解析
│   └── app.js        # 界面交互与状态管理
├── test/
│   └── verify.mjs    # RFC 6238 标准测试向量校验
└── README.md
```

## 使用方法

因为用到了浏览器的 Web Crypto API（`crypto.subtle`），需要在 **安全上下文** 下运行——即通过 `http://localhost` 或 `https://` 访问，直接用 `file://` 打开会无法生成验证码。

启动任意本地静态服务器即可，例如：

```bash
# Python 3
python3 -m http.server 8080

# 或 Node（需先安装 serve）
npx serve .
```

然后浏览器打开 `http://localhost:8080`。

## 算法验证

项目内置 RFC 6238 官方测试向量，可校验算法实现：

```bash
node test/verify.mjs
```

预期输出 `6/6 通过`。

## 工作原理（简述）

1. Base32 密钥解码为原始字节。
2. 取当前 Unix 时间戳，除以周期（默认 30s）得到计数器 `T`。
3. 以密钥为 key，对 8 字节大端的 `T` 做 HMAC-SHA1。
4. 对结果做动态截断（Dynamic Truncation），得到 31 位整数。
5. 对 `10^位数` 取模，前补零得到最终验证码。

客户端与服务端各自用相同密钥和时间独立计算，结果一致，因此整个过程**无需联网**。

## 安全提示

- 2FA 密钥等同于密码，请妥善保管，不要泄露或截图分享。
- “在本机记住密钥”会将密钥明文存入浏览器 localStorage，请仅在私人设备上使用。
- 本工具仅用于管理你自己拥有合法访问权限的账号。
# 2fa
