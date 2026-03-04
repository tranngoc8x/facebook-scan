const pw = require("./playwright");
const Group = require("../models/Group");
const PostLog = require("../models/PostLog");
const path = require("path");
const fs = require("fs");

const DEBUG_DIR = path.join(__dirname, "../../data/debug");

// Tao thu muc debug neu chua co
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

async function takeDebugScreenshot(page, name) {
  try {
    const filePath = path.join(DEBUG_DIR, `${name}-${Date.now()}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`[GroupPoster] Screenshot saved: ${filePath}`);
  } catch (e) {
    console.log(`[GroupPoster] Screenshot failed: ${e.message}`);
  }
}

/**
 * Bat dau luong auto post bang Playwright
 */
async function startPostingTask(roomId, groupIds) {
  console.log(
    `[GroupPoster] Starting task to post Room ${roomId} to ${groupIds.length} groups`,
  );

  const Room = require("../models/Room");
  const room = await Room.findById(roomId);
  if (!room) return;

  const groups = await Group.find({ _id: { $in: groupIds } });

  // Build noi dung bai viet
  const priceStr =
    room.price > 0
      ? new Intl.NumberFormat("vi-VN").format(room.price) + " VND/thang"
      : "Thoa thuan";
  let contentText = `${room.title}\n\nGia: ${priceStr}\nVi tri: ${room.location}\n\n${room.content}`;

  for (const group of groups) {
    if (!group.url) {
      console.log(`[GroupPoster] Skip ${group.name} - URL is empty`);
      continue;
    }

    const page = await pw.getPage();
    try {
      // === STEP 1: Navigate to group ===
      console.log(`[GroupPoster] Step 1: Navigating to ${group.url}`);
      await page.goto(group.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(4000);

      if (page.url().includes("login")) {
        throw new Error("Not logged in to Facebook");
      }

      // Ghep hashtag tu Room va Group vao cuoi noi dung
      const roomHashtags = room.hashtags || [];
      const groupHashtags = group.hashtags || [];
      const allHashtags = [...new Set([...roomHashtags, ...groupHashtags])];
      let postContent = contentText;
      if (allHashtags.length > 0) {
        postContent += `\n\n${allHashtags.join(" ")}`;
      }

      await takeDebugScreenshot(page, "01-group-loaded");

      // === STEP 2: Tim va click vao o "Write something" ===
      console.log('[GroupPoster] Step 2: Looking for "Write something" box...');

      // Facebook group dùng 1 cái placeholder div, click vào sẽ mở dialog
      let dialogOpened = false;

      // Cach 1: Tim theo text content (nhiều ngôn ngữ)
      const triggerTexts = [
        "Write something...",
        "Write something",
        "Bạn viết gì đi...",
        "Bạn đang nghĩ gì?",
        "Viết gì đó...",
      ];

      for (const text of triggerTexts) {
        try {
          const trigger = page.getByText(text, { exact: false }).first();
          if (await trigger.isVisible({ timeout: 1500 })) {
            console.log(`[GroupPoster] Found trigger text: "${text}"`);
            await trigger.click();
            await page.waitForTimeout(3000);
            dialogOpened = true;
            break;
          }
        } catch {}
      }

      // Cach 2: Tim theo role
      if (!dialogOpened) {
        try {
          const feedComposer = page
            .locator('[role="main"] [role="button"] span')
            .filter({ hasText: /Write|viết|nghĩ/i })
            .first();
          if (await feedComposer.isVisible({ timeout: 2000 })) {
            console.log("[GroupPoster] Found trigger via role selector");
            await feedComposer.click();
            await page.waitForTimeout(3000);
            dialogOpened = true;
          }
        } catch {}
      }

      // Cach 3: Click vào vùng composer area
      if (!dialogOpened) {
        try {
          // Thường Facebook group có 1 div "Create a post" area ở đầu feed
          const composerArea = page
            .locator(
              '[aria-label="Create a public post…"], [aria-label="Tạo bài viết công khai…"], [aria-label="Create a post"], [aria-label="Tạo bài viết"]',
            )
            .first();
          if (await composerArea.isVisible({ timeout: 2000 })) {
            console.log("[GroupPoster] Found composer area by aria-label");
            await composerArea.click();
            await page.waitForTimeout(3000);
            dialogOpened = true;
          }
        } catch {}
      }

      await takeDebugScreenshot(page, "02-after-click-trigger");

      if (!dialogOpened) {
        console.log("[GroupPoster] Could not find write-something trigger");
        // Log tất cả các button visible trên trang để debug
        try {
          const buttons = await page
            .locator('[role="button"]')
            .allTextContents();
          console.log(
            "[GroupPoster] Available buttons on page:",
            buttons.slice(0, 20).join(" | "),
          );
        } catch {}
        throw new Error("Cannot open post composer");
      }

      // === STEP 3: Tim textbox trong dialog va nhap noi dung ===
      console.log("[GroupPoster] Step 3: Looking for textbox in dialog...");

      let editor = null;
      const editorSelectors = [
        'div[role="dialog"] div[role="textbox"][contenteditable="true"]',
        'div[role="dialog"] [contenteditable="true"][data-lexical-editor="true"]',
        'div[role="dialog"] div[contenteditable="true"]',
        'form div[role="textbox"]',
        'div[role="textbox"][contenteditable="true"]',
      ];

      for (const sel of editorSelectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 2000 })) {
            editor = el;
            console.log(`[GroupPoster] Found editor with selector: ${sel}`);
            break;
          }
        } catch {}
      }

      if (!editor) {
        await takeDebugScreenshot(page, "03-no-editor-found");
        throw new Error("Cannot find text editor in post dialog");
      }

      // Click vào editor trước
      await editor.click();
      await page.waitForTimeout(500);

      // Dùng keyboard.type() thay vì fill() cho contenteditable
      await page.keyboard.type(postContent, { delay: 10 });
      await page.waitForTimeout(2000);

      await takeDebugScreenshot(page, "04-after-type-content");
      console.log("[GroupPoster] Step 3 done: Content typed successfully");

      // === STEP 4: Upload ảnh nếu có ===
      const mediaFiles = [...(room.images || []), ...(room.videos || [])];
      if (mediaFiles.length > 0) {
        console.log(
          `[GroupPoster] Step 4: Uploading ${mediaFiles.length} media files...`,
        );

        // Click nút Photo/Video
        const photoBtnSelectors = [
          'div[role="dialog"] div[aria-label="Photo/video"]',
          'div[role="dialog"] div[aria-label="Ảnh/video"]',
          'div[aria-label="Photo/video"]',
          'div[aria-label="Ảnh/video"]',
        ];

        for (const sel of photoBtnSelectors) {
          try {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 1500 })) {
              await btn.click();
              await page.waitForTimeout(1000);
              break;
            }
          } catch {}
        }

        // Upload files
        try {
          const fileInput = page
            .locator('div[role="dialog"] input[type="file"]')
            .first();
          if ((await fileInput.count()) > 0) {
            const absolutePaths = mediaFiles
              .map((m) => path.join(__dirname, "../../", m))
              .filter((p) => fs.existsSync(p));

            if (absolutePaths.length > 0) {
              await fileInput.setInputFiles(absolutePaths);
              console.log(
                `[GroupPoster] Uploaded ${absolutePaths.length} files`,
              );
              await page.waitForTimeout(5000);
            }
          }
        } catch (e) {
          console.log(`[GroupPoster] Media upload failed: ${e.message}`);
        }
        await takeDebugScreenshot(page, "05-after-upload");
      }

      // === STEP 5: Click nút Post / Đăng ===
      console.log("[GroupPoster] Step 5: Looking for Post button...");

      let posted = false;
      const postBtnSelectors = [
        'div[role="dialog"] div[aria-label="Post"][role="button"]',
        'div[role="dialog"] div[aria-label="Đăng"][role="button"]',
        'div[role="dialog"] [aria-label="Post"]',
        'div[role="dialog"] [aria-label="Đăng"]',
      ];

      for (const sel of postBtnSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            // Check xem button co bi disabled khong
            const isDisabled = await btn.getAttribute("aria-disabled");
            if (isDisabled === "true") {
              console.log(
                `[GroupPoster] Post button found but disabled, waiting...`,
              );
              await page.waitForTimeout(3000);
            }

            await btn.click();
            posted = true;
            console.log(
              `[GroupPoster] Clicked Post button with selector: ${sel}`,
            );
            break;
          }
        } catch {}
      }

      // Fallback: Tim button bang text "Post" hoặc "Đăng"
      if (!posted) {
        try {
          const postByText = page
            .locator('div[role="dialog"]')
            .getByRole("button", { name: /^(Post|Đăng)$/i })
            .first();
          if (await postByText.isVisible({ timeout: 2000 })) {
            await postByText.click();
            posted = true;
            console.log("[GroupPoster] Clicked Post button by text");
          }
        } catch {}
      }

      if (posted) {
        console.log(`[GroupPoster] Successfully posted to ${group.name}!`);
        await page.waitForTimeout(5000);
        await takeDebugScreenshot(page, "06-after-post");
        await PostLog.create({
          roomId: room._id,
          groupId: group._id,
          status: "success",
        });
      } else {
        await takeDebugScreenshot(page, "06-post-btn-not-found");
        try {
          const dialogBtns = await page
            .locator('div[role="dialog"] [role="button"]')
            .allTextContents();
          console.log(
            "[GroupPoster] Buttons in dialog:",
            dialogBtns.join(" | "),
          );
        } catch {}
        console.log(
          `[GroupPoster] FAILED: Could not find Post button for ${group.name}`,
        );
        await PostLog.create({
          roomId: room._id,
          groupId: group._id,
          status: "failed",
          error: "Post button not found",
        });
      }
    } catch (error) {
      console.error(
        `[GroupPoster] Error posting to ${group.name}:`,
        error.message,
      );
      await takeDebugScreenshot(page, "error");
      await PostLog.create({
        roomId: room._id,
        groupId: group._id,
        status: "failed",
        error: error.message,
      }).catch(() => {});
    } finally {
      try {
        await page.close();
      } catch {}
    }

    // Delay 5s giữa các group để tránh bị Facebook chặn
    await new Promise((r) => setTimeout(r, 5000));
  }

  console.log(`[GroupPoster] Finished task for Room ${roomId}`);
}

module.exports = { startPostingTask };
