import { SignalingMessage } from './types';

export type SignalingMessageHandler = (message: SignalingMessage) => void;
export type SignalingErrorHandler = (error: Event | Error) => void;
export type SignalingCloseHandler = (event: CloseEvent) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private messageHandlers: SignalingMessageHandler[] = [];
  private errorHandlers: SignalingErrorHandler[] = [];
  private closeHandlers: SignalingCloseHandler[] = [];

  constructor(private url: string) {}

  public connect(onOpen?: () => void): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      if (onOpen) onOpen();
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as SignalingMessage;
        this.messageHandlers.forEach((handler) => handler(parsed));
      } catch (err) {
        this.errorHandlers.forEach((handler) => handler(err instanceof Error ? err : new Error(String(err))));
      }
    };

    this.ws.onerror = (err) => {
      this.errorHandlers.forEach((handler) => handler(err));
    };

    this.ws.onclose = (event) => {
      this.closeHandlers.forEach((handler) => handler(event));
    };
  }

  public send(message: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('VoxCall SignalingClient: Cannot send message, WebSocket not open.');
    }
  }

  public onMessage(handler: SignalingMessageHandler): void {
    this.messageHandlers.push(handler);
  }

  public onError(handler: SignalingErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  public onClose(handler: SignalingCloseHandler): void {
    this.closeHandlers.push(handler);
  }

  public close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
