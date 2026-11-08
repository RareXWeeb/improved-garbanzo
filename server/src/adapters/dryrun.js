import zlib from 'zlib';

/**
 * Creates a valid standalone PNG image buffer in pure Node.js with zlib.
 * Generates an actual vertical 9:16 portrait image for reliable local testing.
 */
export function generateMockCinematicPng(sceneId, title, characters, width = 540, height = 960) {
  // Write PNG header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk (Width, Height, Bit depth 8, ColorType 2 RGB, Compression 0, Filter 0, Interlace 0)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 2; // RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Generate uncompressed raw scanlines: each row has 1 filter byte (0) + width * 3 bytes (R, G, B)
  const rawScanlineLength = 1 + width * 3;
  const rawData = Buffer.alloc(rawScanlineLength * height);

  // Cinematic dark warm palette
  const rBg = 24;
  const gBg = 26;
  const bBg = 32;

  const rBorder = 229;
  const gBorder = 169;
  const bBorder = 59; // Amber accent

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rawScanlineLength;
    rawData[rowOffset] = 0; // Filter byte 0 (None)

    const isBorderY = y < 12 || y >= height - 12;

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      const isBorderX = x < 12 || x >= width - 12;

      if (isBorderX || isBorderY) {
        rawData[pxOffset] = rBorder;
        rawData[pxOffset + 1] = gBorder;
        rawData[pxOffset + 2] = bBorder;
      } else {
        // Subtle vertical cinematic vignette
        const vignette = Math.sin((y / height) * Math.PI);
        const r = Math.min(255, Math.floor(rBg + vignette * 15));
        const g = Math.min(255, Math.floor(gBg + vignette * 10));
        const b = Math.min(255, Math.floor(bBg + vignette * 8));

        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
      }
    }
  }

  // Compress IDAT
  const compressedData = zlib.deflateSync(rawData, { level: 6 });
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 table & calculation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

