const { PDFParse } = require("pdf-parse");
const fs = require("fs");
const data = new Uint8Array(fs.readFileSync(__dirname + "/sample.pdf"));
(async () => {
  try {
    const parser = new PDFParse({ data, verbosity: 0 });
    const result = await parser.getText();
    console.log("SUCCESS text length:", (result.text || "").length);
    console.log("TEXT:", (result.text || "").slice(0, 200));
  } catch (e) {
    console.log("FAIL:", e.message.slice(0, 300));
  }
  process.exit(0);
})();
