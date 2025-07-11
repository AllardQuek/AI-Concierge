// Test identity normalization for LiveKit calls
function normalizeForIdentity(phoneNumber) {
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
}

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

// Test cases
const testCases = [
  {
    myNumber: '+65 9201 5367',
    otherNumber: '+65 8329 3712',
    description: 'Both formatted numbers (from logs)'
  },
  {
    myNumber: '+65 9201 5367',
    otherNumber: '83293712',
    description: 'Formatted vs 8 digits'
  },
  {
    myNumber: '92015367',
    otherNumber: '+65 8329 3712',
    description: '8 digits vs formatted'
  }
];

console.log('Testing identity normalization for LiveKit calls:');
console.log('================================================');

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: ${testCase.description}`);
  console.log(`  My number: "${testCase.myNumber}"`);
  console.log(`  Other number: "${testCase.otherNumber}"`);
  
  const roomName = getRoomName(testCase.myNumber, testCase.otherNumber);
  const identity = normalizeForIdentity(testCase.myNumber);
  
  console.log(`  Generated room name: ${roomName}`);
  console.log(`  Normalized identity: ${identity}`);
  
  // Check if identity format matches room name format
  const roomNameParts = roomName.replace('room-', '').split('-');
  const identityMatchesRoom = roomNameParts.includes(identity);
  
  console.log(`  Identity matches room format: ${identityMatchesRoom ? '✅' : '❌'}`);
  
  if (!identityMatchesRoom) {
    console.log(`  ⚠️  WARNING: Identity format doesn't match room name format`);
    console.log(`     Room parts: [${roomNameParts.join(', ')}]`);
    console.log(`     Identity: ${identity}`);
  }
});

console.log('\n================================================');
console.log('Analysis:');
console.log('- Identity should be normalized to match room name format');
console.log('- This ensures consistency between room name and participant identity');
console.log('- Should help resolve LiveKit connection issues'); 