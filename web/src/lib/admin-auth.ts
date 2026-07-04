import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const ADMIN_COOKIE_NAME = 'sofra_admin_import';
const ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hasAdminImportPassword(): boolean {
  return Boolean(process.env.ADMIN_IMPORT_PASSWORD);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const configuredPassword = process.env.ADMIN_IMPORT_PASSWORD;

  if (!configuredPassword) return false;

  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!sessionValue) return false;

  return safeEqual(sessionValue, sha256(configuredPassword));
}

export async function createAdminSession(password: string): Promise<boolean> {
  const configuredPassword = process.env.ADMIN_IMPORT_PASSWORD;

  if (!configuredPassword || !safeEqual(password, configuredPassword)) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, sha256(configuredPassword), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_WEEK_IN_SECONDS,
  });

  return true;
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
