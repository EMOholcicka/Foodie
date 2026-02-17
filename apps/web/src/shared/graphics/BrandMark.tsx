import * as React from "react";

export type BrandMarkProps = {
  title?: string;
  size?: number;
  className?: string;
};

/**
 * Simple inline SVG brand mark.
 *
 * Designed to be warm on a dark UI: citrus/peach gradient + subtle outline.
 * Uses currentColor for outline so it adapts to surrounding text color.
 */
export function BrandMark({ title = "Foodie", size = 28, className }: BrandMarkProps) {
  const titleId = React.useId();
  const gradientId = React.useId();

  return (
    <svg
      role="img"
      aria-labelledby={title ? titleId : undefined}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      focusable="false"
    >
      {title ? <title id={titleId}>{title}</title> : null}
      <defs>
        <linearGradient id={gradientId} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F7C77A" />
          <stop offset="0.55" stopColor="#F39A7A" />
          <stop offset="1" stopColor="#D96A7C" />
        </linearGradient>
      </defs>

      {/* warm droplet/leaf mark */}
      <path
        d="M32 6c10 9 17 19 17 30 0 10-7.8 19-17 19S15 46 15 36C15 25 22 15 32 6Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M32 14c-4.7 6-7.8 12-7.8 18.3C24.2 41 27.6 47 32 47c4.4 0 7.8-6 7.8-14.7C39.8 26 36.7 20 32 14Z"
        fill="rgba(255,255,255,0.16)"
      />

      {/* subtle outline */}
      <path
        d="M32 6c10 9 17 19 17 30 0 10-7.8 19-17 19S15 46 15 36C15 25 22 15 32 6Z"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.28}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}
