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