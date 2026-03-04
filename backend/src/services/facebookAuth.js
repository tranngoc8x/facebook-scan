const pw = require("./playwright");

const FB_URL = "https://www.facebook.com";
const LOGIN_URL = "https://mbasic.facebook.com/login";

/**
 * Tu dong approve checkpoint (2FA auto-approval, "This was me", "Continue", v.v.)
 * Tren mbasic.facebook.com, checkpoint page thuong co form voi nut submit.
 * Function nay se thu click nut submit/continue va doi URL thay doi.
 * @param {Page} page - Playwright page
 * @returns {boolean} true neu auto-approve thanh cong
 */
async function tryAutoApproveCheckpoint(page) {
  const checkpointUrl = page.url();
  console.log("[FB Auth] Checkpoint detected, trying auto-approve...");
  console.log("[FB Auth] Checkpoint URL:", checkpointUrl);

  // Doi React render xong (www.facebook.com la SPA)
  try {
    await page.waitForLoadState("networkidle", { timeout: 10000 });
  } catch {
    // Timeout ok, tiep tuc
  }
  await page.waitForTimeout(3000);

  // Debug log
  try {
    const bodyText = await page.locator("body").innerText();
    console.log(
      "[FB Auth] Checkpoint text (truncated):",
      bodyText.substring(0, 500),
    );
  } catch {}

  // Thu tu dong approve qua nhieu buoc (Facebook co the co 2-3 buoc)
  for (let attempt = 0; attempt < 5; attempt++) {
    const url = page.url();
    if (!url.includes("checkpoint") && !url.includes("two_step_verification")) {
      console.log("[FB Auth] Auto-approve successful!");
      return true;
    }

    // Kiem tra OTP input - neu co thi can nhap thu cong
    const otpSelectors = [
      'input[name="approvals_code"]',
      'input[name="code"]',
      'input[type="text"][autocomplete="one-time-code"]',
      'input[inputmode="numeric"]',
    ];
    for (const sel of otpSelectors) {
      if (
        await page
          .locator(sel)
          .isVisible({ timeout: 500 })
          .catch(() => false)
      ) {
        console.log(`[FB Auth] OTP input found (${sel}), needs manual 2FA`);
        return false;
      }
    }

    // Tim nut approve - ca mbasic va www.facebook.com
    const buttonSelectors = [
      // mbasic selectors
      'input[type="submit"]',
      'button[type="submit"]',
      // www.facebook.com React selectors - tim button/a/div[role=button] co text phu hop
      'button:has-text("Continue")',
      'button:has-text("Tiếp tục")',
      'button:has-text("Tiep tuc")',
      'button:has-text("This was me")',
      'button:has-text("Yes")',
      'button:has-text("Đây là tôi")',
      'button:has-text("OK")',
      'button:has-text("Submit")',
      'button:has-text("Gửi")',
      '[role="button"]:has-text("Continue")',
      '[role="button"]:has-text("Tiếp tục")',
      '[role="button"]:has-text("This was me")',
      '[role="button"]:has-text("Yes")',
      '[role="button"]:has-text("Đây là tôi")',
      '[role="button"]:has-text("OK")',
      // Fallback: any visible button
      "button[data-testid]",
    ];

    let clicked = false;
    for (const selector of buttonSelectors) {
      try {
        const btn = page.locator(selector).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          const btnText = await btn.innerText().catch(() => "");
          console.log(
            `[FB Auth] Found button: "${btnText}" (${selector}), clicking...`,
          );
          await btn.click();
          clicked = true;
          await page.waitForTimeout(3000);

          // Doi React render lai
          try {
            await page.waitForLoadState("networkidle", { timeout: 5000 });
          } catch {}

          break;
        }
      } catch {
        // Skip selector
      }
    }

    if (!clicked) {
      console.log(
        `[FB Auth] No approve button found at attempt ${attempt + 1}`,
      );
      break;
    }
  }

  // Check URL cuoi cung
  const finalUrl = page.url();
  if (
    !finalUrl.includes("checkpoint") &&
    !finalUrl.includes("two_step_verification")
  ) {
    console.log("[FB Auth] Auto-approve successful after clicks!");
    return true;
  }

  // Fallback: doi them 5s xem co tu redirect khong
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(1000);
    const url = page.url();
    if (
      !url.includes("checkpoint") &&
      !url.includes("two_step_verification") &&
      !url.includes("login")
    ) {
      console.log("[FB Auth] Auto-approve via redirect!");
      return true;
    }
  }

  console.log("[FB Auth] Auto-approve failed, manual 2FA needed");
  return false;
}

