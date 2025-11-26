require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

// === Models ===
const ChatRoom = require("./models/ChatRoom");
const Message = require("./models/Message");
const Accommodation = require("./models/Accommodation");
const RoomMember = require("./models/RoomMember"); // ★ 추가: 멤버십 TTL

// === App / Server / IO ===
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

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
const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const norm = (v) => (v === null || v === undefined ? "" : String(v).trim());
const lower = (v) => norm(v).toLowerCase();
const uniq = (arr) => [...new Set(arr)];
const ensureArray = (v) => (Array.isArray(v) ? v : []);
const now = () => new Date();

// 헬스체크
app.get("/", (_, res) => res.send("채팅 서버 동작 중!"));

// ======================================================================
// 단체방: 숙소당 1개 고정 (참가자 없어도 방은 유지)
// ======================================================================
app.post("/rooms/accommodation", async (req, res) => {
  try {
    const { accommodationId, participantIds } = req.body || {};
    if (!accommodationId) return res.status(400).json({ message: "accommodationId는 필수입니다." });

    let room = await ChatRoom.findOne({ isDM: false, accommodationId }).lean();
    if (room) {
      // 선택적으로 participants 업데이트(표시용)
      const participants = uniq(ensureArray(participantIds).map(lower).filter(Boolean));
      if (participants.length > 0) {
        await ChatRoom.updateOne({ _id: room._id }, { $addToSet: { participants: { $each: participants } } });
        room = await ChatRoom.findById(room._id).lean();
      }
      return res.json(room);
    }

    room = await ChatRoom.create({
      isDM: false,
      accommodationId,
      participants: uniq(ensureArray(participantIds).map(lower).filter(Boolean)), // 표시용
      // 단체방은 expiresAt 없음 -> 절대 TTL 삭제되지 않음
    });

    return res.json(room);
  } catch (err) {
    console.error("숙소 단체방 생성/조회 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 숙소 단체방 조회
app.get("/rooms/accommodation/:accommodationId", async (req, res) => {
  try {
    const acId = Number(req.params.accommodationId);
    if (!Number.isInteger(acId)) return res.status(400).json({ message: "유효하지 않은 숙소 id 입니다." });
    const room = await ChatRoom.findOne({ isDM: false, accommodationId: acId }).lean();
    if (!room) return res.status(404).json({ message: "단체 채팅방이 없습니다." });
    return res.json(room);
  } catch (err) {
    console.error("단체방 조회 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 단체방 멤버 등록(체크인 시 호출) - TTL 멤버십
// body: { userId: "email", accommodationId: 13, expiresAt: "2025-12-01T14:59:59.000Z" }
app.post("/rooms/:roomId/members", async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!isObjectId(roomId)) return res.status(400).json({ message: "유효하지 않은 roomId 입니다." });

    const { userId, accommodationId, expiresAt } = req.body || {};
    const user = lower(userId);
    const acId = Number(accommodationId);
    if (!user || !acId || !expiresAt) {
      return res.status(400).json({ message: "userId, accommodationId, expiresAt는 필수입니다." });
    }

    await RoomMember.updateOne(
      { roomId, userId: user },
      { $set: { accommodationId: acId, expiresAt: new Date(expiresAt) } },
      { upsert: true }
    );

    // 표시용 participants에 반영(선택)
    await ChatRoom.updateOne({ _id: roomId }, { $addToSet: { participants: user } });

    return res.json({ ok: true });
  } catch (err) {
    console.error("멤버 등록 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// ======================================================================
// DM: 같은 숙소 내 두 사용자 쌍당 1개, 단체권한 만료 시 DM 자동 삭제
// ======================================================================
app.post("/rooms/dm", async (req, res) => {
  try {
    const acId = req.body.accommodationId;
    let { userA, userB } = req.body || {};
    userA = lower(userA);
    userB = lower(userB);

    if (!acId || !userA || !userB) {
      return res.status(400).json({ message: "accommodationId, userA, userB는 필수입니다." });
    }
    if (userA === userB) {
      return res.status(400).json({ message: "동일 사용자끼리 DM은 생성할 수 없습니다." });
    }

    // 두 사용자 모두 단체방 멤버십이 있어야 DM 허용
    const groupRoom = await ChatRoom.findOne({ isDM: false, accommodationId: acId }).lean();
    if (!groupRoom) return res.status(400).json({ message: "단체방이 먼저 생성되어야 합니다." });

    const mA = await RoomMember.findOne({ roomId: groupRoom._id, userId: userA }).lean();
    const mB = await RoomMember.findOne({ roomId: groupRoom._id, userId: userB }).lean();
    if (!mA || !mB) return res.status(403).json({ message: "단체 채팅 권한이 없습니다." });

    // DM 만료시각 = 두 멤버십 만료 중 더 이른 시각
    const dmExpires = new Date(Math.min(new Date(mA.expiresAt).getTime(), new Date(mB.expiresAt).getTime()));

    const participants = [userA, userB].sort();
    let room = await ChatRoom.findOne({
      isDM: true,
      accommodationId: acId,
      participants: { $all: participants, $size: 2 },
    });

    if (room) {
      // 만료 갱신(더 이른 값으로 업데이트)
      await ChatRoom.updateOne({ _id: room._id }, { $set: { expiresAt: dmExpires } });
      room = await ChatRoom.findById(room._id).lean();
      return res.json(room);
    }

    room = await ChatRoom.create({
      isDM: true,
      accommodationId: acId,
      participants,
      expiresAt: dmExpires, // ★ DM은 TTL로 자동 삭제
    });

    return res.json(room);
  } catch (err) {
    console.error("DM 방 생성/조회 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 공통 조회
app.get("/rooms/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!isObjectId(roomId)) return res.status(400).json({ message: "유효하지 않은 roomId 입니다." });
    const room = await ChatRoom.findById(roomId).lean();
    if (!room) return res.status(404).json({ message: "방을 찾을 수 없습니다." });
    return res.json(room);
  } catch (err) {
    console.error("방 정보 조회 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

app.get("/rooms/:roomId/messages", async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!isObjectId(roomId)) return res.status(400).json({ message: "유효하지 않은 roomId 입니다." });
    const messages = await Message.find({ roomId }).sort({ createdAt: 1 }).lean();
    return res.json(messages);
  } catch (err) {
    console.error("메시지 조회 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 숙소 이름(표시용)
app.get("/accommodations/:id", async (req, res) => {
  try {
    const idNum = Number(req.params.id);
    if (!Number.isInteger(idNum)) return res.status(400).json({ message: "유효하지 않은 숙소 id 입니다." });
    const acc = await Accommodation.findOne({ id: idNum }).lean();
    if (!acc) return res.status(404).json({ message: "숙소를 찾을 수 없습니다." });
    return res.json({ id: acc.id, name: acc.name });
  } catch (err) {
    console.error("숙소 조회 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// ======================================================================
// Socket.IO
// ======================================================================
io.on("connection", (socket) => {
  console.log("📥 socket connected:", socket.id);

  socket.on("joinRoom", ({ roomId }) => {
    try {
      if (!roomId || !isObjectId(roomId)) {
        return socket.emit("errorMessage", { message: "유효하지 않은 roomId" });
      }
      socket.join(roomId);
      console.log("📥 socket", socket.id, "join room", roomId);
    } catch (err) {
      console.error("joinRoom 오류:", err);
      socket.emit("errorMessage", { message: "joinRoom 오류" });
    }
  });

  socket.on("sendMessage", async ({ roomId, senderId, content, type }) => {
    try {
      const rId = norm(roomId);
      const sId = lower(senderId);
      const text = norm(content);
      const msgType = type || "text";

      if (!rId || !isObjectId(rId)) return socket.emit("errorMessage", { message: "유효하지 않은 roomId" });
      if (!sId) return socket.emit("errorMessage", { message: "senderId는 필수입니다." });
      if (!text) return socket.emit("errorMessage", { message: "content는 필수입니다." });

      const room = await ChatRoom.findById(rId);
      if (!room) return socket.emit("errorMessage", { message: "채팅방이 없습니다." });

      if (room.isDM) {
        // DM: 두 멤버 모두 단체권한이 있어야 함 + 만료 갱신/검사
        const [u1, u2] = room.participants;
        const groupRoom = await ChatRoom.findOne({ isDM: false, accommodationId: room.accommodationId }).lean();
        if (!groupRoom) return socket.emit("errorMessage", { message: "단체방이 없습니다." });

        const m1 = await RoomMember.findOne({ roomId: groupRoom._id, userId: u1 }).lean();
        const m2 = await RoomMember.findOne({ roomId: groupRoom._id, userId: u2 }).lean();
        if (!m1 || !m2) return socket.emit("errorMessage", { message: "DM 권한 만료(단체 채팅 권한 필요)" });

        // DM 만료 재계산(동적 갱신)
        const minExp = new Date(Math.min(new Date(m1.expiresAt).getTime(), new Date(m2.expiresAt).getTime()));
        await ChatRoom.updateOne({ _id: room._id }, { $set: { expiresAt: minExp } });
        if (minExp.getTime() <= now().getTime()) {
          return socket.emit("errorMessage", { message: "DM 만료됨" });
        }

        // 메시지도 동일 만료로 TTL 설정
        const saved = await Message.create({
          roomId: rId, senderId: sId, content: text, type: msgType, expiresAt: minExp
        });
        io.to(rId).emit("newMessage", {
          _id: saved._id, roomId: saved.roomId, senderId: saved.senderId,
          content: saved.content, type: saved.type, createdAt: saved.createdAt, updatedAt: saved.updatedAt
        });
      } else {
        // 단체방: 유효 멤버십(체크아웃 전)만 전송 허용 — 방은 절대 삭제되지 않음
        const membership = await RoomMember.findOne({ roomId: rId, userId: sId }).lean();
        if (!membership) {
          return socket.emit("errorMessage", { message: "입장 권한이 없습니다. (체크인 필요 또는 체크아웃 만료)" });
        }
        if (new Date(membership.expiresAt).getTime() <= now().getTime()) {
          return socket.emit("errorMessage", { message: "체크아웃 만료됨" });
        }

        const saved = await Message.create({
          roomId: rId, senderId: sId, content: text, type: msgType
        });
        io.to(rId).emit("newMessage", {
          _id: saved._id, roomId: saved.roomId, senderId: saved.senderId,
          content: saved.content, type: saved.type, createdAt: saved.createdAt, updatedAt: saved.updatedAt
        });
      }
    } catch (err) {
      console.error("메시지 저장/전송 오류:", err);
      socket.emit("errorMessage", { message: "메시지 전송 실패" });
    }
  });

  socket.on("disconnect", () => {
    console.log("📤 socket disconnected:", socket.id);
  });
});

server.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
