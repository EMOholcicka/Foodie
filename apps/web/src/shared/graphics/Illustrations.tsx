import * as React from "react";

export type IllustrationProps = {
  title?: string;
  className?: string;
};

function Svg({ title, className, children, viewBox }: { title?: string; className?: string; children: React.ReactNode; viewBox: string }) {
  const titleId = React.useId();
  return (
    <svg
      role="img"
      aria-labelledby={title ? titleId : undefined}
      viewBox={viewBox}
      className={className}
      focusable="false"
    >
      {title ? <title id={titleId}>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Today: empty meals illustration */
export function TodayEmptyMealsIllustration({ title = "No meals logged yet", className }: IllustrationProps) {
  const warmGlowId = React.useId();
  const speckleId = React.useId();

  return (
    <Svg title={title} className={className} viewBox="0 0 360 200">
      <defs>
        <linearGradient id={warmGlowId} x1="40" y1="0" x2="320" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F7C77A" stopOpacity={0.9} />
          <stop offset="0.55" stopColor="#F39A7A" stopOpacity={0.55} />
          <stop offset="1" stopColor="#D96A7C" stopOpacity={0.35} />
        </linearGradient>
        <pattern id={speckleId} width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="6" r="1" fill="rgba(255,255,255,0.10)" />
          <circle cx="17" cy="9" r="1" fill="rgba(255,255,255,0.06)" />
          <circle cx="12" cy="20" r="1" fill="rgba(255,255,255,0.08)" />
        </pattern>
      </defs>

      <rect x="12" y="10" width="336" height="180" rx="18" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <rect x="12" y="10" width="336" height="180" rx="18" fill={`url(#${speckleId})`} opacity={0.65} />

      {/* soft blob */}
      <path
        d="M86 140c28 30 78 46 126 30 40-13 74-50 55-86-17-33-71-48-116-31-54 20-96 54-65 87Z"
        fill={`url(#${warmGlowId})`}
        opacity={0.55}
      />

      {/* plate */}
      <ellipse cx="190" cy="132" rx="92" ry="34" fill="rgba(0,0,0,0.22)" />
      <ellipse cx="186" cy="124" rx="104" ry="40" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" />
      <ellipse cx="186" cy="124" rx="76" ry="28" fill="rgba(255,255,255,0.03)" />

      {/* fork */}
      <path
        d="M262 64c0 9-6 16-13 16v52c0 5-4 9-9 9s-9-4-9-9V80c-7 0-13-7-13-16 0-1 0-2 .2-3h8c-.1 1-.2 2-.2 3 0 4 2 8 5 9V59c0-4 3-7 7-7s7 3 7 7v14c3-1 5-5 5-9 0-1-.1-2-.2-3h8c.2 1 .2 2 .2 3Z"
        fill="rgba(255,255,255,0.18)"
      />

      {/* sparkle */}
      <path d="M76 66l4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z" fill="rgba(247,199,122,0.75)" />
      <path d="M298 118l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" fill="rgba(243,154,122,0.60)" />
    </Svg>
  );
}

/** Plan: load failure / error illustration */
export function PlanLoadFailIllustration({ title = "Could not load", className }: IllustrationProps) {
  const warnId = React.useId();

  return (
    <Svg title={title} className={className} viewBox="0 0 360 200">
      <defs>
        <linearGradient id={warnId} x1="30" y1="20" x2="330" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F7C77A" stopOpacity={0.45} />
          <stop offset="0.6" stopColor="#D96A7C" stopOpacity={0.35} />
          <stop offset="1" stopColor="#7C5CD9" stopOpacity={0.22} />
        </linearGradient>
      </defs>

      <rect x="14" y="14" width="332" height="172" rx="18" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <path d="M40 150c30-34 66-46 102-28 22 10 36 24 58 16 33-12 40-62 92-78 26-8 52 1 76 24v78H40v-12Z" fill={`url(#${warnId})`} />

      {/* card stack */}
      <g>
        <rect x="92" y="54" width="150" height="104" rx="14" fill="rgba(0,0,0,0.20)" />
        <rect x="82" y="46" width="170" height="112" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" />
        <rect x="102" y="70" width="118" height="10" rx="5" fill="rgba(255,255,255,0.14)" />
        <rect x="102" y="90" width="92" height="10" rx="5" fill="rgba(255,255,255,0.10)" />
        <rect x="102" y="110" width="102" height="10" rx="5" fill="rgba(255,255,255,0.10)" />
      </g>

      {/* broken link icon */}
      <g transform="translate(250 48)">
        <circle cx="34" cy="34" r="26" fill="rgba(217,106,124,0.18)" stroke="rgba(217,106,124,0.35)" />
        <path d="M22 22l24 24M46 22L22 46" stroke="rgba(255,255,255,0.70)" strokeWidth="5" strokeLinecap="round" />
      </g>
    </Svg>
  );
}

/** Plan: generator illustration */
export function PlanGenerateIllustration({ title = "Generate a plan", className }: IllustrationProps) {
  const genId = React.useId();

  return (
    <Svg title={title} className={className} viewBox="0 0 360 200">
      <defs>
        <linearGradient id={genId} x1="40" y1="20" x2="320" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F7C77A" stopOpacity={0.55} />
          <stop offset="0.55" stopColor="#79D7B6" stopOpacity={0.30} />
          <stop offset="1" stopColor="#7C5CD9" stopOpacity={0.22} />
        </linearGradient>
      </defs>

      <rect x="14" y="14" width="332" height="172" rx="18" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <path
        d="M52 148c22-26 50-44 90-34 34 9 50 34 84 28 40-7 44-62 96-72 26-5 49 6 70 30v68H52v-20Z"
        fill={`url(#${genId})`}
      />

      {/* calendar */}
      <g transform="translate(82 44)">
        <rect x="0" y="10" width="178" height="118" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" />
        <rect x="0" y="10" width="178" height="26" rx="14" fill="rgba(255,255,255,0.08)" />
        <circle cx="38" cy="10" r="7" fill="rgba(255,255,255,0.18)" />
        <circle cx="140" cy="10" r="7" fill="rgba(255,255,255,0.18)" />
        <g fill="rgba(255,255,255,0.12)">
          <rect x="18" y="52" width="24" height="18" rx="6" />
          <rect x="54" y="52" width="24" height="18" rx="6" />
          <rect x="90" y="52" width="24" height="18" rx="6" />
          <rect x="126" y="52" width="24" height="18" rx="6" />
          <rect x="18" y="78" width="24" height="18" rx="6" />
          <rect x="54" y="78" width="24" height="18" rx="6" />
          <rect x="90" y="78" width="24" height="18" rx="6" />
        </g>
      </g>

      {/* magic wand */}
      <g transform="translate(270 70) rotate(-18)">
        <rect x="-8" y="28" width="78" height="10" rx="5" fill="rgba(255,255,255,0.18)" />
        <rect x="4" y="24" width="16" height="18" rx="7" fill="rgba(247,199,122,0.55)" />
        <path d="M64 18l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" fill="rgba(121,215,182,0.65)" />
      </g>
    </Svg>
  );
}
