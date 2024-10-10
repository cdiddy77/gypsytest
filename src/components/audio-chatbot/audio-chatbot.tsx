"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import SettingsDrawer from "./settings-drawer";
import { ChatbotSettings } from "./types";
import { useAudioRecord } from "./use-audio-record";
import axios from "axios";
import { useAudioPlayQueue } from "./use-audio-play-queue";
import base64js from "base64-js";
import { on } from "events";

export default function AudioChatbot() {
  const [chatbotSettings, setChatbotSettings] = useState<ChatbotSettings>({
    prompt: "You are a roma gypsy",
    temperature: 0.7,
    maxTokens: 50,
  });
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
      if (maxRecordingVolume > 20) {
        await sendAudioToServer(audioBlob);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        console.log("audio sent");
        setAudioState((prev) =>
          prev === "audio-sent" ? "not-listening" : prev
        );
      } else {
        setAudioState("not-listening");
      }
    },
    []
  );

  const { startRecording, volume } = useAudioRecord(onAudioRecorded);

  const onAudioQueueEmpty = useCallback(() => {
    console.log("onAudioQueueEmpty");
    setAudioState("not-listening");
  }, []);

  const { pushAudio, isPlaying } = useAudioPlayQueue(onAudioQueueEmpty);

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
      setChatbotSettings(JSON.parse(savedSettings));
    }
  }, []);

  const audioEventSourceRef = useRef<EventSource | null>(null);
  const ensureAudioEventSource = useCallback(() => {
    console.log("ensureAudioEventSource");
    if (audioEventSourceRef.current === null) {
      console.log("Creating EventSource...");
      // Create an EventSource to connect to the SSE endpoint
      audioEventSourceRef.current = new EventSource("/api/response-events");
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
    axios
      .get("/api/status")
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
        <div className="flex items-center justify-between mb-8">
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
                setChatbotSettings(s);
                localStorage.setItem("chatbotSettings", JSON.stringify(s));
              }}
              settings={chatbotSettings}
            />
          </div>
        </div>
        <div className="relative h-64 bg-gray-200 rounded-lg overflow-hidden mb-4">
          {audioState === "listening" && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={false}
              style={{ scale: 1 + volume * 0.01 }}
              transition={{ repeat: Infinity, duration: 0.2 }}
            >
              <div className="w-32 h-32 bg-blue-500 rounded-full opacity-50" />
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
        <div className="flex flex-row items-center justify-between mb-8">
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
          </p>{" "}
          <p className="text-center text-gray-600">
            Server Status: {serverStatus}
          </p>
        </div>
      </div>
    </div>
  );
}

const sendAudioToServer = async (audioBlob: Blob) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.wav");

  try {
    console.log("Sending audio to server...");
    const response = await axios.post("/api/upload-audio", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      responseType: "blob", // Expecting a blob back from the server
      timeout: 3000,
    });
    console.log("Response from server:", response.data);
    // Create a URL for the returned audio blob
    // const audioUrl = URL.createObjectURL(response.data);
    // playAudio(audioUrl);
  } catch (error) {
    console.error("Error sending audio to server:", error);
  }
};
