import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("Request to /api/upload-audio");
  if (req.method === "POST") {
    try {
      // Forward the incoming request body to the FastAPI backend
      const backendResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_SVR}/upload-audio`,
        {
          method: "POST",
          headers: {
            ...(req.headers as Record<string, string>), // Forward headers (like Content-Type) to backend
          },
          //   body: req.body, // Pass the raw request body directly
          //   body: req as unknown as BodyInit, // Pass the raw request body directly
        }
      );

      const data = await backendResponse.json();

      // Respond to the frontend with the result from the backend
      return res.status(backendResponse.status).json(data);
    } catch (error) {
      console.error("Error proxying the request:", error);
      return res.status(500).json({ error: "Error proxying the request" });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
