const supabase = require('../config/database');

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // === [PERBAIKAN LOGIKA] ===
    // Cek header dan formatnya dengan lebih ketat
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ').length !== 2) {
    // === [AKHIR PERBAIKAN] ===
      return res.status(401).json({ 
        success: false,
        error: 'Authorization token required' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    // [PERBAIKAN] Cek jika tokennya kosong setelah di-split
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Authorization token is empty' 
      });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid or expired token' 
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Authentication failed' 
    });
  }
};

module.exports = { authenticateUser };