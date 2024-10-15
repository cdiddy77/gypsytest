"use client";
import React from "react";
import { ChatbotSettings } from "./types";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

interface Props {
  settings: ChatbotSettings;
  updateSettings: (newSettings: Partial<ChatbotSettings>) => void;
}

export default function SettingsDrawer({ settings, updateSettings }: Props) {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [systemMessage, setSystemMessage] = React.useState<string>("");
  const [prompt, setPrompt] = React.useState<string>("");
  const [temperature, setTemperature] = React.useState<number>(0.7);
  const [maxTokens, setMaxTokens] = React.useState<number | undefined>(100);
  const [silenceVolumeThreshold, setSilenceVolumeThreshold] =
    React.useState(10);
  const [maxRecordingTime, setMaxRecordingTime] = React.useState(10);
  const [sendVolumeThreshold, setSendVolumeThreshold] = React.useState(10);

  const onOpenChange = React.useCallback(
    (isOpen: boolean) => {
      setIsSettingsOpen(isOpen);
      if (!isOpen) {
        updateSettings({
          prompt,
          temperature,
          maxTokens: maxTokens || 100,
          systemMessage,
          silenceVolumeThreshold,
          maxRecordingTime,
          sendVolumeThreshold,
        });
      } else {
        setSystemMessage(settings.systemMessage);
        setPrompt(settings.prompt);
        setTemperature(settings.temperature);
        setMaxTokens(settings.maxTokens);
        setSilenceVolumeThreshold(settings.silenceVolumeThreshold);
        setMaxRecordingTime(settings.maxRecordingTime);
        setSendVolumeThreshold(settings.sendVolumeThreshold);
      }
    },
    [
      maxRecordingTime,
      maxTokens,
      prompt,
      sendVolumeThreshold,
      settings.maxRecordingTime,
      settings.maxTokens,
      settings.prompt,
      settings.sendVolumeThreshold,
      settings.silenceVolumeThreshold,
      settings.systemMessage,
      settings.temperature,
      silenceVolumeThreshold,
      systemMessage,
      temperature,
      updateSettings,
    ]
  );

  return (
    <Drawer
      open={isSettingsOpen}
      onOpenChange={onOpenChange}
      repositionInputs={false}
    >
      <DrawerTrigger className="relative flex h-10 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-4 text-sm font-medium border-2 shadow-sm transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white">
        <Settings className="h-4 w-4" />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Settings</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 bg-white rounded-t-[10px]">
          <div className="space-y-4 mb-8">
            <div>
              <Label htmlFor="systemMessage" className="text-sm font-medium">
                System Message
              </Label>
              <Textarea
                id="systemMessage"
                value={systemMessage}
                rows={6}
                onChange={(e) => setSystemMessage(e.target.value)}
                placeholder="Enter your system message here"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="prompt" className="text-sm font-medium">
                Prompt
              </Label>
              <Textarea
                id="prompt"
                value={prompt}
                rows={2}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="temperature" className="text-sm font-medium">
                Temperature: {temperature.toFixed(2)}
              </Label>
              <Slider
                id="temperature"
                min={0}
                max={1}
                step={0.01}
                value={[temperature]}
                onValueChange={(value) => setTemperature(value[0])}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="max-tokens" className="text-sm font-medium">
                Max Tokens
              </Label>
              <Input
                id="max-tokens"
                type="number"
                min={1}
                value={maxTokens}
                onChange={(e) =>
                  setMaxTokens(
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                className="mt-1"
              />
            </div>
            <hr className="border-gray-200 my-4" />
            <div>
              <Label
                htmlFor="silenceVolumeThreshold"
                className="text-sm font-medium"
              >
                Silence Volume Threshold: {silenceVolumeThreshold.toFixed(0)}
              </Label>
              <Slider
                id="silenceVolumeThreshold"
                min={5}
                max={80}
                step={5}
                value={[silenceVolumeThreshold]}
                onValueChange={(value) => setSilenceVolumeThreshold(value[0])}
                className="mt-1"
              />
            </div>
            <div>
              <Label
                htmlFor="sendVolumeThreshold"
                className="text-sm font-medium"
              >
                Send Volume Threshold: {sendVolumeThreshold.toFixed(0)}
              </Label>
              <p className="text-xs">
                The recorder must hear something above this threshold
              </p>
              <Slider
                id="sendVolumeThreshold"
                min={10}
                max={80}
                step={5}
                value={[sendVolumeThreshold]}
                onValueChange={(value) => setSendVolumeThreshold(value[0])}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="maxRecordingTime" className="text-sm font-medium">
                Max Recording Time (s): {maxRecordingTime.toFixed(0)}
              </Label>
              <Slider
                id="maxRecordingTime"
                min={5}
                max={30}
                step={5}
                value={[maxRecordingTime]}
                onValueChange={(value) => setMaxRecordingTime(value[0])}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
