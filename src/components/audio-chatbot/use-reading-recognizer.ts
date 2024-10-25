import {
  ReadingStatus,
  TaskStatusResponse,
  UploadImageResponse,
} from "@/lib/dtos";
import React from "react";
import { ChatbotSettings, DEFAULT_WEBCAM_ID } from "./types";
import { wait } from "@/lib/utils";
import axios from "axios";
import base64js from "base64-js";

export function useReadingRecognizer(
  settings: ChatbotSettings,
  pushAudio: (audioBlob: Blob) => void
) {
  const [isWatchMode, setIsWatchMode] = React.useState(false);
  const isWatchModeRef = React.useRef<boolean>(false);
  const [readingStatus, setReadingStatus] =
    React.useState<ReadingStatus>("no_cards");
  const settingsRef = React.useRef<ChatbotSettings>(settings);

  React.useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const runReadingStateMachine = React.useCallback(async () => {
    let currentReadingStatus: ReadingStatus = "no_cards";
    let currentTaskId: string = "";
    // while we are
    while (isWatchModeRef.current) {
      console.log(
        "running reading state machine",
        JSON.stringify({ currentReadingStatus, currentTaskId })
      );
      try {
        // if the current status is no_cards or verifying, then send an image and wait for the response
        if (
          currentReadingStatus === "no_cards" ||
          currentReadingStatus === "verifying_cards"
        ) {
          await wait(settingsRef.current.imageSendInterval * 1000);
          const imageBlob = await captureImageFromWebcam(
            settingsRef.current.webcamId
          );
          const response = await sendImageToServer(imageBlob, currentTaskId);
          console.log("Response from server:", JSON.stringify({ response }));
          currentReadingStatus = response.status;
          setReadingStatus(currentReadingStatus);
          if (response.status === "verifying_cards") {
            currentTaskId = response.task_id || "";
          }
          // else if the response is verifying, record taskid and readingstatus wait verifyImageSendInterval
          // else if requesting_reading,reading_tts_requested, check status
        } else if (
          currentReadingStatus === "requesting_reading" ||
          currentReadingStatus === "reading_tts_requested"
        ) {
          await wait(settingsRef.current.readingStatusCheckInterval * 1000);
          const response = await sendStatusCheckRequest(currentTaskId);
          currentReadingStatus = response.status.status;
          setReadingStatus(currentReadingStatus);
          console.log(
            "status check response from server:",
            JSON.stringify({ response })
          );
          if (
            response.status.status === "reading_tts_complete" &&
            response.status.reading
          ) {
            pushAudio(
              new Blob([base64js.toByteArray(response.status.reading)], {
                type: "audio/mpeg",
              })
            );
            await wait(settingsRef.current.imageSendInterval * 1000);
            currentReadingStatus = "no_cards";
            setReadingStatus(currentReadingStatus);
          }
          // set the current reading status
          // wait readingStatusCheckInterval
          // else if error, wait errorInterval
        } else if (currentReadingStatus === "error") {
          await wait(settingsRef.current.errorInterval * 1000);
          currentReadingStatus = "no_cards";
          // else if reading_tts_complete
        } else if (currentReadingStatus === "reading_tts_complete") {
          // push the audio into the audio queue
          currentTaskId = "";
        }
      } catch (e) {
        await wait(settingsRef.current.errorInterval * 1000);
      }
    }
  }, [pushAudio]);

  React.useEffect(() => {
    runReadingStateMachine();
  }, [runReadingStateMachine]);

  const setWatchMode = React.useCallback(
    (isWatchMode: boolean) => {
      isWatchModeRef.current = isWatchMode;
      if (isWatchMode) {
        runReadingStateMachine();
      }
      setIsWatchMode(isWatchMode);
    },
    [runReadingStateMachine]
  );

  return React.useMemo(
    () => ({
      readingStatus,
      isWatchMode,
      setWatchMode,
    }),
    [isWatchMode, readingStatus, setWatchMode]
  );
}

const captureImageFromWebcam = async (webcamId: string) => {
  const constraints = {
    video: {
      deviceId:
        webcamId === DEFAULT_WEBCAM_ID ? undefined : { exact: webcamId },
    },
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const video = document.createElement("video");
    video.srcObject = stream;
    await new Promise((resolve) => (video.onloadedmetadata = resolve));
    video.play();

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(async (blob) => {
          stream.getTracks().forEach((track) => track.stop());
          if (blob) {
            resolve(blob);
          } else {
            reject("Error capturing image from webcam");
          }
        }, "image/jpeg")
      );
      return blob;
    } else {
      throw new Error("Error creating context from canvas");
    }
  } catch (error) {
    console.error("Error capturing image from webcam:", error);
    throw error;
  }
};

const sendImageToServer = async (
  imageBlob: Blob,
  taskId: string
): Promise<UploadImageResponse> => {
  const formData = new FormData();
  formData.append("image", imageBlob, "snapshot.jpg");
  formData.append("task_id", taskId);
  try {
    console.log("Sending image to server...", taskId);
    const response = await axios.post<UploadImageResponse>(
      `${process.env.NEXT_PUBLIC_API_SVR}/upload-image`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "json",
        timeout: 10_000,
      }
    );
    console.log("Response from server:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error sending image to server:", error);
    throw error;
  }
};

const sendStatusCheckRequest = async (
  taskId: string
): Promise<TaskStatusResponse> => {
  console.log("Sending status check request to server...");
  const response = await axios.get<TaskStatusResponse>(
    `${process.env.NEXT_PUBLIC_API_SVR}/task-status/${taskId}`
  );

  return response.data;
};
