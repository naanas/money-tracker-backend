// naanas/money-tracker-backend/controllers/categoryController.js
const createAuthClient = require('../utils/createAuthClient');
const redisClient = require('../config/redisClient');

// [PERBAIKAN FATAL] Filter kategori berdasarkan User ID
const getAllCategories = async (req, res) => {
  const userId = req.user.id;
  // Cache key harus unik per user agar tidak tercampur!
  const cacheKey = `categories:${userId}`;
  const CACHE_TTL = 3600 * 6; // 6 jam

  try {
    if (redisClient.isOpen) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.json({ success: true, data: JSON.parse(cachedData), fromCache: true });
      }
    }
    
    const supabaseAuth = createAuthClient(req.token);
    const { data: categories, error } = await supabaseAuth
      .from('categories')
      .select('*')
      // [LOGIKA BARU] Ambil yang public (user_id is null) ATAU milik user ini
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('name');
      
    if (error) throw error;
    
    if (redisClient.isOpen) {
      await redisClient.set(cacheKey, JSON.stringify(categories), { EX: CACHE_TTL });
    }

    res.json({ success: true, data: categories, fromCache: false });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

const invalidateCategoryCache = async (userId) => {
  if (redisClient.isOpen) {
    await redisClient.del(`categories:${userId}`);
  }
};

const createCategory = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { name, type, icon, color } = req.body;
    const { data: category, error } = await supabaseAuth
      .from('categories')
      .insert([
        { 
          name: name.trim(), 
          type,
          icon: icon || null,
          color: color || null,
          user_id: req.user.id // Pastikan kategori baru tersimpan dengan ID user
        }
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { 
        return res.status(409).json({ success: false, error: 'Kategori ini sudah ada.' });
      }
      return res.status(500).json({ success: false, error: error.message });
    }
    
    await invalidateCategoryCache(req.user.id);
    res.status(201).json({ success: true, message: 'Category created successfully', data: category });
  } catch (error) {
    console.error('Category creation error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params;
    const { name, type, icon, color } = req.body;

    // Pastikan hanya bisa update kategori milik sendiri
    const { data, error } = await supabaseAuth
      .from('categories')
      .update({
        name: name.trim(),
        type,
        icon: icon || null,
        color: color || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id) // KUNCI KEAMANAN: Cek kepemilikan
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    if (!data) {
      return res.status(404).json({ success: false, error: 'Kategori tidak ditemukan atau bukan milik Anda' });
    }
    
    await invalidateCategoryCache(req.user.id);
    res.json({ success: true, message: 'Category updated successfully', data });

  } catch (error) {
    console.error('Category update error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params; 

    // 1. Cek kepemilikan sebelum hapus
    const { data: category, error: findError } = await supabaseAuth
      .from('categories')
      .select('name')
      .eq('id', id)
      .eq('user_id', req.user.id) // KUNCI KEAMANAN
      .single();

    if (findError || !category) {
      return res.status(404).json({ success: false, error: 'Kategori tidak ditemukan atau bukan milik Anda' });
    }

    // 2. Cek apakah sedang dipakai transaksi
    const { count, error: txError } = await supabaseAuth
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('category', category.name)
      .eq('user_id', req.user.id); // Cek transaksi milik user ini saja

    if (txError) {
      return res.status(500).json({ success: false, error: txError.message });
    }
    if (count > 0) {
      return res.status(409).json({ success: false, error: `Kategori ini masih dipakai di ${count} transaksi Anda.` });
    }

    // 3. Hapus
    const { data, error } = await supabaseAuth
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    await invalidateCategoryCache(req.user.id);
    res.json({ success: true, message: 'Category deleted successfully', data: data });

  } catch (error) {
    console.error('Category deletion error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory, 
  deleteCategory  
};