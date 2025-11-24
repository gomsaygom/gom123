// 이메일 설정

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