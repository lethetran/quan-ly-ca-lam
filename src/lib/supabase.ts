import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // Chưa cấu hình .env — app vẫn render màn hình hướng dẫn cấu hình
  console.warn('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — hãy copy .env.example thành .env và điền key.')
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const BUCKET = 'hrfiles'
