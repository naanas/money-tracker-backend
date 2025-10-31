const createAuthClient = require('../utils/createAuthClient');

// Mendapatkan semua target tabungan
const getSavingsGoals = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token);
    
    // [MODIFIKASI] Ambil query parameters month dan year
    const { month, year } = req.query;

    let query = supabaseAuth
      .from('savings_goals')
      .select('*')
      .order('created_at', { ascending: false });

    // [BARU] Implementasi filtering berdasarkan bulan target
    if (month && year) {
      const currentYear = parseInt(year);
      const currentMonth = parseInt(month);

      // Hitung tanggal akhir bulan (0 adalah hari terakhir bulan sebelumnya)
      const endOfMonthDate = new Date(currentYear, currentMonth, 0); 
      const endOfMonth = endOfMonthDate.toISOString().split('T')[0];
      
      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

      // Filter: target_date harus berada di dalam bulan ini ATAU target_date harus NULL.
      // Filter RLS akan memastikan hanya data milik user yang diambil.
      query = query.or(`target_date.gte.${startOfMonth},target_date.lte.${endOfMonth},target_date.is.null`);
    }

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