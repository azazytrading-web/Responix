export interface ChannelTransportRequest {
  label: string;
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Readonly<Record<string, string>>;
  body?: string | Buffer;
  contentType?: string;
  responseType?: "text" | "binary";
  maximumResponseBytes: number;
  signal: AbortSignal;
}

export interface ChannelTransportResponse {
  status: number;
  body: string;
  encoding: "utf8" | "base64";
  bytes: number;
  headers: Readonly<Record<string, string | string[] | undefined>>;
}

export interface ChannelTransport {
  request(input: ChannelTransportRequest): Promise<ChannelTransportResponse>;
}

