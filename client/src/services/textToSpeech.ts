// Text-to-Speech Service for voice announcements
export class TextToSpeechService {
  private synthesis: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.initializeVoice();
  }

  // Initialize preferred voice for announcements
  private initializeVoice() {
    // Wait for voices to load
    const setVoice = () => {
      const voices = this.synthesis.getVoices();
      
      // Prefer English voices, prioritize female voices for professional announcements
      const preferredVoices = [
        'Google UK English Female',
        'Microsoft Zira Desktop',
        'Samantha',
        'Victoria',
        'Karen',
        'Moira'
      ];

      // Try to find a preferred voice
      for (const preferredName of preferredVoices) {
        const found = voices.find(voice => 
          voice.name.includes(preferredName) && voice.lang.startsWith('en')
        );
        if (found) {
          this.voice = found;
          console.log('TTS: Selected voice:', found.name);
          return;
        }
      }

      // Fallback to any English voice
      const englishVoice = voices.find(voice => 
        voice.lang.startsWith('en') && voice.localService
      );
      
      if (englishVoice) {
        this.voice = englishVoice;
        console.log('TTS: Using fallback English voice:', englishVoice.name);
      } else {
        console.warn('TTS: No suitable English voice found');
      }
    };

    // Voices might not be immediately available
    if (this.synthesis.getVoices().length > 0) {
      setVoice();
    } else {
      this.synthesis.addEventListener('voiceschanged', setVoice, { once: true });
    }
  }

  // Speak text with specified options
  speak(text: string, options: {
    rate?: number;
    pitch?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: SpeechSynthesisErrorEvent) => void;
  } = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      // Cancel any ongoing speech
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set voice if available
      if (this.voice) {
        utterance.voice = this.voice;
      }

      // Configure speech parameters
      utterance.rate = options.rate || 0.9; // Slightly slower for clarity
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 0.8; // Slightly quieter than max

      // Set up event handlers
      utterance.onstart = () => {
        console.log('TTS: Started speaking:', text);
        options.onStart?.();
      };

      utterance.onend = () => {
        console.log('TTS: Finished speaking');
        options.onEnd?.();
        resolve();
      };

      utterance.onerror = (error) => {
        console.error('TTS: Speech error:', error);
        options.onError?.(error);
        reject(new Error(`Speech synthesis failed: ${error.error}`));
      };

      // Start speaking
      this.synthesis.speak(utterance);
    });
  }

  // Generate recording announcement for the call recipient
  async announceRecording(callerNumber: string): Promise<void> {
    const message = `Hello, this is an automated announcement. You are receiving a call from ${this.formatPhoneNumber(callerNumber)}. Please be aware that this call will be recorded for quality and training purposes. The call will begin in a moment.`;
    
    console.log('TTS: Playing recording announcement');
    
    return this.speak(message, {
      rate: 0.85, // Slower for important legal notice
      volume: 0.9, // Slightly louder for clarity
      onStart: () => console.log('📢 Recording announcement started'),
      onEnd: () => console.log('📢 Recording announcement completed')
    });
  }

  // Format phone number for speech (add pauses between digits)
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // For Singapore numbers (+65), format as "+65, 9-1-2-3-4-5-6-7"
    if (digits.startsWith('65') && digits.length === 10) {
      const countryCode = '+65';
      const number = digits.slice(2);
      // Add pauses between groups for clearer pronunciation
      return `${countryCode}, ${number.split('').join(' ')}`; 
    }
    
    // For other numbers, just add spaces between digits
    return `+${digits.split('').join(' ')}`;
  }

  // Cancel any ongoing speech
  cancel(): void {
    this.synthesis.cancel();
  }

  // Check if speech synthesis is supported
  static isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  // Get available voices for debugging
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices();
  }
}
