import "server-only";

/**
 * LINE Messaging API helpers. All functions no-op gracefully when
 * LINE_MESSAGING_TOKEN is not configured, so the app works without push.
 */

const PUSH_URL = "https://api.line.me/v2/bot/message/push";
const REPLY_URL = "https://api.line.me/v2/bot/message/reply";

export function lineConfigured(): boolean {
  return Boolean(process.env.LINE_MESSAGING_TOKEN);
}

export async function pushLineText(
  lineUserId: string,
  text: string
): Promise<boolean> {
  const token = process.env.LINE_MESSAGING_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text: text.slice(0, 4900) }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pushLineImage(
  lineUserId: string,
  originalUrl: string,
  previewUrl: string
): Promise<boolean> {
  const token = process.env.LINE_MESSAGING_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{
          type: "image",
          originalContentUrl: originalUrl,
          previewImageUrl: previewUrl,
        }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function replyLineText(
  replyToken: string,
  text: string
): Promise<boolean> {
  const token = process.env.LINE_MESSAGING_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(REPLY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text: text.slice(0, 4900) }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
