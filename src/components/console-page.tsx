/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || "";

import { useEffect, useRef, useCallback, useState } from "react";

import { RealtimeClient } from "@openai/realtime-api-beta";
import { ItemType } from "@openai/realtime-api-beta/dist/lib/client.js";
import { WavRecorder, WavStreamPlayer } from "../lib/wavtools/index";
import { instructions, randomExclamation } from "@/lib/prompts";
import { WavRenderer } from "@/lib/wav_renderer";

// import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather';
// import { Button } from '../components/button/Button';
// import { Toggle } from '../components/toggle/Toggle';
// import { Map } from '../components/Map';

import "./console-page.scss";
// import { isJsxOpeningLikeElement } from "typescript";
import { Button } from "./ui/button";
import { ArrowDown, ArrowUp, Edit, X, Zap, ZapOff } from "lucide-react";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
  isServerResponseCreatedEvent,
  isServerResponseTextDeltaEvent,
  isServerResponseTextDoneEvent,
  RealtimeEvent,
} from "@/lib/openai-rt-types";
import { useLazyRef } from "@/lib/use-lazy-ref";
import { ElevenLabsClient } from "@/lib/elevenlabs-client";
import { useAudioPlayQueue } from "./audio-chatbot/use-audio-play-queue";
import VideoInput from "./video-input";
import {
  ChatbotSettings,
  DEFAULT_CHATBOT_SETTINGS,
} from "./audio-chatbot/types";
import WebcamSelector from "./webcam-selector";
import { useCardSpotter } from "./audio-chatbot/use-card-spotter";
import { TarotCardHand } from "@/lib/dtos";
import SettingsDrawer from "./audio-chatbot/settings-drawer";

