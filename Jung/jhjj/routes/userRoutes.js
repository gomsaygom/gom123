const express = require('express');
const router = express.Router();
const controller = require('../controllers/userController');
const authMiddleware = require('../middlewares/auth');

// 모든 요청에 로그인 검사 적용
router.use(authMiddleware);

router.get('/me', controller.getMe);
router.put('/me', controller.updateMe);
router.put('/me/password', controller.updatePassword);
router.get('/users/recent', controller.getRecentViews); // (주의: URL 경로 맞추기 위해 users/recent로 둠)

// 찜하기
router.post('/favorites', controller.addFavorite);
router.delete('/favorites/:id', controller.removeFavorite);
router.get('/me/favorites', controller.getFavorites);

module.exports = router;