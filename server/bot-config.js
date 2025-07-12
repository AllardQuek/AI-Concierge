// Bot Client Configuration
// This file contains different bot personalities and configurations

const botConfigs = {
  // Main Sybil Bot
  sybil: {
    phoneNumber: '+65 8000 0000',
    botName: 'Sybil In Call Assistant',
    voice: 'en-US-Neural2-F',
    language: 'en-US',
    personality: 'helpful',
    wakeword: 'hey sybil',
    responses: {
      precall: "Hi, I'm Sybil, your in-call assistant. If you need me, just say my name. T&C's available upon request.",
      postcall: "Thank you for using Sybil. For more information, please visit www.syntelligence.com/sybil"
    }
  }
};

// Environment-based configuration
const getBotConfig = (type = 'sybil') => {
  const config = botConfigs[type];
  
  // Override with environment variables if provided
  return {
    ...config,
    phoneNumber: process.env.BOT_PHONE_NUMBER || config.phoneNumber,
    botName: process.env.BOT_NAME || config.botName,
    voice: process.env.BOT_VOICE || config.voice,
    language: process.env.BOT_LANGUAGE || config.language,
    serverUrl: process.env.BOT_SERVER_URL || 'http://localhost:3001'
  };
};

// Export configurations
module.exports = {
  botConfigs,
  getBotConfig
}; 