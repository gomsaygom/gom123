// middlewares/requireRole.js //권한채크용

// 사용 예시: requireRole("OWNER"), requireRole("OWNER", "ADMIN")
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // auth 미들웨어를 먼저 거치지 않으면 req.user가 없음
    if (!req.user) {
      return res.status(401).json({ message: "로그인이 필요합니다." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "이 작업을 할 권한이 없습니다." });
    }

    next();
  };
}

module.exports = requireRole;
