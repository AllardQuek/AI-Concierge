// Environment configuration helper
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables based on NODE_ENV (standardized with client approach)
function loadEnvironment() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Primary environment file (e.g., .env.production, .env.development)
  const primaryEnvFile = `.env.${nodeEnv}`;
  const primaryResult = dotenv.config({ path: path.resolve(process.cwd(), primaryEnvFile) });
  
  if (primaryResult.error) {
    console.log(`⚠️  ${primaryEnvFile} not found (this is normal)`);
  } else {
    console.log(`✅ Loaded environment from ${primaryEnvFile}`);
  }
  
  // Always load .env.local for local overrides (like client)
  const localResult = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  if (localResult.error) {
    console.log(`⚠️  .env.local not found (this is normal)`);
  } else {
    console.log(`✅ Loaded local overrides from .env.local`);
  }
  
  // Fallback to .env if it exists
  const fallbackResult = dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  if (!fallbackResult.error) {
    console.log(`✅ Loaded fallback from .env`);
  }
}

// Environment configuration (dynamic getter to ensure fresh values)
const getConfig = () => ({
  // Server configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3001,
  
  // Azure Speech-to-Text configuration
  AZURE_SPEECH_KEY: process.env.AZURE_SPEECH_KEY,
  AZURE_SPEECH_REGION: process.env.AZURE_SPEECH_REGION,
  
  // CORS configuration
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : [],
});

// Legacy config object for backward compatibility
const config = new Proxy({}, {
  get(target, prop) {
    return getConfig()[prop];
  }
});

// Validation function
function validateConfig() {
  const required = [];
  
  // Check if Azure is configured (optional for development)
  if (config.NODE_ENV === 'production') {
    if (!config.AZURE_SPEECH_KEY) required.push('AZURE_SPEECH_KEY');
    if (!config.AZURE_SPEECH_REGION) required.push('AZURE_SPEECH_REGION');
  }
  
  if (required.length > 0) {
    throw new Error(`Missing required environment variables: ${required.join(', ')}`);
  }
  
  return true;
}

// Helper to check if Azure is configured
function isAzureConfigured() {
  return !!(config.AZURE_SPEECH_KEY && config.AZURE_SPEECH_REGION);
}

// Helper to get Azure config
function getAzureConfig() {
  return {
    key: config.AZURE_SPEECH_KEY,
    region: config.AZURE_SPEECH_REGION,
    isConfigured: isAzureConfigured()
  };
}

module.exports = {
  loadEnvironment,
  validateConfig,
  isAzureConfigured,
  getAzureConfig,
  config
}; 