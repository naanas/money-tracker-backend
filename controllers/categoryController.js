const createAuthClient = require('../utils/createAuthClient');
// [PERBAIKAN] Supabase anon tidak lagi diperlukan di sini
// const supabase = require('../config/database'); 

const getAllCategories = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    
    // === [BLOK PERBAIKAN] ===
    // Dengan RLS policy (user_id = auth.uid()) OR (user_id IS NULL),
    // kita bisa mengambil kategori custom DAN default dalam satu panggilan
    
    const { data: categories, error } = await supabaseAuth
      .from('categories')
      .select('*')
      // RLS akan menangani filter user_id ATAU user_id IS NULL
      .order('name');
      
    if (error) throw error;
    // === [AKHIR BLOK PERBAIKAN] ===

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
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
          user_id: req.user.id // RLS Policy (WITH CHECK) akan memvalidasi ini
        }
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { 
        return res.status(409).json({
          success: false,
          error: 'Anda sudah memiliki kategori dengan nama dan tipe ini'
        });
      }
      return res.status(500).json({ success: false, error: error.message });
    }
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
      // .eq('user_id', req.user.id) // RLS akan menangani ini
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { 
        return res.status(409).json({
          success: false,
          error: 'Anda sudah memiliki kategori lain dengan nama dan tipe ini'
        });
      }
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Kategori tidak ditemukan atau Anda tidak punya izin'
      });
    }
    
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

    // 1. Ambil nama kategori (menggunakan RLS)
    const { data: category, error: findError } = await supabaseAuth
      .from('categories')
      .select('name')
      .eq('id', id)
      .single();

    if (findError || !category) {
      return res.status(404).json({
        success: false,
        error: 'Kategori tidak ditemukan atau Anda tidak punya izin'
      });
    }

    // 2. Cek apakah ada transaksi yang menggunakan kategori ini (menggunakan RLS)
    const { count, error: txError } = await supabaseAuth
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('category', category.name);

    if (txError) {
      return res.status(500).json({ success: false, error: txError.message });
    }

    if (count > 0) {
      return res.status(409).json({ // 409 Conflict
        success: false,
        error: `Kategori tidak dapat dihapus karena masih digunakan oleh ${count} transaksi.`
      });
    }

    // 4. Hapus kategori (menggunakan RLS)
    const { data, error } = await supabaseAuth
      .from('categories')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

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