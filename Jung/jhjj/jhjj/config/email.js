/**
 * [이메일 발송 설정]
 * Nodemailer를 사용하여 구글(Gmail) 서버를 통해 메일을 보낼 '우체부(Transporter)'를 설정합니다.
 * 회원가입 인증번호, 비밀번호 찾기 메일 발송 시 사용됩니다.
 */

const nodemailer = require('nodemailer');

// 우체부 설정
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'howgyeongju@gmail.com', 
        pass: 'iongfatnfbhrttfn' 
    }
});

module.exports = transporter;