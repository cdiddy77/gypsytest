import EventEmitter from "eventemitter3";

interface WebsocketEvents {
  open: [WebSocket, Event];
  message: [WebSocket, MessageEvent];
  error: [WebSocket, Event];
  close: [WebSocket, CloseEvent];
  readyStateChange: [WebSocket["readyState"]];
}
export class ReconnectingWebsocket {
  private events = new EventEmitter<WebsocketEvents>();
  private socket: Promise<WebSocket> | null = null;

  constructor(private url: string) {}

  get(): Promise<WebSocket> {
    if (this.socket === null) {
      this.socket = new Promise((resolve) => {
        const s = new WebSocket(this.url);
        this.events.emit("readyStateChange", s.readyState);
        s.onopen = (event) => {
          //   console.log("WebSocket Emitting Opened");
          this.events.emit("readyStateChange", s.readyState);
          this.events.emit("open", s, event);
          resolve(s);
        };
        s.onmessage = (event) => {
          //   console.log("WebSocket Emitting Message");
          this.events.emit("message", s, event);
        };
        s.onerror = (event) => {
          console.error("WebSocket Emitting Error");
          this.events.emit("error", s, event);
        };
        s.onclose = (event) => {
          console.log("WebSocket Emitting Close");
          if (this.socket === null) {
            throw new Error("Socket is null");
          }
          this.events.emit("readyStateChange", s.readyState);
          this.events.emit("close", s, event);
          this.socket = null;
        };
      });
    }
    return this.socket;
  }

  subscribe<T extends keyof WebsocketEvents>(
    event: T,
    listener: EventEmitter.EventListener<WebsocketEvents, T>
  ): () => void {
    this.events.addListener(event, listener);
    return () => {
      this.events.removeListener(event, listener);
    };
  }
  async close(): Promise<void> {
    if (this.socket !== null) {
      (await this.socket).close();
      return Promise.resolve();
    } else {
      return Promise.reject(new Error("Socket is already closed"));
    }
  }
  unsubscribeAll() {
    this.events.removeAllListeners();
  }
}
