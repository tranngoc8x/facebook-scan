const scanWorker = require("../services/scanWorker");
const { scanGroup } = require("../services/groupScanner");
const { analyzePendingPosts } = require("../services/aiAnalyzer");
const Group = require("../models/Group");

/**
 * POST /api/scan/start
 * Trigger scan thu cong (tat ca groups hoac 1 group)
 */
exports.startScan = async (req, res) => {
  try {
    const { groupId } = req.body;

    if (groupId) {
      // Scan 1 group cu the
      const group = await Group.findById(groupId);
      if (!group) {
        return res
          .status(404)
          .json({ success: false, message: "Group not found" });
      }
      // Chay async, tra response ngay
      scanGroup(group).then((result) => {
        console.log(`[Scan] Manual scan ${group.name}:`, result);
      });
      return res.json({
        success: true,
        data: { message: `Scanning ${group.name}...` },
      });
    }

    // Scan tat ca groups
    scanWorker.runScanCycle();
    res.json({
      success: true,
      data: { message: "Scan cycle started" },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/scan/status
 * Lay trang thai scan hien tai
 */
exports.getStatus = (req, res) => {
  const status = scanWorker.getScanStatus();
  res.json({ success: true, data: status });
};

/**
 * POST /api/scan/auto-start
 * Bat auto scan
 */
exports.startAutoScan = async (req, res) => {
  try {
    await scanWorker.startAutoScan();
    res.json({ success: true, data: { message: "Auto scan started" } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/scan/auto-stop
 * Tat auto scan
 */
exports.stopAutoScan = (req, res) => {
  scanWorker.stopAutoScan();
  res.json({ success: true, data: { message: "Auto scan stopped" } });
};

/**
 * POST /api/scan/analyze
 * Trigger AI analysis thu cong cho pending posts
 */
exports.analyzePosts = async (req, res) => {
  try {
    const { limit = 10 } = req.body;
    const result = await analyzePendingPosts(limit);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
