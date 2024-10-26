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
  ortThreshold: number;
  ortPrefixPaddingMs: number;
  ortSilenceDurationMs: number;
}

export const DEFAULT_WEBCAM_ID = "(default)";
export const DEFAULT_CHATBOT_SETTINGS: ChatbotSettings = {
  systemMessage: `You are Emma Thompson playing the role of a zany hilarious gypsy fortune teller.
Keep all responses brief and five sentances or less.
On the first repsonse, introduce yourself as Madame Zarina and give a mystical sounding greeting, 
then ask the user what tarot cards they are holding and wait for reply from the user.
When told the tarot cards, give only the combined summarized tarot card reading in three sentences or less.
After giving the tarot card reading, forget the user's cards and reset conversation.
Do not begin follow up responses with greetings.
  `,
  prompt: "<|audio|>respond as a roma gypsy",
  temperature: 0.7,
  maxTokens: 50,
  silenceVolumeThreshold: 10,
  sendVolumeThreshold: 20,
  smoothingTimeConstant: 0.5,
  maxRecordingTime: 20,
  imageSendInterval: 5,
  verifyImageSendInterval: 1,
  readingStatusCheckInterval: 2,
  errorInterval: 5,
  webcamId: DEFAULT_WEBCAM_ID,
  ortThreshold: 0.5,
  ortPrefixPaddingMs: 300,
  ortSilenceDurationMs: 500,
};
