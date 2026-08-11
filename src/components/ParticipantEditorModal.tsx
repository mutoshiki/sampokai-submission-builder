import { Modal, Select, SelectItem, TextInput } from "@carbon/react";
import { useEffect, useState } from "react";
import type { RosterRecord } from "../types";

const faculties = ["人文学部", "教育学部", "経法学部", "理学部", "医学部", "工学部", "農学部", "繊維学部"];

interface ParticipantEditorModalProps {
  open: boolean;
  participant: RosterRecord | null;
  onClose: () => void;
  onSave: (participant: RosterRecord) => void;
}

export function ParticipantEditorModal({ open, participant, onClose, onSave }: ParticipantEditorModalProps) {
  const [draft, setDraft] = useState<RosterRecord | null>(participant);
  useEffect(() => setDraft(participant), [participant]);
  if (!draft) return null;
  const update = (key: keyof RosterRecord, value: string) => setDraft((current) => (current ? { ...current, [key]: value } : current));
  return (
    <Modal
      open={open}
      modalHeading="参加者情報を確認"
      primaryButtonText="この企画で使用"
      secondaryButtonText="キャンセル"
      onRequestClose={onClose}
      onRequestSubmit={() => onSave(draft)}
      size="md"
    >
      <p className="modal-intro">変更は今回の企画だけに使用され、元の全体名簿は変更しません。</p>
      <div className="form-grid form-grid--two">
        <TextInput id="edit-student-id" labelText="学籍番号" value={draft.studentId} onChange={(event) => update("studentId", event.target.value)} />
        <TextInput id="edit-name" labelText="氏名" value={draft.name} onChange={(event) => update("name", event.target.value)} />
        <Select id="edit-faculty" labelText="学部" value={draft.faculty} onChange={(event) => update("faculty", event.target.value)}>
          <SelectItem value="" text="選択してください" />
          {faculties.map((faculty) => <SelectItem key={faculty} value={faculty} text={faculty} />)}
        </Select>
        <TextInput id="edit-department" labelText="学科・課程" value={draft.department} onChange={(event) => update("department", event.target.value)} />
        <Select id="edit-gender" labelText="身体の性別（登山等届の集計）" value={draft.gender.startsWith("男") ? "男性" : draft.gender.startsWith("女") ? "女性" : ""} onChange={(event) => update("gender", event.target.value)}>
          <SelectItem value="" text="選択してください" />
          <SelectItem value="男性" text="男性（男子欄へ集計）" />
          <SelectItem value="女性" text="女性（女子欄へ集計）" />
        </Select>
        <TextInput id="edit-phone" labelText="本人連絡先" value={draft.phone} onChange={(event) => update("phone", event.target.value)} />
        <TextInput id="edit-address" labelText="現住所" value={draft.address} onChange={(event) => update("address", event.target.value)} />
        <TextInput id="edit-emergency" labelText="緊急連絡先" value={draft.emergencyPhone} onChange={(event) => update("emergencyPhone", event.target.value)} />
      </div>
    </Modal>
  );
}
