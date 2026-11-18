import bcrypt from 'bcrypt';

export const BCRYPT_SALT_ROUNDS = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}
