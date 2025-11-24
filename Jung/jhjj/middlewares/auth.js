// 로그인 체크

const jwt = require('jsonwebtoken');
const { JWT_SECRET_KEY } = require('../config/secrets');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
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