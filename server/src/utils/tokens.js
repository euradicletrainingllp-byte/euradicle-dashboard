const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, org_id: user.org_id },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setRefreshCookie(res, token) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('refresh_token');
}

module.exports = { generateAccessToken, generateRefreshToken, generateResetToken, setRefreshCookie, clearRefreshCookie };
