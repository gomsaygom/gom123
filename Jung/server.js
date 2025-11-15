// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const ChatRoom = require("./models/ChatRoom");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());
app.use(cors());

// MongoDB 연결
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

// 테스트용 라우트
app.get("/", (req, res) => {
  res.send("채팅 서버 동작 중!");
});

// 숙소 단체 채팅방 생성 or 조회
app.post("/rooms/accommodation", async (req, res) => {
  const { accommodationId, participantIds } = req.body;

  if (!accommodationId || !participantIds || participantIds.length === 0) {
    return res.status(400).json({ message: "잘못된 요청입니다." });
  }

  try {
    let room = await ChatRoom.findOne({
      accommodationId,
      isDM: false,
    });

    if (!room) {
      room = await ChatRoom.create({
        accommodationId,
        isDM: false,
        participants: participantIds,
      });
    }

    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// DM 방 생성 or 조회
app.post("/rooms/dm", async (req, res) => {
  const { userId1, userId2 } = req.body;

  if (!userId1 || !userId2) {
    return res.status(400).json({ message: "잘못된 요청입니다." });
  }

  const participants = [userId1, userId2].sort();

  try {
    let room = await ChatRoom.findOne({
      isDM: true,
      participants: { $all: participants, $size: 2 },
    });

    if (!room) {
      room = await ChatRoom.create({
        isDM: true,
        participants,
      });
    }

    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 특정 방 메시지 목록 조회
app.get("/rooms/:roomId/messages", async (req, res) => {
  const { roomId } = req.params;

  try {
    const messages = await Message.find({ roomId })
      .sort({ createdAt: 1 })
      .limit(200);

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// Socket.IO
io.on("connection", (socket) => {
  console.log("🔌 클라이언트 접속:", socket.id);

  // 방 입장
  socket.on("joinRoom", async ({ roomId }) => {
    if (!roomId) return;
    console.log(`📥 socket ${socket.id} join room ${roomId}`);
    socket.join(roomId);
  });

  // 메시지 전송
  socket.on("sendMessage", async ({ roomId, senderId, content }) => {
    if (!roomId || !senderId || !content) return;

    try {
      const message = await Message.create({
        roomId,
        senderId,
        content,
      });

      io.to(roomId).emit("newMessage", {
        _id: message._id,
        roomId: message.roomId,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt,
      });
    } catch (err) {
      console.error("메시지 저장/전송 중 오류:", err);
      socket.emit("errorMessage", { message: "메시지 전송 실패" });
    }
  });

  // 방 나가기
  socket.on("leaveRoom", ({ roomId }) => {
    if (!roomId) return;
    console.log(`📤 socket ${socket.id} leave room ${roomId}`);
    socket.leave(roomId);
  });

  socket.on("disconnect", () => {
    console.log("❌ 클라이언트 연결 종료:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
