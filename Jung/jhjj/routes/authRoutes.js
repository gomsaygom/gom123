const express = require('express');
const router = express.Router();
const controller = require('../controllers/authController');

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/refresh', controller.refreshToken);
router.post('/email/send', controller.sendEmail);
router.post('/email/verify', controller.verifyEmail);
router.post('/password/reset', controller.resetPassword);

module.exports = router;