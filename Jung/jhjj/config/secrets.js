/**
 * [비밀키 관리]
 * JWT 토큰 생성에 필요한 Secret Key, 비밀번호 암호화(Salt) 설정 등
 * 보안과 관련된 중요한 상수들을 모아둔 파일입니다.
 */

module.exports = {
    saltRounds: 10,
    JWT_SECRET_KEY: '1234ad',
    JWT_REFRESH_SECRET_KEY: '12345ad'
};