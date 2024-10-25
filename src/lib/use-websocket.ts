import React from "react";
import EventEmitter from "eventemitter3";
import { useResettableLazyRef } from "./use-lazy-ref";

interface WebsocketEvents {
  open: [WebSocket, Event];
  message: [WebSocket, MessageEvent];
  error: [WebSocket, Event];
  close: [WebSocket, CloseEvent];
  readyStateChange: [WebSocket["readyState"]];
}

interface WebsocketHook {
  get: () => Promise<WebSocket>;
  close: () => Promise<void>;
  subscribe: <T extends keyof WebsocketEvents>(
    event: T,
    listener: EventEmitter.EventListener<WebsocketEvents, T>
  ) => () => void;
}
export function useWebsocket(url: string): WebsocketHook {
  const eventsRef = React.useRef(new EventEmitter<WebsocketEvents>());
  const createWebsocket = React.useCallback(async (): Promise<WebSocket> => {
    return new Promise((resolve) => {
      const socket = new WebSocket(url);
      eventsRef.current.emit("readyStateChange", socket.readyState);
      socket.onopen = (event) => {
        console.log("WebSocket Emitting Opened");
        eventsRef.current.emit("readyStateChange", socket.readyState);
        eventsRef.current.emit("open", socket, event);
        resolve(socket);
      };
      socket.onmessage = (event) => {
        console.log("WebSocket Emitting Message");
        eventsRef.current.emit("message", socket, event);
      };
      socket.onerror = (event) => {
        console.error("WebSocket Emitting Error");
        eventsRef.current.emit("error", socket, event);
      };
      socket.onclose = (event) => {
        console.log("WebSocket Emitting Close");
        eventsRef.current.emit("readyStateChange", socket.readyState);
        eventsRef.current.emit("close", socket, event);
        socketRef.reset();
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const socketRef = useResettableLazyRef(createWebsocket);

  return React.useMemo(
    () => ({
      get: socketRef.get,
      close: async () => {
        (await socketRef.get()).close();
      },
      subscribe: (eventName, listener) => {
        console.log("Subscribing to", eventName);
        eventsRef.current.addListener(eventName, listener);
        return () => {
          console.log("Unsubscribing from", eventName);
          eventsRef.current.removeListener(eventName, listener);
        };
      },
    }),
    [socketRef]
  );
}
