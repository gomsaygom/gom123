// middlewares/auth.js
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  // Authorization 헤더가 없으면 -> 로그인 안 한 상태
  if (!authHeader) {
    return res.status(401).json({ message: "인증 토큰이 필요합니다." });
  }

  // "Bearer 토큰값" 형식이라고 가정
  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // decoded 안에는 { userId, role, iat, exp } 이런 값들이 들어옴
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT 검증 실패:", err);
    return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
  }
}

module.exports = auth;
