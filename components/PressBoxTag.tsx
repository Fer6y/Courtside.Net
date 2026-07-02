// Small gold credential chip marking Press Box (house critic) accounts.
// Rendered wherever their reviews, ratings, or profiles appear so house
// content is never mistaken for community content.

export default function PressBoxTag({ size = "sm" }: { size?: "sm" | "md" }) {
  const fontSize = size === "md" ? 10 : 9;
  return (
    <span
      className="font-mono uppercase shrink-0 self-center"
      title="Courtside Press Box — a house critic account, not a community member"
      style={{
        fontSize,
        letterSpacing: "0.16em",
        color: "#c9a96a",
        border: "1px solid rgba(201,169,106,0.35)",
        borderRadius: 3,
        padding: "1px 5px",
        lineHeight: 1.5,
      }}
    >
      Press Box
    </span>
  );
}
