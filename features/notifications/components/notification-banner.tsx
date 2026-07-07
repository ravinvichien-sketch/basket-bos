import Link from "next/link";
import { markAllNotificationsRead } from "../actions";

interface Notification {
  id: string;
  type: string;
  payload: { game_id?: string; game_title?: string };
  created_at: string;
}

function messageFor(n: Notification): string {
  const title = n.payload.game_title ?? "เกม";
  switch (n.type) {
    case "promoted":
      return `🎉 คุณได้เลื่อนจากคิวสำรองขึ้นเป็นตัวจริงใน "${title}"`;
    case "added_by_admin":
      return `แอดมินเพิ่มคุณเข้าเกม "${title}"`;
    case "ref_approval_needed":
      return `🙋 มีคนระบุว่าเป็นเพื่อนที่คุณชวนมาใน "${title}" — แตะเพื่อกดยืนยัน`;
    default:
      return title;
  }
}

export function NotificationBanner({
  notifications,
}: {
  notifications: Notification[];
}) {
  if (notifications.length === 0) return null;

  return (
    <div className="rounded-xl2 bg-court/10 border border-court/30 p-4 space-y-2">
      {notifications.slice(0, 5).map((n) => (
        <p key={n.id} className="text-sm">
          {n.payload.game_id ? (
            <Link href={`/games/${n.payload.game_id}`} className="hover:underline">
              {messageFor(n)}
            </Link>
          ) : (
            messageFor(n)
          )}
        </p>
      ))}
      <form action={markAllNotificationsRead}>
        <button
          type="submit"
          className="text-xs text-ink-faint hover:text-ink transition"
        >
          อ่านแล้วทั้งหมด ✓
        </button>
      </form>
    </div>
  );
}
