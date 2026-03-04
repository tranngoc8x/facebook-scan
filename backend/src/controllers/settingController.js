const Setting = require("../models/Setting");

exports.getAll = async (req, res, next) => {
  try {
    const settings = await Setting.getAll();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const updates = req.body;
    const results = [];

    for (const [key, value] of Object.entries(updates)) {
      const setting = await Setting.setValue(key, value);
      results.push(setting);
    }

    const allSettings = await Setting.getAll();
    res.json({ success: true, data: allSettings });
  } catch (err) {
    next(err);
  }
};

exports.getValue = async (req, res, next) => {
  try {
    const value = await Setting.getValue(req.params.key);
    res.json({ success: true, data: { key: req.params.key, value } });
  } catch (err) {
    next(err);
  }
};
