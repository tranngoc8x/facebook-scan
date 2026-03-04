const pw = require("./playwright");
const ScannedPost = require("../models/ScannedPost");
const Group = require("../models/Group");
const FacebookAccount = require("../models/FacebookAccount");

/**
 * Scan mot Facebook group, lay cac bai post moi
 * @param {Object} group - Group document tu DB
 * @param {Object} options - { maxPosts, scrollCount }
 * @returns {Object} { newPosts, skipped, errors }
 */
async function scanGroup(group, options = {}) {
  const { maxPosts = 20, scrollCount = 3 } = options;
  const page = await pw.getPage();
  const result = { newPosts: 0, skipped: 0, errors: [] };

  try {
    console.log(`[Scanner] Scanning group: ${group.name} (${group.url})`);

    await page.goto(group.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // Kiem tra co can login khong
    if (page.url().includes("login")) {
      throw new Error("Not logged in to Facebook. Please login first.");
    }

    // Dong popup neu co (community questions, etc.)
    await dismissPopups(page);

    // Scroll de load them posts
    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await page.waitForTimeout(2000 + Math.random() * 1000);
    }

    // KHONG scroll lai len top - Facebook se unload posts khoi DOM
    // Extract posts ngay tai vi tri da scroll

    // Extract posts
    const rawPosts = await extractPosts(page, maxPosts);
    console.log(`[Scanner] Found ${rawPosts.length} posts in ${group.name}`);

    // Load ten cac tai khoan Facebook cua minh de loc ra
    const myAccounts = await FacebookAccount.find({}, { name: 1, email: 1 });
    const myNames = myAccounts
      .map((a) => a.name)
      .filter(Boolean)
      .map((n) => n.toLowerCase().trim())
      .filter((n) => n.length > 0);

    // Luu posts moi vao DB
    for (const raw of rawPosts) {
      try {
        // Skip bai viet khong co author
        if (!raw.authorName || raw.authorName.trim().length === 0) {
          console.log(
            `[Scanner] Skipping post without author: "${raw.content?.substring(0, 50)}..."`,
          );
          result.skipped++;
          continue;
        }

        // Skip bai viet cua chinh minh
        if (
          myNames.length > 0 &&
          raw.authorName &&
          myNames.some((name) => raw.authorName.toLowerCase().includes(name))
        ) {
          console.log(`[Scanner] Skipping own post by "${raw.authorName}"`);
          result.skipped++;
          continue;
        }

        // Check neu da scan roi
        const existing = await ScannedPost.findOne({ fbPostId: raw.fbPostId });
        if (existing) {
          result.skipped++;
          continue;
        }

        await ScannedPost.create({
          fbPostId: raw.fbPostId,
          groupId: group._id,
          authorName: raw.authorName || "",
          content: raw.content || "",
          postUrl: raw.postUrl || "",
          images: raw.images || [],
          scannedAt: new Date(),
          status: "new",
        });
        result.newPosts++;
      } catch (err) {
        if (err.code === 11000) {
          result.skipped++;
        } else {
          result.errors.push(err.message);
        }
      }
    }

    // Update lastScannedAt
    await Group.findByIdAndUpdate(group._id, { lastScannedAt: new Date() });

    console.log(
      `[Scanner] ${group.name}: ${result.newPosts} new, ${result.skipped} skipped`,
    );
  } catch (err) {
    console.error(`[Scanner] Error scanning ${group.name}:`, err.message);
    result.errors.push(err.message);
  } finally {
    try {
      await page.close();
    } catch {}
  }

  return result;
}

/**
 * Extract posts tu page hien tai
 * Su dung feed children thay vi div[role="article"] vi Facebook da thay doi DOM
 */
async function extractPosts(page, maxPosts) {
  const posts = await page.evaluate((limit) => {
    const results = [];

    // Strategy 1: Tim div[role="article"] (cach cu)
    let postElements = document.querySelectorAll('div[role="article"]');

    // Strategy 2: Neu khong co article, dung feed children
    if (postElements.length === 0) {
      const feed = document.querySelector('[role="feed"]');
      if (feed) {
        postElements = feed.children;
      }
    }

    for (const post of postElements) {
      if (results.length >= limit) break;

      try {
        // Skip cac element qua nho (divider, spacer, etc.)
        if ((post.textContent?.trim().length || 0) < 15) continue;

        // Tim tat ca cac link trong post
        const allLinks = post.querySelectorAll("a[href]");

        // Lay post ID tu link
        let fbPostId = "";
        let postUrl = "";
        for (const link of allLinks) {
          const href = link.getAttribute("href") || "";
          // Tim permalink patterns
          const postMatch = href.match(
            /\/posts\/(\w+)|permalink\/(\d+)|story_fbid=(\d+)/,
          );
          if (postMatch) {
            fbPostId = postMatch[1] || postMatch[2] || postMatch[3];
            postUrl = href.startsWith("http")
              ? href
              : "https://www.facebook.com" + href;
            break;
          }
        }

        if (!fbPostId) {
          // Generate ID tu noi dung
          const text =
            post.textContent?.substring(0, 100) || Math.random().toString();
          try {
            fbPostId =
              "gen_" +
              btoa(unescape(encodeURIComponent(text))).substring(0, 30);
          } catch {
            fbPostId = "gen_" + Math.random().toString(36).substring(2, 15);
          }
        }

        // Lay noi dung post - tim div co text dai nhat
        let content = "";
        const textDivs = post.querySelectorAll(
          'div[data-ad-preview="message"], div[dir="auto"], span[dir="auto"]',
        );
        for (const div of textDivs) {
          const text = div.textContent?.trim() || "";
          if (text.length > content.length && text.length > 10) {
            content = text;
          }
        }

        // Lay ten tac gia - thu nhieu selector
        let authorName = "";
        const authorSelectors = [
          'a[role="link"] strong',
          "strong a",
          "h2 a",
          "h3 a",
          "h4 a",
          'a[role="link"] span[dir="auto"]',
        ];
        for (const sel of authorSelectors) {
          const el = post.querySelector(sel);
          if (el) {
            const name = el.textContent?.trim() || "";
            if (name.length > 1 && name.length < 100) {
              authorName = name;
              break;
            }
          }
        }

        // Chi them post co noi dung
        if (content && content.length > 10) {
          results.push({
            fbPostId,
            content: content.substring(0, 2000),
            authorName: authorName.substring(0, 200),
            postUrl,
          });
        }
      } catch {
        // Skip post bi loi
      }
    }

    return results;
  }, maxPosts);

  return posts;
}

/**
 * Dong cac popup cua Facebook
 */
async function dismissPopups(page) {
  const popupSelectors = [
    '[aria-label="Close"]',
    '[aria-label="Dong"]',
    '[aria-label="Đóng"]',
    'div[role="dialog"] [aria-label="Close"]',
    'div[role="dialog"] button:has-text("Not Now")',
    'div[role="dialog"] button:has-text("Khong")',
  ];

  for (const selector of popupSelectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // Khong co popup
    }
  }
}

module.exports = {
  scanGroup,
};
