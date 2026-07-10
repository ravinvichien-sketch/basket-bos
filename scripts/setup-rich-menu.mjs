#!/usr/bin/env node
/**
 * สร้าง Rich Menu ให้ BAS BOS LINE Bot
 * รัน: TOKEN='...' node scripts/setup-rich-menu.mjs
 */
import https from "https";
import { deflateSync } from "zlib";

const TOKEN = process.env.TOKEN;
const APP_URL = process.env.APP_URL || "https://basket-bos.vercel.app";

if (!TOKEN) { console.error("ต้องใส่ TOKEN"); process.exit(1); }

function api(method, path, body, ct) {
  return new Promise((resolve, reject) => {
    const host = path.includes("/content") ? "api-data.line.me" : "api.line.me";
    const opts = {
      hostname: host,
      path: "/v2/bot/richmenu" + path,
      method,
      headers: { Authorization: "Bearer " + TOKEN },
    };
    if (body) {
      opts.headers["Content-Type"] = ct || "application/json";
      opts.headers["Content-Length"] = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body);
    }
    const h = https.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, text: data }));
    });
    h.on("error", reject);
    if (body) h.write(body);
    h.end();
  });
}

// ── Generate PNG ──────────────────────────────────────────
function generatePNG() {
  const W = 2500, H = 843, sw = Math.floor(W / 3);
  const pixels = new Uint8Array(W * H * 4);
  const COLORS = [[249, 115, 22, 255], [34, 197, 94, 255], [59, 130, 246, 255]];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const s = Math.min(Math.floor(x / sw), 2), [r, g, b, a] = COLORS[s], i = (y * W + x) * 4;
      pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
    }

  function crc32(b) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let j = 0; j < 8; j++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function ck(t, d) {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const tb = Buffer.from(t), cd = Buffer.concat([tb, d]), cv = Buffer.alloc(4);
    cv.writeUInt32BE(crc32(cd)); return Buffer.concat([l, tb, d, cv]);
  }
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, off = y * (1 + W * 4) + 1 + x * 4;
      raw[off] = pixels[i]; raw[off+1] = pixels[i+1]; raw[off+2] = pixels[i+2]; raw[off+3] = pixels[i+3];
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([sig, ck("IHDR", ihdr), ck("IDAT", deflateSync(raw)), ck("IEND", Buffer.alloc(0))]);
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  // 1. Delete old
  const list = JSON.parse((await api("GET", "/list")).text);
  for (const m of list.richmenus || []) {
    await api("DELETE", "/" + m.richMenuId);
    console.log("  Deleted:", m.richMenuId);
  }

  // 2. Create
  const W = 2500, H = 843, sw = Math.floor(W / 3);
  const cr = JSON.parse((await api("POST", "", JSON.stringify({
    size: { width: W, height: H }, selected: true,
    name: "BAS BOS Menu", chatBarText: "BAS BOS 🏀",
    areas: [
      { bounds: { x: 0, y: 0, width: sw, height: H }, action: { type: "uri", label: "เปิดแอป", uri: APP_URL } },
      { bounds: { x: sw, y: 0, width: sw, height: H }, action: { type: "postback", label: "ลงชื่อ", data: "join:latest" } },
      { bounds: { x: sw * 2, y: 0, width: sw + (W - sw * 3), height: H }, action: { type: "postback", label: "ดูคิว", data: "roster:latest" } },
    ],
  }))).text;
  const mid = cr.richMenuId;
  if (!mid) { console.error("Create failed:", cr); process.exit(1); }
  console.log("  Created:", mid);

  // 3. Upload image (ต้องใช้ api-data)
  const png = generatePNG();
  const up = await api("POST", "/" + mid + "/content", png, "image/png");
  if (up.status !== 200) { console.error("Upload failed:", up.status, up.text); process.exit(1); }
  console.log("  Image uploaded");

  // 4. Set as default  (POST to user/all with Content-Length: 0)
  await api("POST", "/default", JSON.stringify({ richMenuId: mid }));
  await new Promise(r => setTimeout(r, 500));
  const setAll = await api("POST", "/user/all/richmenu/" + mid, null);
  // Need to send with Content-Length: 0 for user/all
  const h = https.request({
    hostname: "api.line.me", method: "POST",
    path: "/v2/bot/richmenu/user/all/richmenu/" + mid,
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json", "Content-Length": "0" },
  });
  await new Promise((resolve, reject) => {
    h.on("response", (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(d)); });
    h.on("error", reject);
    h.end();
  });
  console.log("  Set as default");

  console.log("\n✅ Rich Menu พร้อมใช้งาน!");
  console.log("   🔸 ส้ม → เปิด Web App");
  console.log("   🔸 เขียว → ลงชื่อ");
  console.log("   🔸 ฟ้า → ดูคิว");
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
