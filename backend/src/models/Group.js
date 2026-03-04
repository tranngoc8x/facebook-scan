const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Ten nhom la bat buoc"],
      trim: true,
    },
    url: {
      type: String,
      required: [true, "URL nhom la bat buoc"],
      trim: true,
    },
    fbGroupId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    autoScan: {
      type: Boolean,
      default: false,
    },
    autoPost: {
      type: Boolean,
      default: false,
    },
    lastScannedAt: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      default: "",
    },
    hashtags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  },
);

groupSchema.index({ autoScan: 1, isActive: 1 });

module.exports = mongoose.model("Group", groupSchema);
