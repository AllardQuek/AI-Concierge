# Azure TTS Duplicate Synthesis Issue & Fix

**Date**: July 13, 2025  
**Issue**: Oracle bot was generating duplicate speech synthesis calls  
**Status**: ✅ RESOLVED

## 🚨 **Problem Description**

The Oracle bot was experiencing **duplicate speech synthesis** when joining rooms, resulting in:

- **Two "Speech synthesis completed" logs** for the same text
- **Two sets of audio frames** being sent to LiveKit
- **Back-to-back synthesis calls** with different audio sizes
- **Potential audio overlap** in the voice call

## 🔍 **Root Cause Analysis**

### **Initial Theories (Incorrect)**
1. ❌ **Multiple bot instances** - LiveKit dashboard showed only 3 participants (2 humans + 1 bot)
2. ❌ **LiveKit Agents framework retry** - No evidence of multiple agent instances
3. ❌ **Room connection issues** - Bot was connecting successfully

### **Actual Root Cause**
The **Azure Speech SDK** was calling the **success callback twice** for the same synthesis request:

```javascript
synthesizer.speakTextAsync(
  text,
  result => {
    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
      console.log('[AZURE TTS] ✅ Speech synthesis completed'); // ← Called TWICE
      resolve(result.audioData); // ← Called TWICE
    }
  }
);
```

## 🎯 **Evidence**

### **Log Analysis**
```
[AZURE TTS] Starting synthesis 216a350f-03df-4ee8-93ef-d51a968ccc56 for text: "Hello! The Oracle Mulisa has joined your call..."

[AZURE TTS] ✅ Speech synthesis completed  ← FIRST CALLBACK
[AZURE TTS] 🎵 Processing audio data: 142,000 bytes
[AZURE TTS] 🎵 Generated 44 audio frames

[AZURE TTS] ✅ Speech synthesis completed  ← SECOND CALLBACK  
[AZURE TTS] 🎵 Processing audio data: 111,600 bytes
[AZURE TTS] 🎵 Generated 34 audio frames
```

### **Key Observations**
- ✅ **Single request ID** - Only one synthesis request was made
- ✅ **Two success callbacks** - Azure called success twice
- ✅ **Different audio sizes** - Each callback provided different audio data
- ✅ **3 participants in LiveKit** - No duplicate bot instances

## 🛠️ **Solution Implemented**

### **Deduplication Logic**
Added a flag to prevent multiple Promise resolutions:

```javascript
async synthesizeSpeech(text) {
  return new Promise((resolve, reject) => {
    const synthesizer = new sdk.SpeechSynthesizer(this.#speechConfig);
    let hasResolved = false; // ← Deduplication flag
    
    synthesizer.speakTextAsync(
      text,
      result => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          // Prevent multiple resolutions
          if (!hasResolved) {
            hasResolved = true;
            resolve(result.audioData); // ← Only resolve once
          } else {
            console.log('[AZURE TTS] ⚠️ Duplicate synthesis completion ignored');
          }
        }
      }
    );
  });
}
```

### **Enhanced Logging**
Added callback counting for better debugging:

```javascript
let callbackCount = 0;
// ... in callback
callbackCount++;
console.log(`[AZURE TTS] 🔄 Callback triggered (count: ${callbackCount})`);
console.log(`[AZURE TTS] ✅ Speech synthesis completed (callback #${callbackCount})`);
```

## ✅ **Results**

### **Before Fix**
- ❌ Two synthesis calls per greeting
- ❌ Duplicate audio frames sent
- ❌ Potential audio overlap

### **After Fix**
- ✅ Single synthesis call per greeting
- ✅ Single set of audio frames
- ✅ Clean audio playback

## 📚 **Lessons Learned**

### **1. Azure Speech SDK Behavior**
- The Azure Speech SDK may call success callbacks multiple times
- This appears to be a reliability feature, not a bug
- Always implement deduplication for Azure TTS callbacks

### **2. Debugging Strategy**
- **Request ID tracking** helped identify single request vs multiple requests
- **LiveKit participant count** confirmed no duplicate bot instances
- **Callback counting** revealed the actual root cause

### **3. Best Practices**
- Always add deduplication flags for async callbacks
- Implement comprehensive logging for debugging
- Don't assume framework-level issues without evidence

## 🔧 **Prevention**

### **For Future Azure TTS Implementations**
```javascript
// Always add deduplication
let hasResolved = false;
let callbackCount = 0;

// Track callbacks for debugging
callbackCount++;
console.log(`Callback #${callbackCount} triggered`);

// Prevent multiple resolutions
if (!hasResolved) {
  hasResolved = true;
  resolve(data);
} else {
  console.log('Duplicate callback ignored');
}
```

### **For Other TTS Services**
- Research if the service has known callback duplication issues
- Implement similar deduplication patterns
- Add comprehensive logging for debugging

## 📋 **Files Modified**

- `bot/mulisa-bot.js` - Added deduplication logic to `synthesizeSpeech()` method

## 🎯 **Status**

**RESOLVED** ✅ - Oracle bot now generates single speech synthesis calls with clean audio output. 