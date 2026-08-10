// Generates a stylized handwritten-style signature as a PNG dataURL.
// Deterministic per name (same input → same signature look).
export function generateSignatureDataUrl(
  name: string,
  opts?: { width?: number; height?: number; color?: string },
): string {
  const width = opts?.width ?? 360;
  const height = opts?.height ?? 110;
  const color = opts?.color ?? "#0D1B3E";

  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Seed from name for reproducible variance
  let seed = 0;
  for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Draw cursive name
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  const first = name.split(/\s+/)[0] ?? name;
  const rest = name.split(/\s+/).slice(1).join(" ");

  ctx.font = "italic 700 44px 'Brush Script MT', 'Segoe Script', cursive";
  ctx.textBaseline = "middle";
  const tilt = (rand() - 0.5) * 0.15;
  ctx.save();
  ctx.translate(24, height / 2 - 6);
  ctx.rotate(tilt);
  ctx.fillText(first, 0, 0);
  if (rest) {
    ctx.font = "italic 600 26px 'Brush Script MT', 'Segoe Script', cursive";
    ctx.fillText(rest, 8, 28);
  }
  ctx.restore();

  // Flourish underline
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  const y0 = height - 22 + (rand() - 0.5) * 6;
  ctx.moveTo(18, y0);
  const cp1x = width * 0.3 + rand() * 20;
  const cp1y = y0 + 18 + rand() * 8;
  const cp2x = width * 0.65 + rand() * 20;
  const cp2y = y0 - 14 - rand() * 8;
  const endX = width - 30 - rand() * 20;
  const endY = y0 + (rand() - 0.5) * 10;
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
  ctx.stroke();

  // Tiny initials mark
  ctx.font = "italic 700 12px 'Segoe Script', cursive";
  ctx.fillText(initials, endX + 4, endY - 4);

  return canvas.toDataURL("image/png");
}
