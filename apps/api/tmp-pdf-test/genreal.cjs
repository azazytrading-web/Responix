// Generate a PDF of an approximate target byte size by adding pages.
const fs = require("fs");
const targetBytes = parseInt(process.argv[2] || "917421", 10);

function buildPdf(pages) {
  const objs = [];
  const pageObjStart = 3;
  const numPages = pages.length;
  const lastPageObj = pageObjStart + numPages * 2 - 1;
  const fontObj = lastPageObj + 1;
  const kids = pages.map((_, i) => `${pageObjStart + i * 2} 0 R`).join(" ");
  objs[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objs[2] = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${numPages} >>\nendobj\n`;
  pages.forEach((lines, i) => {
    const pageObjNum = pageObjStart + i * 2;
    const contentObjNum = pageObjNum + 1;
    let y = 750;
    let stream = "BT /F1 11 Tf\n";
    for (const line of lines) {
      stream += `1 0 0 1 50 ${y} Tm (${line.replace(/([()\\])/g, "\\$1")}) Tj\n`;
      y -= 16;
    }
    stream += "ET";
    objs[pageObjNum] = `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> >> >>\nendobj\n`;
    objs[contentObjNum] = `${contentObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
  });
  objs[fontObj] = `${fontObj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  let out = "%PDF-1.5\n";
  const offsets = [];
  const totalObjs = fontObj;
  for (let n = 1; n <= totalObjs; n++) { offsets[n] = out.length; out += objs[n]; }
  const xrefStart = out.length;
  out += `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= totalObjs; n++) out += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return out;
}

let pages = [];
for (let p = 0; p < 60; p++) {
  const lines = [];
  for (let l = 0; l < 45; l++) lines.push(`Responix Master Business Guide page ${p + 1} line ${l + 1}: automated customer response platform details.`);
  pages.push(lines);
}
let pdf = buildPdf(pages);
let guard = 0;
while (Buffer.byteLength(pdf) < targetBytes && guard < 200) {
  pages.push(Array.from({ length: 45 }, (_, l) => `Extra Responix content block page ${pages.length + 1} line ${l + 1}: knowledge base grounding text for retrieval.`));
  pdf = buildPdf(pages);
  guard++;
}
fs.writeFileSync(__dirname + "/real917.pdf", pdf, "binary");
console.log("real917.pdf bytes:", Buffer.byteLength(pdf));
