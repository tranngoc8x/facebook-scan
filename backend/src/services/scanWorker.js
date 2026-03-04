const Group = require("../models/Group");
const Setting = require("../models/Setting");
const { scanGroup } = require("./groupScanner");
const { analyzePendingPosts } = require("./aiAnalyzer");
const { matchPendingPosts } = require("./roomMatcher");
const { processPendingComments } = require("./commentPoster");

let scanInterval = null;
let isScanning = false;
let lastScanResult = null;

/**
 * Bat dau auto scan (cron)
 */
async function startAutoScan() {
  if (scanInterval) {
    console.log("[Worker] Auto scan already running");
    return;
  }

  const intervalMinutes = await Setting.getValue("scanIntervalMinutes");
  const ms = (intervalMinutes || 5) * 60 * 1000;

  console.log(`[Worker] Starting auto scan every ${intervalMinutes} minutes`);

  // Scan ngay lan dau
  runScanCycle();

  // Lap lai
  scanInterval = setInterval(runScanCycle, ms);
}

/**
 * Dung auto scan
 */
function stopAutoScan() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
    console.log("[Worker] Auto scan stopped");
  }
}

/**
 * Chay 1 vong scan tat ca groups active
 */
async function runScanCycle() {
  if (isScanning) {
    console.log("[Worker] Scan already in progress, skipping...");
    return;
  }

  isScanning = true;
  const startTime = Date.now();

  try {
    const groups = await Group.find({
      isActive: true,
      autoScan: true,
    });

    if (groups.length === 0) {
      console.log("[Worker] No active groups to scan");
      lastScanResult = {
        timestamp: new Date(),
        groups: 0,
        newPosts: 0,
        skipped: 0,
        errors: [],
        duration: 0,
      };
      return;
    }

    console.log(`[Worker] Scanning ${groups.length} groups...`);
    let totalNew = 0;
    let totalSkipped = 0;
    const errors = [];

    for (const group of groups) {
      try {
        const result = await scanGroup(group);
        totalNew += result.newPosts;
        totalSkipped += result.skipped;
        if (result.errors.length > 0) {
          errors.push(...result.errors.map((e) => `${group.name}: ${e}`));
        }

        // Delay giua cac groups (2-5s random)
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
      } catch (err) {
        errors.push(`${group.name}: ${err.message}`);
      }
    }

    // Chay AI analysis cho posts moi
    let aiResult = { analyzed: 0, matched: 0, skipped: 0 };
    if (totalNew > 0) {
      try {
        aiResult = await analyzePendingPosts(totalNew);
      } catch (err) {
        console.error("[Worker] AI analysis error:", err.message);
        errors.push(`AI: ${err.message}`);
      }
    }

    // Chay room matching
    let matchResult = { matched: 0, total: 0 };
    if (aiResult.matched > 0) {
      try {
        matchResult = await matchPendingPosts();
      } catch (err) {
        console.error("[Worker] Matching error:", err.message);
        errors.push(`Match: ${err.message}`);
      }
    }

    // Auto comment neu enabled
    let commentResult = { posted: 0, failed: 0 };
    const isAutoComment = await Setting.getValue("isAutoCommentEnabled");
    if (isAutoComment && matchResult.matched > 0) {
      try {
        commentResult = await processPendingComments();
      } catch (err) {
        console.error("[Worker] Comment error:", err.message);
        errors.push(`Comment: ${err.message}`);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    lastScanResult = {
      timestamp: new Date(),
      groups: groups.length,
      newPosts: totalNew,
      skipped: totalSkipped,
      aiAnalyzed: aiResult.analyzed,
      aiMatched: aiResult.matched,
      roomsMatched: matchResult.matched,
      commentsPosted: commentResult.posted,
      commentsFailed: commentResult.failed,
      errors,
      duration,
    };

    console.log(
      `[Worker] Complete: ${totalNew} new, AI: ${aiResult.matched}, Rooms: ${matchResult.matched}, Comments: ${commentResult.posted}, ${duration}s`,
    );
  } catch (err) {
    console.error("[Worker] Scan cycle error:", err);
    lastScanResult = {
      timestamp: new Date(),
      groups: 0,
      newPosts: 0,
      skipped: 0,
      errors: [err.message],
      duration: Math.round((Date.now() - startTime) / 1000),
    };
  } finally {
    isScanning = false;
  }
}

/**
 * Lay trang thai scan hien tai
 */
function getScanStatus() {
  return {
    isScanning,
    isAutoScanRunning: scanInterval !== null,
    lastResult: lastScanResult,
  };
}

module.exports = {
  startAutoScan,
  stopAutoScan,
  runScanCycle,
  getScanStatus,
};
