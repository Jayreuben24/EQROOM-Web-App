// Import the Supabase client library from the CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Replace these with your actual Supabase project credentials
const supabaseUrl = 'https://abvegwcbrdrddvnonmuo.supabase.co'
const supabaseKey = 'sb_publishable_1Nz2tDVakyE5H9BPuBQIaw_eKNKg2Z5'

// Create and export the Supabase client so other files can use it
export const supabase = createClient(supabaseUrl, supabaseKey)