const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[ELOP] FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  console.error('[ELOP] SUPABASE_URL set:', !!SUPABASE_URL);
  console.error('[ELOP] SUPABASE_SERVICE_KEY set:', !!SUPABASE_SERVICE_KEY);
  console.error('[ELOP] KEY prefix:', SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.slice(0, 10) : 'none');
}

// Service role client — bypasses RLS, used server-side only
const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_KEY || 'placeholder',
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

module.exports = supabase;
