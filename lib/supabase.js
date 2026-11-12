// The one Supabase client. The URL and the publishable key are public by design (the database's row level security is
// the lock); the secret key must never be used here. Next.js only exposes names that start with NEXT_PUBLIC_.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// null when the two settings are missing (see .env.example); callers turn that into a readable message
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export const BUCKET = 'task-photos';
