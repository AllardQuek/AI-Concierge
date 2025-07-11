// Test room name generation for LiveKit calls
function getRoomName(numberA, numberB) {
  // Normalize both numbers to ensure consistent room naming (matching client logic)
  const normalizeForRoom = (phoneNumber) => {
    const digitsOnly = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
    
    // Handle 8-digit Singapore mobile numbers (without country code)
    if (digitsOnly.length === 8 && (digitsOnly.startsWith('8') || digitsOnly.startsWith('9'))) {
      return `65${digitsOnly}`; // Add 65 prefix for consistency
    }
    
    // Handle numbers that already have 65 prefix
    if (digitsOnly.startsWith('65') && digitsOnly.length === 10) {
      return digitsOnly;
    }
    
    // Return as-is if we can't normalize
    return digitsOnly;
  };
  
  const cleanA = normalizeForRoom(numberA);
  const cleanB = normalizeForRoom(numberB);
  const [first, second] = [cleanA, cleanB].sort();
  return `room-${first}-${second}`;
}

// Test cases based on the logs and potential scenarios
const testCases = [
  {
    callerNumber: '+65 8329 3712',
    calleeNumber: '+65 9201 5367',
    description: 'Both formatted numbers (from logs)'
  },
  {
    callerNumber: '83293712',
    calleeNumber: '+65 9201 5367',
    description: 'Caller 8 digits, callee formatted'
  },
  {
    callerNumber: '+65 8329 3712',
    calleeNumber: '92015367',
    description: 'Caller formatted, callee 8 digits'
  },
  {
    callerNumber: '83293712',
    calleeNumber: '92015367',
    description: 'Both 8 digits'
  },
  {
    callerNumber: '6583293712',
    calleeNumber: '+65 9201 5367',
    description: 'Caller 10 digits, callee formatted'
  },
  {
    callerNumber: '+65 8329 3712',
    calleeNumber: '6592015367',
    description: 'Caller formatted, callee 10 digits'
  }
];

console.log('Testing room name generation for LiveKit calls:');
console.log('===============================================');

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: ${testCase.description}`);
  console.log(`  Caller number: "${testCase.callerNumber}"`);
  console.log(`  Callee number: "${testCase.calleeNumber}"`);
  
  try {
    const roomName = getRoomName(testCase.callerNumber, testCase.calleeNumber);
    console.log(`  Generated room name: ${roomName}`);
    
    // Check for malformed room names
    if (roomName.includes('--')) {
      console.log(`  ⚠️  WARNING: Malformed room name detected (double dash)`);
    }
    
    // Check if room name matches the expected format from logs
    if (roomName === 'room-6583293712-6592015367') {
      console.log(`  ✅ MATCHES LOGS: This is the room name from the server logs`);
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
});

console.log('\n===============================================');
console.log('Analysis:');
console.log('- The room name from logs is: room-6583293712-6592015367');
console.log('- This suggests both numbers are being processed as 10-digit numbers with 65 prefix');
console.log('- The issue might be that caller and callee have different number formats');
console.log('- We need to ensure both sides use the same normalization logic'); 