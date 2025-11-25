/**
 * [인증 관련 로직]
 * - 회원가입 (비밀번호 암호화)
 * - 로그인 (Access/Refresh 토큰 발급)
 * - 토큰 재발급 (Refresh Token 검증)
 * - 이메일 인증 (인증번호 발송 및 확인)
 * - 비밀번호 찾기 (임시 비밀번호 발송)
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dbPool = require('../config/database');
const transporter = require('../config/email');
const { saltRounds, JWT_SECRET_KEY, JWT_REFRESH_SECRET_KEY } = require('../config/secrets');

// 1. 회원가입
exports.register = async (req, res) => {
    const { email, password, name, phone, role_code } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ message: '이메일, 비밀번호, 이름은 필수입니다.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        const query = `
            INSERT INTO users (email, password, name, phone, role_code) 
            VALUES (?, ?, ?, ?, ?)
        `;
        
        await dbPool.query(query, [
            email, hashedPassword, name, phone, role_code || 'CUSTOMER'
        ]);

        res.status(201).json({ message: '회원가입에 성공했습니다!' });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: '이미 가입된 이메일입니다.' });
        }
        console.error('회원가입 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 2. 로그인
exports.login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: '이메일과 비밀번호를 모두 입력하세요.' });
    }

    try {
        const query = 'SELECT * FROM users WHERE email = ? AND is_active = 1';
        const [users] = await dbPool.query(query, [email]);

        if (users.length === 0) {
            return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) { 
            return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
        }

        // Access Token (1시간)
        const accessToken = jwt.sign(
            { userId: user.user_id, role: user.role_code }, 
            JWT_SECRET_KEY, 
            { expiresIn: '1h' } 
        );

        // Refresh Token (7일)
        const refreshToken = jwt.sign(
            { userId: user.user_id }, 
            JWT_REFRESH_SECRET_KEY, 
            { expiresIn: '7d' } 
        );

        // Refresh Token DB 저장
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const insertTokenQuery = `
            INSERT INTO RefreshToken (user_id, token, expires_at)
            VALUES (?, ?, ?)
        `;
        await dbPool.query(insertTokenQuery, [user.user_id, refreshToken, expiresAt]);
        
        res.status(200).json({
            message: '로그인 성공!',
            accessToken,
            refreshToken,
            userId: user.user_id,
            name: user.name,
            email: user.email
        });

    } catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 3. 토큰 재발급
exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh Token이 필요합니다.' });
    }

    try {
        const findTokenQuery = 'SELECT * FROM RefreshToken WHERE token = ?';
        const [rows] = await dbPool.query(findTokenQuery, [refreshToken]);

        if (rows.length === 0) {
            return res.status(403).json({ message: '유효하지 않은 Refresh Token입니다.' });
        }

        const dbToken = rows[0];

        jwt.verify(refreshToken, JWT_REFRESH_SECRET_KEY, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ message: 'Refresh Token이 만료되었습니다.' });
            }

            if (new Date() > new Date(dbToken.expires_at)) {
                 return res.status(403).json({ message: 'Refresh Token이 만료되었습니다. 다시 로그인하세요.' });
            }

            const [users] = await dbPool.query('SELECT * FROM users WHERE user_id = ?', [decoded.userId]);
            const user = users[0];

            const newAccessToken = jwt.sign(
                { userId: user.user_id, role: user.role_code },
                JWT_SECRET_KEY,
                { expiresIn: '1h' }
            );

            res.json({
                accessToken: newAccessToken,
                message: '토큰이 재발급되었습니다.'
            });
        });

    } catch (error) {
        console.error('토큰 재발급 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 4. 이메일 인증번호 발송
exports.sendEmail = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: '이메일을 입력해주세요.' });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    try {
        const saveQuery = `
            INSERT INTO email_verifications (email, code, expires_at)
            VALUES (?, ?, ?)
        `;
        await dbPool.query(saveQuery, [email, verificationCode, expiresAt]);

        const mailOptions = {
            from: `야놀자클론 <${transporter.options.auth.user}>`,
            to: email,
            subject: '[야놀자서비스] 회원가입 인증번호입니다.',
            text: `인증번호는 [${verificationCode}] 입니다. 5분 안에 입력해주세요.`
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: '인증번호가 메일로 발송되었습니다.' });

    } catch (error) {
        console.error('이메일 발송 실패:', error);
        res.status(500).json({ message: '이메일 발송 중 오류가 발생했습니다.' });
    }
};

// 5. 이메일 인증번호 확인
exports.verifyEmail = async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ message: '이메일과 인증번호를 입력해주세요.' });
    }

    try {
        const checkQuery = `
            SELECT * FROM email_verifications 
            WHERE email = ? AND code = ? AND expires_at > NOW() 
            ORDER BY created_at DESC LIMIT 1
        `;
        const [rows] = await dbPool.query(checkQuery, [email, code]);

        if (rows.length === 0) {
            return res.status(400).json({ message: '인증번호가 일치하지 않거나 만료되었습니다.' });
        }

        res.status(200).json({ message: '이메일 인증이 완료되었습니다!' });

    } catch (error) {
        console.error('인증번호 확인 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 6. 비밀번호 찾기 (임시 비번 발송)
exports.resetPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: '이메일을 입력해주세요.' });
    }

    try {
        const [users] = await dbPool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: '가입되지 않은 이메일입니다.' });
        }

        const tempPassword = Math.random().toString(36).slice(-8); 
        const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);

        await dbPool.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);

        const mailOptions = {
            from: `야놀자클론 <${transporter.options.auth.user}>`,
            to: email,
            subject: '[야놀자 서비스] 임시 비밀번호 안내입니다.',
            text: `회원님의 임시 비밀번호는 [ ${tempPassword} ] 입니다. \n로그인 후 반드시 비밀번호를 변경해주세요.`
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: '임시 비밀번호가 이메일로 발송되었습니다.' });

    } catch (error) {
        console.error('비밀번호 재설정 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};