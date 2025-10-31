const supabase = require('../config/database');

const getAllCategories = async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${req.user.id},user_id.is.null`) 
      .order('name');

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, type, icon, color } = req.body;
    const { data: category, error } = await supabase
      .from('categories')
      .insert([
        { 
          name: name.trim(), 
          type,
          icon: icon || null,
          color: color || null,
          user_id: req.user.id 
        }
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { 
        return res.status(409).json({
          success: false,
          error: 'You already have a category with this name and type'
        });
      }
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(201).json({ success: true, message: 'Category created successfully', data: category });
  } catch (error) {
    console.error('Category creation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// === [FUNGSI BARU UNTUK UPDATE/EDIT] ===
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, icon, color } = req.body;

    const { data, error } = await supabase
      .from('categories')
      .update({
        name: name.trim(),
        type,
        icon: icon || null,
        color: color || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id) // Hanya bisa edit milik sendiri
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { 
        return res.status(409).json({
          success: false,
          error: 'You already have another category with this name and type'
        });
      }
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Category not found or you do not have permission to edit it'
      });
    }
    
    res.json({ success: true, message: 'Category updated successfully', data });

  } catch (error) {
    console.error('Category update error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// === [FUNGSI BARU UNTUK DELETE] ===
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params; 

    const { data, error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id) // Hanya bisa hapus milik sendiri
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Category not found or you do not have permission to delete it'
      });
    }

    res.json({ success: true, message: 'Category deleted successfully', data: data });

  } catch (error) {
    console.error('Category deletion error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory, // [BARU]
  deleteCategory  // [BARU]
};