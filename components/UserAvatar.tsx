import {
  type AvatarConfig,
  DEFAULT_AVATAR_CONFIG,
  BallSVG,
  RacquetSVG,
  NetSVG,
} from "@/lib/avatarTemplates";

interface Props {
  config:      AvatarConfig | null | undefined;
  initials:    string;
  size?:       number;   // px — default 48
  className?:  string;
}

export default function UserAvatar({ config, initials, size = 48, className = "" }: Props) {
  const cfg = config ?? DEFAULT_AVATAR_CONFIG;
  const { template, bgColor, fgColor } = cfg;

  const style: React.CSSProperties = {
    width:           size,
    height:          size,
    borderRadius:    "50%",
    backgroundColor: bgColor,
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
    overflow:        "hidden",
  };

  let inner: React.ReactNode;

  if (template === "ball") {
    inner = <BallSVG fg={fgColor} bg={bgColor} size={size} />;
  } else if (template === "racquet") {
    inner = <RacquetSVG fg={fgColor} bg={bgColor} size={size} />;
  } else if (template === "net") {
    inner = <NetSVG fg={fgColor} bg={bgColor} size={size} />;
  } else {
    // "initials"
    const fontSize = Math.round(size * 0.36);
    inner = (
      <span
        style={{
          fontFamily:  "var(--font-ibm-plex-mono), monospace",
          fontSize:    `${fontSize}px`,
          fontWeight:  700,
          color:       fgColor,
          lineHeight:  1,
          userSelect:  "none",
        }}
      >
        {initials.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <div style={style} className={className} aria-hidden="true">
      {inner}
    </div>
  );
}
