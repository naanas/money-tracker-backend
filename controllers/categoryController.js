const supabase = require('../config/database');

const getAllCategories = async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${req.user.id},user_id.is.null`) 
      .order('name');

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, type, icon, color } = req.body;
    const { data: category, error } = await supabase
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
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// === [FUNGSI BARU UNTUK UPDATE/EDIT] ===
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, icon, color } = req.body;

    const { data, error } = await supabase
      .from('categories')
      .update({
        name: name.trim(),
        type,
        icon: icon || null,
        color: color || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id) // Hanya bisa edit milik sendiri
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
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// === [FUNGSI DELETE DIMODIFIKASI] ===
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params; 

    // 1. Ambil nama kategori
    const { data: category, error: findError } = await supabase
      .from('categories')
      .select('name')
      .eq('id', id)
      .eq('user_id', req.user.id) // Hanya bisa hapus milik sendiri
      .single();

    if (findError || !category) {
      return res.status(404).json({
        success: false,
        error: 'Kategori tidak ditemukan atau Anda tidak punya izin'
      });
    }

    // 2. Cek apakah ada transaksi yang menggunakan kategori ini
    const { count, error: txError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('category', category.name);

    if (txError) {
      return res.status(500).json({ success: false, error: txError.message });
    }

    // 3. Jika ada transaksi, blok penghapusan
    if (count > 0) {
      return res.status(409).json({ // 409 Conflict
        success: false,
        error: `Kategori tidak dapat dihapus karena masih digunakan oleh ${count} transaksi.`
      });
    }

    // 4. Jika tidak ada transaksi, hapus kategori
    const { data, error } = await supabase
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
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
// === [AKHIR MODIFIKASI] ===

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory, 
  deleteCategory  
};