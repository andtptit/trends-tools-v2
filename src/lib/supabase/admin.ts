import { createClient } from '@supabase/supabase-js';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your_') 
  ? process.env.SUPABASE_SERVICE_ROLE_KEY 
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceKey!
);
