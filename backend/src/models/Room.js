const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Tieu de phong tro la bat buoc"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Noi dung mo ta la bat buoc"],
    },
    images: [
      {
        type: String,
      },
    ],
    videos: [
      {
        type: String,
      },
    ],
    location: {
      type: String,
      required: [true, "Dia chi la bat buoc"],
      trim: true,
    },
    locationKeywords: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    hashtags: [
      {
        type: String,
        trim: true,
      },
    ],
    price: {
      type: Number,
      default: 0,
    },
    commentTemplate: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

roomSchema.index({ isActive: 1 });
roomSchema.index({ locationKeywords: 1 });

module.exports = mongoose.model("Room", roomSchema);
