const PostLog = require("../models/PostLog");

exports.getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const [logs, total] = await Promise.all([
      PostLog.find(filter)
        .sort({ postedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("roomId", "title location price")
        .populate("groupId", "name url"),
      PostLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (err) {
    next(err);
  }
};
