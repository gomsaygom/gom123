/**
 * [유저 라우터] (로그인 필수)
 * - GET, PUT /me : 내 정보 조회 및 수정
 * - PUT /me/password : 비밀번호 변경
 * - GET /users/recent : 최근 본 숙소
 * - POST, DELETE, GET /favorites : 찜하기 기능
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/userController');
const authMiddleware = require('../middlewares/auth');

// ====================================================
// 👤 내 정보 관리 (로그인 필수)
// ====================================================
// 1. 내 정보 조회
router.get('/me', authMiddleware, controller.getMe);

// 2. 내 정보 수정
router.put('/me', authMiddleware, controller.updateMe);

// 3. 비밀번호 변경
router.put('/me/password', authMiddleware, controller.updatePassword);

// ====================================================
// 👁️ [여기!] 최근 본 숙소 (이게 없어서 에러 났던 것!)
// ====================================================
router.get('/users/recent', authMiddleware, controller.getRecentViews);

// ====================================================
// ❤️ 찜하기 기능 (로그인 필수)
// ====================================================
// 4. 찜 추가
router.post('/favorites', authMiddleware, controller.addFavorite);

// 5. 찜 삭제
router.delete('/favorites/:id', authMiddleware, controller.removeFavorite);

// 6. 내 찜 목록 조회
router.get('/me/favorites', authMiddleware, controller.getFavorites);

module.exports = router;