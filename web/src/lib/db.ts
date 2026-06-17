import { neon } from '@neondatabase/serverless';

// DATABASE_URL doit être définie en env var Vercel (prod + staging) et dans .env.local (dev).
export const sql = neon(process.env.DATABASE_URL!);
