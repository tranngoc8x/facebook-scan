const Group = require("../models/Group");

exports.getAll = async (req, res, next) => {
  try {
    const { isActive, autoScan } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (autoScan !== undefined) filter.autoScan = autoScan === "true";

    const groups = await Group.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: groups });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group)
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    res.json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, url, fbGroupId, description, autoScan, autoPost, hashtags } =
      req.body;

    let parsedHashtags = hashtags;
    if (typeof hashtags === "string") {
      parsedHashtags = hashtags
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => (h.startsWith("#") ? h : `#${h}`));
    }

    const group = await Group.create({
      name,
      url,
      fbGroupId,
      description,
      autoScan,
      autoPost,
      hashtags: parsedHashtags || [],
    });
    res.status(201).json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const updateData = { ...req.body };

    if (typeof updateData.hashtags === "string") {
      updateData.hashtags = updateData.hashtags
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => (h.startsWith("#") ? h : `#${h}`));
    }

    const group = await Group.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!group)
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    res.json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const group = await Group.findByIdAndDelete(req.params.id);
    if (!group)
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    res.json({ success: true, message: "Group deleted" });
  } catch (err) {
    next(err);
  }
};

exports.toggleAutoScan = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group)
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    group.autoScan = !group.autoScan;
    await group.save();
    res.json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
};
