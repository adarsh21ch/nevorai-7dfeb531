/**
 * Generate a completion certificate as a PNG and trigger a browser download.
 * Pure client-side canvas — no server cost, no extra deps.
 */
export async function downloadCertificate(opts: {
  memberName: string;
  programName: string;
  date?: Date;
  signatureName?: string;
}) {
  const { memberName, programName, date = new Date(), signatureName } = opts;

  const W = 1600;
  const H = 1100;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Outer gold border
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.lineWidth = 1;
  ctx.strokeRect(60, 60, W - 120, H - 120);

  // Decorative top flourish
  ctx.fillStyle = "#d4af37";
  ctx.beginPath();
  ctx.arc(W / 2, 180, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 36px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("★", W / 2, 182);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 64px Georgia, serif";
  ctx.fillText("Certificate of Completion", W / 2, 290);

  // "This is to certify that"
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "italic 28px Georgia, serif";
  ctx.fillText("This is to certify that", W / 2, 400);

  // Member name (gold)
  ctx.fillStyle = "#d4af37";
  ctx.font = "bold 80px Georgia, serif";
  ctx.fillText(memberName || "Valued Member", W / 2, 510);

  // Underline under name
  const nameWidth = Math.min(W - 200, ctx.measureText(memberName || "Valued Member").width + 80);
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo((W - nameWidth) / 2, 545);
  ctx.lineTo((W + nameWidth) / 2, 545);
  ctx.stroke();

  // "has successfully completed"
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "italic 28px Georgia, serif";
  ctx.fillText("has successfully completed the program", W / 2, 610);

  // Program name
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px Georgia, serif";
  // Wrap if too long
  const maxWidth = W - 240;
  const words = (programName || "Untitled Program").split(" ");
  let line = "";
  let y = 690;
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  for (const l of lines.slice(0, 2)) {
    ctx.fillText(l, W / 2, y);
    y += 60;
  }

  // Date + signature row
  const baselineY = H - 200;
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "20px Georgia, serif";
  ctx.textAlign = "center";

  const dateStr = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Date column
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Georgia, serif";
  ctx.fillText(dateStr, W * 0.3, baselineY);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "16px Georgia, serif";
  ctx.fillText("Awarded On", W * 0.3, baselineY + 32);

  // Signature column
  if (signatureName) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "italic bold 26px Georgia, serif";
    ctx.fillText(signatureName, W * 0.7, baselineY);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px Georgia, serif";
    ctx.fillText("Issued By", W * 0.7, baselineY + 32);
  }

  // Footer brand
  ctx.fillStyle = "#64748b";
  ctx.font = "16px sans-serif";
  ctx.fillText("Issued via Nevorai Flow", W / 2, H - 90);

  // Trigger download
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png", 1),
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (memberName || "member").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  a.download = `nflow_certificate_${safeName}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
