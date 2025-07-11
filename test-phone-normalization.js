// Test phone number normalization for room naming
function getRoomNameClient(numberA, numberB) {
  // Normalize both numbers to ensure consistent room naming
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

function getRoomNameBot(numberA, numberB) {
  // Validate that both numbers are provided and non-empty
  if (!numberA || !numberB) {
    throw new Error(`Invalid phone numbers: numberA="${numberA}", numberB="${numberB}". Both numbers must be provided.`);
  }
  
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
  
  // Validate that cleaning didn't result in empty strings
  if (!cleanA || !cleanB) {
    throw new Error(`Invalid phone numbers after cleaning: cleanA="${cleanA}", cleanB="${cleanB}". Numbers must contain digits.`);
  }
  
  const [first, second] = [cleanA, cleanB].sort();
  return `room-${first}-${second}`;
}

// Test cases
const testCases = [
  ['+65 9033 9936', '+65 9033 9937'],
  ['6590339936', '6590339937'],
  ['90339936', '90339937'],
  ['+65 9033 9936', '90339937'],
  ['6590339936', '+65 9033 9937'],
  ['90339936', '+65 9033 9937'],
];

console.log('Testing phone number normalization for room naming (FIXED):');
console.log('='.repeat(60));

testCases.forEach(([numA, numB], index) => {
  const clientRoom = getRoomNameClient(numA, numB);
  const botRoom = getRoomNameBot(numA, numB);
  const match = clientRoom === botRoom;
  
  console.log(`Test ${index + 1}:`);
  console.log(`  Input: "${numA}" + "${numB}"`);
  console.log(`  Client room: ${clientRoom}`);
  console.log(`  Bot room:    ${botRoom}`);
  console.log(`  Match:       ${match ? '✅' : '❌'}`);
  console.log('');
}); 