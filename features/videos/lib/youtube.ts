/** ดึง video id จากลิงก์ YouTube รูปแบบต่าง ๆ (watch, youtu.be, shorts, embed) */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1) || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|v|live)\/([^/?]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

/** URL สำหรับฝัง iframe (null ถ้าไม่ใช่ลิงก์ YouTube ที่รู้จัก) */
export function youtubeEmbed(url: string | null): string | null {
  if (!url) return null;
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}