/**
 * Dang nhap Facebook bang email/password
 * Dung mbasic.facebook.com de compat voi headless browser
 * @param {Object} opts - { email, password }
 */
async function login({ email, password }) {
  const page = await pw.getPage();

  try {
    console.log("[FB Auth] Navigating to Facebook login (mbasic)...");
    await page.goto(LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Kiem tra neu da login (redirect ve home)
    const url = page.url();
    if (
      !url.includes("login") &&
      !url.includes("checkpoint") &&
      (url.includes("facebook.com/home") || url.includes("facebook.com/?"))
    ) {
      console.log("[FB Auth] Already logged in");
      await pw.saveCookies();
      const cookies = await pw.getCookiesJSON();
      await page.close();
      return {
        success: true,
        message: "Already logged in",
        cookies,
        userName: "Facebook User",
      };
    }

    // Nhap email
    const emailInput = page.locator(
      'input[name="email"], input[id="m_login_email"]',
    );
    await emailInput.fill(email);
    await page.waitForTimeout(500);

    // Nhap password
    const passInput = page.locator(
      'input[name="pass"], input[id="m_login_password"]',
    );
    await passInput.fill(password);
    await page.waitForTimeout(500);

    // Submit form - nhan Enter (FB SPA hide submit button)
    await passInput.press("Enter");

    // Cho ket qua
    await page.waitForTimeout(5000);

    // Kiem tra login thanh cong
    const currentUrl = page.url();

    // Kiem tra 2FA / checkpoint
    if (
      currentUrl.includes("checkpoint") ||
      currentUrl.includes("two_step_verification")
    ) {
      const autoApproved = await tryAutoApproveCheckpoint(page);

      if (autoApproved) {
        await pw.saveCookies();
        const cookies = await pw.getCookiesJSON();
        const userName = await getProfileName(page);
        console.log(`[FB Auth] Login successful after auto-2FA: ${userName}`);
        await page.close();
        return {
          success: true,
          message: "Login successful",
          cookies,
          userName,
        };
      }

      // Van con checkpoint -> bao loi 2FA
      await page.close();
      return {
        success: false,
        error:
          "Two-factor authentication required. Please use interactive login (Globe icon) to enter 2FA code.",
        requiresTwoFactor: true,
      };
    }

    // Kiem tra loi login
    const errorEl = page.locator("#error_box, ._9ay7");
    if (await errorEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      const errorText = await errorEl.textContent();
      await page.close();
      return {
        success: false,
        error: `Login failed: ${errorText}`,
      };
    }

    // Login thanh cong
    if (
      !currentUrl.includes("login") ||
      currentUrl === FB_URL + "/" ||
      currentUrl.includes("facebook.com/?")
    ) {
      await pw.saveCookies();
      const cookies = await pw.getCookiesJSON();
      const userName = await getProfileName(page);
      console.log(`[FB Auth] Login successful: ${userName}`);
      await page.close();
      return { success: true, message: "Login successful", cookies, userName };
    }

    await page.close();
    return {
      success: false,
      error: `Unexpected state after login. URL: ${currentUrl}`,
    };
  } catch (err) {
    console.error("[FB Auth] Login error:", err.message);
    try {
      await page.close();
    } catch {}
    return {
      success: false,
      error: `Login error: ${err.message}`,
    };
  }
}

/**
 * Lay ten profile tu page hien tai
 */
async function getProfileName(page) {
  try {
    const profileLink = page.locator(
      '[aria-label="Your profile"], [aria-label="Trang cá nhân của bạn"]',
    );
    if (await profileLink.isVisible({ timeout: 3000 })) {
      return await profileLink.getAttribute("aria-label");
    }
  } catch {}
  return "Facebook User";
}

/**
 * Dang nhap bang cookies string (tu browser DevTools)
 */
async function loginWithCookies(cookieString) {
  try {
    const cookies = parseCookieString(cookieString);
    if (cookies.length === 0) {
      return { success: false, message: "Invalid cookie string" };
    }

    const ctx = await pw.getContext();
    await ctx.addCookies(cookies);
    await pw.saveCookies();

    // Verify session
    const status = await checkSession();
    if (status.isLoggedIn) {
      return { success: true, message: "Logged in with cookies" };
    }
    return { success: false, message: "Cookies expired or invalid" };
  } catch (err) {
    return { success: false, message: `Cookie login error: ${err.message}` };
  }
}

/**
 * Kiem tra session FB con valid khong
 */
async function checkSession() {
  const page = await pw.getPage();

  try {
    await page.goto(FB_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    const url = page.url();
    const isLoggedIn =
      !url.includes("login") &&
      !url.includes("checkpoint") &&
      (url.includes("facebook.com/?") ||
        url === FB_URL + "/" ||
        url.includes("facebook.com/home"));

    // Kiem tra them bang selector
    let userName = null;
    if (isLoggedIn) {
      try {
        const profileLink = page.locator(
          '[aria-label="Your profile"], [aria-label="Trang cá nhân của bạn"]',
        );
        if (await profileLink.isVisible({ timeout: 3000 })) {
          userName = await profileLink.getAttribute("aria-label");
        }
      } catch {}
    }

    await page.close();
    return {
      isLoggedIn,
      userName: userName || (isLoggedIn ? "Facebook User" : null),
    };
  } catch (err) {
    console.error("[FB Auth] Check session error:", err.message);
    try {
      await page.close();
    } catch {}
    return { isLoggedIn: false, userName: null };
  }
}

/**
 * Dang xuat Facebook
 */
async function logout() {
  await pw.clearSession();
  await pw.closeBrowser();
  return { success: true, message: "Logged out" };
}

/**
 * Parse cookie string tu browser DevTools
 * Format: "name1=value1; name2=value2"
 */
function parseCookieString(cookieStr) {
  if (!cookieStr || typeof cookieStr !== "string") return [];

  return cookieStr
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair.includes("="))
    .map((pair) => {
      const idx = pair.indexOf("=");
      return {
        name: pair.substring(0, idx).trim(),
        value: pair.substring(idx + 1).trim(),
        domain: ".facebook.com",
        path: "/",
      };
    });
}

// Luu tru trang thai login tuong tac (key: accountId -> { status, cookies, userName, error })
const loginSessions = new Map();

/**
 * Lay trang thai login tuong tac cua account
 */
function getLoginStatus(accountId) {
  return loginSessions.get(accountId) || null;
}

/**
 * Xoa trang thai login sau khi da doc
 */
function clearLoginStatus(accountId) {
  loginSessions.delete(accountId);
}

/**
 * Dang nhap tuong tac - dung headed browser (VNC mode)
 * Start login trong background, tra ve ngay
 * Frontend poll getLoginStatus() de kiem tra ket qua
 */
async function interactiveLogin({ email, password, accountId }) {
  // Dat status = pending ngay
  loginSessions.set(accountId, { status: "pending" });

  // Chay login trong background (khong await)
  _runInteractiveLogin({ email, password, accountId }).catch((err) => {
    console.error("[FB Auth] Background login error:", err.message);
    loginSessions.set(accountId, {
      status: "error",
      error: `Loi dang nhap: ${err.message}`,
    });
  });

  return { started: true };
}

/**
 * Background process: mo headed browser, nhap credentials, poll URL
 */
async function _runInteractiveLogin({ email, password, accountId }) {
  let page;

  try {
    console.log("[FB Auth] Interactive login (headed/VNC mode)...");

    page = await pw.getHeadedPage();

    await page.goto("https://www.facebook.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Kiem tra neu da login
    const url = page.url();
    if (
      !url.includes("login") &&
      !url.includes("checkpoint") &&
      (url.includes("facebook.com/home") || url.includes("facebook.com/?"))
    ) {
      await pw.saveHeadedCookies();
      const cookies = await pw.getHeadedCookiesJSON();
      await pw.closeHeadedBrowser();
      loginSessions.set(accountId, {
        status: "success",
        cookies,
        userName: "Facebook User",
      });
      return;
    }

    // Nhap email + password
    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(email);
      await page.waitForTimeout(500);

      const passInput = page.locator('input[name="pass"]');
      await passInput.fill(password);
      await page.waitForTimeout(500);

      const loginBtn = page.locator(
        'button[name="login"], button[type="submit"], #loginbutton',
      );
      if (await loginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loginBtn.click();
      } else {
        await passInput.press("Enter");
      }
    }

    // Poll URL moi 2s (toi da 5 phut)
    console.log("[FB Auth] Waiting for user to complete login via VNC...");
    const maxWaitMs = 5 * 60 * 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await page.waitForTimeout(2000);

      let currentUrl;
      try {
        currentUrl = page.url();
      } catch {
        break;
      }

      if (
        !currentUrl.includes("login") &&
        !currentUrl.includes("checkpoint") &&
        !currentUrl.includes("two_step_verification") &&
        !currentUrl.includes("recover") &&
        (currentUrl.includes("facebook.com") || currentUrl.includes("fb.com"))
      ) {
        console.log("[FB Auth] Login successful via VNC!");
        await pw.saveHeadedCookies();
        const cookies = await pw.getHeadedCookiesJSON();
        const userName = await getProfileName(page).catch(
          () => "Facebook User",
        );
        console.log(`[FB Auth] Logged in as: ${userName}`);

        await pw.closeHeadedBrowser();
        loginSessions.set(accountId, {
          status: "success",
          cookies,
          userName,
        });
        return;
      }
    }

    // Timeout
    console.log("[FB Auth] Interactive login timeout (5 min)");
    await pw.closeHeadedBrowser();
    loginSessions.set(accountId, {
      status: "error",
      error: "Het thoi gian cho (5 phut). Vui long thu lai.",
    });
  } catch (err) {
    console.error("[FB Auth] Interactive login error:", err.message);
    try {
      await pw.closeHeadedBrowser();
    } catch {}
    loginSessions.set(accountId, {
      status: "error",
      error: `Loi dang nhap: ${err.message}`,
    });
  }
}

