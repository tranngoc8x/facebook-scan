const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "../../data");
const SESSION_DIR = path.join(DATA_DIR, "browser-session");
const COOKIES_FILE = path.join(DATA_DIR, "fb-cookies.json");

let browser = null;
let context = null;

/**
 * Stealth script - inject vao moi page de an dau headless browser
 */
const STEALTH_SCRIPT = `
  // 1. Override navigator.webdriver
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
  });

  // 2. Override chrome.runtime
  window.chrome = {
    runtime: {
      onConnect: { addListener: function() {} },
      onMessage: { addListener: function() {} },
    },
    loadTimes: function() { return {}; },
    csi: function() { return {}; },
  };

  // 3. Override navigator.plugins (them plugins gia)
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const plugins = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ];
      plugins.length = 3;
      return plugins;
    },
  });

  // 4. Override navigator.languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['vi-VN', 'vi', 'en-US', 'en'],
  });

  // 5. Override Permissions.prototype.query
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) => (
    parameters.name === 'notifications' ?
      Promise.resolve({ state: Notification.permission }) :
      originalQuery(parameters)
  );

  // 6. Override navigator.hardwareConcurrency
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => 8,
  });

  // 7. Override navigator.deviceMemory
  Object.defineProperty(navigator, 'deviceMemory', {
    get: () => 8,
  });

  // 8. Patch toSource (Firefox detection)
  if (!Function.prototype.toSource) {
    Function.prototype.toSource = function() {
      return '() { [native code] }';
    };
  }

  // 9. Override navigator.connection
  Object.defineProperty(navigator, 'connection', {
    get: () => ({
      effectiveType: '4g',
      rtt: 50,
      downlink: 10,
      saveData: false,
    }),
  });

  // 10. Override WebGL vendor/renderer
  const getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(parameter) {
    if (parameter === 37445) return 'Intel Inc.';
    if (parameter === 37446) return 'Intel Iris OpenGL Engine';
    return getParameter.call(this, parameter);
  };
`;

/**
 * Khoi tao browser va context voi persistent session + stealth
 */
async function getBrowser() {
  if (browser && browser.isConnected()) return browser;

  browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1280,800",
      "--start-maximized",
    ],
  });

  return browser;
}

/**
 * Lay browser context voi cookies da luu (neu co) + stealth
 */
async function getContext() {
  if (context) return context;

  const b = await getBrowser();

  context = await b.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    // Stealth: them extra HTTP headers
    extraHTTPHeaders: {
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  // Inject stealth script vao moi page
  await context.addInitScript(STEALTH_SCRIPT);

  // Load saved cookies neu co
  await loadCookies();

  return context;
}
/**
 * Lay page moi tu context (headless - cho login thuong)
 */
async function getPage() {
  const ctx = await getContext();
  const page = await ctx.newPage();
  return page;
}

// === HEADED BROWSER (cho interactive login voi VNC) ===
let headedBrowser = null;
let headedContext = null;

/**
 * Lay page tu headed browser (hien thi tren VNC/Xvfb)
 * User co the thao tac truc tiep qua noVNC
 */
async function getHeadedPage() {
  // Dong headed browser cu neu con
  await closeHeadedBrowser();

  headedBrowser = await chromium.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--window-size=1280,800",
      "--start-maximized",
    ],
  });

  headedContext = await headedBrowser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  });

  // Inject stealth script
  await headedContext.addInitScript(STEALTH_SCRIPT);

  const page = await headedContext.newPage();
  console.log("[Playwright] Headed browser launched (VNC mode)");
  return page;
}

/**
 * Luu cookies tu headed browser context
 */
async function saveHeadedCookies() {
  if (!headedContext) return;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const cookies = await headedContext.cookies();
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  console.log(
    `[Playwright] Saved ${cookies.length} cookies from headed browser`,
  );

  // Cung luu vao headless context de dung cho cac thao tac sau
  if (context) {
    await context.addCookies(cookies);
  }
}

/**
 * Lay cookies JSON tu headed browser
 */
async function getHeadedCookiesJSON() {
  if (!headedContext) return "";
  const cookies = await headedContext.cookies();
  return JSON.stringify(cookies);
}

/**
 * Dong headed browser
 */
async function closeHeadedBrowser() {
  if (headedContext) {
    await headedContext.close().catch(() => {});
    headedContext = null;
  }
  if (headedBrowser) {
    await headedBrowser.close().catch(() => {});
    headedBrowser = null;
  }
}

/**
 * Luu cookies hien tai
 */
async function saveCookies() {
  if (!context) return;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  console.log(`[Playwright] Saved ${cookies.length} cookies`);
}

/**
 * Load cookies da luu
 */
async function loadCookies() {
  if (!context) return false;

  if (fs.existsSync(COOKIES_FILE)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf-8"));
      await context.addCookies(cookies);
      console.log(`[Playwright] Loaded ${cookies.length} cookies`);
      return true;
    } catch (err) {
      console.error("[Playwright] Failed to load cookies:", err.message);
    }
  }
  return false;
}

/**
 * Xoa cookies va session
 */
async function clearSession() {
  if (context) {
    await context.clearCookies();
  }
  if (fs.existsSync(COOKIES_FILE)) {
    fs.unlinkSync(COOKIES_FILE);
  }
  console.log("[Playwright] Session cleared");
}

/**
 * Dong browser va context
 */
async function closeBrowser() {
  if (context) {
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Lay cookies hien tai dang JSON string (de luu vao DB)
 */
async function getCookiesJSON() {
  if (!context) return "";
  const cookies = await context.cookies();
  return JSON.stringify(cookies);
}

module.exports = {
  getBrowser,
  getContext,
  getPage,
  getHeadedPage,
  saveHeadedCookies,
  getHeadedCookiesJSON,
  closeHeadedBrowser,
  saveCookies,
  loadCookies,
  clearSession,
  closeBrowser,
  getCookiesJSON,
};
