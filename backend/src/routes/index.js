const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const groupController = require("../controllers/groupController");
const roomController = require("../controllers/roomController");
const postController = require("../controllers/postController");
const commentController = require("../controllers/commentController");
const settingController = require("../controllers/settingController");
const authController = require("../controllers/authController");
const scanController = require("../controllers/scanController");
const fbAccountController = require("../controllers/fbAccountController");

// Facebook Auth (legacy)
router.post("/auth/fb-login", authController.login);
router.get("/auth/fb-status", authController.getStatus);
router.post("/auth/fb-logout", authController.logout);

// FB Accounts
router.get("/fb-accounts", fbAccountController.getAll);
router.post("/fb-accounts", fbAccountController.create);
router.put("/fb-accounts/:id", fbAccountController.update);
router.delete("/fb-accounts/:id", fbAccountController.remove);
router.post("/fb-accounts/:id/login", fbAccountController.login);
router.post("/fb-accounts/:id/logout", fbAccountController.logout);
router.get("/fb-accounts/:id/status", fbAccountController.checkStatus);
router.post("/fb-accounts/:id/save-cookies", fbAccountController.saveCookies);
router.post("/fb-accounts/:id/set-active", fbAccountController.setActive);
router.get("/fb-accounts/:id/browser-login", fbAccountController.browserLogin);
router.post(
  "/fb-accounts/:id/interactive-login",
  fbAccountController.interactiveLogin,
);
router.get("/fb-accounts/:id/login-status", fbAccountController.loginStatus);
router.post("/fb-accounts/:id/submit-2fa", fbAccountController.submit2FA);

// Scan
router.post("/scan/start", scanController.startScan);
router.get("/scan/status", scanController.getStatus);
router.post("/scan/auto-start", scanController.startAutoScan);
router.post("/scan/auto-stop", scanController.stopAutoScan);
router.post("/scan/analyze", scanController.analyzePosts);

// Groups
router.get("/groups", groupController.getAll);
router.get("/groups/:id", groupController.getById);
router.post("/groups", groupController.create);
router.put("/groups/:id", groupController.update);
router.delete("/groups/:id", groupController.remove);
router.patch("/groups/:id/toggle-scan", groupController.toggleAutoScan);

// Rooms
router.get("/rooms", roomController.getAll);
router.get("/rooms/:id", roomController.getById);
router.post("/rooms", upload.array("files", 10), roomController.create);
router.put("/rooms/:id", upload.array("files", 10), roomController.update);
router.delete("/rooms/:id", roomController.remove);
router.patch("/rooms/:id/remove-media", roomController.removeMedia);
router.post("/rooms/:id/post", roomController.postToGroups);

// Scanned Posts
router.get("/posts", postController.getAll);
router.get("/posts/stats", postController.getStats);
router.get("/posts/:id", postController.getById);

// Comments
router.get("/comments", commentController.getAll);
router.get("/comments/:id", commentController.getById);

// Settings
router.get("/settings", settingController.getAll);
router.put("/settings", settingController.update);
router.get("/settings/:key", settingController.getValue);

module.exports = router;
