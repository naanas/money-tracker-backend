const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
  
    // Supabase error
    if (err.code && err.message) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
  
    // Default error
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  };
  
  const notFound = (req, res) => {
    res.status(404).json({
      success: false,
      error: `Endpoint not found - ${req.originalUrl}`
    });
  };
  
  module.exports = {
    errorHandler,
    notFound
  };