/**
 * [숙소/리뷰 라우터]
 * - GET /accommodations : 숙소 목록 (공개)
 * - GET /accommodations/:id : 숙소 상세 (공개)
 * - GET /recommend/popular : 인기 숙소 (공개)
 * - POST, PUT, DELETE /reviews : 리뷰 관리 (로그인 필수, 사진 업로드)
 * - GET /accommodations/:id/reviews : 리뷰 조회 (공개)
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/accommodationController');
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.get('/accommodations', controller.getAccommodations);
router.get('/accommodations/:id', controller.getAccommodationDetail);
router.get('/recommend/popular', controller.getPopular);

// 리뷰 (로그인 필요)
router.post('/reviews', authMiddleware, upload.single('reviewImage'), controller.createReview);
router.put('/reviews/:id', authMiddleware, upload.none(), controller.updateReview);
router.delete('/reviews/:id', authMiddleware, controller.deleteReview);
router.get('/accommodations/:id/reviews', controller.getReviews);

module.exports = router;