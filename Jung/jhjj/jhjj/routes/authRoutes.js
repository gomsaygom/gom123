/**
 * [인증 라우터] URL Prefix: /auth
 * - POST /register : 회원가입
 * - POST /login : 로그인
 * - POST /refresh : 토큰 재발급
 * - POST /email/send : 이메일 인증번호 발송
 * - POST /email/verify : 이메일 인증번호 확인
 * - POST /password/reset : 비밀번호 초기화(찾기)
 */

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