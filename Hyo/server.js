// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

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
app.get("/", (_req, res) => {
  res.send("채팅 서버 동작 중!");
});

// === Helper: 숙소 단체방(숙소당 1개) 만들거나 가져오기 ===
async function getOrCreateAccommodationRoom(accommodationId, participantIds = []) {
  const accIdNum = Number(accommodationId);
  if (!Number.isFinite(accIdNum)) {
    throw new Error("accommodationId must be a number");
  }

  // 이미 방 있으면 재사용
  let room = await ChatRoom.findOne({ isDM: false, accommodationId: accIdNum });
  if (room) return room;

  // 없으면 새로 생성 (participants는 이제 권한용 X, 그냥 참고용)
  const dedup = Array.from(
    new Set((participantIds || []).map(normalizeEmail).filter(Boolean))
  );

  room = await ChatRoom.create({
    isDM: false,
    accommodationId: accIdNum,
    participants: dedup, // 빈 배열도 허용 (ChatRoom.js 수정돼 있어야 함)
  });
  return room;
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
    // 실제에선 메인 백엔드에서 가져와야 하지만 지금은 프론트용 더미
    return res.json({ id, name: `숙소 #${id}` });
  } catch (err) {
    console.error("숙소명 조회 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// === Socket.IO ===
io.on("connection", (socket) => {
  console.log("📥 socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("📤 socket disconnected:", socket.id);
  });

  // 방 입장 (권한 검증 없음, room 존재만 확인)
  socket.on("joinRoom", async ({ roomId }) => {
    try {
      if (!roomId) {
        return socket.emit("errorMessage", { message: "roomId가 필요합니다." });
      }

      const exists = await ChatRoom.exists({ _id: roomId });
      if (!exists) {
        return socket.emit("errorMessage", { message: "유효하지 않은 roomId 입니다." });
      }

      socket.join(roomId);
      console.log("📥 socket", socket.id, "join room", roomId);
    } catch (err) {
      console.error("joinRoom 오류:", err);
      socket.emit("errorMessage", { message: "joinRoom 처리 중 서버 오류" });
    }
  });

  // 메시지 전송 (❗예약/멤버/권한 검사 전부 없음, room만 존재하면 허용)
  socket.on("sendMessage", async (payload) => {
    try {
      const { roomId, senderId, content, type = "text" } = payload || {};
      if (!roomId || !senderId || !content) {
        return socket.emit("errorMessage", {
          message: "roomId/senderId/content가 필요합니다.",
        });
      }

      const room = await ChatRoom.findById(roomId);
      if (!room) {
        return socket.emit("errorMessage", { message: "유효하지 않은 roomId 입니다." });
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
