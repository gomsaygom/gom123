/**
 * [회원 개인 기능 로직]
 * - 내 정보 조회 및 수정 (마이페이지)
 * - 비밀번호 변경
 * - 최근 본 숙소 목록 조회
 * - 찜하기(Favorite) 추가, 삭제, 목록 조회
 */

const dbPool = require('../config/database');
const bcrypt = require('bcrypt');
const { saltRounds } = require('../config/secrets');

// 1. 내 정보 조회
exports.getMe = async (req, res) => {
    const { userId } = req.user; 

    try {
        const query = `
            SELECT user_id, name, email, phone, role_code, created_at
            FROM users WHERE user_id = ?
        `;
        const [rows] = await dbPool.query(query, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        res.status(200).json({ user: rows[0] });

    } catch (error) {
        console.error('내 정보 조회 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 2. 내 정보 수정
exports.updateMe = async (req, res) => {
    const { userId } = req.user;
    const { name, phone } = req.body;

    if (!name && !phone) {
        return res.status(400).json({ message: '수정할 이름이나 전화번호를 입력해주세요.' });
    }

    try {
        let updateQuery = 'UPDATE users SET ';
        const params = [];

        if (name) {
            updateQuery += 'name = ?, ';
            params.push(name);
        }
        if (phone) {
            updateQuery += 'phone = ?, ';
            params.push(phone);
        }

        updateQuery = updateQuery.slice(0, -2) + ' WHERE user_id = ?';
        params.push(userId);

        await dbPool.query(updateQuery, params);
        res.status(200).json({ message: '내 정보가 수정되었습니다.' });

    } catch (error) {
        console.error('내 정보 수정 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 3. 비밀번호 변경
exports.updatePassword = async (req, res) => {
    const { userId } = req.user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' });
    }

    try {
        const [users] = await dbPool.query('SELECT password FROM users WHERE user_id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ message: '사용자 없음' });

        const isMatch = await bcrypt.compare(currentPassword, users[0].password);
        if (!isMatch) return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });

        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        await dbPool.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedPassword, userId]);

        res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });

    } catch (error) {
        console.error('비밀번호 변경 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 4. 최근 본 숙소 목록 조회
exports.getRecentViews = async (req, res) => {
    const { userId } = req.user; 

    try {
        const sql = `
            SELECT 
                a.accommodation_id, a.name, a.main_image_url, a.region_city, r.viewed_at
            FROM recently_viewed r
            JOIN Accommodation a ON r.accommodation_id = a.accommodation_id
            WHERE r.user_id = ? 
            AND r.viewed_at > DATE_SUB(NOW(), INTERVAL 1 MONTH) 
            ORDER BY r.viewed_at DESC
        `;
        const [rows] = await dbPool.query(sql, [userId]);
        res.status(200).json(rows);

    } catch (err) {
        console.error('최근 본 목록 조회 오류:', err);
        res.status(500).json({ message: '서버 오류' });
    }
};

// 5. 찜 추가
exports.addFavorite = async (req, res) => {
    const { userId } = req.user; 
    const { accommodation_id } = req.body;

    if (!accommodation_id) return res.status(400).json({ message: '숙소 ID가 필요합니다.' });

    try {
        const query = 'INSERT INTO Favorite (user_id, accommodation_id) VALUES (?, ?)';
        await dbPool.query(query, [userId, accommodation_id]);
        res.status(201).json({ message: '찜 목록에 추가되었습니다!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: '이미 찜 목록에 있습니다.' });
        res.status(500).json({ message: '서버 오류' });
    }
};

// 6. 찜 삭제
exports.removeFavorite = async (req, res) => {
    const { userId } = req.user; 
    const { id: favoriteId } = req.params;

    try {
        const [result] = await dbPool.query('DELETE FROM Favorite WHERE favorite_id = ? AND user_id = ?', [favoriteId, userId]);
        if (result.affectedRows === 0) return res.status(403).json({ message: '삭제 권한이 없거나 존재하지 않습니다.' });
        res.status(200).json({ message: '찜 목록에서 삭제되었습니다.' });
    } catch (error) {
        res.status(500).json({ message: '서버 오류' });
    }
};

// 7. 내 찜 목록 조회
exports.getFavorites = async (req, res) => {
    const { userId } = req.user; 
    try {
        const query = `
            SELECT f.favorite_id, f.created_at, a.accommodation_id, a.name, a.address, a.region_city
            FROM Favorite AS f
            JOIN Accommodation AS a ON f.accommodation_id = a.accommodation_id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        `;
        const [favorites] = await dbPool.query(query, [userId]);
        res.status(200).json(favorites);
    } catch (error) {
        res.status(500).json({ message: '서버 오류' });
    }
};