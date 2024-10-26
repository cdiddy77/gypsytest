"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import SettingsDrawer from "./settings-drawer";
import {
  ChatbotSettings,
  DEFAULT_CHATBOT_SETTINGS,
  DEFAULT_WEBCAM_ID,
} from "./types";
import { useAudioRecord } from "./use-audio-record";
import axios, { AxiosResponse } from "axios";
import { useAudioPlayQueue } from "./use-audio-play-queue";
import base64js from "base64-js";
import { RefreshCcw } from "lucide-react";
import { Button } from "../ui/button";
import {
  ResetConversationRequest,
  ResetConversationResponse,
} from "@/lib/dtos";
import VideoInput from "../video-input";
import { useReadingRecognizer } from "./use-reading-recognizer";

export default function AudioChatbot() {
  const [chatbotSettings, setChatbotSettings] = useState<ChatbotSettings>(
    DEFAULT_CHATBOT_SETTINGS
  );
  const [isListenMode, setIsListenMode] = useState(false);
  const [serverStatus, setServerStatus] = useState("offline");
  const [audioState, setAudioState] = useState<
    "not-listening" | "listening" | "audio-sent" | "playing"
  >("not-listening");
  // const speakingTimeoutRef = useRef<NodeJS.Timeout | number>();

  const onAudioRecorded = useCallback(
    async (audioBlob: Blob, maxRecordingVolume: number) => {
      console.log("onAudioRecorded");
      setAudioState("audio-sent");
      console.log("maxRecordingVolume", maxRecordingVolume);
      if (maxRecordingVolume > chatbotSettings.sendVolumeThreshold) {
        await sendAudioToServer(audioBlob, chatbotSettings);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        console.log("audio sent");
        setAudioState((prev) =>
          prev === "audio-sent" ? "not-listening" : prev
        );
      } else {
        setAudioState("not-listening");
      }
    },
    [chatbotSettings]
  );

  const resetConversation = useCallback(() => {
    console.log("resetConversation");
    axios
      .post<
        ResetConversationResponse,
        AxiosResponse<ResetConversationResponse>,
        ResetConversationRequest
      >(`${process.env.NEXT_PUBLIC_API_SVR}/reset-conversation`, {
        system_message: chatbotSettings.systemMessage,
      })
      .then((response) => {
        console.log("Reset result:", response);
      })
      .catch((error) => {
        console.log("Error resetting conversation:", error);
      });
  }, [chatbotSettings.systemMessage]);

  const { startRecording, volume } = useAudioRecord(
    onAudioRecorded,
    chatbotSettings
  );

  const onAudioQueueEmpty = useCallback(() => {
    console.log("onAudioQueueEmpty");
    setAudioState("not-listening");
  }, []);

  const { pushAudio, isPlaying } = useAudioPlayQueue(() => {},
  onAudioQueueEmpty);

  const readingRecognizer = useReadingRecognizer(chatbotSettings, pushAudio);

  useEffect(() => {
    console.log("isPlaying:", isPlaying);
    if (isPlaying) {
      setAudioState("playing");
    }
  }, [isPlaying]);

  // this means that if we aren't playing audio, we are listening
  const onListenModeToggle = useCallback((listenModeSetting: boolean) => {
    setIsListenMode(listenModeSetting);
  }, []);

  useEffect(() => {
    const savedSettings = localStorage.getItem("chatbotSettings");
    if (savedSettings) {
      setChatbotSettings({
        ...DEFAULT_CHATBOT_SETTINGS,
        ...JSON.parse(savedSettings),
      });
    }
  }, []);

  const audioEventSourceRef = useRef<EventSource | null>(null);
  const ensureAudioEventSource = useCallback(() => {
    console.log("ensureAudioEventSource");
    if (audioEventSourceRef.current === null) {
      console.log("Creating EventSource...");
      // Create an EventSource to connect to the SSE endpoint
      audioEventSourceRef.current = new EventSource(
        `${process.env.NEXT_PUBLIC_API_SVR}/response-events`
      );
      audioEventSourceRef.current.onmessage = (event) => {
        // Decode base64 audio data using base64-js
        const base64Audio = event.data;
        const bytes = base64js.toByteArray(base64Audio);

        // Create a Blob from the array buffer
        const audioBlob = new Blob([bytes], { type: "audio/wav" });

        // Add the blob to the queue
        pushAudio(audioBlob);
      };
      audioEventSourceRef.current.addEventListener("close", () => {
        console.log("EventSource wow we got a close event");
        if (audioEventSourceRef.current) {
          audioEventSourceRef.current.close();
          audioEventSourceRef.current = null;
        }
      });

      audioEventSourceRef.current.addEventListener("error", (error) => {
        console.error("Server Processing Error", error);
        if (audioEventSourceRef.current) {
          audioEventSourceRef.current.close();
          audioEventSourceRef.current = null;
        }
      });

      audioEventSourceRef.current.onerror = (error) => {
        console.error("Error with SSE:", error);
        if (audioEventSourceRef.current) {
          audioEventSourceRef.current.close();
          audioEventSourceRef.current = null;
        }
      };
    }
  }, [pushAudio]);

  useEffect(() => {
    console.log("audioState:", audioState);
    if (isPlaying) {
      setAudioState("playing");
    } else if (audioState === "not-listening" && isListenMode) {
      setAudioState("listening");
      startRecording();
    } else if (audioState === "audio-sent") {
      ensureAudioEventSource();
    }
  }, [
    audioState,
    ensureAudioEventSource,
    isListenMode,
    isPlaying,
    startRecording,
  ]);

  const checkStatus = useCallback(() => {
    setServerStatus("checking...");
    axios
      .get(`${process.env.NEXT_PUBLIC_API_SVR}/status`)
      .then((response) => {
        console.log("Server status:", response.data);
        setServerStatus(response.data.status);
      })
      .catch((error) => {
        setServerStatus("offline");
      });
  }, []);
  useEffect(() => {
    checkStatus();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Your browser does not support audio recording.");
      return;
    }

    return () => {
      if (audioEventSourceRef.current) {
        console.log("Closing EventSource...");
        audioEventSourceRef.current.close();
        audioEventSourceRef.current = null;
      }
    };
  }, [checkStatus]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <div className="w-full h-full max-w-md bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <Label htmlFor="listening-mode" className="text-lg font-medium">
            Listening Mode
          </Label>
          <div className="flex items-center space-x-4">
            <Switch
              id="listening-mode"
              checked={isListenMode}
              onCheckedChange={onListenModeToggle}
            />
            <SettingsDrawer
              updateSettings={(s) => {
                console.log(JSON.stringify(s));
                setChatbotSettings((prev) => ({ ...prev, ...s }));
                localStorage.setItem(
                  "chatbotSettings",
                  JSON.stringify({ ...chatbotSettings, ...s })
                );
              }}
              settings={chatbotSettings}
            />
          </div>
        </div>
        <div className="relative h-32 bg-gray-200 rounded-lg overflow-hidden mb-4">
          {audioState === "listening" && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
            >
              <div className="text-white text-2xl w-32 h-32 bg-blue-500 rounded-full opacity-50 flex items-center justify-center">
                <div>{Math.round(volume)}</div>
              </div>
            </motion.div>
          )}
          {audioState === "playing" && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            >
              <div className="w-32 h-32 border-4 border-green-500 rounded-full border-t-transparent" />
            </motion.div>
          )}
          {audioState === "audio-sent" && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            >
              <div className="w-32 h-32 border-4 bg-red-500 rounded-full border-t-transparent" />
            </motion.div>
          )}
        </div>
        <div className="flex flex-row items-center justify-between mb-2">
          <p className="text-center text-gray-600">
            {(() => {
              switch (audioState) {
                case "listening":
                  return "Listening...";
                case "audio-sent":
                  return "Waiting for response...";
                case "playing":
                  return "Playing...";
                case "not-listening":
                  return "Listening mode is off";
              }
            })()}
          </p>
        </div>
        <hr className="mb-2" />
        <div className="flex items-center justify-between mb-4">
          <Label htmlFor="watching-mode" className="text-lg font-medium">
            Watching Mode
          </Label>
          <div className="flex items-center space-x-4">
            <Switch
              id="watching-mode"
              checked={readingRecognizer.isWatchMode}
              onCheckedChange={readingRecognizer.setWatchMode}
            />
          </div>
        </div>
        <div className="flex items-center justify-center mb-2">
          <VideoInput deviceId={chatbotSettings.webcamId} />
        </div>
        <div className="flex flex-row items-center justify-between mb-2">
          <p className="text-center text-gray-600">
            {(() => {
              switch (readingRecognizer.readingStatus) {
                case "error":
                  return "Error";
                case "no_cards":
                  return "No cards detected";
                case "verifying_cards":
                  return "Verifying cards...";
                case "requesting_reading":
                  return "Requesting reading...";
                case "reading_tts_requested":
                  return "Reading TTS requested...";
                case "reading_tts_complete":
                  return "Reading TTS complete";
              }
            })()}
          </p>
        </div>{" "}
        <div className="flex items-center justify-between">
          <Button onClick={resetConversation}>Reset Conversation</Button>
          <p className="text-center text-gray-600">
            <RefreshCcw
              onClick={checkStatus}
              className="inline cursor-pointer hover:bg-gray-200 rounded-full p-1"
            />{" "}
            Server Status: {serverStatus}
          </p>{" "}
        </div>
      </div>
    </div>
  );
}

const sendAudioToServer = async (
  audioBlob: Blob,
  settings: ChatbotSettings
) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.wav");
  formData.append("prompt", settings.prompt);
  formData.append("temperature", settings.temperature.toString());
  formData.append("max_new_tokens", settings.maxTokens.toString());
  try {
    console.log("Sending audio to server...");
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_API_SVR}/upload-audio`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob", // Expecting a blob back from the server
        timeout: 3000,
      }
    );
    console.log("Response from server:", response.data);
    // Create a URL for the returned audio blob
    // const audioUrl = URL.createObjectURL(response.data);
    // playAudio(audioUrl);
  } catch (error) {
    console.error("Error sending audio to server:", error);
  }
};
