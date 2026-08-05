import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";

export class NextSSEServerTransport implements Transport {
  private _sessionId: string;
  private _endpoint: string;
  private _controller?: ReadableStreamDefaultController<any>;
  private _stream?: ReadableStream;

  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  constructor(endpoint: string) {
    this._sessionId = randomUUID();
    this._endpoint = endpoint;
  }

  get sessionId() {
    return this._sessionId;
  }

  get stream(): ReadableStream {
    if (!this._stream) {
      this._stream = new ReadableStream({
        start: (controller) => {
          this._controller = controller;
        },
        cancel: () => {
          this.close();
        },
      });
    }
    return this._stream;
  }

  async start(): Promise<void> {
    if (!this._controller) {
      throw new Error("Stream not initialized. Access 'stream' getter first.");
    }

    // Send the endpoint event
    const dummyBase = "http://localhost";
    const endpointUrl = new URL(this._endpoint, dummyBase);
    endpointUrl.searchParams.set("sessionId", this._sessionId);
    const relativeUrlWithSession = endpointUrl.pathname + endpointUrl.search + endpointUrl.hash;

    this._controller.enqueue(
      new TextEncoder().encode(`event: endpoint\ndata: ${relativeUrlWithSession}\n\n`)
    );
  }

  async close(): Promise<void> {
    if (this._controller) {
      try {
        this._controller.close();
      } catch (e) {
        // Ignore if already closed
      }
      this._controller = undefined;
    }
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._controller) {
      throw new Error("Not connected");
    }
    this._controller.enqueue(
      new TextEncoder().encode(`event: message\ndata: ${JSON.stringify(message)}\n\n`)
    );
  }

  async handlePostMessage(body: any): Promise<void> {
    // In Next.js, we parse the body from the Request and pass it here
    let parsedMessage: JSONRPCMessage;
    try {
      parsedMessage = typeof body === "string" ? JSON.parse(body) : body;
    } catch (e) {
      throw new Error("Invalid message body");
    }

    if (this.onmessage) {
      this.onmessage(parsedMessage);
    }
  }
}
