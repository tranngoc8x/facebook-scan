const pw = require("./playwright");
const ScannedPost = require("../models/ScannedPost");
const Group = require("../models/Group");

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

    // Scroll lai len top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    // Extract posts
    const rawPosts = await extractPosts(page, maxPosts);
    console.log(`[Scanner] Found ${rawPosts.length} posts in ${group.name}`);

    // Luu posts moi vao DB
    for (const raw of rawPosts) {
      try {
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
          // Duplicate key - da scan roi
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
 */
async function extractPosts(page, maxPosts) {
  const posts = await page.evaluate((limit) => {
    const results = [];

    // Facebook render posts trong cac div[role="article"]
    const articles = document.querySelectorAll('div[role="article"]');

    for (const article of articles) {
      if (results.length >= limit) break;

      try {
        // Lay post ID tu data attribute hoac link
        let fbPostId = "";
        const permalink = article.querySelector(
          'a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid"]',
        );
        if (permalink) {
          const href = permalink.getAttribute("href") || "";
          // Extract post ID tu URL
          const postMatch = href.match(
            /\/posts\/(\d+)|permalink\/(\d+)|story_fbid=(\d+)/,
          );
          if (postMatch) {
            fbPostId = postMatch[1] || postMatch[2] || postMatch[3];
          } else {
            // Dung URL lam ID
            fbPostId = href.replace(/[^a-zA-Z0-9]/g, "").substring(0, 50);
          }
        }

        if (!fbPostId) {
          // Generate ID tu noi dung
          const text =
            article.textContent?.substring(0, 100) || Math.random().toString();
          fbPostId = "gen_" + btoa(text).substring(0, 30);
        }

        // Lay noi dung post
        let content = "";
        // Tim div chua text chinh cua post (khong phai comments)
        const textDivs = article.querySelectorAll(
          'div[data-ad-preview="message"], div[dir="auto"]',
        );
        for (const div of textDivs) {
          const text = div.textContent?.trim() || "";
          if (text.length > content.length && text.length > 20) {
            content = text;
          }
        }

        // Lay ten tac gia
        let authorName = "";
        const authorLink = article.querySelector(
          'a[role="link"] strong, h3 a, h2 a',
        );
        if (authorLink) {
          authorName = authorLink.textContent?.trim() || "";
        }

        // Lay post URL
        let postUrl = "";
        if (permalink) {
          const href = permalink.getAttribute("href") || "";
          postUrl = href.startsWith("http")
            ? href
            : "https://www.facebook.com" + href;
        }

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
