const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ScannedPost",
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    content: {
      type: String,
      required: [true, "Noi dung comment la bat buoc"],
    },
    status: {
      type: String,
      enum: ["pending", "posted", "failed"],
      default: "pending",
    },
    postedAt: {
      type: Date,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

commentSchema.index({ postId: 1 });
commentSchema.index({ status: 1 });

module.exports = mongoose.model("Comment", commentSchema);
