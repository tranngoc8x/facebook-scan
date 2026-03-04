const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "../../data");
const SESSION_DIR = path.join(DATA_DIR, "browser-session");
const COOKIES_FILE = path.join(DATA_DIR, "fb-cookies.json");

let browser = null;
let context = null;

/**
 * Khoi tao browser va context voi persistent session
 */
async function getBrowser() {
  if (browser && browser.isConnected()) return browser;

  browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  return browser;
}

/**
 * Lay browser context voi cookies da luu (neu co)
 */
async function getContext() {
  if (context) return context;

  const b = await getBrowser();

  context = await b.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  });

  // Load saved cookies neu co
  await loadCookies();

  return context;
}

/**
 * Lay page moi tu context
 */
async function getPage() {
  const ctx = await getContext();
  const page = await ctx.newPage();
  return page;
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
  saveCookies,
  loadCookies,
  clearSession,
  closeBrowser,
  getCookiesJSON,
};
