import crypto from "node:crypto";

let lastTimestamp = 0;
let sequence = crypto.randomInt(0, 0x1000);

export function uuidv7() {
  const timestamp = Date.now();

  if (timestamp === lastTimestamp) {
    sequence = (sequence + 1) & 0x0fff;
  } else {
    lastTimestamp = timestamp;
    sequence = crypto.randomInt(0, 0x1000);
  }

  const timeHex = timestamp.toString(16).padStart(12, "0");
  const randomHex = crypto.randomBytes(8).toString("hex");
  const versionSegment = `7${sequence.toString(16).padStart(3, "0")}`;
  const variantNibble = ((parseInt(randomHex[0], 16) & 0x3) | 0x8).toString(16);
  const variantSegment = `${variantNibble}${randomHex.slice(1, 4)}`;
  const tailSegment = randomHex.slice(4, 16);

  return [
    timeHex.slice(0, 8),
    timeHex.slice(8, 12),
    versionSegment,
    variantSegment,
    tailSegment
  ].join("-");
}
