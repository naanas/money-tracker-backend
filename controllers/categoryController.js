const supabase = require('../config/database');

const getAllCategories = async (req, res) => {
  try {
    // === [MODIFIKASI KUERI UTAMA] ===
    // Ambil kategori di mana user_id = user yang login ATAU user_id = null (default)
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${req.user.id},user_id.is.null`) // Mengambil milik user ATAU default
      .order('name');
    // === [AKHIR MODIFIKASI] ===

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

// === [FUNGSI CREATE DIMODIFIKASI] ===
const createCategory = async (req, res) => {
  try {
    const { name, type, icon, color } = req.body;
    
    // === [MODIFIKASI] ===
    // Sekarang kita tambahkan user_id dari middleware auth
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
    // === [AKHIR MODIFIKASI] ===

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
// === [AKHIR FUNGSI CREATE] ===

module.exports = {
  getAllCategories,
  createCategory
};