/**
 * Gui ma 2FA vao phien Playwright dang cho
 */
async function submit2FA(sessionId, code) {
  const session = pendingSessions.get(sessionId);
  if (!session) {
    return {
      success: false,
      error: "Phien da het han. Vui long dang nhap lai.",
    };
  }

  const { page, timeout } = session;
  clearTimeout(timeout);
  pendingSessions.delete(sessionId);

  try {
    console.log(`[FB Auth] Submitting 2FA code for session ${sessionId}`);

    // Tim input 2FA tren mbasic (co the la input[name="approvals_code"])
    const codeInput = page.locator(
      'input[name="approvals_code"], input[id="approvals_code"], input[type="text"]',
    );

    if (await codeInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await codeInput.fill(code);
      await page.waitForTimeout(500);

      // Submit form
      const submitBtn = page.locator(
        'button[type="submit"], input[type="submit"], button[name="submit[Submit Code]"]',
      );
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
      } else {
        await codeInput.press("Enter");
      }

      await page.waitForTimeout(5000);
    } else {
      // Thu nhap vao bat ky input nao
      await page.keyboard.type(code);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(5000);
    }

    const currentUrl = page.url();

    // Kiem tra con checkpoint khong (co the FB hoi "save browser")
    if (currentUrl.includes("checkpoint")) {
      // Thu bam "Continue" / "Tiep tuc" neu co
      const continueBtn = page.locator(
        'button[type="submit"], input[type="submit"]',
      );
      if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await continueBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    const finalUrl = page.url();

    // Thanh cong
    if (
      !finalUrl.includes("login") &&
      !finalUrl.includes("checkpoint") &&
      (finalUrl.includes("facebook.com") || finalUrl === FB_URL + "/")
    ) {
      await pw.saveCookies();
      const cookies = await pw.getCookiesJSON();
      const userName = await getProfileName(page);
      console.log(`[FB Auth] 2FA login successful: ${userName}`);
      await page.close();
      return {
        success: true,
        message: "Dang nhap thanh cong",
        cookies,
        userName,
      };
    }

    // Van con checkpoint
    if (finalUrl.includes("checkpoint")) {
      await page.close();
      return {
        success: false,
        error: "Ma 2FA khong dung hoac Facebook yeu cau xac minh them.",
      };
    }

    await page.close();
    return {
      success: false,
      error: `Trang thai khong xac dinh. URL: ${finalUrl}`,
    };
  } catch (err) {
    console.error("[FB Auth] 2FA error:", err.message);
    try {
      await page.close();
    } catch {}
    return { success: false, error: `Loi 2FA: ${err.message}` };
  }
}

module.exports = {
  login,
  interactiveLogin,
  getLoginStatus,
  clearLoginStatus,
  submit2FA,
  loginWithCookies,
  checkSession,
  logout,
};
