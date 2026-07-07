"use client";

import { useTransition } from "react";
import { addComment, deleteComment } from "../actions";

export interface CommentView {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author_nickname: string;
}

export function ProfileComments({
  targetId,
  meId,
  comments,
}: {
  targetId: string;
  meId: string;
  comments: CommentView[];
}) {
  const [pending, start] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (fd.get("content") as string)?.trim();
    if (!text) return;
    start(async () => {
      await addComment(targetId, text);
      e.currentTarget.reset();
    });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          name="content"
          maxLength={500}
          placeholder="พิมพ์ข้อความ..."
          className="h-10 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-xl bg-court px-4 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
        >
          ส่ง
        </button>
      </form>

      {comments.length === 0 ? (
        <p className="text-center text-sm text-ink-faint py-4">
          ยังไม่มีความคิดเห็น
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {comments.map((c) => (
            <li key={c.id} className="py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-dim">
                    {c.author_nickname}
                  </p>
                  <p className="text-sm mt-0.5">{c.content}</p>
                </div>
                {c.author_id === meId && (
                  <button
                    onClick={() =>
                      start(async () => { await deleteComment(c.id, targetId); })
                    }
                    disabled={pending}
                    aria-label="ลบ"
                    className="h-6 w-6 rounded-full bg-red-500/10 text-red-400 text-xs hover:bg-red-500/25 transition shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
