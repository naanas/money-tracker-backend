const createAuthClient = require('../utils/createAuthClient');

// Mendapatkan semua target tabungan
const getSavingsGoals = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token); // <-- Menggunakan client terautentikasi
    
    // RLS (Row Level Security) akan otomatis memfilter berdasarkan user_id
    const { data, error } = await supabaseAuth
      .from('savings_goals')
      .select('*')
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
    const supabaseAuth = createAuthClient(req.token); // <-- Menggunakan client terautentikasi
    const { name, target_amount } = req.body;

    // Kita tetap harus memasukkan user_id secara eksplisit 
    // karena RLS INSERT policy kita memerlukannya (WITH CHECK)
    const { data, error } = await supabaseAuth
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
    const supabaseAuth = createAuthClient(req.token); // <-- Menggunakan client terautentikasi
    const { goal_id, amount, date } = req.body;

    // Panggil RPC menggunakan client yang sudah diautentikasi
    // auth.uid() di dalam fungsi SQL sekarang akan berfungsi
    const { error } = await supabaseAuth.rpc('add_to_savings', {
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
    const supabaseAuth = createAuthClient(req.token); // <-- Menggunakan client terautentikasi
    const { id } = req.params;

    // RLS akan mencegah penghapusan jika bukan milik user
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