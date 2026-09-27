import { BadRequestException } from "@nestjs/common";
import { PDFParse } from "pdf-parse";
import { TextExtractorService } from "./text-extractor.service";

jest.mock("pdf-parse", () => ({ PDFParse: jest.fn() }));

describe("TextExtractorService", () => {
  const service = new TextExtractorService();

  it("extracts plain text and markdown content", async () => {
    const text = await service.extract({ buffer: Buffer.from("Hello\nworld"), mimeType: "text/plain", fileName: "a.txt" });
    expect(text.content).toBe("Hello\nworld");
    expect(text.totalPages).toBeNull();
    expect(text.parserMetadata).toMatchObject({ parser: "text", rawBytes: 11 });

    const markdown = await service.extract({ buffer: Buffer.from("# Title"), mimeType: "text/markdown", fileName: "a.md" });
    expect(markdown.parserMetadata).toMatchObject({ parser: "markdown" });
  });

  it("counts non-empty CSV rows", async () => {
    const csv = await service.extract({ buffer: Buffer.from("a,b\n1,2\n3,4\n"), mimeType: "text/csv", fileName: "a.csv" });
    expect(csv.parserMetadata).toMatchObject({ parser: "csv", rows: 3 });
  });

  it("pretty-prints valid JSON and keeps malformed JSON as raw text", async () => {
    const valid = await service.extract({ buffer: Buffer.from('{"b":1,"a":2}'), mimeType: "application/json", fileName: "a.json" });
    expect(valid.parserMetadata).toMatchObject({ parser: "json", validJson: true });
    expect(valid.content).toContain('"a": 2');

    const invalid = await service.extract({ buffer: Buffer.from("{nope"), mimeType: "application/json", fileName: "a.json" });
    expect(invalid.parserMetadata).toMatchObject({ parser: "json", validJson: false });
    expect(invalid.content).toBe("{nope");
  });

  it("strips HTML chrome and tags and decodes entities", async () => {
    const html = await service.extract({
      buffer: Buffer.from(
        "<head><style>body{}</style></head><body><h1>Ops</h1><script>evil()</script><p>Price &amp; co &quot;quoted&quot;</p></body>"
      ),
      mimeType: "text/html",
      fileName: "a.html"
    });
    expect(html.parserMetadata).toMatchObject({ parser: "html-strip" });
    expect(html.content).toContain("Ops");
    expect(html.content).toContain('Price & co "quoted"');
    expect(html.content).not.toContain("evil");
    expect(html.content).not.toContain("<");
  });

  it("rejects unsupported document types", async () => {
    await expect(
      service.extract({ buffer: Buffer.from("x"), mimeType: "image/png", fileName: "a.png" })
    ).rejects.toThrow(BadRequestException);
  });

  it("resolves MIME types from explicit headers first and file extensions second", () => {
    expect(service.resolveMimeType("TEXT/CSV; charset=utf-8", "a.bin")).toBe("text/csv");
    expect(service.resolveMimeType("application/octet-stream", "Report.PDF")).toBe("application/pdf");
    expect(service.resolveMimeType("", "notes.log")).toBe("text/plain");
    expect(service.resolveMimeType("application/octet-stream", "archive.xyz")).toBe("");
  });

  describe("PDF extraction retry (worker clone race)", () => {
    const mockPdfParse = PDFParse as unknown as jest.Mock;

    beforeEach(() => {
      mockPdfParse.mockReset();
    });

    function stubParser(text: string) {
      return {
        getText: jest.fn().mockResolvedValue({ text, total: 2 }),
        getInfo: jest.fn().mockResolvedValue({ info: { Title: "T" } }),
        destroy: jest.fn().mockResolvedValue(undefined)
      };
    }

    it("recovers from a transient worker deserialization failure", async () => {
      const transient = new Error("Unable to deserialize cloned data");
      mockPdfParse
        .mockImplementationOnce(() => {
          throw transient;
        })
        .mockImplementationOnce(() => {
          const p = stubParser("hello pdf");
          p.getText.mockRejectedValue(transient);
          return p;
        })
        .mockImplementationOnce(() => stubParser("hello pdf"));

      const result = await service.extract({ buffer: Buffer.from("%PDF-1.5"), mimeType: "application/pdf", fileName: "a.pdf" });
      expect(result.content).toBe("hello pdf");
      expect(result.parserMetadata).toMatchObject({ parser: "pdf-parse", totalPages: 2, title: "T" });
      // Two failing attempts + one success = 3 parser constructions.
      expect(mockPdfParse).toHaveBeenCalledTimes(3);
    });

    it("gives up and rethrows after exhausting attempts", async () => {
      const transient = new Error("Unable to deserialize cloned data");
      mockPdfParse.mockImplementation(() => {
        const p = stubParser("");
        p.getText.mockRejectedValue(transient);
        return p;
      });

      await expect(
        service.extract({ buffer: Buffer.from("%PDF-1.5"), mimeType: "application/pdf", fileName: "a.pdf" })
      ).rejects.toThrow("Unable to deserialize cloned data");
      expect(mockPdfParse).toHaveBeenCalledTimes(3);
    });

    it("extracts text and metadata sequentially to keep the fake worker single-flight", async () => {
      // Concurrent getText + getInfo deterministically trips the pdf.js fake-worker
      // structured-clone race ("Unable to deserialize cloned data"). Guard against a
      // regression to Promise.all([getText, getInfo]) by asserting getInfo is only
      // invoked after getText has already resolved.
      const order: string[] = [];
      mockPdfParse.mockImplementation(() => ({
        getText: jest.fn().mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => {
                order.push("getText:resolved");
                resolve({ text: "hello pdf", total: 2 });
              }, 5)
            )
        ),
        getInfo: jest.fn().mockImplementation(() => {
          order.push("getInfo:called");
          return Promise.resolve({ info: { Title: "T" } });
        }),
        destroy: jest.fn().mockResolvedValue(undefined)
      }));

      const result = await service.extract({ buffer: Buffer.from("%PDF-1.5"), mimeType: "application/pdf", fileName: "a.pdf" });
      expect(result.content).toBe("hello pdf");
      expect(result.parserMetadata).toMatchObject({ parser: "pdf-parse", title: "T" });
      const textResolvedAt = order.indexOf("getText:resolved");
      const infoCalledAt = order.indexOf("getInfo:called");
      expect(textResolvedAt).toBeGreaterThanOrEqual(0);
      expect(infoCalledAt).toBeGreaterThan(textResolvedAt);
    });
  });
});