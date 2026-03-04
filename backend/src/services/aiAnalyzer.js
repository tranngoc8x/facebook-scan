const OpenAI = require("openai");
const ScannedPost = require("../models/ScannedPost");
const Setting = require("../models/Setting");

const SYSTEM_PROMPT = `Ban la AI phan tich bai dang tren nhom Facebook cho thue phong tro tai Viet Nam.

Nhiem vu: Phan tich noi dung bai dang va xac dinh nguoi dang co dang TIM PHONG TRO/NHA TRO/CAN HO de thue hay khong.

PHAN BIET:
- Nguoi TIM phong tro (isRoomSearch = true): ho muon thue, ho can tim phong
- Nguoi DANG/CHO THUE phong tro (isRoomSearch = false): ho la chu nha, ho dang quang cao cho thue

Tra ve JSON voi format:
{
  "isRoomSearch": boolean,
  "location": "khu vuc/quan/phuong neu co",
  "budget": "muc gia mong muon neu co (VND)",
  "requirements": ["yeu cau 1", "yeu cau 2"],
  "confidence": 0.0-1.0,
  "summary": "tom tat ngan gon nhu cau"
}

Luu y:
- Chi tra ve JSON, khong them text khac
- confidence cao (>0.8) khi ro rang la tim phong
- confidence thap (<0.3) khi khong lien quan
- Neu bai dang la quang cao cho thue thi isRoomSearch = false`;

/**
 * Phan tich 1 post bang OpenAI
 */
async function analyzePost(post) {
  const apiKey =
    (await Setting.getValue("openaiApiKey")) || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured. Set it in Settings.");
  }

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Phan tich bai dang sau:\n\n"${post.content}"`,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0].message.content;
    const analysis = JSON.parse(raw);

    return {
      isRoomSearch: analysis.isRoomSearch === true,
      location: analysis.location || "",
      budget: analysis.budget || "",
      requirements: analysis.requirements || [],
      confidence: Math.min(1, Math.max(0, analysis.confidence || 0)),
      summary: analysis.summary || "",
      aiProvider: "openai",
      rawResponse: raw,
    };
  } catch (err) {
    console.error("[AI] OpenAI error:", err.message);
    throw err;
  }
}

/**
 * Phan tich batch posts co status "new"
 * @param {number} limit - so post toi da
 */
async function analyzePendingPosts(limit = 10) {
  const posts = await ScannedPost.find({ status: "new" })
    .sort({ scannedAt: -1 })
    .limit(limit);

  if (posts.length === 0) {
    console.log("[AI] No pending posts to analyze");
    return { analyzed: 0, matched: 0, skipped: 0 };
  }

  console.log(`[AI] Analyzing ${posts.length} posts...`);
  let analyzed = 0;
  let matched = 0;
  let skipped = 0;

  for (const post of posts) {
    try {
      const analysis = await analyzePost(post);

      // Update post voi ket qua analysis
      post.analysis = {
        isRoomSearch: analysis.isRoomSearch,
        location: analysis.location,
        budget: analysis.budget,
        requirements: analysis.requirements,
        confidence: analysis.confidence,
        aiProvider: analysis.aiProvider,
        rawResponse: analysis.rawResponse,
      };

      if (analysis.isRoomSearch && analysis.confidence >= 0.6) {
        post.status = "analyzed";
        post.matched = true;
        matched++;
      } else {
        post.status = "skipped";
        skipped++;
      }

      await post.save();
      analyzed++;

      // Rate limit: 500ms giua cac API calls
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`[AI] Error analyzing post ${post._id}:`, err.message);
      // Khong thay doi status, se retry lan sau
    }
  }

  console.log(
    `[AI] Done: ${analyzed} analyzed, ${matched} matched, ${skipped} skipped`,
  );
  return { analyzed, matched, skipped };
}

module.exports = {
  analyzePost,
  analyzePendingPosts,
};
