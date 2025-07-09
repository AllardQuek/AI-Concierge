// Mulisa Oracle Service - Frontend Integration
export interface OracleWisdom {
  text: string;
  timestamp: Date;
  type: 'greeting' | 'prophetic-insight' | 'guidance';
  oracleActive: boolean;
  // Oracle audio properties for TTS functionality
  hasAudio?: boolean;
  audioUrl?: string;
  // Enhanced properties for better Oracle integration
  content?: string;
  confidence?: number;
  context?: string;
}

export interface OracleInviteResult {
  success: boolean;
  roomName?: string;
  error?: string;
}

export class MulisaOracleService {
  private baseUrl: string;
  private statusPollingInterval: number | null = null;
  constructor() {
    // Type assertion for Vite environment variables
    this.baseUrl = (import.meta as any).env?.VITE_BOT_SERVER_URL || 'http://localhost:4000';
  }

  async inviteOracle(number1: string, number2: string): Promise<OracleInviteResult> {
    try {
      console.log('🔮 Summoning Mulisa Oracle...');
      
      const response = await fetch(`${this.baseUrl}/join-room?number1=${number1}&number2=${number2}`);
      const result = await response.json();
      
      if (result.success) {
        console.log('✨ Oracle awakened:', result.message);
        this.startStatusPolling(number1, number2);
        return { success: true, roomName: result.roomName };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Failed to summon Oracle:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async getLatestWisdom(number1: string, number2: string): Promise<OracleWisdom | null> {
    try {
      const roomName = this.getRoomName(number1, number2);
      const response = await fetch(`${this.baseUrl}/room-status?room=${roomName}`);
      const status = await response.json();
      
      return status.details?.lastWisdom || null;
    } catch (error) {
      console.error('❌ Error fetching wisdom:', error);
      return null;
    }
  }

  async dismissOracle(number1: string, number2: string): Promise<boolean> {
    try {
      console.log('🌙 Dismissing Oracle back to the mystical realm...');
      
      const response = await fetch(`${this.baseUrl}/leave-room?number1=${number1}&number2=${number2}`);
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Oracle dismissed:', result.message);
        this.stopStatusPolling();
        return true;
      } else {
        throw new Error(result.error || 'Failed to dismiss Oracle');
      }
    } catch (error) {
      console.error('❌ Failed to dismiss Oracle:', error);
      return false;
    }
  }
    private startStatusPolling(number1: string, number2: string) {
    if (this.statusPollingInterval) return;
    
    console.log('🔍 Starting Oracle wisdom polling...');
    this.statusPollingInterval = setInterval(async () => {
      const wisdom = await this.getLatestWisdom(number1, number2);
      if (wisdom) {
        // Check if Oracle has audio to play
        if (wisdom.hasAudio && wisdom.audioUrl) {
          await this.playOracleAudio(wisdom.audioUrl);
        }
        
        window.dispatchEvent(new CustomEvent('oracle-wisdom', { detail: wisdom }));
      }
    }, 3000) as unknown as number;
  }

  private async playOracleAudio(audioUrl: string) {
    try {
      console.log('🎵 Playing Oracle voice:', audioUrl);
      
      // Create audio element for Oracle voice
      const audioElement = document.createElement('audio');
      audioElement.src = `${this.baseUrl}${audioUrl}`;
      audioElement.autoplay = true;
      audioElement.volume = 0.8; // Slightly quieter than normal speech
      
      // Add mystical audio effects
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);
      
      // Play the Oracle voice
      await audioElement.play();
      
      // Clean up after audio finishes
      audioElement.addEventListener('ended', () => {
        document.body.removeChild(audioElement);
        console.log('✅ Oracle voice playback completed');
      });
      
      // Cleanup fallback (in case 'ended' event doesn't fire)
      setTimeout(() => {
        if (document.body.contains(audioElement)) {
          document.body.removeChild(audioElement);
        }
      }, 10000); // 10 second max cleanup
      
    } catch (error) {
      console.error('❌ Error playing Oracle audio:', error);
    }
  }
  private stopStatusPolling() {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
      console.log('⏹️ Oracle wisdom polling stopped');
    }
  }

  // Public methods for Oracle control
  startWisdomPolling(roomId: string, participantName?: string) {
    // Use roomId directly or construct from room parameters
    const [number1, number2] = roomId.includes('-') 
      ? roomId.replace('room-', '').split('-') 
      : [roomId, participantName || 'unknown'];
    this.startStatusPolling(number1, number2);
  }

  stopWisdomPolling() {
    this.stopStatusPolling();
  }

  private getRoomName(numberA: string, numberB: string): string {
    const cleanA = numberA.replace(/\D/g, '');
    const cleanB = numberB.replace(/\D/g, '');
    const [first, second] = [cleanA, cleanB].sort();
    return `room-${first}-${second}`;
  }

  // Cleanup when service is destroyed
  destroy() {
    this.stopStatusPolling();
  }
}
