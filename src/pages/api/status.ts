import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_SVR}/status`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("Error proxying /status:", error);
    res.status(500).end("Error proxying /status");
  }
}
