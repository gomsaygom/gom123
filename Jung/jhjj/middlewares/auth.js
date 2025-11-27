/**
 * [로그인 인증 미들웨어]
 * 요청 헤더(Authorization)에 담긴 JWT 토큰(Access Token)을 검사합니다.
 * - 토큰이 유효하면: req.user에 사용자 정보를 담고 통과(next)시킵니다.
 * - 토큰이 없거나 만료되면: 401 에러를 반환하고 차단합니다.
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET_KEY } = require('../config/secrets');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        console.log("내오림");
        return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: '유효하지 않은 토큰 형식입니다.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET_KEY);
        req.user = decoded; 
        next(); 
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: '토큰이 만료되었습니다. 다시 로그인하세요.' });
        }
        return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
    }
};

module.exports = authMiddleware;