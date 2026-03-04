const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// Default settings
settingSchema.statics.getDefaults = function () {
  return {
    scanIntervalMinutes: 5,
    aiProvider: "openai",
    openaiApiKey: "",
    geminiApiKey: "",
    maxCommentsPerHour: 10,
    commentDelaySeconds: 30,
    isAutoCommentEnabled: false,
    isAutoScanEnabled: false,
  };
};

settingSchema.statics.getValue = async function (key) {
  const setting = await this.findOne({ key });
  if (!setting) {
    const defaults = this.getDefaults();
    return defaults[key] ?? null;
  }
  return setting.value;
};

settingSchema.statics.setValue = async function (key, value, description = "") {
  return this.findOneAndUpdate(
    { key },
    { value, description },
    { upsert: true, new: true },
  );
};

settingSchema.statics.getAll = async function () {
  const settings = await this.find({});
  const defaults = this.getDefaults();
  const result = { ...defaults };
  settings.forEach((s) => {
    result[s.key] = s.value;
  });
  return result;
};

module.exports = mongoose.model("Setting", settingSchema);
