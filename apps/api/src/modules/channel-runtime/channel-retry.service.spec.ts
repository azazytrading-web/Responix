import { ChannelRetryService } from "./channel-retry.service";

describe("ChannelRetryService", () => {
  const retry = new ChannelRetryService();
  it.each([408, 429, 500, 503])("retries transient status %d", (status) => expect(retry.retryable({ status })).toBe(true));
  it("does not retry permanent client failures and caps exponential backoff", () => {
    expect(retry.retryable({ status: 400 })).toBe(false);
    expect(retry.delay(1)).toBe(500);
    expect(retry.delay(20)).toBe(30000);
    expect(retry.delay(1, 120000)).toBe(60000);
  });
});
