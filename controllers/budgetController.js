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

    const { data: existingBudget } = await supabaseAuth
      .from('budgets')
      .select('id')
      // [DIHAPUS] .eq('user_id', req.user.id) // RLS menangani
      .eq('month', parseInt(month))
      .eq('year', parseInt(year))
      .eq('category_name', category_name)
      .single();

    let result;
    
    if (existingBudget && parseFloat(amount) === 0) {
      result = await supabaseAuth
        .from('budgets')
        .delete()
        .eq('id', existingBudget.id)
        .select()
        .single();
    } else if (existingBudget) {
      result = await supabaseAuth
        .from('budgets')
        .update({
          amount: parseFloat(amount),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingBudget.id)
        .select()
        .single();
    } else if (!existingBudget && parseFloat(amount) > 0) {
      result = await supabaseAuth
        .from('budgets')
        .insert([
          {
            user_id: req.user.id, // RLS Policy (WITH CHECK) akan memvalidasi ini
            amount: parseFloat(amount),
            month: parseInt(month),
            year: parseInt(year),
            category_name: category_name
          }
        ])
        .select()
        .single();
    } else {
      return res.status(200).json({
        success: true,
        message: 'Budget set to 0, no entry created.',
        data: null
      });
    }

    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }

    res.status(existingBudget ? 200 : 201).json({
      success: true,
      message: existingBudget ? 'Budget updated successfully' : 'Budget created successfully',
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