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
  const analysis = post.analysis || {};

  // 1. Location matching (max 50 diem)
  if (analysis.location && room.locationKeywords?.length > 0) {
    const postLocation = normalize(analysis.location);
    for (const keyword of room.locationKeywords) {
      const kw = normalize(keyword);
      if (postLocation.includes(kw) || kw.includes(postLocation)) {
        score += 50;
        break;
      }
    }
    // Partial match: kiem tra tung tu
    if (score === 0) {
      const postWords = postLocation.split(/\s+/);
      for (const keyword of room.locationKeywords) {
        const kw = normalize(keyword);
        for (const word of postWords) {
          if (word.length > 2 && kw.includes(word)) {
            score += 25;
            break;
          }
        }
        if (score > 0) break;
      }
    }
  }

  // 2. Budget matching (max 30 diem)
  if (analysis.budget && room.price > 0) {
    const budgetNum = parseBudget(analysis.budget);
    if (budgetNum > 0) {
      const ratio = room.price / budgetNum;
      if (ratio >= 0.5 && ratio <= 1.5) {
        // Gia room nam trong khoang +/-50% budget
        score += 30;
      } else if (ratio >= 0.3 && ratio <= 2.0) {
        // Gan match
        score += 15;
      }
    }
  }

  // 3. Confidence bonus (max 20 diem)
  if (analysis.confidence) {
    score += Math.round(analysis.confidence * 20);
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
