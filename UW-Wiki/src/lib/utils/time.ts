import {
  differenceInMinutes,
  differenceInWeeks,
  format,
  formatDistanceToNowStrict,
  parseJSON,
} from "date-fns";

export function formatRelativeTime(date: string | Date): string {
  const then = typeof date === "string" ? parseJSON(date) : date;
  if (Number.isNaN(then.getTime())) return "";
  const minutesAgo = differenceInMinutes(new Date(), then);
  if (minutesAgo < 1) return "Just now";
  if (differenceInWeeks(new Date(), then) <= 4) {
    return `${formatDistanceToNowStrict(then)} ago`;
  }
  return format(then, "MMM d, yyyy");
}

export function formatLongDate(date: string | Date): string {
  const then = typeof date === "string" ? parseJSON(date) : date;
  if (Number.isNaN(then.getTime())) return "";
  return format(then, "MMM d, yyyy h:mm a");
}
