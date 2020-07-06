import { stringify } from "./link-header.ts";
import { SimpleHeaders } from "./types.ts"

type SimpleWriter = Deno.Writer & Deno.Closer & { rid?: number };

export interface HeaderWriter {
  setHeader(key: string, value: any): Promise<any>;
  closeHeaders(): Promise<any>;
}

function safeClose(writer: SimpleWriter) {
  if (writer.rid && writer.rid === 1) {
    return;
  } else {
    writer.close();
  }
}

export class HttpHeaders implements HeaderWriter {
  private writer: SimpleWriter;
  private CRLF: Uint8Array;
  private initPromise: Promise<any>;
  constructor(writer: SimpleWriter) {
    this.writer = writer;
    this.CRLF = new TextEncoder().encode("\r\n");
    this.initPromise = this.startHeaders();
  }
  async startHeaders() {
    await this.writer.write(new TextEncoder().encode(`HTTP/1.1 200 OK`));
    await this.writer.write(this.CRLF);
    await this._setHeader("Date", new Date().toUTCString());
  }
  async setHeader(key: string, value: any) {
    await this.initPromise;
    return this._setHeader(key, value);
  }

  private async _setHeader(key: string, value: any) {
    if (!value) return;
    const encoder = new TextEncoder();
    let v = typeof value === "string" ? value : undefined;
    if (value instanceof Date) v = value.toUTCString();
    else if (key.toLowerCase() === "link") v = stringify(value);
    else if (typeof value !== "string") v = JSON.stringify(value);
    await this.writer.write(encoder.encode(`${key.toLowerCase()}: ${v}`));
    await this.writer.write(this.CRLF);
  }
  async closeHeaders() {
    await this.initPromise;
    await this.writer.write(this.CRLF);
    safeClose(this.writer);
  }
}

export class GeminiHeaders implements HeaderWriter {
  private writer: SimpleWriter;
  private CRLF: Uint8Array;
  private headers: SimpleHeaders;
  private contentType: string;
  constructor(writer: SimpleWriter) {
    this.writer = writer;
    this.headers = {};
    this.contentType = "application/octet-stream";
    this.CRLF = new TextEncoder().encode("\r\n");
  }
  async setHeader(key: string, value: any) {
    if (key.toLowerCase() === "content-type") {
      if (typeof value !== "string")
        throw new Error(
          `Content type must be a string, got ${JSON.stringify(value)}`
        );
      this.contentType = value;
    } else {
      this.headers[key] = value;
    }
  }
  async closeHeaders() {
    await this.writer.write(new TextEncoder().encode(`20 ${this.contentType}`));
    await this.writer.write(this.CRLF);
    if (this.contentType.startsWith("text/gemini")) {
      // put the links in the body? or with any text type?
    }
    safeClose(this.writer);
  }
}

export class JsonHeaders implements HeaderWriter {
  private writer: SimpleWriter;
  private headers: SimpleHeaders;
  constructor(writer: SimpleWriter) {
    this.writer = writer;
    this.headers = {};
  }
  async setHeader(key: string, value: any) {
    if (value) this.headers[key.toLowerCase()] = value;
  }
  async asObject() {
    return this.headers;
  }
  async closeHeaders() {
    const encoder = new TextEncoder();
    this.writer.write(encoder.encode(JSON.stringify(this.headers) + "\n"));
    safeClose(this.writer);
  }
}
