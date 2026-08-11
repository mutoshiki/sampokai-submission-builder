import type { ItineraryPoint } from "../types";

const marker = (kind: ItineraryPoint["kind"]) => {
  if (kind === "Start") return "Ⓢ";
  if (kind === "Peak") return "Ⓟ";
  if (kind === "Goal") return "Ⓖ";
  return "";
};

const minutesLabel = (value: string) => {
  const total = Number(value);
  if (!Number.isFinite(total) || total <= 0) return "";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours && minutes) return `${hours}時間${minutes}分`;
  if (hours) return `${hours}時間`;
  return `${minutes}分`;
};

export const buildItineraryText = (points: ItineraryPoint[]) =>
  points
    .map((point, index) => {
      const label = `${marker(point.kind)}${point.name} ${point.arrivalTime}`.trim();
      const rest = Number(point.restMinutes) > 0 ? `～（休憩${minutesLabel(point.restMinutes)}）` : "";
      const travel = minutesLabel(point.travelMinutesToNext);
      const connector = index < points.length - 1 ? `⇒（${travel || "所要時間未入力"}）⇒` : "";
      return `${label}${rest}${connector}`;
    })
    .join("");

export const durationBetween = (start: string, end: string) => {
  const parse = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const startMinutes = parse(start);
  const endMinutes = parse(end);
  if (startMinutes === null || endMinutes === null || endMinutes < startMinutes) return "";
  const total = endMinutes - startMinutes;
  return `${Math.floor(total / 60)}時間${total % 60}分`;
};
