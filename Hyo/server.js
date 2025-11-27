// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const axios = require("axios");

// === Models ===
const ChatRoom = require("./models/ChatRoom");
const Message = require("./models/Message");

// === App / Server / IO ===
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

// === Env ===
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

// 예약 검증용(다른 백엔드, MariaDB 쪽)
// 예) http://<메인백엔드호스트>:<포트>
const RESV_API_BASE = (process.env.RESV_API_BASE || "").trim(); 
// 메인 백엔드에서 제공하는 검증 엔드포인트 경로(필요시 변경)
const RESV_VERIFY_PATH = (process.env.RESV_VERIFY_PATH || "/reservations/verify").trim();
// 예약 검증 타임아웃(ms)
const RESV_TIMEOUT_MS = Number(process.env.RESV_TIMEOUT_MS || 3000);
// 응급 스위치(테스트·비상시) — 'true'면 예약검증을 통과시킴
const RESV_ALLOW_ALL = String(process.env.RESV_ALLOW_ALL || "false").toLowerCase() === "true";

// === MongoDB Connect ===
(async () => {
  try {
    if (!MONGODB_URI) throw new Error("MONGODB_URI is missing in .env");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
})();

// === Utils ===
const toStr = (v) => (typeof v === "string" ? v : String(v ?? ""));
const normalizeEmail = (v) => toStr(v).trim().toLowerCase();

// === Health ===
app.get("/", (_req, res) => res.send("채팅 서버 동작 중!"));

// === Helper: 숙소 단체방(숙소당 1개) 만들거나 가져오기 ===
async function getOrCreateAccommodationRoom(accommodationId, participantIds = []) {
  const accIdNum = Number(accommodationId);
  if (!Number.isFinite(accIdNum)) throw new Error("accommodationId must be a number");

  let room = await ChatRoom.findOne({ isDM: false, accommodationId: accIdNum });
  if (room) return room;

  const dedup = Array.from(new Set((participantIds || []).map(normalizeEmail).filter(Boolean)));
  room = await ChatRoom.create({
    isDM: false,
    accommodationId: accIdNum,
    participants: dedup, // participants는 이제 권한 판단엔 사용하지 않지만, 조회/표시용으로 유지
  });
  return room;
}

// === 예약 검증 ===
// 계약: 메인 백엔드가 아래 형태 중 하나로 응답한다고 가정
// 1) POST { accommodationId, userId } -> { ok: true } 또는 { ok: false, reason: "..."}
async function isReservedUser(userId, accommodationId) {
  if (RESV_ALLOW_ALL) return true; // 비상 우회 스위치

  const uid = normalizeEmail(userId);
  const accIdNum = Number(accommodationId);
  if (!uid || !Number.isFinite(accIdNum)) return false;

  if (!RESV_API_BASE) {
    // 설정이 안 된 경우엔 "보수적으로 차단" (필요시 true로 바꿔 임시 개방 가능)
    console.warn("⚠️  RESV_API_BASE 미설정 → 예약 검증 불가(차단)");
    return false;
  }

  try {
    const url = RESV_API_BASE.replace(/\/+$/, "") + RESV_VERIFY_PATH; // base + path
    const { data } = await axios.post(
      url,
      { accommodationId: accIdNum, userId: uid },
      { timeout: RESV_TIMEOUT_MS }
    );
    return !!data?.ok;
  } catch (e) {
    console.error("❌ 예약 검증 실패:", e?.response?.status, e?.message);
    return false;
  }
}

// === REST: 숙소 단체방 생성/조회(있으면 재사용) ===
app.post("/rooms/accommodation", async (req, res) => {
  try {
    const { accommodationId, participantIds = [] } = req.body || {};
    if (accommodationId === undefined) {
      return res.status(400).json({ message: "accommodationId가 필요합니다." });
    }
    const room = await getOrCreateAccommodationRoom(accommodationId, participantIds);
    return res.json(room);
  } catch (err) {
    console.error("숙소 방 생성/조회 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// === REST: 숙소 단체방 조회(없으면 404) ===
app.get("/rooms/accommodation/:accommodationId", async (req, res) => {
  try {
    const accIdNum = Number(req.params.accommodationId);
    if (!Number.isFinite(accIdNum)) {
      return res.status(400).json({ message: "accommodationId가 올바르지 않습니다." });
    }
    const room = await ChatRoom.findOne({ isDM: false, accommodationId: accIdNum }).lean();
    if (!room) return res.status(404).json({ message: "단체 채팅방이 없습니다." });
    return res.json(room);
  } catch (err) {
    console.error("숙소 방 조회 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// === REST: 특정 채팅방 정보 조회 ===
app.get("/rooms/:roomId", async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId).lean();
    if (!room) return res.status(404).json({ message: "방을 찾을 수 없습니다." });
    return res.json(room);
  } catch (err) {
    console.error("방 정보 조회 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// === REST: 과거 메시지 ===
app.get("/rooms/:roomId/messages", async (req, res) => {
  try {
    const exists = await ChatRoom.exists({ _id: req.params.roomId });
    if (!exists) return res.status(400).json({ message: "유효하지 않은 roomId 입니다." });

    const messages = await Message.find({ roomId: req.params.roomId })
      .sort({ createdAt: 1 })
      .lean();
    return res.json(messages);
  } catch (err) {
    console.error("메시지 조회 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// === REST: 숙소 이름 조회(표시용 더미) ===
app.get("/accommodations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "id가 올바르지 않습니다." });
    }
    return res.json({ id, name: `숙소 #${id}` });
  } catch (err) {
    console.error("숙소명 조회 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// === 예약 자격 조회(프런트가 미리 확인하고 버튼 활성화용) ===
app.get("/eligibility/:roomId", async (req, res) => {
  try {
    const userId = normalizeEmail(req.query.userId);
    if (!userId) return res.status(400).json({ ok: false, message: "userId가 필요합니다." });

    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ ok: false, message: "방을 찾을 수 없습니다." });

    const allowed = await isReservedUser(userId, room.accommodationId);
    return res.json({ ok: allowed });
  } catch (err) {
    console.error("eligibility 조회 오류:", err);
    return res.status(500).json({ ok: false, message: "서버 오류" });
  }
});

// === Socket.IO ===
io.on("connection", (socket) => {
  console.log("📥 socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("📤 socket disconnected:", socket.id);
  });

  // 방 입장(예약 검증은 전송 시점에 수행 — 프런트 변경 없이 사용 가능)
  socket.on("joinRoom", async ({ roomId }) => {
    try {
      if (!roomId) return socket.emit("errorMessage", { message: "roomId가 필요합니다." });
      const exists = await ChatRoom.exists({ _id: roomId });
      if (!exists) return socket.emit("errorMessage", { message: "유효하지 않은 roomId 입니다." });
      socket.join(roomId);
      console.log("📥 socket", socket.id, "join room", roomId);
    } catch (err) {
      console.error("joinRoom 오류:", err);
      socket.emit("errorMessage", { message: "joinRoom 처리 중 서버 오류" });
    }
  });

  // 메시지 전송(여기서 '예약 고객'만 허용)
  socket.on("sendMessage", async (payload) => {
    try {
      const { roomId, senderId, content, type = "text" } = payload || {};
      if (!roomId || !senderId || !content) {
        return socket.emit("errorMessage", { message: "roomId/senderId/content가 필요합니다." });
      }
      const room = await ChatRoom.findById(roomId);
      if (!room) return socket.emit("errorMessage", { message: "유효하지 않은 roomId 입니다." });

      const allowed = await isReservedUser(senderId, room.accommodationId);
      if (!allowed) {
        return socket.emit("errorMessage", { message: "예약 고객만 전송할 수 있습니다." });
      }

      const msg = await Message.create({
        roomId,
        senderId: normalizeEmail(senderId),
        content: String(content),
        type,
      });

      io.to(roomId).emit("newMessage", {
        _id: msg._id,
        roomId: msg.roomId,
        senderId: msg.senderId,
        content: msg.content,
        type: msg.type,
        createdAt: msg.createdAt,
      });
    } catch (err) {
      console.error("메시지 저장/전송 중 오류:", err);
      socket.emit("errorMessage", { message: "메시지 전송 실패" });
    }
  });
});

// === Start ===
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
