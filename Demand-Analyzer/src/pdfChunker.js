// src/pdfChunker.js
// Splits a large PDF into <=MAX_PAGES_PER_CHUNK pieces, entirely in the browser, before upload.
// Requires: npm install pdf-lib
import { PDFDocument } from "pdf-lib";

export const MAX_PAGES_PER_CHUNK = 85; // stays safely under Claude's 100-page/request hard limit

// Reads a File object and returns its page count (PDFs only)
export async function getPdfPageCount(file) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

// Splits a PDF File into multiple base64 chunks of <= MAX_PAGES_PER_CHUNK pages each.
// Returns: [{ data: base64string, pageStart, pageEnd }]
export async function splitPdfToChunks(file, maxPagesPerChunk = MAX_PAGES_PER_CHUNK) {
  const bytes = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const chunks = [];

  for (let start = 0; start < totalPages; start += maxPagesPerChunk) {
    const end = Math.min(start + maxPagesPerChunk, totalPages);
    const indices = Array.from({ length: end - start }, (_, i) => start + i);

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, indices);
    copiedPages.forEach((p) => newDoc.addPage(p));

    const newBytes = await newDoc.save();
    const base64 = arrayBufferToBase64(newBytes);

    chunks.push({ data: base64, pageStart: start + 1, pageEnd: end });
  }

  return chunks;
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // avoid call stack overflow on large arrays
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
