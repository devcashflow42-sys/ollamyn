import bcrypt from 'bcryptjs';
import { env } from '../config/env';

/** Hashea una contraseña en texto plano con bcrypt. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

/** Compara una contraseña en texto plano con su hash. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
