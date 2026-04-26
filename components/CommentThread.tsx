"use client";

import { useState, useTransition } from "react";
import { addComment, deleteComment } from "@/app/matches/[id]/comments/actions";

export interface Comment {
  id: string;
  user_id: string;
  review_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  profile: {
    username: string;
    display_name: string | null;
    clerk_user_id: string;
  } | null;
}

interface Props {
  reviewId: string;
  initialComments: Comment[];
  currentClerkUserId: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function CommentThread({ reviewId, initialComments, currentClerkUserId }: Props) {
  const [comments, setComments]   = useState<Comment[]>(initialComments);
  const [newBody, setNewBody]     = useState("");
  const [replyTo, setReplyTo]     = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesFor = (parentId: string) => comments.filter((c) => c.parent_comment_id === parentId);

  function handleAdd(body: string, parentId: string | null) {
    startTransition(async () => {
      try {
        const created = await addComment(reviewId, body, parentId);
        setComments((prev) => [...prev, created as unknown as Comment]);
        if (parentId) { setReplyTo(null); setReplyBody(""); }
        else           { setNewBody(""); }
      } catch { /* silent — toast already handles feedback */ }
    });
  }

  function handleDelete(commentId: string) {
    startTransition(async () => {
      try {
        await deleteComment(commentId);
        setComments((prev) =>
          prev.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId)
        );
      } catch { /* silent */ }
    });
  }

  return (
    <div>
      {topLevel.length > 0 && (
        <div
          className="flex flex-col gap-4 mb-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 14, marginTop: 16 }}
        >
          {topLevel.map((comment) => {
            const replies  = repliesFor(comment.id);
            const isOwn    = comment.profile?.clerk_user_id === currentClerkUserId;
            const name     = comment.profile?.display_name ?? comment.profile?.username ?? "Anonymous";

            return (
              <div key={comment.id}>
                {/* Top-level comment */}
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}
                  >
                    {name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-sans text-xs font-medium text-text-primary">{name}</span>
                      <span className="font-mono text-[10px] text-text-dim">{timeAgo(comment.created_at)}</span>
                    </div>
                    <p className="font-sans text-sm text-text-mid leading-relaxed">{comment.body}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {currentClerkUserId && (
                        <button
                          onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                          className="font-mono text-[10px] text-text-dim hover:text-text-primary transition-colors"
                        >
                          Reply
                        </button>
                      )}
                      {isOwn && (
                        <button
                          onClick={() => handleDelete(comment.id)}
                          disabled={isPending}
                          className="font-mono text-[10px] text-text-dim hover:text-loss transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {replies.length > 0 && (
                  <div className="ml-8 mt-3 flex flex-col gap-3">
                    {replies.map((reply) => {
                      const replyIsOwn = reply.profile?.clerk_user_id === currentClerkUserId;
                      const replyName  = reply.profile?.display_name ?? reply.profile?.username ?? "Anonymous";
                      return (
                        <div key={reply.id} className="flex items-start gap-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[9px] font-bold shrink-0 mt-0.5"
                            style={{ background: "rgba(255,255,255,0.04)", color: "#6b7280" }}
                          >
                            {replyName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="font-sans text-xs font-medium text-text-primary">{replyName}</span>
                              <span className="font-mono text-[10px] text-text-dim">{timeAgo(reply.created_at)}</span>
                            </div>
                            <p className="font-sans text-sm text-text-mid leading-relaxed">{reply.body}</p>
                            {replyIsOwn && (
                              <button
                                onClick={() => handleDelete(reply.id)}
                                disabled={isPending}
                                className="font-mono text-[10px] text-text-dim hover:text-loss transition-colors mt-1"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply input */}
                {replyTo === comment.id && (
                  <div className="ml-8 mt-2">
                    <CommentInput
                      placeholder={`Reply to ${name}…`}
                      value={replyBody}
                      onChange={setReplyBody}
                      onSubmit={() => handleAdd(replyBody, comment.id)}
                      onCancel={() => { setReplyTo(null); setReplyBody(""); }}
                      isPending={isPending}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New comment input — only for signed-in users */}
      {currentClerkUserId && (
        <div style={{ marginTop: topLevel.length > 0 ? 4 : 14, borderTop: topLevel.length === 0 ? "1px solid rgba(255,255,255,0.05)" : "none", paddingTop: topLevel.length === 0 ? 14 : 0 }}>
          <CommentInput
            placeholder="Add a comment…"
            value={newBody}
            onChange={setNewBody}
            onSubmit={() => handleAdd(newBody, null)}
            isPending={isPending}
          />
        </div>
      )}
    </div>
  );
}

function CommentInput({
  placeholder,
  value,
  onChange,
  onSubmit,
  onCancel,
  isPending,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && value.trim()) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className="flex-1 font-sans text-sm text-text-primary placeholder:text-text-dim px-3 py-1.5 rounded-lg transition-colors duration-150"
        style={{
          background:  "rgba(255,255,255,0.04)",
          border:      "1px solid rgba(255,255,255,0.07)",
          outline:     "none",
          minHeight:   36,
        }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.15)")}
        onBlur={(e)  => (e.target.style.borderColor = "rgba(255,255,255,0.07)")}
      />
      <button
        onClick={onSubmit}
        disabled={isPending || !value.trim()}
        className="font-mono text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150 shrink-0"
        style={{
          background: isPending || !value.trim() ? "rgba(34,214,138,0.3)" : "#22d68a",
          color:      isPending || !value.trim() ? "rgba(0,0,0,0.4)"       : "#0e1116",
          cursor:     isPending || !value.trim() ? "not-allowed"            : "pointer",
          minHeight:  36,
        }}
      >
        Post
      </button>
      {onCancel && (
        <button
          onClick={onCancel}
          className="font-mono text-xs text-text-dim hover:text-text-primary transition-colors shrink-0"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
