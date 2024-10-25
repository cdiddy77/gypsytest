export interface ChatbotSettings {
  systemMessage: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
  sendVolumeThreshold: number;
  silenceVolumeThreshold: number;
  smoothingTimeConstant: number; // 0..1
  maxRecordingTime: number; // in seconds
  imageSendInterval: number; // in seconds
  verifyImageSendInterval: number; // in seconds
  readingStatusCheckInterval: number; // in seconds
  errorInterval: number; // in seconds
  webcamId: string;
}

export const DEFAULT_WEBCAM_ID = "(default)";
