export interface ChatbotSettings {
  prompt: string;
  temperature: number;
  maxTokens: number;
  sendVolumeThreshold: number;
  silenceVolumeThreshold: number;
  smoothingTimeConstant: number; // 0..1
}
