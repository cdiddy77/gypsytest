import React, { useState, useEffect } from "react";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface Props {
  webcam: string;
  setWebcam: (webcam: string) => void;
}
const WebcamSelector: React.FC<Props> = ({ webcam, setWebcam }) => {
  const [webcams, setWebcams] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const getWebcams = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(
          (device) => device.kind === "videoinput"
        );
        console.log(
          "videoDevices",
          JSON.stringify({
            // devices,
            videoDevices: videoDevices.map((d) => d.label),
          })
        );
        setWebcams(videoDevices);
        if (videoDevices.length > 0) {
          setWebcam(videoDevices[0].deviceId);
        }
      } catch (error) {
        console.error("Error accessing webcams:", error);
      }
    };

    getWebcams();
  }, [setWebcam]);

  return (
    <div>
      <Label htmlFor="webcam-select">Select Webcam: </Label>
      <Select value={webcam} onValueChange={setWebcam}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select a webcam" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Available video sources</SelectLabel>
            {webcams.map((webcam) => (
              <SelectItem
                key={webcam.deviceId}
                value={webcam.deviceId || "none"}
              >
                {webcam.label || `Webcam ${webcam.deviceId}`}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default WebcamSelector;
