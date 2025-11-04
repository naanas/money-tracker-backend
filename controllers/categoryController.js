// naanas/money-tracker-backend/controllers/categoryController.js
const createAuthClient = require('../utils/createAuthClient');
const redisClient = require('../config/redisClient'); // Impor

// [MODIFIKASI] getAllCategories dengan Caching
const getAllCategories = async (req, res) => {
  const userId = req.user.id;
  const cacheKey = `categories:${userId}`;
  const CACHE_TTL = 3600 * 6; // Cache 6 jam

  try {
    // 1. Coba dari Cache
    if (redisClient.isOpen) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.json({ success: true, data: cachedData, fromCache: true });
      }
    }
    
    // 2. Query Supabase
    const supabaseAuth = createAuthClient(req.token);
    const { data: categories, error } = await supabaseAuth
      .from('categories')
      .select('*')
      .order('name');
      
    if (error) throw error;
    
    // 3. Simpan di Cache
    if (redisClient.isOpen) {
      await redisClient.set(cacheKey, categories, { ex: CACHE_TTL });
    }

    res.json({ success: true, data: categories, fromCache: false });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// [BARU] Helper invalidation
const invalidateCategoryCache = async (userId) => {
  if (redisClient.isOpen) {
    await redisClient.del(`categories:${userId}`);
  }
};

// [MODIFIKASI] createCategory
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
          user_id: req.user.id
        }
      ])
      .select()
      .single();

    if (error) { /* ... (error handling) ... */
      if (error.code === '23505') { 
        return res.status(409).json({ success: false, error: 'Anda sudah memiliki kategori dengan nama dan tipe ini' });
      }
      return res.status(500).json({ success: false, error: error.message });
    }
    
    await invalidateCategoryCache(req.user.id); // Invalidate
    res.status(201).json({ success: true, message: 'Category created successfully', data: category });
  } catch (error) {
    console.error('Category creation error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// [MODIFIKASI] updateCategory
const updateCategory = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params;
    const { name, type, icon, color } = req.body;

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
      .select()
      .single();

    if (error) { /* ... (error handling) ... */
      if (error.code === '23505') { 
        return res.status(409).json({ success: false, error: 'Anda sudah memiliki kategori lain dengan nama dan tipe ini' });
      }
      return res.status(500).json({ success: false, error: error.message });
    }
    if (!data) {
      return res.status(404).json({ success: false, error: 'Kategori tidak ditemukan' });
    }
    
    await invalidateCategoryCache(req.user.id); // Invalidate
    res.json({ success: true, message: 'Category updated successfully', data });

  } catch (error) {
    console.error('Category update error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// [MODIFIKASI] deleteCategory
const deleteCategory = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params; 

    // ... (Cek transaksi) ...
    const { data: category, error: findError } = await supabaseAuth
      .from('categories')
      .select('name')
      .eq('id', id)
      .single();
    if (findError || !category) {
      return res.status(404).json({ success: false, error: 'Kategori tidak ditemukan' });
    }
    const { count, error: txError } = await supabaseAuth
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('category', category.name);
    if (txError) {
      return res.status(500).json({ success: false, error: txError.message });
    }
    if (count > 0) {
      return res.status(409).json({ success: false, error: `Kategori tidak dapat dihapus karena masih digunakan oleh ${count} transaksi.` });
    }
    // ... (Akhir cek)

    const { data, error } = await supabaseAuth
      .from('categories')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    await invalidateCategoryCache(req.user.id); // Invalidate
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