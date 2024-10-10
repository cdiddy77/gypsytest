// import httpProxyMiddleware from 'http-proxy-middleware';
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: false, // Disable body parser to stream data directly
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("Request to /api/response-events");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // Flush headers immediately

  try {
    const backendRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_SVR}/response-events`
    );
    if (!backendRes.body) {
      throw new Error("No response body from backend");
    }

    const reader = backendRes.body.getReader();

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });

      // Send the chunk to the client
      res.write(chunk);
    }
  } catch (error) {
    console.error("Error proxying SSE:", error);
    res.status(500).end("Error proxying SSE");
  }
}
