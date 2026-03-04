const Room = require("../models/Room");
const path = require("path");
const fs = require("fs");

exports.getAll = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const rooms = await Room.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: rooms });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    res.json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { title, content, location, locationKeywords, hashtags, price } =
      req.body;

    const images = [];
    const videos = [];

    if (req.files) {
      req.files.forEach((file) => {
        const relativePath = `/uploads/${file.filename}`;
        if (file.mimetype.startsWith("image/")) {
          images.push(relativePath);
        } else if (file.mimetype.startsWith("video/")) {
          videos.push(relativePath);
        }
      });
    }

    let keywords = locationKeywords;
    if (typeof locationKeywords === "string") {
      keywords = locationKeywords
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
    }

    let parsedHashtags = hashtags;
    if (typeof hashtags === "string") {
      parsedHashtags = hashtags
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => (h.startsWith("#") ? h : `#${h}`));
    }

    const room = await Room.create({
      title,
      content,
      images,
      videos,
      location,
      locationKeywords: keywords || [],
      hashtags: parsedHashtags || [],
      price: price ? Number(price) : 0,
    });

    res.status(201).json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const updateData = { ...req.body };

    if (req.files && req.files.length > 0) {
      const newImages = [];
      const newVideos = [];
      req.files.forEach((file) => {
        const relativePath = `/uploads/${file.filename}`;
        if (file.mimetype.startsWith("image/")) {
          newImages.push(relativePath);
        } else if (file.mimetype.startsWith("video/")) {
          newVideos.push(relativePath);
        }
      });

      const room = await Room.findById(req.params.id);
      if (room) {
        updateData.images = [...(room.images || []), ...newImages];
        updateData.videos = [...(room.videos || []), ...newVideos];
      }
    }

    if (typeof updateData.locationKeywords === "string") {
      updateData.locationKeywords = updateData.locationKeywords
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
    }

    if (typeof updateData.hashtags === "string") {
      updateData.hashtags = updateData.hashtags
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => (h.startsWith("#") ? h : `#${h}`));
    }

    if (updateData.price) updateData.price = Number(updateData.price);

    const room = await Room.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    res.json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });

    // Delete associated files
    const allFiles = [...(room.images || []), ...(room.videos || [])];
    allFiles.forEach((filePath) => {
      const fullPath = path.join(__dirname, "../../", filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });

    await Room.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Room deleted" });
  } catch (err) {
    next(err);
  }
};

exports.removeMedia = async (req, res, next) => {
  try {
    const { mediaPath, mediaType } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });

    if (mediaType === "image") {
      room.images = room.images.filter((img) => img !== mediaPath);
    } else if (mediaType === "video") {
      room.videos = room.videos.filter((vid) => vid !== mediaPath);
    }

    const fullPath = path.join(__dirname, "../../", mediaPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await room.save();
    res.json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};

exports.postToGroups = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { groupIds } = req.body;

    const Room = require("../models/Room");
    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Bài viết không tồn tại (Room not found)",
      });
    }

    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng chọn ít nhất 1 group" });
    }

    // Call service to post to groups asynchronously
    const groupPoster = require("../services/groupPoster");
    groupPoster
      .startPostingTask(room._id, groupIds)
      .catch((err) => console.error("Error in startPostingTask:", err));

    res.json({ success: true, message: "Đã đưa vào hàng đợi đăng bài" });
  } catch (err) {
    next(err);
  }
};
