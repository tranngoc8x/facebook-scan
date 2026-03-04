const FacebookAccount = require("../models/FacebookAccount");
const facebookAuth = require("../services/facebookAuth");

/**
 * GET /api/fb-accounts
 */
exports.getAll = async (req, res) => {
  try {
    const accounts = await FacebookAccount.find().sort({ createdAt: -1 });
    const safeAccounts = accounts.map((a) => a.toSafeJSON());
    res.json({ success: true, data: safeAccounts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/fb-accounts
 */
exports.create = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email va password bat buoc" });
    }

    const existing = await FacebookAccount.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Email da ton tai" });
    }

    const account = new FacebookAccount({ email });
    account.setPassword(password);
    await account.save();

    res.json({ success: true, data: account.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/fb-accounts/:id
 */
exports.update = async (req, res) => {
  try {
    const account = await FacebookAccount.findById(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }

    const { email, password } = req.body;
    if (email) account.email = email;
    if (password) account.setPassword(password);
    await account.save();

    res.json({ success: true, data: account.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/fb-accounts/:id
 */
exports.remove = async (req, res) => {
  try {
    const account = await FacebookAccount.findByIdAndDelete(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }
    res.json({ success: true, data: { message: "Deleted" } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/fb-accounts/:id/login
 */
exports.login = async (req, res) => {
  try {
    const account = await FacebookAccount.findById(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }

    const password = account.getPassword();
    if (!password) {
      return res
        .status(400)
        .json({ success: false, message: "No password set for this account" });
    }

    const result = await facebookAuth.login({
      email: account.email,
      password,
    });

    if (result.success) {
      account.status = "active";
      account.name = result.userName || "";
      account.cookies = result.cookies || "";
      account.lastLoginAt = new Date();
      account.error = "";
    } else {
      account.status = "error";
      account.error = result.error || "Login failed";
    }
    await account.save();

    res.json({
      success: result.success,
      data: account.toSafeJSON(),
      message: result.success ? "Login thanh cong" : account.error,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/fb-accounts/:id/logout
 */
exports.logout = async (req, res) => {
  try {
    const account = await FacebookAccount.findById(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }

    await facebookAuth.logout();
    account.status = "inactive";
    account.cookies = "";
    await account.save();

    res.json({ success: true, data: account.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/fb-accounts/:id/status
 */
exports.checkStatus = async (req, res) => {
  try {
    const account = await FacebookAccount.findById(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }

    const result = await facebookAuth.checkSession();
    account.lastCheckedAt = new Date();

    if (result.isLoggedIn) {
      account.status = "active";
      account.name = result.userName || account.name;
      account.error = "";
    } else {
      account.status = "inactive";
    }
    await account.save();

    res.json({ success: true, data: account.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/fb-accounts/:id/save-cookies
 * Nhan cookies tu interactive login script
 */
exports.saveCookies = async (req, res) => {
  try {
    const account = await FacebookAccount.findById(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }

    const { cookies } = req.body;
    if (!cookies) {
      return res
        .status(400)
        .json({ success: false, message: "Cookies required" });
    }

    // Luu cookies vao account
    account.cookies = cookies;
    account.status = "active";
    account.lastLoginAt = new Date();
    account.error = "";

    // Load cookies vao Playwright context
    try {
      const pw = require("../services/playwright");
      const ctx = await pw.getContext();
      const cookiesArray = JSON.parse(cookies);
      await ctx.addCookies(cookiesArray);
      await pw.saveCookies();
      account.name = "Facebook User";
    } catch (err) {
      console.error("[FB Account] Error loading cookies:", err.message);
    }

    await account.save();
    res.json({ success: true, data: account.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/fb-accounts/:id/set-active
 * Chon tai khoan nay lam tai khoan hien tai
 */
exports.setActive = async (req, res) => {
  try {
    const account = await FacebookAccount.findById(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }

    // Tat isActive cho tat ca account khac
    await FacebookAccount.updateMany(
      { _id: { $ne: account._id } },
      { isActive: false },
    );

    // Bat isActive cho account nay
    account.isActive = true;
    await account.save();

    res.json({ success: true, data: account.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/fb-accounts/:id/browser-login
 * Render trang HTML de user login Facebook va paste cookies
 */
exports.browserLogin = async (req, res) => {
  try {
    const account = await FacebookAccount.findById(req.params.id);
    if (!account) {
      return res.status(404).send("Account not found");
    }

    // apiBase se la window.location.origin trong browser
    const accountId = account._id;

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facebook Login - ${account.email}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #0a0a1a; color: #e0e0e0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { max-width: 480px; width: 100%; padding: 32px; }
    h1 { font-size: 20px; margin-bottom: 8px; color: #fff; }
    .email { color: #a78bfa; font-size: 14px; margin-bottom: 24px; }
    .section { background: #1a1a2e; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .section h3 { font-size: 14px; margin-bottom: 12px; color: #a78bfa; }
    .step { display: flex; gap: 12px; margin-bottom: 12px; }
    .step:last-child { margin-bottom: 0; }
    .step-num { background: #7c3aed; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0; }
    .step-text { font-size: 14px; line-height: 1.5; }
    .step-text a { color: #a78bfa; }
    textarea { width: 100%; background: #1a1a2e; border: 1px solid #333; color: #fff; padding: 12px; border-radius: 8px; font-size: 13px; font-family: monospace; resize: vertical; margin-bottom: 16px; }
    textarea:focus { outline: none; border-color: #7c3aed; }
    button { width: 100%; padding: 12px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; color: #fff; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #7c3aed; }
    .btn-primary:hover { background: #6d28d9; }
    .btn-secondary { background: #374151; margin-bottom: 8px; }
    .btn-secondary:hover { background: #4b5563; }
    .result { margin-top: 16px; padding: 12px; border-radius: 8px; font-size: 14px; display: none; }
    .success { background: #064e3b; color: #6ee7b7; display: block; }
    .error { background: #7f1d1d; color: #fca5a5; display: block; }
    .divider { text-align: center; color: #666; margin: 16px 0; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Dang nhap Facebook</h1>
    <p class="email">${account.email}</p>

    <div class="section">
      <h3>Cach 1: Dang nhap tu dong</h3>
      <p style="font-size:13px;color:#999;margin-bottom:12px;">Khong ho tro 2FA. Neu can 2FA, dung Cach 2.</p>
      <button class="btn-secondary" id="autoLoginBtn" onclick="autoLogin()">Dang nhap tu dong</button>
    </div>

    <div class="divider">- hoac -</div>

    <div class="section">
      <h3>Cach 2: Paste Cookies (ho tro 2FA)</h3>
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Mo <a href="https://www.facebook.com" target="_blank">facebook.com</a> trong tab moi va dang nhap (ke ca 2FA)</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Nhan F12 &rarr; Console &rarr; go: <code style="background:#333;padding:2px 6px;border-radius:4px;">document.cookie</code> &rarr; Enter</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Copy ket qua va paste vao o ben duoi</div>
      </div>
    </div>

    <textarea id="cookies" rows="4" placeholder="c_user=123; xs=abc; fr=xyz; datr=..."></textarea>
    <button class="btn-primary" id="saveBtn" onclick="saveCookies()">Luu Cookies va Dang nhap</button>
    <div id="result" class="result"></div>
  </div>

  <script>
    const API = window.location.origin;
    const ID = '${accountId}';

    async function autoLogin() {
      const btn = document.getElementById('autoLoginBtn');
      const result = document.getElementById('result');
      btn.disabled = true;
      btn.textContent = 'Dang xu ly...';
      try {
        const resp = await fetch(API + '/api/fb-accounts/' + ID + '/login', { method: 'POST' });
        const data = await resp.json();
        if (data.success) {
          result.className = 'result success';
          result.textContent = 'Dang nhap thanh cong! Co the dong tab nay.';
        } else {
          result.className = 'result error';
          result.textContent = data.message || 'That bai. Thu Cach 2 (paste cookies).';
        }
      } catch (err) {
        result.className = 'result error';
        result.textContent = 'Loi ket noi: ' + err.message;
      }
      btn.disabled = false;
      btn.textContent = 'Dang nhap tu dong';
    }

    async function saveCookies() {
      const cookies = document.getElementById('cookies').value.trim();
      if (!cookies) return alert('Hay paste cookies vao');
      const btn = document.getElementById('saveBtn');
      const result = document.getElementById('result');
      btn.disabled = true;
      btn.textContent = 'Dang luu...';
      try {
        const resp = await fetch(API + '/api/fb-accounts/' + ID + '/save-cookies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookies })
        });
        const data = await resp.json();
        if (data.success) {
          result.className = 'result success';
          result.textContent = 'Luu cookies thanh cong! Co the dong tab nay.';
        } else {
          result.className = 'result error';
          result.textContent = data.message || 'Loi khi luu cookies';
        }
      } catch (err) {
        result.className = 'result error';
        result.textContent = 'Loi ket noi: ' + err.message;
      }
      btn.disabled = false;
      btn.textContent = 'Luu Cookies va Dang nhap';
    }
  </script>
</body>
</html>`);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
};

/**
 * POST /api/fb-accounts/:id/interactive-login
 * Dang nhap tuong tac qua Playwright, ho tro 2FA
 */
exports.interactiveLogin = async (req, res) => {
  try {
    const account = await FacebookAccount.findById(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Khong tim thay tai khoan" });
    }

    if (!account.encryptedPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Tai khoan chua co password" });
    }

    const result = await facebookAuth.interactiveLogin({
      email: account.email,
      password: account.getPassword(),
    });
Name	Type	Length	Decimals	Not Null	Virtual	Key	Virtual Type	Expression	Enum Value	Default Value	Comment	Storage	Column Format	Character Set	Collation	Key Length	Key Order	Generated Always	On Update Current_Timestamp	Binary	Auto Increment	Unsigned	Zerofill
address_new	varchar	1024		false	false	false				NULL	Địa chỉ sau khi sáp nhập 2025			utf8mb3	utf8mb3_unicode_ci			false	false	false	false	false	false
address_en_new	varchar	1024		false	false	false				NULL	Địa chỉ sau khi sáp nhập 2025			utf8mb3	utf8mb3_unicode_ci			false	false	false	false	false	false
title_city_new	varchar	70		false	false	false				NULL	Địa chỉ sau khi sáp nhập 2025			utf8mb3	utf8mb3_unicode_ci			false	false	false	false	false	false
title_ward_new	varchar	70		false	false	false				NULL	Địa chỉ sau khi sáp nhập 2025			utf8mb3	utf8mb3_unicode_ci			false	false	false	false	false	false
city_new_id	int	11		false	false	false				NULL	Địa chỉ sau khi sáp nhập 2025							false	false	false	false	false	false
ward_new_id	int	11		false	false	false				NULL	Địa chỉ sau khi sáp nhập 2025							false	false	false	false	false	false
    if (result.success) {
      // Luu cookies vao account
      account.status = "active";
      account.cookies = result.cookies;
      account.error = null;
      account.lastLoginAt = new Date();
      if (result.userName) account.name = result.userName;
      await account.save();
    } else if (result.requiresTwoFactor) {
      // Giu nguyen status, cho user nhap 2FA
      account.error = "Dang cho ma xac thuc 2FA";
      await account.save();
    }

    res.json({
      success: result.success,
      message: result.message,
      error: result.error,
      requiresTwoFactor: result.requiresTwoFactor || false,
      sessionId: result.sessionId || null,
      data: account.toSafeJSON(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/fb-accounts/:id/submit-2fa
 * Gui ma 2FA vao phien Playwright
 */
exports.submit2FA = async (req, res) => {
  try {
    const { sessionId, code } = req.body;
    if (!sessionId || !code) {
      return res
        .status(400)
        .json({ success: false, message: "sessionId va code bat buoc" });
    }

    const account = await FacebookAccount.findById(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Khong tim thay tai khoan" });
    }

    const result = await facebookAuth.submit2FA(sessionId, code);

    if (result.success) {
      account.status = "active";
      account.cookies = result.cookies;
      account.error = null;
      account.lastLoginAt = new Date();
      if (result.userName) account.name = result.userName;
      await account.save();
    } else {
      account.status = "error";
      account.error = result.error;
      await account.save();
    }

    res.json({
      success: result.success,
      message: result.message,
      error: result.error,
      data: account.toSafeJSON(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
