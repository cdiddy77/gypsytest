"use client";
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import base64js from "base64-js";

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [, setAudioBlob] = useState<Blob | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | number>();

  // Start listening to the microphone when the component mounts
  const startRecording = async () => {
    console.log("Starting recording...");
    audioContextRef.current = new AudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    // mediaRecorderRef.current = mediaRecorder;

    let audioChunks: BlobPart[] = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      console.log("Recording stopped.");
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      setAudioBlob(audioBlob);
      // Reset audio chunks for next recording
      audioChunks = [];
      // Send the audio to server
      sendAudioToServer(audioBlob);
    };

    mediaRecorder.start();
    setIsRecording(true);

    // Setup silence detection
    const audioSource = audioContextRef.current.createMediaStreamSource(stream);
    const analyser = audioContextRef.current.createAnalyser();
    audioSource.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkSilence = () => {
      analyser.getByteFrequencyData(dataArray);
      const volume = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
      // console.log("Volume:", volume);
      // If silence (volume < threshold), stop recording after 0.5 seconds
      if (volume < 5) {
        if (!silenceTimeoutRef.current) {
          silenceTimeoutRef.current = setTimeout(() => {
            mediaRecorder.stop();
            setIsRecording(false);
          }, 500);
        }
      } else {
        // If there's noise, clear the silence timeout
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = undefined;
      }
    };

    // Check for silence periodically
    const silenceCheckInterval = setInterval(checkSilence, 100);

    // Cleanup on component unmount
    return () => {
      clearInterval(silenceCheckInterval);
      if (audioContextRef.current) audioContextRef.current.close();
      stream.getTracks().forEach((track) => track.stop());
    };
  };

  const [audioQueue, setAudioQueue] = useState<Blob[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    axios.get(process.env.NEXT_PUBLIC_API_SVR + "/status").then((response) => {
      console.log("Server status:", response.data);
    });
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Your browser does not support audio recording.");
      return;
    }
    // Create an EventSource to connect to the SSE endpoint
    const eventSource = new EventSource(
      process.env.NEXT_PUBLIC_API_SVR + "/response-events"
    );
    eventSource.onmessage = (event) => {
      // Decode base64 audio data using base64-js
      const base64Audio = event.data;
      const bytes = base64js.toByteArray(base64Audio);

      // Create a Blob from the array buffer
      const audioBlob = new Blob([bytes], { type: "audio/wav" });

      // Add the blob to the queue
      setAudioQueue((prevQueue) => [...prevQueue, audioBlob]);
    };

    eventSource.onerror = (error) => {
      console.error("Error with SSE:", error);
      eventSource.close();
    };

    return () => {
      console.log("Closing EventSource...");
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    // Play audio chunks in order as they arrive
    const playNext = async () => {
      if (audioQueue.length > 0 && !isPlayingRef.current) {
        isPlayingRef.current = true; // Mark as playing
        const nextAudioBlob = audioQueue[0];

        // Create an audio URL and play it
        const audioUrl = URL.createObjectURL(nextAudioBlob);
        const audio = new Audio(audioUrl);

        // Play the audio and wait until it finishes
        await audio.play();

        // When the audio finishes, clean up and play the next chunk
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setAudioQueue((prevQueue) => prevQueue.slice(1)); // Remove the played chunk
          isPlayingRef.current = false; // Mark as not playing
        };
      }
    };

    // Try to play the next chunk whenever the queue changes
    if (!isPlayingRef.current) {
      playNext();
    }
  }, [audioQueue]);

  return (
    <div>
      <h1>Mic Recording App</h1>
      <Button
        disabled={isRecording}
        onClick={() => {
          console.log("Start button clicked");
          startRecording();
        }}
      >
        Start
      </Button>
      <p>{isRecording ? "Recording..." : "Stopped"}</p>
      {/* {audioBlob && <audio controls src={URL.createObjectURL(audioBlob)} />} */}
    </div>
  );
}

const sendAudioToServer = async (audioBlob: Blob) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.wav");

  try {
    console.log("Sending audio to server...");
    const response = await axios.post(
      process.env.NEXT_PUBLIC_API_SVR + "/upload-audio",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob", // Expecting a blob back from the server
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const playAudio = (audioUrl: string) => {
  const audio = new Audio(audioUrl);
  audio.play();
};

export default App;
