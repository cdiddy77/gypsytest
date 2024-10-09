import React from "react";

export function useAudioPlayQueue(onAudioQueueEmpty: () => void) {
  const [audioQueue, setAudioQueue] = React.useState<Blob[]>([]);
  const isPlayingRef = React.useRef(false);

  React.useEffect(() => {
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
          console.log("Audio ended", audioQueue.length);
        };
      } else if (audioQueue.length === 0) {
        // If the queue is empty, call the onAudioQueueEmpty callback
        onAudioQueueEmpty();
      }
    };

    // Try to play the next chunk whenever the queue changes
    if (!isPlayingRef.current) {
      playNext();
    }
  }, [audioQueue, onAudioQueueEmpty]);

  const pushAudio = React.useCallback((audioBlob: Blob) => {
    setAudioQueue((prevQueue) => [...prevQueue, audioBlob]);
  }, []);

  return React.useMemo(
    () => ({ pushAudio, isPlaying: audioQueue.length > 0 }),
    [audioQueue.length, pushAudio]
  );
}
