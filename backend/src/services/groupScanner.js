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

    if (rawPosts.length === 0) {
      const fs = require("fs");
      try {
        const html = await page.content();
        fs.writeFileSync("/tmp/fb_debug_0_posts.html", html);
        await page.screenshot({
          path: "/tmp/fb_debug_0_posts.png",
          fullPage: true,
        });
        console.log(`[Scanner] Dumped HTML and Screenshot to /tmp/`);
      } catch (e) {
        console.error("Failed to dump HTML/Screenshot:", e);
      }
    }

    // Load ten cac tai khoan Facebook cua minh de loc ra
    const myAccounts = await FacebookAccount.find({}, { name: 1, email: 1 });
    const myNames = myAccounts
      .map((a) => a.name)
      .filter(Boolean)
      .map((n) => n.toLowerCase().trim())
      .filter((n) => n.length > 0);

    // Luu posts moi vao DB
    for (const raw of rawPosts) {
      if (raw.authorName === "Trần Ngọc Thắng") {
        console.log(`[Scanner] ID: ${raw.fbPostId}, URL: ${raw.postUrl}`);
      }
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
  const posts = await page.evaluate(async (limit) => {
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

        // Lay post ID tu link hoac HTML content
        let fbPostId = "";
        let postUrl = "";
        let debugLinks = [];
        const linkElements = post.querySelectorAll('a, [role="link"]');
        for (const el of linkElements) {
          try {
            el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
            el.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
          } catch (e) {}
          debugLinks.push(
            (
              el.tagName +
              "|" +
              (el.getAttribute("href") || "nohref") +
              "|" +
              (el.textContent?.substring(0, 20) || "notext")
            ).replace(/\s+/g, " "),
          );
        }

        // Wait a tiny bit for React to process the hover (simulate async)
        await new Promise((r) => setTimeout(r, 10));

        const html = post.innerHTML;

        // Log giup debug tat ca cac chuoi co the la ID (fbid, pfbid, day so dai tren 10 ky tu ma nam gan cac keyword)
        const possibleIds = [
          ...html.matchAll(
            /(?:post_id|story_fbid|top_level_post_id|target_id|feedback_target_id|fbid|pfbid\w+|"id":"[1-9]\d{10,}")/g,
          ),
        ];

        // Thu pattern URL neu co the (luc nay groups/ user/ is broken)
        const permalinkRegexes = [
          /pfbid[a-zA-Z0-9]{20,}/g, // Facebook's new pfbid format
          /"top_level_post_id"\s*:\s*"(\d+)"/g,
          /"post_id"\s*:\s*"(\d+)"/g,
          /"story_fbid"\s*:\s*"(\d+)"/g,
          /groupID=\d+&postID=(\d+)/g,
          /groups[/%2F]+[^/%2F]+[/%2F]+(?:posts|permalink)[/%2F]+(\d+)/g,
        ];

        for (const regex of permalinkRegexes) {
          const matches = [...html.matchAll(regex)];
          for (const m of matches) {
            const id = m[1] || m[0];
            if (id && id.length > 5 && id !== "0") {
              fbPostId = id;
              const groupIdMatch = html.match(/group_id[=:]\s*["']?(\d+)/);
              const groupId = groupIdMatch ? groupIdMatch[1] : "0";
              postUrl = `https://www.facebook.com/groups/${groupId}/posts/${fbPostId}`;

              if (fbPostId.startsWith("pfbid")) {
                postUrl = `https://www.facebook.com/${fbPostId}`;
              }
              break;
            }
          }
          if (fbPostId) break;
        }

        if (fbPostId === "") {
          console.log(
            "No fbPostId found for post by " +
              authorName +
              " - Possible ID snippets: ",
            html
              .match(/.{0,20}(pfbid[a-zA-Z0-9]+|\d{15,}).{0,20}/g)
              ?.slice(0, 10),
          );
        }

        if (!fbPostId) {
          // Khong tim thay pattern chuan
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
            debugLinks: debugLinks,
            debugHtml: post.innerHTML.substring(0, 2500), // <--- Them dong nay de test roi doc log
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
