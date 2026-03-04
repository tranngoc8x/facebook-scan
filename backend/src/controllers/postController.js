const ScannedPost = require("../models/ScannedPost");

exports.getAll = async (req, res, next) => {
  try {
    const { status, groupId, matched, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (groupId) filter.groupId = groupId;
    if (matched !== undefined) filter.matched = matched === "true";

    const skip = (Number(page) - 1) * Number(limit);
    const [posts, total] = await Promise.all([
      ScannedPost.find(filter)
        .populate("groupId", "name")
        .populate("matchedRoomIds", "title location")
        .sort({ scannedAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ScannedPost.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const post = await ScannedPost.findById(req.params.id)
      .populate("groupId", "name url")
      .populate("matchedRoomIds");
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const [total, analyzed, matched, commented] = await Promise.all([
      ScannedPost.countDocuments(),
      ScannedPost.countDocuments({ status: "analyzed" }),
      ScannedPost.countDocuments({ matched: true }),
      ScannedPost.countDocuments({ status: "commented" }),
    ]);
    res.json({ success: true, data: { total, analyzed, matched, commented } });
  } catch (err) {
    next(err);
  }
};
