const Comment = require("../models/Comment");

exports.getAll = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [comments, total] = await Promise.all([
      Comment.find(filter)
        .populate({
          path: "postId",
          select: "content postUrl authorName",
          populate: { path: "groupId", select: "name" },
        })
        .populate("roomId", "title location")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Comment.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: comments,
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
    const comment = await Comment.findById(req.params.id)
      .populate("postId")
      .populate("roomId");
    if (!comment)
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    res.json({ success: true, data: comment });
  } catch (err) {
    next(err);
  }
};
