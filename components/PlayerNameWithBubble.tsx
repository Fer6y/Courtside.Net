"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import PlayerBubble from "./PlayerBubble";

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
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBubble = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    // Keep bubble within right edge of viewport
    const left = Math.min(rect.left, window.innerWidth - 340);
    setPos({ top: rect.bottom + 8, left: Math.max(8, left) });
    setVisible(true);
  }, []);

  const hideBubble = useCallback(() => {
    setVisible(false);
  }, []);

  // Desktop: show after 300ms hover, hide on mouse-out
  const onMouseEnter = () => {
    hoverTimerRef.current = setTimeout(showBubble, 300);
  };
  const onMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hideBubble();
  };

  // Mobile: long press 450ms to trigger, any touch elsewhere dismisses
  const onTouchStart = () => {
    longPressTimerRef.current = setTimeout(showBubble, 450);
  };
  const onTouchEnd = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };
  const onTouchMove = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  // Dismiss bubble on any touch outside (mobile)
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
      {visible && (
        <PlayerBubble
          playerId={playerId}
          playerName={playerName}
          position={pos}
        />
      )}
    </>
  );
}
