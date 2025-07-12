#!/usr/bin/env node

const BotClient = require('./bot-client');
const { getBotConfig, botConfigs } = require('./bot-config');

// Parse command line arguments
const args = process.argv.slice(2);
const botType = args[0] || 'sybil';

// Show available bot types if help is requested
if (args.includes('--help') || args.includes('-h')) {
  console.log('\n🤖 Bot Client Launcher');
  console.log('=====================\n');
  console.log('Usage: node start-bot.js [bot-type] [options]\n');
  console.log('Available bot types:');
  Object.keys(botConfigs).forEach(type => {
    const config = botConfigs[type];
    console.log(`  ${type.padEnd(15)} - ${config.botName} (${config.phoneNumber})`);
  });
  console.log('\nOptions:');
  console.log('  --help, -h     Show this help message');
  console.log('  --debug        Enable debug logging');
  console.log('\nExamples:');
  console.log('  node start-bot.js sybil');
  console.log('  node start-bot.js sybil --debug');
  console.log('\nEnvironment Variables:');
  console.log('  BOT_SERVER_URL     - Server URL (default: http://localhost:3001)');
  console.log('  BOT_PHONE_NUMBER   - Phone number to register with');
  console.log('  BOT_NAME           - Bot name');
  console.log('  BOT_VOICE          - TTS voice');
  console.log('  BOT_LANGUAGE       - Language code');
  process.exit(0);
}

// Validate bot type
if (!botConfigs[botType]) {
  console.error(`❌ Unknown bot type: ${botType}`);
  console.error('Run "node start-bot.js --help" to see available bot types');
  process.exit(1);
}

// Get configuration
const config = getBotConfig(botType);

// Enable debug logging if requested
if (args.includes('--debug')) {
  process.env.DEBUG = 'true';
  console.log('🔍 Debug logging enabled');
}

console.log(`\n🤖 Starting ${config.botName}...`);
console.log(`📱 Phone Number: ${config.phoneNumber}`);
console.log(`🔗 Server URL: ${config.serverUrl}`);
console.log(`🎤 Voice: ${config.voice}`);
console.log(`🌍 Language: ${config.language}`);
console.log(`🎭 Personality: ${config.personality}`);
if (config.wakeword) {
  console.log(`🔊 Wake Word: "${config.wakeword}"`);
}
console.log('');

// Create and start the bot
const bot = new BotClient(config);

// Handle graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  await bot.stop();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start the bot
bot.start().catch((error) => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
}); 