/**
 * [예약 라우터] (로그인 필수)
 * - POST /reservations : 예약하기
 * - DELETE /reservations/:id : 예약 취소
 * - GET /me/reservations : 내 예약 조회
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/reservationController');
const authMiddleware = require('../middlewares/auth');

router.use(authMiddleware); // 예약은 전부 로그인 필요

router.post('/reservations', controller.createReservation);
router.delete('/reservations/:id', controller.cancelReservation);
router.get('/me/reservations', controller.getMyReservations);

module.exports = router;