const { PDFParse } = require("pdf-parse");
const fs = require("fs");
const file = process.argv[2] || "big.pdf";
const buf = fs.readFileSync(__dirname + "/" + file);
(async () => {
  // Try several data representations to isolate the clone issue.
  const variants = {
    "Buffer": buf,
    "Uint8Array(copy)": new Uint8Array(buf),
    "detached-copy": new Uint8Array(buf.slice(0)),
    "plain Uint8Array from buffer": new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  };
  for (const [name, data] of Object.entries(variants)) {
    try {
      const parser = new PDFParse({ data, verbosity: 0 });
      const r = await parser.getText();
      console.log(`[${name}] SUCCESS len=${(r.text||"").length}`);
    } catch (e) {
      console.log(`[${name}] FAIL:`, e.message);
      if (name === process.env.DEBUG_VARIANT) console.log(e.stack);
    }
  }
  process.exit(0);
})();
