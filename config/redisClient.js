// naanas/money-tracker-backend/config/redisClient.js
const { createClient } = require('redis');
const environment = require('./environment');

// [PERBAIKAN] Kita cek 'redisUrl' dari environment
if (!environment.redisUrl) {
  console.warn('⚠️ REDIS_URL tidak ditemukan. Caching akan dinonaktifkan.');
  // Mengembalikan objek "dummy" agar aplikasi tidak crash
  module.exports = {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(null),
    del: () => Promise.resolve(null),
    on: () => {},
    connect: () => Promise.resolve(null),
    isOpen: false
  };
} else {
  const redisClient = createClient({
    url: environment.redisUrl
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('✅ Terhubung ke Redis');
  });

  // Mulai koneksi di latar belakang
  redisClient.connect().catch(console.error);

  module.exports = redisClient;
}