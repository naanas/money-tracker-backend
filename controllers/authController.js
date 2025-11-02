const supabase = require('../config/database');
const createAuthClient = require('../utils/createAuthClient');

const register = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return res.status(400).json({
        success: false,
        error: authError.message
      });
    }

    // Create user profile
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('users')
        .upsert(
          {
            id: authData.user.id, 
            email: authData.user.email,
            full_name: full_name || '',
            subscription_tier: 'free'
          },
          {
            onConflict: 'email'
          }
        );

      if (profileError) {
        console.error('Profile creation/upsert error:', profileError);
        return res.status(400).json({
            success: false,
            error: `User auth created, but profile operation failed: ${profileError.message}`
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          full_name: full_name || ''
        },
        session: authData.session
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: data.user.id,
          email: data.user.email
        },
        session: data.session
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const supabaseAuth = createAuthClient(req.token); 
    
    const { data: user, error } = await supabaseAuth
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// === [FUNGSI BARU 1: UPDATE PROFILE] ===
const updateProfile = async (req, res) => {
  try {
    const { email, full_name } = req.body;
    const supabaseAuth = createAuthClient(req.token);
    
    // 1. Update data di 'auth.users' (termasuk email jika berubah)
    const { data: authData, error: authError } = await supabaseAuth.auth.updateUser({
      email: email,
      data: { full_name: full_name } // Simpan full_name di metadata auth juga
    });

    if (authError) throw authError;

    // 2. Update data di tabel 'public.users'
    const { data: profileData, error: profileError } = await supabaseAuth
      .from('users')
      .update({
        email: authData.user.email,
        full_name: full_name
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (profileError) throw profileError;

    res.json({ success: true, message: 'Profil berhasil diperbarui. Jika Anda mengubah email, silakan cek email Anda untuk verifikasi.', data: profileData });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};

// === [FUNGSI BARU 2: UPDATE PASSWORD] ===
const updatePassword = async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password minimal 8 karakter' });
    }
    
    const supabaseAuth = createAuthClient(req.token);

    // Update password di 'auth.users'
    const { error } = await supabaseAuth.auth.updateUser({
      password: password
    });

    if (error) throw error;

    res.json({ success: true, message: 'Password berhasil diperbarui' });

  } catch (error) {
    console.error('Update password error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};


module.exports = {
  register,
  login,
  getProfile,
  updateProfile,    // [BARU]
  updatePassword    // [BARU]
};