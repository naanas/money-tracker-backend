const supabase = require('../config/database');

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

const createOrUpdateBudget = async (req, res) => {
  try {
    const { amount, month, year } = req.body;

    // Check if budget exists
    const { data: existingBudget } = await supabase
      .from('budgets')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('month', parseInt(month))
      .eq('year', parseInt(year))
      .single();

    let result;
    
    if (existingBudget) {
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
      result = await supabase
        .from('budgets')
        .insert([
          {
            user_id: req.user.id,
            amount: parseFloat(amount),
            month: parseInt(month),
            year: parseInt(year)
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

module.exports = {
  getBudgets,
  createOrUpdateBudget
};