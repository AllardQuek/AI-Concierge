# Call State Management Improvements

## Issues Identified:

### 1. iPhone-to-iPhone WebRTC Issues
- **NAT/Firewall Problems**: Mobile networks often have strict NAT/firewall rules
- **TURN Server Missing**: No relay servers for cases where direct P2P fails
- **iOS Audio Context**: May need additional iOS-specific handling

### 2. Call State Management Issues
- **Inconsistent States**: Using both 'ended' and 'idle' - should standardize
- **Race Conditions**: Multiple event handlers can conflict
- **No Error Recovery**: Failed calls require page reload
- **Missing State Validation**: No checks for valid transitions

### 3. Cleanup Issues
- **Incomplete Cleanup**: Some resources not properly cleaned
- **Event Listener Leaks**: Not all listeners removed on cleanup
- **Memory Leaks**: Intervals and timeouts may persist

## Recommended Solutions:

### 1. Add TURN Servers (Critical for Mobile)
```javascript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { 
    urls: 'turn:turn.example.com:3478',
    username: 'user',
    credential: 'pass'
  }
];
```

### 2. Standardize Call States
```typescript
type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'disconnecting';
// Remove 'ended' state - always return to 'idle'
```

### 3. Add State Validation
```typescript
const isValidStateTransition = (from: CallState, to: CallState): boolean => {
  const validTransitions = {
    'idle': ['outgoing', 'incoming'],
    'outgoing': ['connected', 'idle'],
    'incoming': ['connected', 'idle'],
    'connected': ['disconnecting'],
    'disconnecting': ['idle']
  };
  return validTransitions[from]?.includes(to) || false;
};
```

### 4. Improve Cleanup
```typescript
const cleanup = () => {
  // Clear all timers and timeouts
  clearAllTimers();
  
  // Remove all event listeners
  removeAllEventListeners();
  
  // Close WebRTC connection
  webrtcRef.current?.cleanup();
  
  // Reset state
  resetCallState();
};
```

### 5. Add Error Recovery
```typescript
const recoverFromError = () => {
  cleanup();
  setCallState('idle');
  setError('');
  // Re-initialize services if needed
};
```