export function ConsolePage() {
  const [chatbotSettings, setChatbotSettings] = useState<ChatbotSettings>(
    DEFAULT_CHATBOT_SETTINGS
  );

  useEffect(() => {
    const savedSettings = localStorage.getItem("chatbotSettings");
    if (savedSettings) {
      setChatbotSettings({
        ...DEFAULT_CHATBOT_SETTINGS,
        ...JSON.parse(savedSettings),
      });
    }
  }, []);

  /**
   * Ask user for API Key
   * If we're using the local relay server, we don't need this
   */
  const apiKey = LOCAL_RELAY_SERVER_URL
    ? ""
    : process.env.NEXT_PUBLIC_OPENAI_API_KEY || "";

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useLazyRef<WavRecorder>(
    () => new WavRecorder({ sampleRate: 24000, debug: true })
  );
  const wavStreamPlayerRef = useLazyRef<WavStreamPlayer>(
    () => new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useLazyRef<RealtimeClient>(() => {
    console.log("creating new RealtimeClient");
    return new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    );
  });

  const elevenlabsRef = useLazyRef<ElevenLabsClient>(() => {
    console.log("creating new ElevenLabsClient");
    return new ElevenLabsClient();
  });
  const audioPlayQueueEmpty = useCallback(async () => {
    console.log("audioPlayQueueEmpty");
    const wavRecorder = wavRecorderRef();
    const client = clientRef();
    if (wavRecorder.getStatus() === "paused") {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, [clientRef, wavRecorderRef]);
  const audioPlayQueueBegin = useCallback(() => {
    console.log("audioPlayQueueBegin");
    const wavRecorder = wavRecorderRef();
    if (wavRecorder.getStatus() === "recording") {
      wavRecorder.pause();
    }
  }, [wavRecorderRef]);
  const { pushAudio } = useAudioPlayQueue(
    audioPlayQueueBegin,
    audioPlayQueueEmpty
  );
  useEffect(() => {
    elevenlabsRef().audioConsumer = pushAudio;
  }, [elevenlabsRef, pushAudio]);

  const setWebcam = useCallback((deviceId: string) => {
    setChatbotSettings((settings) => ({ ...settings, webcamId: deviceId }));
  }, []);

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [currentGypsyState, setCurrentGypsyState] = useState<{
    conversation_stage:
      | "idle"
      | "need_major_arcana"
      | "need_minor_arcana"
      | "need_topic"
      | "reading"
      | "goodbye";
  }>({
    conversation_stage: "idle",
  });

  const onCardsSpotted = useCallback(
    (hand: TarotCardHand) => {
      console.log("onCardsSpotted", JSON.stringify({ hand }));
      setCurrentGypsyState({ conversation_stage: "need_minor_arcana" });
      clientRef().sendUserMessageContent([
        {
          type: `input_text`,
          text: `Here are the cards I have: ${hand.cards
            .map((card, i) => `${i + 1}: ${card.name}`)
            .join(", ")}`,
        },
      ]);
    },
    [clientRef]
  );
  // const cardSpotter = useCardSpotter(
  //   chatbotSettings,
  //   onCardsSpotted,
  //   pushAudio
  // );

  useEffect(() => {
    console.log(
      "conversation stage change",
      currentGypsyState.conversation_stage
    );
    if (currentGypsyState.conversation_stage === "need_major_arcana") {
      // cardSpotter.setWatchMode(true);
    } else {
      // cardSpotter.setWatchMode(false);
    }
  }, [currentGypsyState.conversation_stage]);

  /**
   * Utility for formatting the timing of logs
   */
  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + "";
      while (s.length < 2) {
        s = "0" + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  const onAudioChunk = useCallback(
    (audio: ArrayBuffer | Int16Array) => {
      const wavStreamPlayer = wavStreamPlayerRef();
      wavStreamPlayer.add16BitPCM(audio);
    },
    [wavStreamPlayerRef]
  );

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef();
    const wavRecorder = wavRecorderRef();
    const wavStreamPlayer = wavStreamPlayerRef();

    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
        // text: `For testing purposes, I want you to list ten car brands. Number each item, e.g. "one (or whatever number you are one): the item name".`,
      },
    ]);

    if (client.getTurnDetectionType() === "server_vad") {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, [clientRef, wavRecorderRef, wavStreamPlayerRef]);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    // cardSpotter.setWatchMode(false);

    const client = clientRef();
    client.disconnect();

    const wavRecorder = wavRecorderRef();
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef();
    await wavStreamPlayer.interrupt();
  }, [clientRef, wavRecorderRef, wavStreamPlayerRef]);

  const deleteConversationItem = useCallback(
    async (id: string) => {
      const client = clientRef();
      client.deleteItem(id);
    },
    [clientRef]
  );

  /**
   * In push-to-talk mode, start recording
   * .appendInputAudio() for each sample
   */
  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef();
    const wavRecorder = wavRecorderRef();
    const wavStreamPlayer = wavStreamPlayerRef();
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  /**
   * In push-to-talk mode, stop recording
   */
  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef();
    const wavRecorder = wavRecorderRef();
    await wavRecorder.pause();
    client.createResponse();
  };

  const turnEndType = clientRef().getTurnDetectionType() === "server_vad";
  /**
   * Switch between Manual <> VAD mode for communication
   */
  const changeTurnEndType = async (autoListen: boolean) => {
    const client = clientRef();
    const wavRecorder = wavRecorderRef();
    if (!autoListen && wavRecorder.getStatus() === "recording") {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: !autoListen
        ? null
        : {
            type: "server_vad",
            threshold: chatbotSettings.ortThreshold,
            prefix_padding_ms: chatbotSettings.ortPrefixPaddingMs,
            silence_duration_ms: chatbotSettings.ortSilenceDurationMs,
          },
    });
    if (autoListen && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(!autoListen);
  };

  /**
   * Auto-scroll the event logs
   */
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      // Only scroll if height has just changed
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll("[data-conversation-content]")
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef();
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef();
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext("2d");
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies("voice")
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              "#0099ff",
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext("2d");
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies("voice")
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              "#009900",
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, [wavRecorderRef, wavStreamPlayerRef]);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef();
    const client = clientRef();

    // Set instructions
    client.updateSession({ instructions: instructions });
    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: "whisper-1" } });
    client.updateSession({ modalities: ["text"] });
    client.updateSession({ temperature: 0.95 });

    // Add tools
    // client.addTool(
    //   {
    //     name: "set_memory",
    //     description: "Saves important data about the user into memory.",
    //     parameters: {
    //       type: "object",
    //       properties: {
    //         key: {
    //           type: "string",
    //           description:
    //             "The key of the memory value. Always use lowercase and underscores, no other characters.",
    //         },
    //         value: {
    //           type: "string",
    //           description: "Value can be anything represented as a string",
    //         },
    //       },
    //       required: ["key", "value"],
    //     },
    //   },
    //   async ({ key, value }: { [key: string]: any }) => {
    //     setMemoryKv((memoryKv) => {
    //       const newKv = { ...memoryKv };
    //       newKv[key] = value;
    //       return newKv;
    //     });
    //     return { ok: true };
    //   }
    // );
    client.addTool(
      {
        name: "record_major_arcana_requested",
        description:
          "Records that the assistant has requested to hear the major arcana.",
        parameters: {},
      },
      async () => {
        console.log("record_major_arcana_requested");
        setCurrentGypsyState({ conversation_stage: "need_major_arcana" });
        return { conversation_stage: "need_major_arcana" };
      }
    );
    client.addTool(
      {
        name: "record_major_arcana_received",
        description:
          "Records that the user has provided the major arcana card.",
        parameters: {
          type: "object",
          properties: {
            card: {
              type: "string",
              description: "The name of the major arcana card",
            },
          },
        },
      },
      async () => {
        console.log("record_major_arcana_received");
        setCurrentGypsyState({ conversation_stage: "need_minor_arcana" });
        return { conversation_stage: "need_minor_arcana" };
      }
    );
    client.addTool(
      {
        name: "record_minor_arcana_requested",
        description:
          "Records that the assistant has requested to hear the major arcana.",
        parameters: {},
      },
      async () => {
        console.log("record_major_arcana_requested");
        setCurrentGypsyState({ conversation_stage: "need_minor_arcana" });
        return { conversation_stage: "need_minor_arcana" };
      }
    );
    client.addTool(
      {
        name: "record_minor_arcana_received",
        description:
          "Records that the user has provided the minor arcana cards.",
        parameters: {
          type: "object",
          properties: {
            cards: {
              type: "array",
              items: {
                type: "string",
                description: "The name of a minor arcana card",
              },
              description: "A list of minor arcana cards",
            },
          },
        },
      },
      async ({ cards }: { cards: string[] }) => {
        console.log("record_minor_arcana_received", JSON.stringify(cards));
        setCurrentGypsyState({ conversation_stage: "need_topic" });
        return { conversation_stage: "reading" };
      }
    );
    client.addTool(
      {
        name: "record_topic_received",
        description:
          "Records that the user has provided a topic on which to perform the reading.",
        parameters: {
          type: "object",
          properties: { topic: { type: "string" } },
        },
      },
      async ({ cards }: { cards: string[] }) => {
        console.log("record_topic_received", JSON.stringify(cards));
        setCurrentGypsyState({ conversation_stage: "reading" });
        return { conversation_stage: "reading" };
      }
    );
    client.addTool(
      {
        name: "record_reading_provided",
        description: "Records that the seer has provided the reading.",
        parameters: {},
      },
      async () => {
        console.log("record_reading_provided");
        setCurrentGypsyState({ conversation_stage: "goodbye" });
        return { conversation_stage: "goodbye" };
      }
    );
    client.addTool(
      {
        name: "record_goodbye_made",
        description: "Records that the seer has provided the reading.",
        parameters: {},
      },
      async () => {
        console.log("record_goodbye_made");
        setTimeout(() => {
          // apparently we need to tell the server to clear all of the items
          // by hand
          client.conversation.getItems().forEach((item) => {
            console.log("deleting item", item.id);
            client.deleteItem(item.id);
          });
          client.conversation.clear();
          setCurrentGypsyState({ conversation_stage: "idle" });
          console.log("CONVERSATION CLEARED");
        }, 5000);
        setCurrentGypsyState({ conversation_stage: "goodbye" });
        return { conversation_stage: "goodbye" };
      }
    );
    // handle realtime events from client + server for event logging
    client.on("realtime.event", (realtimeEvent: RealtimeEvent) => {
      // console.log("realtimeEvent:", JSON.stringify(realtimeEvent));
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
      if (realtimeEvent.source === "server") {
        if (isServerResponseTextDeltaEvent(realtimeEvent.event)) {
          // console.log(realtimeEvent.event.delta);
          elevenlabsRef().sendText(realtimeEvent.event.delta);
        } else if (isServerResponseTextDoneEvent(realtimeEvent.event)) {
          console.log("DONE\n", realtimeEvent.event.text);
          elevenlabsRef().sendTextDone();
        }
      }
    });
    client.on("error", (event: any) => console.error(event));
    client.on("conversation.interrupted", async () => {
      const trackSampleOffset = wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        client.cancelResponse(trackId, offset);
      }
    });
    client.on("conversation.updated", async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === "completed" && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });
    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, [clientRef, elevenlabsRef, wavStreamPlayerRef]);

  const updateSessionTurnDetection = useCallback(
    (
      threshold: number,
      prefix_padding_ms: number,
      silence_duration_ms: number
    ) => {
      const client = clientRef();
      client.updateSession({
        turn_detection: canPushToTalk
          ? null
          : {
              type: "server_vad",
              threshold,
              prefix_padding_ms,
              silence_duration_ms,
            },
      });
    },
    [canPushToTalk, clientRef]
  );

  /**
   * Render the application
   */
  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <span>Gypsy Console</span>
          <div>
            <SettingsDrawer
              updateSettings={(s) => {
                console.log(JSON.stringify(s));
                setChatbotSettings((prev) => ({ ...prev, ...s }));
                updateSessionTurnDetection(
                  s.ortThreshold ?? chatbotSettings.ortThreshold,
                  s.ortPrefixPaddingMs ?? chatbotSettings.ortPrefixPaddingMs,
                  s.ortSilenceDurationMs ?? chatbotSettings.ortSilenceDurationMs
                );
                localStorage.setItem(
                  "chatbotSettings",
                  JSON.stringify({ ...chatbotSettings, ...s })
                );
              }}
              settings={chatbotSettings}
            />
          </div>
          <div>
            <Button
              onClick={() =>
                setCurrentGypsyState((prev) => ({
                  conversation_stage:
                    prev.conversation_stage === "need_major_arcana"
                      ? "need_minor_arcana"
                      : "need_major_arcana",
                }))
              }
            >
              {`${
                currentGypsyState.conversation_stage === "need_major_arcana"
                  ? "need minor arcana"
                  : "need major arcana"
              }`}
            </Button>
          </div>
          <div>
            <Button onClick={() => pushAudio(randomExclamation())}>
              exclamation
            </Button>
          </div>
        </div>
      </div>
      <div className="content-main">
        <div className="content-logs">
          <div className="content-block events">
            <div className="visualization">
              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server">
                <canvas ref={serverCanvasRef} />
              </div>
            </div>
            <div className="content-block-title">events</div>
            <div
              className="content-block-body minheight maxheight"
              ref={eventsScrollRef}
            >
              {!realtimeEvents.length && `awaiting connection...`}
              {realtimeEvents.slice(-100).map((realtimeEvent, i) => {
                const count = realtimeEvent.count;
                const event = { ...realtimeEvent.event };
                if (event.type === "input_audio_buffer.append") {
                  event.audio = `[trimmed: ${event.audio.length} bytes]`;
                } else if (event.type === "response.audio.delta") {
                  event.delta = `[trimmed: ${event.delta.length} bytes]`;
                }
                return (
                  <div className="event" key={event.event_id}>
                    <div className="event-timestamp">
                      {formatTime(realtimeEvent.time)}
                    </div>
                    <div className="event-details">
                      <div
                        className="event-summary"
                        onClick={() => {
                          // toggle event details
                          const id = event.event_id;
                          const expanded = { ...expandedEvents };
                          if (expanded[id]) {
                            delete expanded[id];
                          } else {
                            expanded[id] = true;
                          }
                          setExpandedEvents(expanded);
                        }}
                      >
                        <div
                          className={`event-source ${
                            event.type === "error"
                              ? "error"
                              : realtimeEvent.source
                          }`}
                        >
                          {realtimeEvent.source === "client" ? (
                            <ArrowUp />
                          ) : (
                            <ArrowDown />
                          )}
                          <span>
                            {event.type === "error"
                              ? "error!"
                              : realtimeEvent.source}
                          </span>
                        </div>
                        <div className="event-type">
                          {event.type}
                          {count && ` (${count})`}
                        </div>
                      </div>
                      {!!expandedEvents[event.event_id] && (
                        <div className="event-payload">
                          {JSON.stringify(event, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-block conversation">
            <div className="content-block-title">conversation</div>
            <div className="content-block-body" data-conversation-content>
              {!items.length && `awaiting connection...`}
              {items.map((conversationItem, i) => {
                return (
                  <div className="conversation-item" key={conversationItem.id}>
                    <div className={`speaker ${conversationItem.role || ""}`}>
                      <div>
                        {(
                          conversationItem.role || conversationItem.type
                        ).replaceAll("_", " ")}
                      </div>
                      <div
                        className="close"
                        onClick={() =>
                          deleteConversationItem(conversationItem.id)
                        }
                      >
                        <X />
                      </div>
                    </div>
                    <div className={`speaker-content`}>
                      {/* tool response */}
                      {conversationItem.type === "function_call_output" && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      {/* tool call */}
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === "user" && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? "(awaiting transcript)"
                                : conversationItem.formatted.text ||
                                  "(item sent)")}
                          </div>
                        )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === "assistant" && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              "(truncated)"}
                          </div>
                        )}
                      {conversationItem.formatted.file && (
                        <audio
                          src={conversationItem.formatted.file.url}
                          controls
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-actions">
            <Label htmlFor="turn-end-type">Auto-listen</Label>
            <Switch
              id="turn-end-type"
              checked={turnEndType}
              onCheckedChange={changeTurnEndType}
            />
            <div className="spacer" />
            {isConnected && canPushToTalk && (
              <Button
                variant={isRecording ? "destructive" : "default"}
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              >
                {isRecording ? "release to send" : "push to talk"}
              </Button>
            )}
            <div className="spacer" />
            <Button
              variant={isConnected ? "default" : "outline"}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
            >
              {isConnected ? (
                <>
                  <ZapOff />
                  disconnect
                </>
              ) : (
                <>
                  <Zap />
                  connect
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="content-right">
          <div className="content-block map">
            <div className="content-block-body full">
              <div className="pt-8">{`ElevenLabs : ${
                elevenlabsRef().readyState
              }`}</div>
              <div className="py-4">version: 0.96</div>
              <div className="py-4">
                conv state: {currentGypsyState.conversation_stage}
              </div>
              <div className="py-4">
                {/* {cardSpotter.isWatchMode ? "Watching" : "Not watching"} */}
              </div>
              {/* <div>{`${JSON.stringify(cardSpotter.spotCardsResponse)}`}</div> */}
            </div>
            <div className="content-block-body">
              <div className="pt-8">
                <WebcamSelector
                  webcam={chatbotSettings.webcamId}
                  setWebcam={setWebcam}
                />
              </div>
            </div>{" "}
          </div>
          <div className="content-block kv">
            <div className="flex items-center justify-center mb-2">
              <VideoInput deviceId={chatbotSettings.webcamId} />
            </div>
            <div className="content-block-body content-kv">
              {JSON.stringify(memoryKv, null, 2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
