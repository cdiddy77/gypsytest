import React from "react";
import { ChatbotSettings } from "./types";

export function useAudioRecord(
  onAudioRecorded: (audioBlob: Blob, maxRecordingVolume: number) => void,
  settings: ChatbotSettings
) {
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const recordingStartTimeRef = React.useRef<number | null>(null);
  const [volume, setVolume] = React.useState(0);
  const startRecording = React.useCallback(async () => {
    console.log("Starting recording...");
    audioContextRef.current = new AudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    let silenceTimeout: number | NodeJS.Timeout | undefined = undefined;
    let maxRecordingVolume = 0;
    // mediaRecorderRef.current = mediaRecorder;

    let audioChunks: BlobPart[] = [];

    mediaRecorder.ondataavailable = (event) => {
      console.log("Data available...");
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      console.log("Recording stopped.");
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      // Reset audio chunks for next recording
      audioChunks = [];
      // Send the audio to server
      onAudioRecorded(audioBlob, maxRecordingVolume);
      maxRecordingVolume = 0;
      recordingStartTimeRef.current = null;
    };

    mediaRecorder.start();
    recordingStartTimeRef.current = Date.now();

    // Setup silence detection
    const audioSource = audioContextRef.current.createMediaStreamSource(stream);
    const analyser = audioContextRef.current.createAnalyser();
    audioSource.connect(analyser);
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = settings.smoothingTimeConstant;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkSilence = () => {
      analyser.getByteFrequencyData(dataArray);
      const recentVolume = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
      // console.log("recentVolume:", recentVolume);
      // If silence (recentVolume < threshold), stop recording after 0.5 seconds
      // console.log(`Recent volume: ${recentVolume}`);
      maxRecordingVolume = Math.max(maxRecordingVolume, recentVolume);
      const elapsedTime = Date.now() - (recordingStartTimeRef.current || 0);
      if (elapsedTime > settings.maxRecordingTime * 1000) {
        console.log("Max recording time reached");
        mediaRecorder.stop();
      } else if (recentVolume < settings.silenceVolumeThreshold) {
        if (!silenceTimeout) {
          silenceTimeout = setTimeout(() => {
            mediaRecorder.stop();
          }, 500);
        }
      } else {
        // every half second, set the volume to the recent volume
        setVolume(recentVolume);
        // If there's noise, clear the silence timeout
        if (silenceTimeout) {
          clearTimeout(silenceTimeout);
        }
        silenceTimeout = undefined;
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
  }, [
    onAudioRecorded,
    settings.maxRecordingTime,
    settings.silenceVolumeThreshold,
    settings.smoothingTimeConstant,
  ]);

  return React.useMemo(
    () => ({ startRecording, volume }),
    [startRecording, volume]
  );
}
