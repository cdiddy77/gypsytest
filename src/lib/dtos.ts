export interface ResetConversationRequest {
  system_message: string;
}

export interface ResetConversationResponse {
  status: "pending" | "processing" | "completed" | "failed";
}
