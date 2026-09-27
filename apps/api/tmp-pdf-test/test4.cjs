const { PDFParse } = require("pdf-parse");
const fs = require("fs");
const buf = fs.readFileSync(__dirname + "/real917.pdf");
const mode = process.argv[2] || "parallel";
const iters = parseInt(process.argv[3] || "30", 10);
let ok = 0, fail = 0;
(async () => {
  for (let i = 0; i < iters; i++) {
    try {
      const parser = new PDFParse({ data: new Uint8Array(buf), verbosity: 0 });
      if (mode === "parallel") {
        await Promise.all([parser.getText(), parser.getInfo()]);
      } else {
        await parser.getText();
        await parser.getInfo();
      }
      ok++;
      await parser.destroy();
    } catch (e) {
      fail++;
      if (fail <= 6) console.log(`mode=${mode} iter ${i} FAIL: ${e.message}`);
    }
  }
  console.log(`RESULT mode=${mode} ok=${ok} fail=${fail} of ${iters}`);
  process.exit(0);
})();
