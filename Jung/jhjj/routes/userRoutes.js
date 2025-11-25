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

// ❌ [삭제됨] router.use(authMiddleware); 
// 이제 전체 검문소가 사라졌습니다. 필요한 곳에만 개별 검문소를 세웁니다.

// ====================================================
// 👤 내 정보 관리 (로그인 필수)
// ====================================================
router.get('/me', authMiddleware, controller.getMe);
router.put('/me', authMiddleware, controller.updateMe);
router.put('/me/password', authMiddleware, controller.updatePassword);

// ====================================================
// 👁️ 최근 본 숙소 (로그인 필수)
// ====================================================
// (URL 경로 매칭을 위해 여기 둠)
router.get('/users/recent', authMiddleware, controller.getRecentViews);

// ====================================================
// ❤️ 찜하기 기능 (로그인 필수)
// ====================================================
router.post('/favorites', authMiddleware, controller.addFavorite);
router.delete('/favorites/:id', authMiddleware, controller.removeFavorite);
router.get('/me/favorites', authMiddleware, controller.getFavorites);

module.exports = router;