const environment = {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000'
  };
  
  // Validation
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      console.error(`❌ Missing required environment variable: ${varName}`);
      process.exit(1);
    }
  });
  
  module.exports = environment;