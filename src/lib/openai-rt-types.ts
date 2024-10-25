/**
 * Type for all event logs
 */
export interface RealtimeEvent {
  time: string;
  source: "client" | "server";
  count?: number;
  event: { [key: string]: any };
}

interface EventResponseResource {
  id: string;
  object: string;
  status: string;
  status_details: string | null;
  output: any[];
  usage: any | null;
}

export interface ServerResponseCreatedEvent {
  event_id: string;
  type: "response.created";
  response: EventResponseResource;
}

export function isServerResponseCreatedEvent(
  event: RealtimeEvent["event"]
): event is ServerResponseCreatedEvent {
  return event.type === "response.created";
}

export interface ServerResponseTextDeltaEvent {
  event_id: string;
  type: "response.text.delta";
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
}

export function isServerResponseTextDeltaEvent(
  event: RealtimeEvent["event"]
): event is ServerResponseTextDeltaEvent {
  return event.type === "response.text.delta";
}

export interface ServerResponseTextDoneEvent {
  event_id: string;
  type: "response.text.done";
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  text: string;
}

export function isServerResponseTextDoneEvent(
  event: RealtimeEvent["event"]
): event is ServerResponseTextDoneEvent {
  return event.type === "response.text.done";
}
