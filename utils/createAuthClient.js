const { createClient } = require('@supabase/supabase-js');

/**
 * Membuat instance Supabase client yang diautentikasi
 * untuk satu request, menggunakan token JWT user.
 * Ini memastikan RLS diterapkan dengan benar di sisi server.
 */
const createAuthClient = (token) => {
  if (!token) {
    throw new Error("Supabase client auth token is missing.");
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` }
      }
    }
  );
};

module.exports = createAuthClient;