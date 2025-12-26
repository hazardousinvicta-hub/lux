import { createClient } from '@supabase/supabase-js';

// Environment variables - be explicit about what's required
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Prefer service role key (bypasses RLS) for server-side operations
// Fall back to anon key for client-side operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validation - fail fast with clear errors
if (!supabaseUrl) {
    throw new Error('[Supabase] NEXT_PUBLIC_SUPABASE_URL environment variable is required');
}

if (!supabaseKey) {
    throw new Error('[Supabase] Either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
}

// Log which key type is being used (helpful for debugging)
if (typeof window === 'undefined') {
    // Server-side only logging
    const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon';
    console.log(`[Supabase] Initialized with ${keyType} key`);
}

export const supabase = createClient(supabaseUrl, supabaseKey);
