#!/usr/bin/env node
/**
 * Interactive Facebook Login
 * Mo browser thuc (headed), user tu dang nhap (xu ly 2FA, captcha...)
 * Sau khi login xong, cookies duoc luu vao backend API
 *
 * Usage: node scripts/fb-login-interactive.js [accountId]
 * Neu khong co accountId, se list accounts va cho chon
 */

const { chromium } = require("playwright");
const http = require("http");

const API_BASE = process.env.API_URL || "http://localhost:4000/api";

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { "Content-Type": "application/json" },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const accountId = process.argv[2];

  // Lay account info
  let account;
  if (accountId) {
    const res = await apiRequest("GET", "/fb-accounts");
    const accounts = res.data || [];
    account = accounts.find((a) => a._id === accountId);
    if (!account) {
      console.error(`Account ${accountId} not found`);
      process.exit(1);
    }
  } else {
    // List accounts
    const res = await apiRequest("GET", "/fb-accounts");
    const accounts = res.data || [];
    if (accounts.length === 0) {
      console.log("No accounts found. Create one via the dashboard first.");
      process.exit(1);
    }

    console.log("\nAvailable accounts:");
    accounts.forEach((a, i) => {
      const status =
        a.status === "active"
          ? "✓ Connected"
          : a.status === "error"
            ? "✗ Error"
            : "○ Disconnected";
      console.log(`  ${i + 1}. ${a.email} [${status}]`);
    });

    // Su dung account dau tien
    account = accounts[0];
    console.log(`\nUsing: ${account.email}`);
  }

  console.log(`\nOpening browser for: ${account.email}`);
  console.log(
    "Please login manually. The browser will close automatically after login.\n",
  );

  // Mo browser headed
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "vi-VN",
  });

  const page = await context.newPage();

  // Navigate to FB login
  await page.goto("https://www.facebook.com/login", {
    waitUntil: "domcontentloaded",
  });

  // Pre-fill email
  try {
    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill(account.email);
  } catch {
    // Ignore
  }

  // Doi user login (poll URL thay doi)
  console.log("Waiting for login...");

  let loggedIn = false;
  for (let i = 0; i < 120; i++) {
    // Max 2 phut
    await page.waitForTimeout(1000);
    const url = page.url();

    if (
      !url.includes("login") &&
      !url.includes("checkpoint") &&
      (url.includes("facebook.com/?") ||
        url.includes("facebook.com/home") ||
        url === "https://www.facebook.com/")
    ) {
      loggedIn = true;
      break;
    }

    // Neu dang o checkpoint (2FA), cho tiep
    if (url.includes("checkpoint")) {
      if (i % 5 === 0)
        console.log("  2FA detected, waiting for you to complete...");
    }
  }

  if (loggedIn) {
    console.log("\n✓ Login successful!");

    // Lay cookies
    const cookies = await context.cookies();
    const cookiesJSON = JSON.stringify(cookies);

    // Gui cookies ve backend
    console.log("Saving cookies to backend...");
    const saveResult = await apiRequest(
      "POST",
      `/fb-accounts/${account._id}/save-cookies`,
      { cookies: cookiesJSON },
    );

    if (saveResult.success) {
      console.log("✓ Cookies saved! Account is now active.");
    } else {
      console.log("✗ Failed to save cookies:", saveResult.message);
    }
  } else {
    console.log("\n✗ Login timed out (2 minutes). Please try again.");
  }

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
