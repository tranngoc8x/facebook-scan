const fbAuth = require("../services/facebookAuth");

/**
 * POST /api/auth/fb-login
 * Login Facebook bang email/password hoac cookies
 */
exports.login = async (req, res) => {
  try {
    const { email, password, cookies } = req.body;

    let result;
    if (cookies) {
      result = await fbAuth.loginWithCookies(cookies);
    } else if (email && password) {
      result = await fbAuth.login(email, password);
    } else {
      return res.status(400).json({
        success: false,
        message: "Email/password or cookies required",
      });
    }

    res.json({ success: result.success, data: result });
  } catch (err) {
    console.error("[Auth Controller] Login error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/auth/fb-status
 * Kiem tra trang thai session Facebook
 */
exports.getStatus = async (req, res) => {
  try {
    const status = await fbAuth.checkSession();
    res.json({ success: true, data: status });
  } catch (err) {
    console.error("[Auth Controller] Status error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/auth/fb-logout
 * Dang xuat Facebook
 */
exports.logout = async (req, res) => {
  try {
    const result = await fbAuth.logout();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("[Auth Controller] Logout error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
