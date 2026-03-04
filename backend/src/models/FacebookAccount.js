const mongoose = require("mongoose");
const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
const SECRET = process.env.ENCRYPT_SECRET || "fb-scan-default-secret-key-32ch";

function getKey() {
  return crypto.createHash("sha256").update(SECRET).digest();
}

function encrypt(text) {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
  if (!text || !text.includes(":")) return "";
  const [ivHex, encrypted] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const facebookAccountSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email la bat buoc"],
      unique: true,
      trim: true,
    },
    encryptedPassword: {
      type: String,
      default: "",
    },
    name: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "error"],
      default: "inactive",
    },
    cookies: {
      type: String, // JSON string of cookies array
      default: "",
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    error: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Virtual: set password (encrypt)
facebookAccountSchema.methods.setPassword = function (plainPassword) {
  this.encryptedPassword = encrypt(plainPassword);
};

// Virtual: get password (decrypt)
facebookAccountSchema.methods.getPassword = function () {
  return decrypt(this.encryptedPassword);
};

// Khong tra ve password khi toJSON
facebookAccountSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.encryptedPassword;
  delete obj.cookies;
  obj.hasPassword = !!this.encryptedPassword;
  obj.hasCookies = !!this.cookies;
  return obj;
};

module.exports = mongoose.model("FacebookAccount", facebookAccountSchema);
