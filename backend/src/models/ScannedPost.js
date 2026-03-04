const mongoose = require("mongoose");

const scannedPostSchema = new mongoose.Schema(
  {
    fbPostId: {
      type: String,
      required: true,
      unique: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    authorName: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      default: "",
    },
    postUrl: {
      type: String,
      default: "",
    },
    scannedAt: {
      type: Date,
      default: Date.now,
    },
    analysis: {
      isRoomSearch: { type: Boolean, default: false },
      location: { type: String, default: "" },
      budget: { type: String, default: "" },
      requirements: [{ type: String }],
      confidence: { type: Number, default: 0 },
      aiProvider: { type: String, default: "" },
      rawResponse: { type: String, default: "" },
    },
    matched: {
      type: Boolean,
      default: false,
    },
    matchedRoomIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
      },
    ],
    status: {
      type: String,
      enum: ["new", "analyzed", "matched", "commented", "skipped"],
      default: "new",
    },
  },
  {
    timestamps: true,
  },
);

scannedPostSchema.index({ fbPostId: 1 });
scannedPostSchema.index({ groupId: 1, scannedAt: -1 });
scannedPostSchema.index({ status: 1 });

module.exports = mongoose.model("ScannedPost", scannedPostSchema);
