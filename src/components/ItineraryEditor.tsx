import { Button, Select, SelectItem, TextInput } from "@carbon/react";
import { Add, ArrowDown, ArrowUp, TrashCan } from "@carbon/icons-react";
import type { ItineraryPoint } from "../types";

interface ItineraryEditorProps {
  points: ItineraryPoint[];
  onChange: (points: ItineraryPoint[]) => void;
}

export function ItineraryEditor({ points, onChange }: ItineraryEditorProps) {
  const update = (id: string, key: keyof ItineraryPoint, value: string) =>
    onChange(points.map((point) => (point.id === id ? { ...point, [key]: value } : point)));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= points.length) return;
    const next = [...points];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const addPoint = () => {
    const next = [...points];
    const goalIndex = next.findIndex((point) => point.kind === "Goal");
    const point: ItineraryPoint = {
      id: crypto.randomUUID(),
      kind: "Waypoint",
      name: "",
      arrivalTime: "",
      restMinutes: "0",
      travelMinutesToNext: "",
    };
    if (goalIndex >= 0) next.splice(goalIndex, 0, point);
    else next.push(point);
    onChange(next);
  };
  return (
    <div className="itinerary-editor" id="itinerary-editor" tabIndex={-1}>
      <div className="section-toolbar">
        <div>
          <h3>行程地点</h3>
          <p>区間所要時間は、この地点から次の地点までの時間です。</p>
        </div>
        <Button kind="tertiary" size="sm" renderIcon={Add} onClick={addPoint}>地点を追加</Button>
      </div>
      <div className="itinerary-header" aria-hidden="true">
        <span>種別</span><span>地点名</span><span>到着時刻</span><span>休憩（分）</span><span>次まで（分）</span><span>操作</span>
      </div>
      {points.map((point, index) => (
        <div className="itinerary-row" key={point.id}>
          <Select id={`${point.id}-kind`} labelText="種別" hideLabel value={point.kind} onChange={(event) => update(point.id, "kind", event.target.value)}>
            <SelectItem value="Start" text="Start" />
            <SelectItem value="Waypoint" text="地点" />
            <SelectItem value="Peak" text="Peak" />
            <SelectItem value="Goal" text="Goal" />
          </Select>
          <TextInput id={`${point.id}-name`} labelText="地点名" hideLabel value={point.name} placeholder="例：登山口" onChange={(event) => update(point.id, "name", event.target.value)} />
          <TextInput id={`${point.id}-arrival`} type="time" labelText="到着時刻" hideLabel value={point.arrivalTime} onChange={(event) => update(point.id, "arrivalTime", event.target.value)} />
          <TextInput id={`${point.id}-rest`} type="number" min="0" labelText="休憩（分）" hideLabel value={point.restMinutes} onChange={(event) => update(point.id, "restMinutes", event.target.value)} />
          <TextInput id={`${point.id}-travel`} type="number" min="0" labelText="次まで（分）" hideLabel value={point.travelMinutesToNext} disabled={index === points.length - 1} onChange={(event) => update(point.id, "travelMinutesToNext", event.target.value)} />
          <div className="row-actions">
            <Button hasIconOnly kind="ghost" size="sm" renderIcon={ArrowUp} iconDescription="上へ" disabled={index === 0} onClick={() => move(index, -1)} />
            <Button hasIconOnly kind="ghost" size="sm" renderIcon={ArrowDown} iconDescription="下へ" disabled={index === points.length - 1} onClick={() => move(index, 1)} />
            <Button hasIconOnly kind="ghost" size="sm" renderIcon={TrashCan} iconDescription="削除" disabled={points.length <= 2} onClick={() => onChange(points.filter((item) => item.id !== point.id))} />
          </div>
        </div>
      ))}
    </div>
  );
}
