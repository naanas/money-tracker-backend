// naanas/money-tracker-backend/config/redisClient.js
const { createClient } = require('@vercel/kv');

// Cek jika variabel env Vercel KV ada (ini diinjeksi otomatis oleh Vercel)
if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  console.warn('⚠️ Variabel Vercel KV (KV_REST_API_URL, KV_REST_API_TOKEN) tidak ditemukan.');
  console.warn('Caching akan dinonaktifkan. Hubungkan Vercel KV di dashboard Vercel Anda.');

  // Mengembalikan objek "dummy" agar aplikasi tidak crash
  module.exports = {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(null),
    del: () => Promise.resolve(null),
    // Properti dummy 'isOpen' agar controller tidak error
    isOpen: false
  };
} else {
  const kvClient = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
  
  console.log('✅ Terhubung ke Vercel KV');

  // Buat wrapper agar kompatibel dengan kode kita (memiliki properti .isOpen)
  module.exports = {
    ...kvClient,
    isOpen: true // Selalu anggap terbuka jika env ada
  };
}