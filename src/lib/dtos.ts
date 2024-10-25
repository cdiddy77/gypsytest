export interface ResetConversationRequest {
  system_message: string;
}

export interface ResetConversationResponse {
  status: "pending" | "processing" | "completed" | "failed";
}

export type ReadingStatus =
  | "no_cards"
  | "verifying_cards"
  | "requesting_reading"
  | "error"
  | "reading_tts_requested"
  | "reading_tts_complete";

interface TarotCard {
  name: string;
  description: string;
}

interface TarotCardHand {
  cards: TarotCard[];
}

interface ReadingTaskState {
  status: ReadingStatus;
  task_id?: string | null;
  error_message?: string | null;
  hand?: TarotCardHand | null;
  reading?: string | null;
}

export interface UploadImageResponse {
  status: ReadingStatus;
  task_id: string | null;
}

export interface TaskStatusResponse {
  status: ReadingTaskState;
}
