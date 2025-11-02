const createAuthClient = require('../utils/createAuthClient');

// Mendapatkan semua target tabungan
const getSavingsGoals = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    
    // [MODIFIKASI] Hapus filter bulan, tampilkan SEMUA goals
    // Goal harus selalu ditampilkan terlepas dari bulan yang dipilih.

    let query = supabaseAuth
      .from('savings_goals')
      .select('*')
      .order('created_at', { ascending: false });

    // Logika filtering bulan/tahun di sini dihapus karena goals harus selalu ditampilkan

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get savings goals error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// Membuat target tabungan baru
const createSavingsGoal = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token); 
    const { name, target_amount, target_date } = req.body; 

    const { data, error } = await supabaseAuth
      .from('savings_goals')
      .insert({
        user_id: req.user.id, 
        name: name,
        target_amount: parseFloat(target_amount),
        target_date: target_date || null 
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Create savings goal error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// Menambahkan dana ke tabungan (Memanggil Fungsi RPC)
const addFundsToSavings = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token); 
    const { goal_id, amount, date } = req.body;

    const { error } = await supabaseAuth.rpc('add_to_savings', {
      goal_id: goal_id,
      amount_to_add: parseFloat(amount),
      transaction_date: date || new Date().toISOString().split('T')[0]
    });

    if (error) throw error;
    res.json({ success: true, message: 'Dana berhasil ditambahkan ke tabungan' });
  } catch (error) {
    console.error('Add funds to savings error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// Menghapus target tabungan
const deleteSavingsGoal = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token); 
    const { id } = req.params;

    const { data, error } = await supabaseAuth
      .from('savings_goals')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Target tabungan tidak ditemukan' });
    }

    res.json({ success: true, message: 'Target tabungan dihapus' });
  } catch (error) {
    console.error('Delete savings goal error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

module.exports = {
  getSavingsGoals,
  createSavingsGoal,
  addFundsToSavings,
  deleteSavingsGoal
};