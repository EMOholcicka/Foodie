import dayjs from "dayjs";

const LS_PLAN_WEEK_KEY = "foodie:plan:lastWeekStart";

function safeLocalStorageGet(key: string): string | null {
  // In SSR/tests (jsdom-less) localStorage may be unavailable or throw.
  try {
    if (typeof window === "undefined") return null;
    if (!("localStorage" in window)) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    if (!("localStorage" in window)) return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function startOfIsoWeek(d: dayjs.Dayjs) {
  // dayjs: Sunday=0 ... Saturday=6
  const day = d.day();
  const diff = day === 0 ? -6 : 1 - day;
  return d.add(diff, "day").startOf("day");
}

export function fmtDate(d: dayjs.Dayjs) {
  return d.format("YYYY-MM-DD");
}

export function weekLabel(weekStart: dayjs.Dayjs) {
  const end = weekStart.add(6, "day");
  return `${weekStart.format("D MMM")} – ${end.format("D MMM")}`;
}

export function weekdays() {
  return [0, 1, 2, 3, 4, 5, 6] as const;
}

export function mealTypeShort(t: string) {
  switch (t) {
    case "breakfast":
      return "B";
    case "lunch":
      return "L";
    case "dinner":
      return "D";
    case "snack":
      return "S";
    default:
      return t;
  }
}

export function isValidWeekStart(s: string | null | undefined) {
  return Boolean(s && dayjs(s, "YYYY-MM-DD", true).isValid());
}

export function getWeekStartFromUrlOrStorage(opts: { searchParams: URLSearchParams; fallback: dayjs.Dayjs }) {
  const fromQuery = opts.searchParams.get("week");
  if (isValidWeekStart(fromQuery)) return fromQuery!;

  const fromLs = safeLocalStorageGet(LS_PLAN_WEEK_KEY);
  if (isValidWeekStart(fromLs)) return fromLs!;

  return fmtDate(startOfIsoWeek(opts.fallback));
}

export function persistLastWeekStart(weekStart: string) {
  if (!isValidWeekStart(weekStart)) return;
  safeLocalStorageSet(LS_PLAN_WEEK_KEY, weekStart);
}
