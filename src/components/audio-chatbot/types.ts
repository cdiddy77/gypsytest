export interface ChatbotSettings {
  systemMessage: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
  sendVolumeThreshold: number;
  silenceVolumeThreshold: number;
  smoothingTimeConstant: number; // 0..1
  maxRecordingTime: number; // in seconds
}
