const express = require('express');
const router = express.Router();
const controller = require('../controllers/reservationController');
const authMiddleware = require('../middlewares/auth');

router.use(authMiddleware); // 예약은 전부 로그인 필요

router.post('/reservations', controller.createReservation);
router.delete('/reservations/:id', controller.cancelReservation);
router.get('/me/reservations', controller.getMyReservations);

module.exports = router;