// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const auth = require("./middlewares/auth");
const requireRole = require("./middlewares/requireRole");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

/**
 * 1. 헬스 체크(서버 살아있는지 확인)
 */
app.get("/", (req, res) => {
  res.send("숙소 API 서버 동작중!");
});

/**
 * 2. 회원가입 API
 *    POST /auth/register
 *    body: { email, password, name, userType }
 *    userType: "CUSTOMER" 또는 "OWNER"
 */
app.post("/auth/register", async (req, res) => {
  const { email, password, name, userType } = req.body;

  if (!email || !password || !name) {
    return res
      .status(400)
      .json({ message: "email, password, name은 필수입니다." });
  }

  try {
    // 1) 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2) 역할 이름 결정 (기본은 CUSTOMER)
    const roleName = userType === "OWNER" ? "OWNER" : "CUSTOMER";

    // 3) role 테이블에서 role_id 조회
    const [roleRows] = await pool.query(
      "SELECT role_id FROM role WHERE name = ?",
      [roleName]
    );

    if (roleRows.length === 0) {
      return res.status(500).json({
        message: "ROLE 테이블에 해당 역할이 없습니다. (CUSTOMER/OWNER 확인)",
      });
    }

    const roleId = roleRows[0].role_id;

    // 4) 이메일 중복 체크
    const [existRows] = await pool.query(
      "SELECT user_id FROM users WHERE email = ?",
      [email]
    );
    if (existRows.length > 0) {
      return res.status(400).json({ message: "이미 존재하는 이메일입니다." });
    }

    // 5) users에 INSERT (username, role_code 포함)
    const insertSql = `
      INSERT INTO users (username, email, password, name, role_id, role_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await pool.query(insertSql, [
      email,        // username
      email,        // email
      hashedPassword,
      name,
      roleId,
      roleName,     // 'CUSTOMER' 또는 'OWNER'
    ]);

    return res.status(201).json({ message: "회원가입 완료" });
  } catch (err) {
    console.error("회원가입 에러:", err);
    return res.status(500).json({ message: "서버 에러" });
  }
});

/**
 * 3. 로그인 API
 *    POST /auth/login
 *    body: { email, password }
 *    응답: { token, user: { userId, email, name, role } }
 */
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "email, password는 필수입니다." });
  }

  try {
    const sql = `
      SELECT u.user_id, u.email, u.password, u.name, r.name AS role
      FROM users u
      LEFT JOIN role r ON u.role_id = r.role_id
      WHERE u.email = ?
    `;
    const [rows] = await pool.query(sql, [email]);

    if (rows.length === 0) {
      return res.status(400).json({ message: "존재하지 않는 이메일입니다." });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "비밀번호가 올바르지 않습니다." });
    }

    const payload = {
      userId: user.user_id,
      role: user.role || "CUSTOMER",
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });

    return res.json({
      message: "로그인 성공",
      token,
      user: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        role: payload.role,
      },
    });
  } catch (err) {
    console.error("로그인 에러:", err);
    return res.status(500).json({ message: "서버 에러" });
  }
});

/**
 * 4. OWNER 전용 테스트 API (권한 확인용)
 *    GET /owner/me
 *    헤더: Authorization: Bearer <token>
 */
app.get("/owner/me", auth, requireRole("OWNER"), async (req, res) => {
  try {
    return res.json({
      message: "OWNER 전용 API 접근 성공",
      user: req.user,
    });
  } catch (err) {
    console.error("OWNER 전용 API 에러:", err);
    return res.status(500).json({ message: "서버 에러" });
  }
});

/**
 * 5. 지도용 숙소 목록 조회
 *    GET /api/map/accommodations
 */
app.get("/api/map/accommodations", async (req, res) => {
  try {
    const sql = `
      SELECT
        accommodation_id AS accommodationId,
        name,
        latitude,
        longitude
      FROM accommodation
      WHERE is_active = 1
    `;

    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error("숙소 조회 에러:", err);
    res.status(500).json({ message: "서버 에러" });
  }
});

/**
 * 6. 날짜 + 인원 기준 예약 가능 숙소 조회 (roominventory 사용)
 *    GET /api/map/accommodations/available
 */
app.get("/api/map/accommodations/available", async (req, res) => {
  const { checkIn, checkOut, people, region } = req.query;

  if (!checkIn || !checkOut) {
    return res.status(400).json({
      message:
        "checkIn, checkOut 쿼리스트링은 필수입니다. 예) ?checkIn=2025-12-01&checkOut=2025-12-03",
    });
  }

  const userCheckIn = checkIn;
  const userCheckOut = checkOut;
  const peopleNum = people ? parseInt(people, 10) || 1 : 1;

  try {
    let sql = `
      SELECT
        a.accommodation_id AS accommodationId,
        a.name,
        a.latitude,
        a.longitude,
        MIN(ri.price_per_night) AS minPrice
      FROM accommodation a
      JOIN roomtype rt
        ON rt.accommodation_id = a.accommodation_id
      JOIN roominventory ri
        ON ri.room_type_id = rt.room_type_id
      WHERE a.is_active = 1
        AND ri.stay_date >= ?
        AND ri.stay_date < ?
        AND ri.available_count > 0
        AND rt.max_people >= ?
    `;

    const params = [userCheckIn, userCheckOut, peopleNum];

    if (region) {
      sql += ` AND a.region_city = ? `;
      params.push(region);
    }

    sql += `
      GROUP BY
        a.accommodation_id,
        a.name,
        a.latitude,
        a.longitude
      HAVING
        COUNT(DISTINCT ri.stay_date) = DATEDIFF(?, ?)
      ORDER BY
        minPrice ASC
    `;

    params.push(userCheckOut, userCheckIn);

    const [rows] = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("예약 가능 숙소 조회 에러:", err);
    return res.status(500).json({ message: "서버 에러" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 숙소 API 서버가 포트 ${PORT}에서 실행중`);
});
