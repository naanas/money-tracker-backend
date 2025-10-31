const supabase = require('../config/database');

// Mendapatkan semua target tabungan
const getSavingsGoals = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get savings goals error:', error);
    // [MODIFIKASI] Tampilkan pesan error asli
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// Membuat target tabungan baru
const createSavingsGoal = async (req, res) => {
  try {
    const { name, target_amount } = req.body;

    const { data, error } = await supabase
      .from('savings_goals')
      .insert({
        user_id: req.user.id,
        name: name,
        target_amount: parseFloat(target_amount)
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Create savings goal error:', error);
    // [MODIFIKASI] Tampilkan pesan error asli
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// Menambahkan dana ke tabungan (Memanggil Fungsi RPC)
const addFundsToSavings = async (req, res) => {
  try {
    const { goal_id, amount, date } = req.body;

    // Ini memanggil fungsi 'add_to_savings' yang Anda buat di Supabase
    const { error } = await supabase.rpc('add_to_savings', {
      goal_id: goal_id,
      amount_to_add: parseFloat(amount),
      transaction_date: date || new Date().toISOString().split('T')[0]
    });

    if (error) throw error;

    res.json({ success: true, message: 'Dana berhasil ditambahkan ke tabungan' });
  } catch (error) {
    console.error('Add funds to savings error:', error);
    // [MODIFIKASI] Tampilkan pesan error asli
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// Menghapus target tabungan
const deleteSavingsGoal = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Target tabungan tidak ditemukan' });
    }

    res.json({ success: true, message: 'Target tabungan dihapus' });
  } catch (error) {
    console.error('Delete savings goal error:', error);
    // [MODIFIKASI] Tampilkan pesan error asli
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

module.exports = {
  getSavingsGoals,
  createSavingsGoal,
  addFundsToSavings,
  deleteSavingsGoal
};