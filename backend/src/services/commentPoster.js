const pw = require("./playwright");
const Comment = require("../models/Comment");
const ScannedPost = require("../models/ScannedPost");
const Room = require("../models/Room");
const Setting = require("../models/Setting");

/**
 * Tao comment content tu template cua room
 * Thay the bien: {location}, {price}, {title}
 */
function buildCommentContent(room) {
  let template = room.commentTemplate || "";
  if (!template) {
    // Default template
    template = `Em co phong cho thue tai ${room.location}, gia ${formatPrice(room.price)}/thang. Lien he em de biet them chi tiet a!`;
  }

  return template
    .replace(/{location}/g, room.location || "")
    .replace(/{price}/g, formatPrice(room.price))
    .replace(/{title}/g, room.title || "");
}

/**
 * Format gia VND
 */
function formatPrice(price) {
  if (!price) return "lien he";
  if (price >= 1000000) {
    return `${(price / 1000000).toFixed(1).replace(".0", "")} trieu`;
  }
  if (price >= 1000) {
    return `${(price / 1000).toFixed(0)}k`;
  }
  return `${price} VND`;
}

/**
 * Post comment len Facebook bang Playwright
 * @param {string} postUrl - URL cua bai post
 * @param {string} content - Noi dung comment
 * @returns {Object} { success, error }
 */
async function postComment(postUrl, content) {
  const page = await pw.getPage();

  try {
    console.log(`[Comment] Navigating to ${postUrl}`);
    await page.goto(postUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // Kiem tra login
    if (page.url().includes("login")) {
      throw new Error("Not logged in to Facebook");
    }

    // Tim comment box
    // Facebook dung contenteditable div cho comment input
    const commentSelectors = [
      'div[aria-label="Viết bình luận"]',
      'div[aria-label="Write a comment"]',
      'div[aria-label="Viết bình luận..."]',
      'div[aria-label="Write a comment..."]',
      'div[contenteditable="true"][role="textbox"]',
    ];

    let commentBox = null;
    for (const selector of commentSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 2000 })) {
          commentBox = el;
          break;
        }
      } catch {
        // Thu selector tiep theo
      }
    }

    if (!commentBox) {
      // Thu click vao comment area de mo input
      try {
        const commentArea = page
          .locator(
            'div[aria-label="Leave a comment"], div[aria-label="Viết bình luận"]',
          )
          .first();
        if (await commentArea.isVisible({ timeout: 2000 })) {
          await commentArea.click();
          await page.waitForTimeout(1000);

          // Thu lai tim comment box
          for (const selector of commentSelectors) {
            const el = page.locator(selector).first();
            if (await el.isVisible({ timeout: 1000 })) {
              commentBox = el;
              break;
            }
          }
        }
      } catch {}
    }

    if (!commentBox) {
      throw new Error("Cannot find comment box on this post");
    }

    // Click vao comment box
    await commentBox.click();
    await page.waitForTimeout(500);

    // Nhap noi dung comment
    await commentBox.fill(content);
    await page.waitForTimeout(1000);

    // Nhan Enter de gui comment
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);

    console.log(`[Comment] Posted successfully on ${postUrl}`);
    await page.close();
    return { success: true };
  } catch (err) {
    console.error(`[Comment] Error posting on ${postUrl}:`, err.message);
    try {
      await page.close();
    } catch {}
    return { success: false, error: err.message };
  }
}

/**
 * Tao va post comments cho cac posts da matched
 */
async function processPendingComments() {
  // Kiem tra rate limit
  const maxPerHour = await Setting.getValue("maxCommentsPerHour");
  const delaySec = await Setting.getValue("commentDelaySeconds");

  // Dem comments posted trong 1 gio qua
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await Comment.countDocuments({
    status: "posted",
    postedAt: { $gte: oneHourAgo },
  });

  if (recentCount >= (maxPerHour || 10)) {
    console.log(
      `[Comment] Rate limit reached: ${recentCount}/${maxPerHour} per hour`,
    );
    return { posted: 0, failed: 0, rateLimited: true };
  }

  const remaining = (maxPerHour || 10) - recentCount;

  // Lay posts matched chua comment
  const posts = await ScannedPost.find({ status: "matched" })
    .populate("matchedRoomIds")
    .limit(remaining);

  if (posts.length === 0) {
    console.log("[Comment] No matched posts to comment on");
    return { posted: 0, failed: 0, rateLimited: false };
  }

  console.log(`[Comment] Processing ${posts.length} posts...`);
  let posted = 0;
  let failed = 0;

  for (const post of posts) {
    if (!post.postUrl || !post.matchedRoomIds?.length) {
      continue;
    }

    // Chon room dau tien de comment
    const room = post.matchedRoomIds[0];
    if (!room || !room.isActive) continue;

    const content = buildCommentContent(room);

    // Tao comment record
    const comment = await Comment.create({
      postId: post._id,
      roomId: room._id,
      content,
      status: "pending",
    });

    // Post comment
    const result = await postComment(post.postUrl, content);

    if (result.success) {
      comment.status = "posted";
      comment.postedAt = new Date();
      await comment.save();

      post.status = "commented";
      await post.save();

      posted++;
    } else {
      comment.status = "failed";
      comment.error = result.error;
      await comment.save();
      failed++;
    }

    // Delay giua cac comments
    if (delaySec) {
      await new Promise((r) => setTimeout(r, delaySec * 1000));
    }
  }

  console.log(`[Comment] Done: ${posted} posted, ${failed} failed`);
  return { posted, failed, rateLimited: false };
}

module.exports = {
  postComment,
  processPendingComments,
  buildCommentContent,
};
