const pw = require("../src/services/playwright");

async function debugLogin() {
  try {
    const page = await pw.getPage();

    console.log("Navigating to mbasic login...");
    await page.goto("https://mbasic.facebook.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    console.log("Current URL:", page.url());

    // Get page HTML (first 5000 chars)
    const html = await page.content();
    console.log("=== PAGE HTML (first 3000 chars) ===");
    console.log(html.substring(0, 3000));

    // List all input elements
    const inputs = await page.evaluate(() => {
      const els = document.querySelectorAll("input, button");
      return Array.from(els).map((el) => ({
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        value: el.value?.substring(0, 50),
        class: el.className?.substring(0, 50),
      }));
    });

    console.log("\n=== FORM ELEMENTS ===");
    console.log(JSON.stringify(inputs, null, 2));

    await page.close();
    await pw.closeBrowser();
  } catch (err) {
    console.error("Error:", err.message);
  }
  process.exit(0);
}

debugLogin();
