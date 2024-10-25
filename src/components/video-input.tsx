import React, { useEffect, useRef } from "react";
import { DEFAULT_WEBCAM_ID } from "./audio-chatbot/types";

interface VideoInputProps {
  deviceId: string;
}

const VideoInput: React.FC<VideoInputProps> = ({ deviceId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  //   const [isVisible, setIsVisible] = React.useState(true);

  useEffect(() => {
    const setupVideoStream = async () => {
      try {
        let finalDeviceId = deviceId;

        if (deviceId === DEFAULT_WEBCAM_ID) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputDevices = devices.filter(
            (device) => device.kind === "videoinput"
          );
          if (videoInputDevices.length > 0) {
            finalDeviceId = videoInputDevices[0].deviceId;
          } else {
            throw new Error("No video input devices found");
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: finalDeviceId } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing video stream:", error);
      }
    };

    setupVideoStream();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [deviceId]);

  return <video ref={videoRef} autoPlay />;
};

export default VideoInput;
