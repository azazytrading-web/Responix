const { PDFParse } = require("pdf-parse");
const fs = require("fs");
const file = process.argv[2] || "real917.pdf";
const iters = parseInt(process.argv[3] || "20", 10);
const buf = fs.readFileSync(__dirname + "/" + file);
let ok = 0, fail = 0;
(async () => {
  for (let i = 0; i < iters; i++) {
    try {
      const parser = new PDFParse({ data: new Uint8Array(buf), verbosity: 0 });
      const r = await parser.getText();
      ok++;
    } catch (e) {
      fail++;
      if (fail <= 3) console.log(`iter ${i} FAIL: ${e.message}`);
    }
  }
  console.log(`RESULT ok=${ok} fail=${fail} of ${iters}`);
  process.exit(0);
})();
