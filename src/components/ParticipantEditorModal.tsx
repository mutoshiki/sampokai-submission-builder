import { Modal, Select, SelectItem, TextInput } from "@carbon/react";
import { useEffect, useState } from "react";
import { participantFieldError } from "../lib/participantValidation";
import { participantEditorFieldId } from "../lib/validationTargets";
import type { ParticipantField, RosterRecord } from "../types";

const faculties = ["人文学部", "教育学部", "経法学部", "理学部", "医学部", "工学部", "農学部", "繊維学部"];

interface ParticipantEditorModalProps {
  open: boolean;
  participant: RosterRecord | null;
  invalidField: ParticipantField | null;
  onClose: () => void;
  onSave: (participant: RosterRecord) => void;
}

export function ParticipantEditorModal({ open, participant, invalidField, onClose, onSave }: ParticipantEditorModalProps) {
  const [draft, setDraft] = useState<RosterRecord | null>(participant);
  const [highlightedField, setHighlightedField] = useState<ParticipantField | null>(null);

  useEffect(() => {
    if (!open || !participant) return;
    setDraft(participant);
    setHighlightedField(invalidField);
  }, [open, participant, invalidField]);
  useEffect(() => {
    if (invalidField) setHighlightedField(invalidField);
  }, [invalidField]);

  // Unmount closed modal. Carbon modal focus trap must not remain mounted after close.
  if (!open || !participant || !draft) return null;
  const update = (key: keyof RosterRecord, value: string) => setDraft((current) => (current ? { ...current, [key]: value } : current));
  const fieldError = (field: ParticipantField) => highlightedField === field ? participantFieldError(draft, field) : undefined;

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
        <TextInput id={participantEditorFieldId(draft.rowId, "studentId")} labelText="学籍番号" value={draft.studentId} invalid={Boolean(fieldError("studentId"))} invalidText={fieldError("studentId")} onChange={(event) => update("studentId", event.target.value)} />
        <TextInput id={participantEditorFieldId(draft.rowId, "name")} labelText="氏名" value={draft.name} invalid={Boolean(fieldError("name"))} invalidText={fieldError("name")} onChange={(event) => update("name", event.target.value)} />
        <Select id={participantEditorFieldId(draft.rowId, "faculty")} labelText="学部" value={draft.faculty} invalid={Boolean(fieldError("faculty"))} invalidText={fieldError("faculty")} onChange={(event) => update("faculty", event.target.value)}>
          <SelectItem value="" text="選択してください" />
          {faculties.map((faculty) => <SelectItem key={faculty} value={faculty} text={faculty} />)}
        </Select>
        <TextInput id="edit-department" labelText="学科・課程" value={draft.department} onChange={(event) => update("department", event.target.value)} />
        <Select id={participantEditorFieldId(draft.rowId, "gender")} labelText="身体の性別（登山等届の集計）" value={draft.gender.startsWith("男") ? "男性" : draft.gender.startsWith("女") ? "女性" : ""} invalid={Boolean(fieldError("gender"))} invalidText={fieldError("gender")} onChange={(event) => update("gender", event.target.value)}>
          <SelectItem value="" text="選択してください" />
          <SelectItem value="男性" text="男性（男子欄へ集計）" />
          <SelectItem value="女性" text="女性（女子欄へ集計）" />
        </Select>
        <TextInput id={participantEditorFieldId(draft.rowId, "phone")} labelText="本人連絡先" value={draft.phone} invalid={Boolean(fieldError("phone"))} invalidText={fieldError("phone")} onChange={(event) => update("phone", event.target.value)} />
        <TextInput id={participantEditorFieldId(draft.rowId, "address")} labelText="現住所" value={draft.address} invalid={Boolean(fieldError("address"))} invalidText={fieldError("address")} onChange={(event) => update("address", event.target.value)} />
        <TextInput id={participantEditorFieldId(draft.rowId, "emergencyPhone")} labelText="緊急連絡先" value={draft.emergencyPhone} invalid={Boolean(fieldError("emergencyPhone"))} invalidText={fieldError("emergencyPhone")} onChange={(event) => update("emergencyPhone", event.target.value)} />
      </div>
    </Modal>
  );
}
