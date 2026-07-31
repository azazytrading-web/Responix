import { Injectable } from "@nestjs/common";
import { ProviderHttpClient } from "../ai/security/provider-http-client.service";
import type { ChannelTransport, ChannelTransportRequest, ChannelTransportResponse } from "./contracts/channel-transport.contract";

@Injectable()
export class ChannelTransportService implements ChannelTransport {
  constructor(private readonly http: ProviderHttpClient) {}
  request(input: ChannelTransportRequest): Promise<ChannelTransportResponse> {
    return this.http.request(input);
  }
}

