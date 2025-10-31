const createAuthClient = require('../utils/createAuthClient');

const getBudgets = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { month, year } = req.query;
    
    let query = supabaseAuth
      .from('budgets')
      .select('*');
      // [DIHAPUS] .eq('user_id', req.user.id); // RLS menangani

    if (month && year) {
      query = query.eq('month', parseInt(month)).eq('year', parseInt(year));
    }
    const { data: budgets, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true, data: budgets });
  } catch (error) {
    console.error('Budgets fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const createOrUpdateBudget = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { amount, month, year, category_name } = req.body;
    
    // [Perbaikan] Parsing amount di awal
    const finalAmount = parseFloat(amount) || 0;

    const { data: existingBudget } = await supabaseAuth
      .from('budgets')
      .select('id')
      // [DIHAPUS] .eq('user_id', req.user.id) // RLS menangani
      .eq('month', parseInt(month))
      .eq('year', parseInt(year))
      .eq('category_name', category_name)
      .single();

    let result;
    let message = 'Budget is 0, no entry created or updated.'; // Default message

    // [MODIFIKASI] Logika baru untuk DELETE, UPDATE, atau CREATE
    if (existingBudget && finalAmount === 0) { 
      // Kasus 1: Budget sudah ada dan di-reset ke 0 -> Hapus
      result = await supabaseAuth
        .from('budgets')
        .delete()
        .eq('id', existingBudget.id)
        .select()
        .single();
      message = 'Budget reset successfully';
    } else if (existingBudget && finalAmount > 0) {
      // Kasus 2: Budget sudah ada dan di-update
      result = await supabaseAuth
        .from('budgets')
        .update({
          amount: finalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingBudget.id)
        .select()
        .single();
      message = 'Budget updated successfully';
    } else if (!existingBudget && finalAmount > 0) {
      // Kasus 3: Budget belum ada dan di-create
      result = await supabaseAuth
        .from('budgets')
        .insert([
          {
            user_id: req.user.id, // RLS Policy (WITH CHECK) akan memvalidasi ini
            amount: finalAmount,
            month: parseInt(month),
            year: parseInt(year),
            category_name: category_name
          }
        ])
        .select()
        .single();
      message = 'Budget created successfully';
    } else {
      // Kasus 4: Budget belum ada dan amount-nya 0 (Tidak ada yang dilakukan)
      return res.status(200).json({
        success: true,
        message: message,
        data: null
      });
    }

    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }

    res.status(message.includes('created') ? 201 : 200).json({
      success: true,
      message: message,
      data: result.data
    });
  } catch (error) {
    console.error('Budget creation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const deleteBudget = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    const { id } = req.params; 

    const { data, error } = await supabaseAuth
      .from('budgets')
      .delete()
      .eq('id', id)
      // [DIHAPUS] .eq('user_id', req.user.id) // RLS menangani
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found or user not authorized'
      });
    }

    res.json({
      success: true,
      message: `Budget pocket deleted successfully`
    });

  } catch (error) {
    console.error('Budget deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  getBudgets,
  createOrUpdateBudget,
  deleteBudget
};