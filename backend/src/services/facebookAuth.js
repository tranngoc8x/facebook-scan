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
  console.log("[FB Auth] Checkpoint detected, trying auto-approve...");

  // Thu click cac nut approve tren checkpoint page
  // mbasic thuong dung input[type="submit"] hoac button[type="submit"]
  const approveSelectors = [
    'input[type="submit"][value*="Continue"]',
    'input[type="submit"][value*="continue"]',
    'input[type="submit"][value*="Tiep tuc"]',
    'input[type="submit"][value*="tiep tuc"]',
    'input[type="submit"][value*="This was me"]',
    'input[type="submit"][value*="Toi nhan ra"]',
    'input[type="submit"][value*="Yes"]',
    'input[type="submit"][value*="OK"]',
    'input[type="submit"][value*="Submit"]',
    'button[type="submit"]',
    'input[type="submit"]',
  ];

  for (const selector of approveSelectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Kiem tra xem co phai form nhap OTP khong
        // Neu co input text (OTP input) -> khong auto click, de user nhap
        const otpInput = page.locator(
          'input[name="approvals_code"], input[name="code"]',
        );
        const hasOtpInput = await otpInput
          .isVisible({ timeout: 500 })
          .catch(() => false);

        if (hasOtpInput) {
          console.log(
            "[FB Auth] OTP input found, skipping auto-approve (needs manual 2FA)",
          );
          return false;
        }

        const btnValue = await btn.getAttribute("value").catch(() => "submit");
        console.log(`[FB Auth] Clicking approve button: "${btnValue}"`);
        await btn.click();
        await page.waitForTimeout(3000);

        // Kiem tra URL sau khi click - co the co nhieu buoc checkpoint
        let url = page.url();
        // Thu click tiep neu van o checkpoint (co the co nhieu buoc)
        for (let step = 0; step < 3; step++) {
          if (
            !url.includes("checkpoint") &&
            !url.includes("two_step_verification")
          ) {
            console.log("[FB Auth] Auto-approve successful!");
            return true;
          }
          // Tim nut submit tiep theo
          const nextBtn = page.locator('input[type="submit"]').first();
          if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            // Kiem tra OTP input o buoc nay
            const otpCheck = page.locator(
              'input[name="approvals_code"], input[name="code"]',
            );
            if (await otpCheck.isVisible({ timeout: 500 }).catch(() => false)) {
              console.log("[FB Auth] OTP input found at step, need manual 2FA");
              return false;
            }
            console.log(
              `[FB Auth] Clicking next checkpoint button (step ${step + 1})`,
            );
            await nextBtn.click();
            await page.waitForTimeout(3000);
            url = page.url();
          } else {
            break;
          }
        }

        // Check final URL
        if (
          !url.includes("checkpoint") &&
          !url.includes("two_step_verification")
        ) {
          console.log("[FB Auth] Auto-approve successful after multi-step!");
          return true;
        }
      }
    } catch (e) {
      // Ignore and try next selector
    }
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

// Luu tru cac phien dang cho 2FA (key: sessionId -> { page, timeout })
const pendingSessions = new Map();

/**
 * Dang nhap tuong tac - giu page mo khi gap 2FA
 * Tra ve sessionId de client gui ma 2FA sau
 */
async function interactiveLogin({ email, password }) {
  const page = await pw.getPage();

  try {
    console.log("[FB Auth] Interactive login...");
    await page.goto(LOGIN_URL, {
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
      await pw.saveCookies();
      const cookies = await pw.getCookiesJSON();
      await page.close();
      return {
        success: true,
        message: "Da dang nhap roi",
        cookies,
        userName: "Facebook User",
      };
    }

    // Nhap email + password
    const emailInput = page.locator(
      'input[name="email"], input[id="m_login_email"]',
    );
    await emailInput.fill(email);
    await page.waitForTimeout(500);

    const passInput = page.locator(
      'input[name="pass"], input[id="m_login_password"]',
    );
    await passInput.fill(password);
    await page.waitForTimeout(500);

    await passInput.press("Enter");
    await page.waitForTimeout(5000);

    const currentUrl = page.url();

    // 2FA / checkpoint detected
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
          message: "Dang nhap thanh cong",
          cookies,
          userName,
        };
      }

      // Van con checkpoint -> can nhap ma 2FA thu cong
      const sessionId =
        Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

      const timeoutId = setTimeout(
        () => {
          const session = pendingSessions.get(sessionId);
          if (session) {
            console.log(`[FB Auth] 2FA session ${sessionId} expired`);
            session.page.close().catch(() => {});
            pendingSessions.delete(sessionId);
          }
        },
        5 * 60 * 1000,
      );

      pendingSessions.set(sessionId, { page, timeout: timeoutId });

      console.log(`[FB Auth] 2FA required, session: ${sessionId}`);
      return {
        success: false,
        requiresTwoFactor: true,
        sessionId,
        message: "Nhap ma xac thuc 2 buoc (2FA)",
      };
    }

    // Loi login
    const errorEl = page.locator("#error_box, ._9ay7");
    if (await errorEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      const errorText = await errorEl.textContent();
      await page.close();
      return { success: false, error: `Dang nhap that bai: ${errorText}` };
    }

    // Login thanh cong (khong co 2FA)
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
      return {
        success: true,
        message: "Dang nhap thanh cong",
        cookies,
        userName,
      };
    }

    await page.close();
    return {
      success: false,
      error: `Trang thai khong xac dinh. URL: ${currentUrl}`,
    };
  } catch (err) {
    console.error("[FB Auth] Interactive login error:", err.message);
    try {
      await page.close();
    } catch {}
    return { success: false, error: `Loi dang nhap: ${err.message}` };
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
  submit2FA,
  loginWithCookies,
  checkSession,
  logout,
};
