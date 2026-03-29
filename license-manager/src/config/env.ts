import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const env = {
  PORT: parseInt(process.env.PORT ?? '8080', 10),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  ADMIN_API_KEY: required('ADMIN_API_KEY'),
  ED25519_PRIVATE_KEY: process.env.ED25519_PRIVATE_KEY ?? '',
  ED25519_PUBLIC_KEY: process.env.ED25519_PUBLIC_KEY ?? '',
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? '*').split(',').map(s => s.trim()),
  APP_SLUG: process.env.APP_SLUG ?? 'dispara-zapp',
};

export const APP_SLUG = env.APP_SLUG;
