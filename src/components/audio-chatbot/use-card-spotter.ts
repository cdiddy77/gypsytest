import { SpotCardsResponse, TarotCardHand } from "@/lib/dtos";
import React from "react";
import { ChatbotSettings, DEFAULT_WEBCAM_ID } from "./types";
import { wait } from "@/lib/utils";
import axios from "axios";
import { randomExclamation } from "@/lib/prompts";

export function useCardSpotter(
  settings: ChatbotSettings,
  onCardsSpotted: (hand: TarotCardHand) => void,
  pushAudio: (audio: Blob | string) => void
) {
  const onCardsSpottedRef = React.useRef(onCardsSpotted);

  React.useEffect(() => {
    onCardsSpottedRef.current = onCardsSpotted;
  }, [onCardsSpotted]);

  const [isWatchMode, setIsWatchMode] = React.useState(false);
  const isWatchModeRef = React.useRef<boolean>(false);
  const [spotCardsResponse, setSpotCardsResponse] =
    React.useState<SpotCardsResponse>({ hand: null, hand_verified: false });
  const spotCardsResponseRef =
    React.useRef<SpotCardsResponse>(spotCardsResponse);
  // const [readingStatus, setReadingStatus] =
  //   React.useState<ReadingStatus>("no_cards");
  const settingsRef = React.useRef<ChatbotSettings>(settings);
  const isRunningRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const runSpottingStateMachine = React.useCallback(async () => {
    if (isRunningRef.current) {
      console.log("Already running, returning");
      return;
    }
    isRunningRef.current = true;
    // let currentReadingStatus: ReadingStatus = "no_cards";
    // let currentTaskId: string = "";
    // while we are
    while (isWatchModeRef.current) {
      console.log(
        "running reading state machine",
        JSON.stringify({ current: spotCardsResponseRef.current })
      );
      try {
        // if the current status is no_cards or verifying, then send an image and wait for the response
        if ((spotCardsResponseRef.current.hand?.cards.length ?? 0) > 0) {
          await wait(settingsRef.current.verifyImageSendInterval * 1000);
        } else {
          await wait(settingsRef.current.imageSendInterval * 1000);
        }
        const imageBlob = await captureImageFromWebcam(
          settingsRef.current.webcamId
        );
        const response = await sendImageToServer(imageBlob);
        console.log("Response from server:", JSON.stringify({ response }));
        spotCardsResponseRef.current = response;
        setSpotCardsResponse(spotCardsResponseRef.current);
        if (response.hand_verified) {
          onCardsSpottedRef.current(response.hand ?? { cards: [] });
          isWatchModeRef.current = false;
          setIsWatchMode(false);
          isRunningRef.current = false;
          console.log(
            "Cards Spotted so Finished running reading state machine"
          );
          return;
        } else {
          pushAudio(randomExclamation());
        }
      } catch (e) {
        await wait(settingsRef.current.errorInterval * 1000);
      }
      isRunningRef.current = false;
      console.log("Finished running reading state machine");
    }
  }, []);

  const setWatchMode = React.useCallback(
    (isWatchMode: boolean) => {
      console.log(
        "Setting watch mode:(to/from):",
        isWatchMode,
        isWatchModeRef.current
      );
      if (isWatchMode === isWatchModeRef.current) {
        return;
      }
      isWatchModeRef.current = isWatchMode;
      if (isWatchMode) {
        runSpottingStateMachine();
      }
      setIsWatchMode(isWatchMode);
    },
    [runSpottingStateMachine]
  );

  return React.useMemo(
    () => ({
      isWatchMode,
      setWatchMode,
      spotCardsResponse,
    }),
    [isWatchMode, setWatchMode, spotCardsResponse]
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
  imageBlob: Blob
): Promise<SpotCardsResponse> => {
  const formData = new FormData();
  formData.append("image", imageBlob, "snapshot.jpg");
  try {
    console.log("Sending image to server...");
    const response = await axios.post<SpotCardsResponse>(
      `${process.env.NEXT_PUBLIC_API_SVR}/spot-cards/`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "json",
        timeout: 10_000,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error sending image to server:", error);
    throw error;
  }
};
