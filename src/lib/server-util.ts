import axios from "axios";

interface MessageRequest {
  phone_number: string;
  message: string;
}

interface MessageResponse {
  status: string;
  sid: string;
}

export async function sendTwilioMessage(
  request: MessageRequest
): Promise<MessageResponse> {
  try {
    const response = await axios.post<MessageResponse>(
      `${process.env.NEXT_PUBLIC_API_SVR}/send-message/`,
      request,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Error: ${error.response?.data.detail || error.message}`);
    } else {
      throw new Error("An unexpected error occurred");
    }
  }
}
