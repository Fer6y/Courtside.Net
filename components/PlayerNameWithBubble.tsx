"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import PlayerBubble, { type BubbleData } from "./PlayerBubble";

interface Props {
  playerId: string;
  playerName: string;
  className?: string;
}

export default function PlayerNameWithBubble({
  playerId,
  playerName,
  className,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [bubbleData, setBubbleData] = useState<BubbleData | null>(null);

  const wrapperRef      = useRef<HTMLSpanElement>(null);
  const hoverTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveringRef     = useRef(false);
  const dataCache       = useRef<BubbleData | null>(null);

  const computePos = useCallback(() => {
    if (!wrapperRef.current) return null;
    const rect = wrapperRef.current.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - 340);
    return { top: rect.bottom + 8, left: Math.max(8, left) };
  }, []);

  const showBubble = useCallback(async () => {
    // Use cached data if available
    if (dataCache.current) {
      const p = computePos();
      if (!p || !hoveringRef.current) return;
      setPos(p);
      setBubbleData(dataCache.current);
      setVisible(true);
      return;
    }

    // Fetch data, then show — no partial render
    try {
      const res = await fetch(`/api/players/${playerId}/bubble`);
      const data: BubbleData = await res.json();
      dataCache.current = data;

      // Only show if still hovering after the async fetch
      if (!hoveringRef.current || !wrapperRef.current) return;
      const p = computePos();
      if (!p) return;
      setPos(p);
      setBubbleData(data);
      setVisible(true);
    } catch {
      // fail silently — don't show a broken bubble
    }
  }, [playerId, computePos]);

  const hideBubble = useCallback(() => {
    hoveringRef.current = false;
    setVisible(false);
  }, []);

  // Desktop: 300ms hover delay
  const onMouseEnter = () => {
    hoveringRef.current = true;
    hoverTimerRef.current = setTimeout(showBubble, 300);
  };
  const onMouseLeave = () => {
    hoveringRef.current = false;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setVisible(false);
  };

  // Mobile: 450ms long press
  const onTouchStart = () => {
    hoveringRef.current = true;
    longPressRef.current = setTimeout(showBubble, 450);
  };
  const onTouchEnd = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };
  const onTouchMove = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  // Dismiss on touch outside (mobile)
  useEffect(() => {
    if (!visible) return;
    const handler = () => hideBubble();
    document.addEventListener("touchstart", handler, { passive: true });
    return () => document.removeEventListener("touchstart", handler);
  }, [visible, hideBubble]);

  return (
    <>
      <span
        ref={wrapperRef}
        className={className}
        style={{ borderBottom: "1px dotted currentColor", cursor: "inherit" }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
      >
        {playerName}
      </span>
      {visible && bubbleData && createPortal(
        <PlayerBubble
          playerName={playerName}
          data={bubbleData}
          position={pos}
        />,
        document.body
      )}
    </>
  );
}
