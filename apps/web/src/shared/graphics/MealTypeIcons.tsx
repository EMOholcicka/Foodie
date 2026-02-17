import * as React from "react";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type MealTypeIconProps = {
  type: MealType;
  title?: string;
  className?: string;
};

function BaseIcon({ title, className, children }: { title?: string; className?: string; children: React.ReactNode }) {
  const titleId = React.useId();
  return (
    <svg
      role="img"
      aria-labelledby={title ? titleId : undefined}
      viewBox="0 0 20 20"
      className={className}
      focusable="false"
    >
      {title ? <title id={titleId}>{title}</title> : null}
      {children}
    </svg>
  );
}

export function MealTypeIcon({ type, title, className }: MealTypeIconProps) {
  const label = title ?? ({ breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" } as const)[type];

  switch (type) {
    case "breakfast":
      return (
        <BaseIcon title={label} className={className}>
          <path
            d="M3 11.2c.1-4 3.3-7.2 7.3-7.2 4 0 7.3 3.2 7.4 7.2 0 2.9-2.2 5.5-5.3 6.4-.7.2-1.4.4-2.1.4-3.9 0-7.3-3.1-7.3-6.8Z"
            fill="currentColor"
            fillOpacity={0.22}
          />
          <path
            d="M6 12.2c.4-2.4 2.5-4.2 4.9-4.2 2.4 0 4.5 1.8 4.9 4.2"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.75}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <path
            d="M10 7.2c.6-1.2 1.5-2 2.6-2.4"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </BaseIcon>
      );
    case "lunch":
      return (
        <BaseIcon title={label} className={className}>
          <rect x="4" y="4" width="12" height="14" rx="3" fill="currentColor" fillOpacity={0.16} />
          <path
            d="M6 8.2h8M6 11.2h8M6 14.2h5"
            stroke="currentColor"
            strokeOpacity={0.75}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <path
            d="M12.4 4.4c.3-1.1 1.2-1.9 2.3-2.2"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </BaseIcon>
      );
    case "dinner":
      return (
        <BaseIcon title={label} className={className}>
          <circle cx="10" cy="11" r="6" fill="currentColor" fillOpacity={0.16} />
          <circle cx="10" cy="11" r="3.5" fill="none" stroke="currentColor" strokeOpacity={0.7} strokeWidth={1.6} />
          <path d="M4.2 6.2c1.4-1.6 3.4-2.6 5.8-2.6 2.3 0 4.3 1 5.7 2.6" fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.4} strokeLinecap="round" />
        </BaseIcon>
      );
    case "snack":
      return (
        <BaseIcon title={label} className={className}>
          <path
            d="M6.2 6.2c0-1.2 1-2.2 2.2-2.2h3.2c1.2 0 2.2 1 2.2 2.2v1.1c0 .7-.3 1.3-.9 1.7l-1.2.8c-.4.2-.6.7-.6 1.1V16H8.7v-3.1c0-.4-.2-.9-.6-1.1l-1.2-.8c-.6-.4-.9-1-.9-1.7V6.2Z"
            fill="currentColor"
            fillOpacity={0.18}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <path
            d="M9 7.3h2"
            stroke="currentColor"
            strokeOpacity={0.75}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </BaseIcon>
      );
    default:
      return null;
  }
}
