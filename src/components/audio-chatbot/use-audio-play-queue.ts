import React from "react";

export function useAudioPlayQueue(onAudioQueueEmpty: () => void) {
  const audioQueueRef = React.useRef<Blob[]>([]);
  const isPlayingRef = React.useRef(false);
  const queueLength = audioQueueRef.current.length;

  const playNext = React.useCallback(async () => {
    isPlayingRef.current = true; // Mark as playing
    while (audioQueueRef.current.length > 0) {
      const nextAudioBlob = audioQueueRef.current.shift();

      // Create an audio URL and play it
      if (nextAudioBlob) {
        const audioUrl = URL.createObjectURL(nextAudioBlob);
        const audio = new Audio(audioUrl);
        let playComplete = false;
        try {
          // Play the audio and wait until it finishes
          await audio.play();
          playComplete = true;
        } catch (e) {
          console.error(`Error playing audio:${audioUrl.slice(0, 20)}`, e);
        }
        // When the audio finishes, clean up and play the next chunk
        if (playComplete) {
          try {
            await new Promise<void>((resolve) => {
              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                console.log("Audio ended", audioQueueRef.current.length);
                resolve();
              };
            });
          } catch (e) {
            console.error("Error waiting for audio to end", e);
          }
        } else {
          URL.revokeObjectURL(audioUrl);
          console.log("failure playing audio", audioQueueRef.current.length);
        }
      }
    }
    // If the queue is empty, call the onAudioQueueEmpty callback
    isPlayingRef.current = false; // Mark as not playing
    onAudioQueueEmpty();
  }, [onAudioQueueEmpty]);

  const pushAudio = React.useCallback(
    (audioBlob: Blob) => {
      audioQueueRef.current.push(audioBlob);
      if (!isPlayingRef.current) {
        playNext();
      }
    },
    [playNext]
  );

  return React.useMemo(
    () => ({ pushAudio, isPlaying: audioQueueRef.current.length > 0 }),
    [pushAudio]
  );
}
