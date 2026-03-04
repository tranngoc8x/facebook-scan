require("dotenv").config();
const mongoose = require("mongoose");
const Group = require("../models/Group");
const Room = require("../models/Room");
const ScannedPost = require("../models/ScannedPost");
const Comment = require("../models/Comment");
const Setting = require("../models/Setting");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/facebook-scan";

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB:", MONGO_URI);

    // Drop indexes and clear existing data
    const collections = [Group, Room, ScannedPost, Comment, Setting];
    for (const Model of collections) {
      try {
        await Model.collection.dropIndexes();
      } catch (e) {
        /* ignore */
      }
      await Model.deleteMany({});
    }
    console.log("Cleared all collections + indexes");

    // === GROUPS ===
    const groups = await Group.insertMany([
      {
        name: "Cho Thue Phong Tro HCM",
        url: "https://www.facebook.com/groups/chothuephongtro.hcm",
        fbGroupId: "123456789",
        isActive: true,
        autoScan: true,
        autoPost: false,
        lastScannedAt: new Date(Date.now() - 10 * 60000),
        description: "Nhom cho thue phong tro lon nhat HCM",
      },
      {
        name: "Tim Phong Tro Quan 7",
        url: "https://www.facebook.com/groups/timphongtro.q7",
        fbGroupId: "234567890",
        isActive: true,
        autoScan: true,
        autoPost: true,
        lastScannedAt: new Date(Date.now() - 5 * 60000),
        description: "Nhom tim phong tro khu vuc Quan 7",
      },
      {
        name: "Phong Tro Binh Thanh",
        url: "https://www.facebook.com/groups/phongtro.binhthanh",
        fbGroupId: "345678901",
        isActive: true,
        autoScan: false,
        autoPost: false,
        lastScannedAt: null,
        description: "Nhom phong tro khu Binh Thanh",
      },
      {
        name: "Thue Phong Tro Go Vap",
        url: "https://www.facebook.com/groups/thuephongtro.govap",
        fbGroupId: "456789012",
        isActive: true,
        autoScan: true,
        autoPost: false,
        lastScannedAt: new Date(Date.now() - 30 * 60000),
        description: "Phong tro Go Vap gia re",
      },
      {
        name: "Nha Tro Tan Binh - Tan Phu",
        url: "https://www.facebook.com/groups/nhatro.tanbinh",
        fbGroupId: "567890123",
        isActive: false,
        autoScan: false,
        autoPost: false,
        lastScannedAt: null,
        description: "Nhom nha tro khu Tan Binh va Tan Phu",
      },
      {
        name: "Cho Thue Can Ho Mini Thu Duc",
        url: "https://www.facebook.com/groups/canho.thuduc",
        fbGroupId: "678901234",
        isActive: true,
        autoScan: true,
        autoPost: true,
        lastScannedAt: new Date(Date.now() - 3 * 60000),
        description: "Can ho mini, phong tro khu Thu Duc, Linh Trung",
      },
    ]);
    console.log(`Inserted ${groups.length} groups`);

    // === ROOMS ===
    const rooms = await Room.insertMany([
      {
        title: "Phong tro cao cap Quan 7 - Phu My Hung",
        content:
          "Phong tro moi xay, day du noi that: may lanh, tu lanh, giuong nem. Gan Lotte Mart, truong hoc, benh vien. Bao ve 24/7, camera an ninh. Gia chi tu 3.5 trieu/thang. Lien he ngay de xem phong!",
        images: [],
        videos: [],
        location: "Quan 7, TP.HCM",
        locationKeywords: [
          "quan 7",
          "phu my hung",
          "tan phong",
          "tan phu",
          "nam long",
        ],
        price: 3500000,
        commentTemplate:
          "Chao ban, minh co phong tro tai Quan 7 - Phu My Hung, day du noi that, gia 3.5tr/thang. Inbox minh de biet them chi tiet nhe!",
        isActive: true,
      },
      {
        title: "Phong tro gia re Binh Thanh - Gan D2",
        content:
          "Phong sach se, thoang mat, dien tich 20-25m2. Co san gac lung, WC rieng, cua so lon. Gan truong Dai hoc Van Lang, cho Ba Chieu. Gia tu 2.8 trieu/thang, bao dien nuoc internet.",
        images: [],
        videos: [],
        location: "Binh Thanh, TP.HCM",
        locationKeywords: [
          "binh thanh",
          "hang xanh",
          "ba chieu",
          "van lang",
          "d2",
        ],
        price: 2800000,
        commentTemplate:
          "Hi ban! Minh dang co phong cho thue o Binh Thanh, gan D2, gia chi 2.8tr bao tat ca. Inbox minh nhe!",
        isActive: true,
      },
      {
        title: "Can ho mini Go Vap - Full noi that",
        content:
          "Can ho mini 30m2, full noi that cao cap: bep, may giat, may lanh Daikin. Ban cong thoang mat, view dep. Gui xe mien phi. Co cho de oto. Gia 4.5 trieu/thang.",
        images: [],
        videos: [],
        location: "Go Vap, TP.HCM",
        locationKeywords: [
          "go vap",
          "le duc tho",
          "quang trung",
          "pham van dong",
        ],
        price: 4500000,
        commentTemplate:
          "Chao ban, minh co can ho mini 30m2 full noi that o Go Vap, 4.5tr/thang. LH minh de xem phong nhe!",
        isActive: true,
      },
      {
        title: "Phong tro sinh vien Thu Duc",
        content:
          "Phong tro gan DH Nong Lam, FPT. Gia sinh vien than thien: 1.8-2.5 trieu/thang. Co che nau an, wifi mien phi, cho de xe rong. Moi truong yeu tinh, an ninh.",
        images: [],
        videos: [],
        location: "Thu Duc, TP.HCM",
        locationKeywords: [
          "thu duc",
          "linh trung",
          "linh xuan",
          "nong lam",
          "fpt",
        ],
        price: 2000000,
        commentTemplate:
          "Hello ban! Phong tro sinh vien Thu Duc day ne, gan truong, tu 1.8tr thoi. Inbox minh nha!",
        isActive: true,
      },
      {
        title: "Nha tro Tan Binh - Gan san bay",
        content:
          "Phong rong 28m2, co gac lung cao 1m4. Khu dan cu yen tinh, gan cong vien Hoang Van Thu. Bao ve, PCCC day du. Gia 3 trieu/thang.",
        images: [],
        videos: [],
        location: "Tan Binh, TP.HCM",
        locationKeywords: ["tan binh", "san bay", "hoang van thu", "cong hoa"],
        price: 3000000,
        commentTemplate: "",
        isActive: false,
      },
    ]);
    console.log(`Inserted ${rooms.length} rooms`);

    // === SCANNED POSTS ===
    const posts = await ScannedPost.insertMany([
      {
        groupId: groups[0]._id,
        fbPostId: "pfbid0abc1",
        authorName: "Nguyen Van A",
        authorFbId: "100001111",
        content:
          "Em dang tim phong tro o Quan 7, gan Phu My Hung, budget khoang 3-4 trieu. Co ai biet cho nao khong a? Can phong co may lanh, WC rieng. Em la nu, o 1 minh.",
        images: [],
        postUrl: "https://facebook.com/groups/123456789/posts/111",
        scannedAt: new Date(Date.now() - 8 * 60000),
        status: "matched",
        matched: true,
        matchedRoomIds: [rooms[0]._id],
        analysis: {
          isLookingForRoom: true,
          location: "Quan 7, Phu My Hung",
          budget: "3-4 trieu",
          requirements: "may lanh, WC rieng, nu o 1 minh",
          confidence: 0.95,
        },
      },
      {
        groupId: groups[0]._id,
        fbPostId: "pfbid0abc2",
        authorName: "Tran Thi B",
        authorFbId: "100002222",
        content:
          "Cho thue phong tro moi xay tai Quan 4, gia 2.5 trieu/thang, day du tien nghi. LH: 0909xxx",
        images: [],
        postUrl: "https://facebook.com/groups/123456789/posts/222",
        scannedAt: new Date(Date.now() - 7 * 60000),
        status: "skipped",
        matched: false,
        matchedRoomIds: [],
        analysis: {
          isLookingForRoom: false,
          location: "Quan 4",
          confidence: 0.9,
        },
      },
      {
        groupId: groups[1]._id,
        fbPostId: "pfbid0abc3",
        authorName: "Le Van C",
        authorFbId: "100003333",
        content:
          "Minh can tim phong tro 2 nguoi o khu vuc Quan 7 hoac Nha Be, gia khoang 4-5 trieu. Uu tien co cho nau an va giat do. Inbox minh nhe!",
        images: [],
        postUrl: "https://facebook.com/groups/234567890/posts/333",
        scannedAt: new Date(Date.now() - 5 * 60000),
        status: "commented",
        matched: true,
        matchedRoomIds: [rooms[0]._id],
        analysis: {
          isLookingForRoom: true,
          location: "Quan 7, Nha Be",
          budget: "4-5 trieu",
          requirements: "2 nguoi, bep, may giat",
          confidence: 0.92,
        },
      },
      {
        groupId: groups[1]._id,
        fbPostId: "pfbid0abc4",
        authorName: "Pham D",
        authorFbId: "100004444",
        content:
          "Tim phong tro gan Dai hoc Van Lang Binh Thanh, budget 2-3 trieu. Sinh vien nam, can phong yen tinh de hoc bai.",
        images: [],
        postUrl: "https://facebook.com/groups/234567890/posts/444",
        scannedAt: new Date(Date.now() - 4 * 60000),
        status: "matched",
        matched: true,
        matchedRoomIds: [rooms[1]._id],
        analysis: {
          isLookingForRoom: true,
          location: "Binh Thanh, Van Lang",
          budget: "2-3 trieu",
          requirements: "yen tinh, sinh vien nam",
          confidence: 0.88,
        },
      },
      {
        groupId: groups[3]._id,
        fbPostId: "pfbid0abc5",
        authorName: "Hoang E",
        authorFbId: "100005555",
        content:
          "Co ai biet cho nao o Go Vap co can ho mini full noi that gia tam 4-5 trieu khong a? Minh can gap, dang o khach san ton lam.",
        images: [],
        postUrl: "https://facebook.com/groups/456789012/posts/555",
        scannedAt: new Date(Date.now() - 3 * 60000),
        status: "matched",
        matched: true,
        matchedRoomIds: [rooms[2]._id],
        analysis: {
          isLookingForRoom: true,
          location: "Go Vap",
          budget: "4-5 trieu",
          requirements: "can ho mini, full noi that, can gap",
          confidence: 0.94,
        },
      },
      {
        groupId: groups[5]._id,
        fbPostId: "pfbid0abc6",
        authorName: "Vo F",
        authorFbId: "100006666",
        content:
          "Minh la sinh vien FPT, can tim phong tro khu Thu Duc, budget khoang 2 trieu. Co ban nao muon o ghep khong?",
        images: [],
        postUrl: "https://facebook.com/groups/678901234/posts/666",
        scannedAt: new Date(Date.now() - 2 * 60000),
        status: "analyzed",
        matched: true,
        matchedRoomIds: [rooms[3]._id],
        analysis: {
          isLookingForRoom: true,
          location: "Thu Duc, FPT",
          budget: "2 trieu",
          requirements: "sinh vien, o ghep",
          confidence: 0.87,
        },
      },
      {
        groupId: groups[0]._id,
        fbPostId: "pfbid0abc7",
        authorName: "Admin Group",
        authorFbId: "100007777",
        content:
          "THONG BAO: Moi nguoi chu y khong dang bai rac, quang cao lung tung. Vi pham se bi kick khoi nhom. Cam on!",
        images: [],
        postUrl: "https://facebook.com/groups/123456789/posts/777",
        scannedAt: new Date(Date.now() - 1 * 60000),
        status: "skipped",
        matched: false,
        matchedRoomIds: [],
        analysis: {
          isLookingForRoom: false,
          confidence: 0.98,
        },
      },
      {
        groupId: groups[3]._id,
        fbPostId: "pfbid0abc8",
        authorName: "Do G",
        authorFbId: "100008888",
        content:
          "Ban nao co info phong tro Go Vap, dien tich khoang 25-30m2, co ban cong thoang, gia khoang 3 trieu inbox minh nhe.",
        images: [],
        postUrl: "https://facebook.com/groups/456789012/posts/888",
        scannedAt: new Date(),
        status: "new",
        matched: false,
        matchedRoomIds: [],
      },
    ]);
    console.log(`Inserted ${posts.length} scanned posts`);

    // === COMMENTS ===
    const comments = await Comment.insertMany([
      {
        postId: posts[2]._id,
        roomId: rooms[0]._id,
        content:
          "Chao ban, minh co phong tro tai Quan 7 - Phu My Hung, day du noi that, gia 3.5tr/thang. Phong rong, co may lanh, tu lanh, giuong nem. Cho 2 nguoi o rat thoai mai. Inbox minh de biet them chi tiet nhe!",
        status: "posted",
        postedAt: new Date(Date.now() - 4 * 60000),
        fbCommentId: "comment_001",
      },
      {
        postId: posts[0]._id,
        roomId: rooms[0]._id,
        content:
          "Hi ban, minh co phong tro o Quan 7 Phu My Hung ne, co may lanh + WC rieng, gia 3.5tr. Khu an ninh, camera 24/7, rat phu hop cho ban nu o 1 minh. Inbox minh nha!",
        status: "pending",
        postedAt: null,
        fbCommentId: null,
      },
      {
        postId: posts[4]._id,
        roomId: rooms[2]._id,
        content:
          "Chao ban, minh co can ho mini 30m2 full noi that o Go Vap, 4.5tr/thang. Co ban cong thoang, may giat, bep, may lanh Daikin. Xem phong ngay hom nay duoc luon! LH minh nhe.",
        status: "posted",
        postedAt: new Date(Date.now() - 2 * 60000),
        fbCommentId: "comment_003",
      },
      {
        postId: posts[3]._id,
        roomId: rooms[1]._id,
        content:
          "Hi ban! Minh co phong cho thue o Binh Thanh, cach Van Lang 5 phut xe may, gia 2.8tr bao dien nuoc internet. Phong yen tinh, rat hop cho sinh vien hoc bai. Inbox minh nhe!",
        status: "failed",
        postedAt: null,
        fbCommentId: null,
        error: "Facebook rate limit exceeded",
      },
    ]);
    console.log(`Inserted ${comments.length} comments`);

    // === SETTINGS ===
    const settings = await Promise.all([
      Setting.setValue("scanIntervalMinutes", 5, "So phut giua moi lan scan"),
      Setting.setValue(
        "aiProvider",
        "openai",
        "AI provider: openai hoac gemini",
      ),
      Setting.setValue("maxCommentsPerHour", 10, "So comment toi da moi gio"),
      Setting.setValue(
        "commentDelaySeconds",
        30,
        "Delay giua cac comment (giay)",
      ),
      Setting.setValue("isAutoScanEnabled", true, "Bat/tat auto scan"),
      Setting.setValue("isAutoCommentEnabled", false, "Bat/tat auto comment"),
    ]);
    console.log(`Inserted ${settings.length} settings`);

    console.log("\n=== SEED COMPLETED ===");
    console.log(`Groups: ${groups.length}`);
    console.log(`Rooms: ${rooms.length}`);
    console.log(`Scanned Posts: ${posts.length}`);
    console.log(`Comments: ${comments.length}`);
    console.log(`Settings: ${settings.length}`);

    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
}

seed();
