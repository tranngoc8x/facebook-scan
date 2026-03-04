const Room = require("../models/Room");
const ScannedPost = require("../models/ScannedPost");

/**
 * Normalize text: bo dau, lowercase
 */
function normalize(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
}

/**
 * Tinh match score giua 1 post va 1 room
 * @returns {number} 0-100
 */
function calculateMatchScore(post, room) {
  let score = 0;

  if (!post.content) return 0;

  const postContent = normalize(post.content);

  // Tao danh sach cum tu de so khop tu room content, title, location
  const roomTexts = [room.content, room.title, room.location].filter(Boolean);
  const allKeywords = new Set();

  for (const text of roomTexts) {
    // Them nguyen chuoi
    const normalized = normalize(text);
    if (normalized.length > 2) allKeywords.add(normalized);
    // Tach thanh cac cum tu co nghia (> 2 ky tu)
    const words = normalized.split(/[,\s]+/).filter((w) => w.length > 2);
    words.forEach((w) => allKeywords.add(w));
  }

  if (allKeywords.size === 0) return 0;

  // Dem so keywords match
  let matchCount = 0;
  let hasFullMatch = false;

  for (const kw of allKeywords) {
    if (postContent.includes(kw)) {
      matchCount++;
      // Full match (cum tu dai > 5 ky tu) co trong gia tri cao hon
      if (kw.length > 5) hasFullMatch = true;
    }
  }

  if (matchCount === 0) return 0;

  // Tinh diem
  // Full match cum tu dai: 50 diem
  if (hasFullMatch) score += 50;
  // Moi keyword match them: 10 diem
  score += matchCount * 10;

  // Confidence bonus tu AI (max 20 diem)
  const confidence = post.analysis?.confidence || 0;
  if (confidence > 0) {
    score += Math.round(confidence * 20);
  }

  return Math.min(100, score);
}

/**
 * Parse budget string thanh so (VND)
 * Xu ly: "3 trieu", "3tr", "3.000.000", "3000000", "3-4 trieu"
 */
function parseBudget(budgetStr) {
  if (!budgetStr) return 0;
  const s = normalize(budgetStr);

  // Tim so dau tien
  let match = s.match(/([\d.,]+)\s*(trieu|tr|m)/i);
  if (match) {
    return parseFloat(match[1].replace(",", ".")) * 1000000;
  }

  match = s.match(/([\d.,]+)\s*(nghin|ngan|k)/i);
  if (match) {
    return parseFloat(match[1].replace(",", ".")) * 1000;
  }

  // So thuong
  match = s.match(/([\d.,]+)/);
  if (match) {
    const num = parseFloat(match[1].replace(/\./g, "").replace(",", "."));
    // Neu > 100, coi la VND
    return num > 100 ? num : num * 1000000;
  }

  return 0;
}

/**
 * Match posts da analyze voi rooms
 * @param {number} minScore - diem toi thieu de match (0-100)
 */
async function matchPendingPosts(minScore = 30) {
  const posts = await ScannedPost.find({
    status: "analyzed",
    matched: true,
    "analysis.isRoomSearch": true,
  });

  if (posts.length === 0) {
    console.log("[Matcher] No analyzed posts to match");
    return { matched: 0, total: 0 };
  }

  const rooms = await Room.find({ isActive: true });
  if (rooms.length === 0) {
    console.log("[Matcher] No active rooms to match against");
    return { matched: 0, total: posts.length };
  }

  console.log(
    `[Matcher] Matching ${posts.length} posts against ${rooms.length} rooms...`,
  );

  let matchedCount = 0;

  for (const post of posts) {
    const matchedRoomIds = [];

    for (const room of rooms) {
      const score = calculateMatchScore(post, room);
      if (score >= minScore) {
        matchedRoomIds.push(room._id);
      }
    }

    if (matchedRoomIds.length > 0) {
      post.matchedRoomIds = matchedRoomIds;
      post.status = "matched";
      await post.save();
      matchedCount++;
      console.log(
        `[Matcher] Post ${post._id} matched ${matchedRoomIds.length} rooms`,
      );
    }
  }

  console.log(`[Matcher] Done: ${matchedCount}/${posts.length} posts matched`);
  return { matched: matchedCount, total: posts.length };
}

module.exports = {
  matchPendingPosts,
  calculateMatchScore,
  parseBudget,
};
