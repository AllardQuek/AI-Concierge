export interface TranscriptionResult {
  id: string;
  text: string;
  speaker: string; // Allow any string for participant IDs
  timestamp: number;
  confidence: number;
  isFinal: boolean;
} 