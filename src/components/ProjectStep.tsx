import { ComboBox, FormGroup, InlineNotification, TextInput } from "@carbon/react";
import { useEffect, useState } from "react";
import { focusValidationTarget } from "../lib/focus";
import type { ProjectInfo, ProjectRole, RosterRecord, ValidationTarget } from "../types";

interface ProjectStepProps {
  project: ProjectInfo;
  role: ProjectRole;
  roster: RosterRecord[];
  onChange: (project: ProjectInfo) => void;
  focusTarget: ValidationTarget | null;
  onFocusHandled: () => void;
}

export function ProjectStep({ project, role, roster, onChange, focusTarget, onFocusHandled }: ProjectStepProps) {
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const organizerItems = roster.map((person, index) => ({ id: String(index), index, label: `${person.name} / ${person.studentId || "学籍番号なし"}` }));
  const selectedOrganizer = project.organizer.rosterIndex === null ? null : organizerItems.find((item) => item.index === project.organizer.rosterIndex) ?? null;
  const setField = (key: keyof ProjectInfo, value: string) => { setInvalidField(null); onChange({ ...project, [key]: value }); };
  const updateOrganizer = (changes: Partial<ProjectInfo["organizer"]>) => { setInvalidField(null); onChange({ ...project, organizer: { ...project.organizer, ...changes } }); };
  useEffect(() => {
    if (!focusTarget) return;
    setInvalidField(focusTarget.fieldId);
    if (focusValidationTarget(focusTarget)) onFocusHandled();
  }, [focusTarget, onFocusHandled]);
  const invalid = (id: string) => invalidField === id;
  const leader = role === "leader";

  if (leader) {
    return <section aria-labelledby="project-heading">
      <div className="page-heading"><div><h1 id="project-heading">学務提出情報</h1></div></div>
      <FormGroup legendText="提出書類の情報">
        <div className="form-grid form-grid--three" id="submission-info">
          <TextInput id="mountain-name" invalid={invalid("mountain-name")} labelText="山名" value={project.mountainName} onChange={(event) => setField("mountainName", event.target.value)} />
          <TextInput id="event-date" invalid={invalid("event-date")} type="date" labelText="実施日" value={project.date} onChange={(event) => setField("date", event.target.value)} />
          <TextInput id="reserve-date" type="date" labelText="予備日（任意）" value={project.reserveDate} onChange={(event) => setField("reserveDate", event.target.value)} />
          <TextInput id="submission-date" invalid={invalid("submission-date")} type="date" labelText="届出日" value={project.submissionDate} onChange={(event) => setField("submissionDate", event.target.value)} />
          <TextInput id="notice-place" invalid={invalid("notice-place")} labelText="登山等届の場所" value={project.noticePlace} onChange={(event) => setField("noticePlace", event.target.value)} />
        </div>
      </FormGroup>
      <FormGroup legendText="企画者（全体名簿から補完）">
        <div className="organizer-picker"><ComboBox id="organizer" invalid={invalid("organizer")} titleText="全体名簿から選択" items={organizerItems} selectedItem={selectedOrganizer} itemToString={(item) => item?.label ?? ""} placeholder="氏名または学籍番号で検索" onChange={({ selectedItem }) => {
          if (!selectedItem) return;
          const person = roster[selectedItem.index];
          updateOrganizer({ rosterIndex: selectedItem.index, studentId: person.studentId, name: person.name, faculty: person.faculty, department: person.department, phone: person.phone });
        }} /></div>
        {project.organizer.name ? <InlineNotification kind="info" title={`${project.organizer.name}を企画者として使用`} subtitle={`学籍番号 ${project.organizer.studentId || "未入力"} / ${project.organizer.faculty || "学部未入力"} / ${project.organizer.department || "学科・課程未入力"} / ${project.organizer.phone || "電話番号未入力"}`} hideCloseButton lowContrast /> : null}
      </FormGroup>
    </section>;
  }

  return <section aria-labelledby="project-heading">
    <div className="page-heading"><div><h1 id="project-heading">登山計画書の情報</h1></div></div>
    <FormGroup legendText="基本情報">
      <div className="form-grid form-grid--three">
        <TextInput id="mountain-name" invalid={invalid("mountain-name")} labelText="山名" value={project.mountainName} onChange={(event) => setField("mountainName", event.target.value)} />
        <TextInput id="event-date" invalid={invalid("event-date")} type="date" labelText="実施日" value={project.date} onChange={(event) => setField("date", event.target.value)} />
      </div>
    </FormGroup>
    <FormGroup legendText="集合・入山情報">
      <div className="form-grid form-grid--three">
        <TextInput id="area" invalid={invalid("area")} labelText="入山エリア" value={project.area} onChange={(event) => setField("area", event.target.value)} />
        <TextInput id="meeting-place" invalid={invalid("meeting-place")} labelText="集合場所" value={project.meetingPlace} onChange={(event) => setField("meetingPlace", event.target.value)} />
        <TextInput id="meeting-time" invalid={invalid("meeting-time")} type="time" labelText="集合時間" value={project.meetingTime} onChange={(event) => setField("meetingTime", event.target.value)} />
        <TextInput id="weather-policy" invalid={invalid("weather-policy")} labelText="天候時の扱い" value={project.weatherPolicy} onChange={(event) => setField("weatherPolicy", event.target.value)} />
      </div>
    </FormGroup>
    <FormGroup legendText="企画者">
      <div className="form-grid form-grid--three">
        <TextInput id="organizer-student-id" invalid={invalid("organizer-student-id")} labelText="学籍番号" value={project.organizer.studentId} onChange={(event) => updateOrganizer({ rosterIndex: null, studentId: event.target.value })} />
        <TextInput id="organizer-name" invalid={invalid("organizer-name")} labelText="氏名" value={project.organizer.name} onChange={(event) => updateOrganizer({ rosterIndex: null, name: event.target.value })} />
        <TextInput id="organizer-phone" invalid={invalid("organizer-phone")} labelText="携帯電話番号" value={project.organizer.phone} onChange={(event) => updateOrganizer({ rosterIndex: null, phone: event.target.value })} />
      </div>
    </FormGroup>
  </section>;
}
