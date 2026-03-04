const mongoose = require("mongoose");

const postLogSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },
    error: {
      type: String,
      default: "",
    },
    postedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

postLogSchema.index({ roomId: 1 });
postLogSchema.index({ groupId: 1 });
postLogSchema.index({ postedAt: -1 });

module.exports = mongoose.model("PostLog", postLogSchema);
