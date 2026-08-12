import { ComboBox, FormGroup, InlineNotification, TextInput } from "@carbon/react";
import { useEffect } from "react";
import { focusValidationTarget } from "../lib/focus";
import type { ProjectInfo, RosterRecord, ValidationTarget } from "../types";

interface ProjectStepProps {
  project: ProjectInfo;
  roster: RosterRecord[];
  onChange: (project: ProjectInfo) => void;
  focusTarget: ValidationTarget | null;
  onFocusHandled: () => void;
}

export function ProjectStep({ project, roster, onChange, focusTarget, onFocusHandled }: ProjectStepProps) {
  const organizerItems = roster.map((person, index) => ({
    id: String(index),
    index,
    label: `${person.name} / ${person.studentId || "学籍番号なし"}`,
  }));
  const selectedOrganizer =
    project.organizer.rosterIndex === null
      ? null
      : organizerItems.find((item) => item.index === project.organizer.rosterIndex) ?? null;
  const setField = (key: keyof ProjectInfo, value: string) => onChange({ ...project, [key]: value });
  useEffect(() => {
    if (focusTarget && focusValidationTarget(focusTarget)) onFocusHandled();
  }, [focusTarget, onFocusHandled]);
  return (
    <section aria-labelledby="project-heading">
      <div className="page-heading">
        <h1 id="project-heading">企画情報</h1>
      </div>

      <FormGroup legendText="基本情報">
        <div className="form-grid form-grid--three">
          <TextInput id="mountain-name" labelText="山名" value={project.mountainName} placeholder="例：蝶ヶ岳" onChange={(event) => setField("mountainName", event.target.value)} />
          <TextInput id="event-date" type="date" labelText="実施日" value={project.date} onChange={(event) => setField("date", event.target.value)} />
          <TextInput id="reserve-date" type="date" labelText="予備日（任意）" value={project.reserveDate} onChange={(event) => setField("reserveDate", event.target.value)} />
          <TextInput id="submission-date" type="date" labelText="登山等届の届出日" value={project.submissionDate} onChange={(event) => setField("submissionDate", event.target.value)} />
          <TextInput id="area" labelText="入山エリア" value={project.area} placeholder="山名（山域／所在市町村）" onChange={(event) => setField("area", event.target.value)} />
          <TextInput id="notice-place" labelText="登山等届の場所" value={project.noticePlace} placeholder="例：長野県安曇野市 蝶ヶ岳" onChange={(event) => setField("noticePlace", event.target.value)} />
          <TextInput id="meeting-place" labelText="集合場所" value={project.meetingPlace} onChange={(event) => setField("meetingPlace", event.target.value)} />
          <TextInput id="meeting-time" type="time" labelText="集合時間" value={project.meetingTime} onChange={(event) => setField("meetingTime", event.target.value)} />
          <TextInput id="weather-policy" labelText="天候時の扱い" value={project.weatherPolicy} placeholder="例：雨天中止" onChange={(event) => setField("weatherPolicy", event.target.value)} />
        </div>
      </FormGroup>

      <FormGroup legendText="企画者">
        <div className="organizer-picker">
          <ComboBox
            id="organizer"
            titleText="全体名簿から選択"
            items={organizerItems}
            selectedItem={selectedOrganizer}
            itemToString={(item) => item?.label ?? ""}
            placeholder="氏名または学籍番号で検索"
            onChange={({ selectedItem }) => {
              if (!selectedItem) return;
              const person = roster[selectedItem.index];
              onChange({
                ...project,
                organizer: {
                  rosterIndex: selectedItem.index,
                  studentId: person.studentId,
                  name: person.name,
                  faculty: person.faculty,
                  department: person.department,
                  phone: person.phone,
                },
              });
            }}
          />
        </div>
        {project.organizer.name ? (
          <InlineNotification
            kind="info"
            title={`${project.organizer.name}を企画者として使用`}
            subtitle={`学籍番号 ${project.organizer.studentId || "未入力"} / ${project.organizer.faculty || "学部未入力"} / ${project.organizer.department || "学科未入力"} / ${project.organizer.phone || "連絡先未入力"}`}
            hideCloseButton
            lowContrast
          />
        ) : null}
      </FormGroup>
    </section>
  );
}
