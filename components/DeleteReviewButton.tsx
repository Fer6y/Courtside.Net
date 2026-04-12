"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteReview } from "@/app/matches/[id]/review/actions";
import { useToast } from "@/components/toast/ToastContext";

export default function DeleteReviewButton({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    setPending(true);
    const toastId = toast.loading("Deleting review…");
    try {
      await deleteReview(reviewId);
      toast.success(toastId, "Review deleted");
      router.refresh();
    } catch {
      toast.error(toastId, "Couldn't delete review");
      setPending(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-text-dim">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="font-mono text-xs text-loss hover:opacity-80 transition-opacity"
        >
          {pending ? "···" : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="font-mono text-xs text-text-dim hover:text-text-mid transition-colors"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="font-mono text-xs text-text-dim hover:text-loss transition-colors duration-150"
    >
      Delete
    </button>
  );
}
