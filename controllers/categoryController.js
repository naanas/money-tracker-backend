const supabase = require('../config/database');

const getAllCategories = async (req, res) => {
  try {
    // Kueri ini sudah benar untuk skema Anda (mengambil semua kategori global)
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
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

// === [FUNGSI BARU DITAMBAHKAN] ===
const createCategory = async (req, res) => {
  try {
    const { name, type, icon, color } = req.body;
    
    // Insert ke tabel global, tanpa user_id, sesuai skema
    const { data: category, error } = await supabase
      .from('categories')
      .insert([
        { 
          name: name.trim(), 
          type,
          icon: icon || null, // Atur ke null jika tidak disediakan
          color: color || null // Atur ke null jika tidak disediakan
        }
      ])
      .select()
      .single();

    if (error) {
      // Menangani jika kategori sudah ada (pelanggaran unik)
      if (error.code === '23505') { 
        return res.status(409).json({ // 409 Conflict
          success: false,
          error: 'Category with this name and type already exists'
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.status(201).json({ // 201 Created
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
// === [AKHIR FUNGSI BARU] ===

module.exports = {
  getAllCategories,
  createCategory // [BARU] Ekspor fungsi baru
};