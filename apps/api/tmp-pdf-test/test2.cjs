const { PDFParse } = require("pdf-parse");
const fs = require("fs");
const file = process.argv[2] || "big.pdf";
const data = new Uint8Array(fs.readFileSync(__dirname + "/" + file));
console.log("Reading:", file, "bytes:", data.length);
(async () => {
  try {
    const parser = new PDFParse({ data, verbosity: 0 });
    const t0 = Date.now();
    const result = await parser.getText();
    console.log("SUCCESS text length:", (result.text || "").length, "in", Date.now() - t0, "ms");
    await parser.destroy?.();
  } catch (e) {
    console.log("FAIL:", e.message.slice(0, 400));
  }
  process.exit(0);
})();
