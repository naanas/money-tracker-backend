const supabase = require('../config/database');

// getBudgets (Tidak berubah)
const getBudgets = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    let query = supabase
      .from('budgets')
      .select('*')
      .eq('user_id', req.user.id);

    if (month && year) {
      query = query.eq('month', parseInt(month)).eq('year', parseInt(year));
    }

    const { data: budgets, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data: budgets
    });
  } catch (error) {
    console.error('Budgets fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// createOrUpdateBudget (Tidak berubah)
const createOrUpdateBudget = async (req, res) => {
  try {
    const { amount, month, year, category_name } = req.body;

    // Cek apakah budget untuk KATEGORI INI sudah ada
    const { data: existingBudget } = await supabase
      .from('budgets')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('month', parseInt(month))
      .eq('year', parseInt(year))
      .eq('category_name', category_name) 
      .single();

    let result;
    
    if (existingBudget) {
      // JIKA SUDAH ADA: UPDATE
      result = await supabase
        .from('budgets')
        .update({
          amount: parseFloat(amount),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingBudget.id)
        .select()
        .single();
    } else {
      // JIKA BELUM ADA: INSERT
      result = await supabase
        .from('budgets')
        .insert([
          {
            user_id: req.user.id,
            amount: parseFloat(amount),
            month: parseInt(month),
            year: parseInt(year),
            category_name: category_name 
          }
        ])
        .select()
        .single();
    }

    if (result.error) {
      return res.status(500).json({
        success: false,
        error: result.error.message
      });
    }

    res.status(existingBudget ? 200 : 201).json({
      success: true,
      message: existingBudget ? 'Budget updated successfully' : 'Budget created successfully',
      data: result.data
    });
  } catch (error) {
    console.error('Budget creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// === [FUNGSI BARU DITAMBAHKAN] ===
const deleteBudget = async (req, res) => {
  try {
    const { id } = req.params; // Ambil ID budget dari URL

    // Hapus budget HANYA JIKA ID-nya cocok DAN user_id-nya cocok
    const { data, error } = await supabase
      .from('budgets')
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

    // Jika data-nya null, berarti budget itu tidak ditemukan ATAU bukan milik user
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found or you do not have permission to delete it'
      });
    }

    res.json({
      success: true,
      message: 'Budget deleted successfully',
      data: data
    });

  } catch (error) {
    console.error('Budget deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
// === [AKHIR FUNGSI BARU] ===

module.exports = {
  getBudgets,
  createOrUpdateBudget,
  deleteBudget // [BARU] Ekspor fungsi baru
};