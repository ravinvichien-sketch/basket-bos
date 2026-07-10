"use client";

import { useRef, useState, useTransition } from "react";
import { addComment, deleteComment } from "../actions";

export interface CommentView {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author_nickname: string;
  parent_id?: string | null;
  replies?: CommentView[];
}

function CommentItem({
  c,
  meId,
  isOwner,
  targetId,
  depth,
}: {
  c: CommentView;
  meId: string;
  isOwner: boolean;
  targetId: string;
  depth: number;
}) {
  const [pending, start] = useTransition();
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleReply = () => {
    if (!replyText.trim()) return;
    start(async () => {
      await addComment(targetId, replyText.trim(), c.id);
      setReplyText("");
      setReplying(false);
    });
  };

  return (
    <div className={depth > 0 ? "ml-6 pl-3 border-l border-white/5" : ""}>
      <div className="flex items-start justify-between gap-2 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-dim">{c.author_nickname}</p>
          <p className="text-sm mt-0.5">{c.content}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          {(isOwner || c.author_id === meId) && (
            <button
              onClick={() =>
                start(async () => {
                  await deleteComment(c.id, targetId);
                })
              }
              disabled={pending}
              aria-label="ลบ"
              className="h-6 w-6 rounded-full bg-red-500/10 text-red-400 text-xs hover:bg-red-500/25 transition"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Reply button (show for profile owner or comment author) */}
      {(isOwner || c.author_id === meId) && depth === 0 && (
        <button
          onClick={() => {
            setReplying(!replying);
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          className="text-[11px] text-ink-faint hover:text-court transition mb-1"
        >
          {replying ? "ยกเลิก" : "↩ ตอบ"}
        </button>
      )}

      {replying && (
        <div className="flex gap-2 mb-2">
          <input
            ref={inputRef}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            maxLength={500}
            placeholder="พิมพ์ตอบกลับ..."
            className="h-8 flex-1 rounded-lg bg-surface-overlay border border-white/10 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-court"
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleReply();
              }
            }}
          />
          <button
            onClick={handleReply}
            disabled={pending || !replyText.trim()}
            className="h-8 rounded-lg bg-court px-3 text-xs font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
          >
            {pending ? "..." : "ส่ง"}
          </button>
        </div>
      )}

      {/* Replies */}
      {c.replies && c.replies.length > 0 && (
        <div className="space-y-1">
          {c.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              c={reply}
              meId={meId}
              isOwner={isOwner}
              targetId={targetId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProfileComments({
  targetId,
  meId,
  isOwner,
  comments,
}: {
  targetId: string;
  meId: string;
  isOwner: boolean;
  comments: CommentView[];
}) {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!text.trim()) return;
    const t = text;
    setText("");
    start(async () => {
      await addComment(targetId, t);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="พิมพ์ข้อความ..."
          className="h-10 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
          disabled={pending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={pending || !text.trim()}
          className="h-10 rounded-xl bg-court px-4 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
        >
          {pending ? "..." : "ส่ง"}
        </button>
      </div>

      {comments.length === 0 ? (
        <p className="text-center text-sm text-ink-faint py-4">
          ยังไม่มีความคิดเห็น
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {comments.map((c) => (
            <li key={c.id} className="py-1">
              <CommentItem
                c={c}
                meId={meId}
                isOwner={isOwner}
                targetId={targetId}
                depth={0}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
