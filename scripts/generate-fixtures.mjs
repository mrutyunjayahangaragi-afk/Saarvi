import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

const testDir = path.resolve("test-files");
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// 1. Create a 5-page PDF document for PDF to JPG, Merge, Split, Extract
async function generateTestPdf() {
  const doc = await PDFDocument.create();
  for (let i = 1; i <= 5; i++) {
    const page = doc.addPage([400, 400]);
    // Page dimension or annotation
  }
  const pdfBytes = await doc.save();
  fs.writeFileSync(path.join(testDir, "test-5pages.pdf"), Buffer.from(pdfBytes));
  console.log("Created test-5pages.pdf");

  // Create two smaller PDFs for merge
  const docA = await PDFDocument.create();
  docA.addPage([300, 300]);
  fs.writeFileSync(path.join(testDir, "doc-a.pdf"), Buffer.from(await docA.save()));

  const docB = await PDFDocument.create();
  docB.addPage([300, 300]);
  docB.addPage([300, 300]);
  fs.writeFileSync(path.join(testDir, "doc-b.pdf"), Buffer.from(await docB.save()));
  console.log("Created doc-a.pdf and doc-b.pdf");
}

// 2. Create sample 1x1 or small PNG/JPG data
function generateSampleImages() {
  // 1x1 transparent PNG:
  const transparentPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  fs.writeFileSync(path.join(testDir, "transparent.png"), transparentPng);

  // 1x1 red JPG:
  const sampleJpg = Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64"
  );
  fs.writeFileSync(path.join(testDir, "sample.jpg"), sampleJpg);
  console.log("Created transparent.png and sample.jpg");
}

async function main() {
  await generateTestPdf();
  generateSampleImages();
}

main();
