const supabase = require('../config/database');

const getAllCategories = async (req, res) => {
  try {
    // Ambil kategori di mana user_id = user yang login ATAU user_id = null (default)
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${req.user.id},user_id.is.null`) // Mengambil milik user ATAU default
      .order('name');

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, type, icon, color } = req.body;
    
    // Tambahkan user_id dari middleware auth
    const { data: category, error } = await supabase
      .from('categories')
      .insert([
        { 
          name: name.trim(), 
          type,
          icon: icon || null,
          color: color || null,
          user_id: req.user.id // Tautkan kategori ini ke user
        }
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { 
        return res.status(409).json({
          success: false,
          error: 'You already have a category with this name and type'
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });

  } catch (error) {
    console.error('Category creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// === [FUNGSI BARU DITAMBAHKAN] ===
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params; // Ambil ID kategori dari URL

    // Hapus kategori HANYA JIKA ID-nya cocok DAN user_id-nya cocok
    // Ini secara otomatis mencegah user menghapus kategori default (yang user_id-nya NULL)
    const { data, error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id) // Paling penting!
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    // Jika data-nya null, berarti kategori itu tidak ditemukan ATAU bukan milik user
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Category not found or you do not have permission to delete it'
      });
    }

    res.json({
      success: true,
      message: 'Category deleted successfully',
      data: data
    });

  } catch (error) {
    console.error('Category deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
// === [AKHIR FUNGSI BARU] ===

module.exports = {
  getAllCategories,
  createCategory,
  deleteCategory // [BARU] Ekspor fungsi baru
};