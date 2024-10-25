import { ReconnectingWebsocket } from "./reconnecting-websocket";
import base64js from "base64-js";

const SEER_MORGANA_VOICE_ID = "7NsaqHdLuKNFvEfjpUno";
const model = "eleven_turbo_v2_5";
const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${SEER_MORGANA_VOICE_ID}/stream-input?model_id=${model}`;
const MAX_BUFFER_SIZE = 100;
const MAX_DELAY_MS = 250;

interface BOSMessage {
  text: string;
  voice_settings?: {
    stability: number;
    similarity_boost: number;
  };
  xi_api_key?: string;
}

const READYSTATE_NAMES: Record<WebSocket["readyState"], string> = {
  0: "CONNECTING",
  1: "OPEN",
  2: "CLOSING",
  3: "CLOSED",
};

export class ElevenLabsClient {
  private _socket: ReconnectingWebsocket = new ReconnectingWebsocket(wsUrl);
  private _readyState: string = READYSTATE_NAMES[WebSocket.CLOSED];
  // const socket = new WebSocket(wsUrl);
  private _audioConsumer: (audioBlob: Blob) => void = () => {};

  constructor() {
    this._lastSendTime = Date.now();
    this._socket.subscribe("open", (s, event) => {
      console.log("WebSocket Opened");
      const bosMessage: BOSMessage = {
        text: " ",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        },
        xi_api_key: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || "", // replace with your API key
      };

      s.send(JSON.stringify(bosMessage));
    });
    this._socket.subscribe("message", (s, event) => {
      const response = JSON.parse(event.data);

      //   console.log("Server response:", response);

      if (response.audio) {
        const bytes = base64js.toByteArray(response.audio);

        // Create a Blob from the array buffer
        const audioBlob = new Blob([bytes], { type: "audio/wav" });

        // Add the blob to the queue
        this._audioConsumer(audioBlob);
        console.log("Received audio chunk", audioBlob.size);
      } else {
        console.log("No audio data in the response");
      }

      if (response.isFinal) {
        // the generation is complete
      }

      if (response.normalizedAlignment) {
        // use the alignment info if needed
      }
    });
    this._socket.subscribe("error", (s, event) => {
      console.error("WebSocket Error:", event);
    });
    this._socket.subscribe("close", (s, event) => {
      if (event.wasClean) {
        console.info(
          `Connection closed cleanly, code=${event.code}, reason=${event.reason}`
        );
      } else {
        console.warn("Connection died");
      }
    });
    this._socket.subscribe("readyStateChange", (readyState) => {
      console.log("WebSocket readyStateChange", readyState);
      this._readyState = READYSTATE_NAMES[readyState];
    });
  }

  online() {
    this._socket.get();
  }

  offline() {
    this._socket.close();
    this._socket.unsubscribeAll();
  }

  private _lastSendTime: number;
  private _sendBuffer: string = "";

  async sendText(text: string) {
    // buffer up
    this._sendBuffer += text;
    console.log(
      "sendText",
      this._sendBuffer.length,
      Date.now() - this._lastSendTime
    );
    if (
      Date.now() - this._lastSendTime <= MAX_DELAY_MS &&
      this._sendBuffer.length < MAX_BUFFER_SIZE
    ) {
      console.log(
        "buffering",
        JSON.stringify({
          text,
          buffer: this._sendBuffer,
          delay: Date.now() - this._lastSendTime,
        })
      );
      return;
    } else {
      try {
        const s = await this._socket.get();
        if (this._sendBuffer.length > 0) {
          s.send(JSON.stringify({ text: this._sendBuffer }));
          console.log(
            "sent",
            JSON.stringify({
              text,
              buffer: this._sendBuffer,
              delay: Date.now() - this._lastSendTime,
            })
          );
          this._lastSendTime = Date.now();
          this._sendBuffer = "";
        } else {
          console.log("no text to send");
        }
      } catch (e) {
        console.error("sendText", e);
      }
    }
  }
  async sendTextDone() {
    console.log("sendTextDone");
    try {
      const s = await this._socket.get();
      if (this._sendBuffer.length > 0) {
        console.log("sending final buffer", this._sendBuffer);
        s.send(JSON.stringify({ text: this._sendBuffer }));
        this._sendBuffer = "";
        this._lastSendTime = Date.now();
      }

      s.send(JSON.stringify({ text: "" }));
    } catch (e) {
      console.error("sendTextDone", e);
    }
  }
  get readyState() {
    return this._readyState;
  }

  set audioConsumer(consumer: (audioBlob: Blob) => void) {
    this._audioConsumer = consumer;
  }
}
