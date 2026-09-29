import { normalizeCustomProviderName, requireNormalizedCustomProviderName } from "./custom-provider-name";

describe("Custom Provider name normalization", () => {
  it("folds case, trims edges, and collapses Unicode whitespace", () => {
    expect(normalizeCustomProviderName("  My\t\n Provider  ")).toBe("my provider");
    expect(normalizeCustomProviderName("MY PROVIDER")).toBe("my provider");
  });

  it("applies Unicode NFKC compatibility normalization", () => {
    expect(normalizeCustomProviderName("ＡＰＩ　ＰＲＯＶＩＤＥＲ")).toBe("api provider");
  });

  it("preserves Arabic characters and punctuation", () => {
    expect(normalizeCustomProviderName("  مزوّد، API!  ")).toBe("مزوّد، api!");
  });

  it("does not transliterate or strip accents and punctuation", () => {
    expect(normalizeCustomProviderName("Café / Qwen-2")).toBe("café / qwen-2");
    expect(normalizeCustomProviderName("Cafe / Qwen-2")).not.toBe("café / qwen-2");
  });

  it("rejects an empty normalized name", () => {
    expect(() => requireNormalizedCustomProviderName(" \t\n ")).toThrow(
      "Custom provider name must not be empty"
    );
  });
});
