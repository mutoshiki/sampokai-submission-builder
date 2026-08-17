import {
  Button, Checkbox, ComboBox, DataTable, InlineNotification, Search, Table, TableBody, TableCell,
  TableContainer, TableHead, TableHeader, TableRow, TableToolbar, TableToolbarContent, Tag,
} from "@carbon/react";
import { Add, Checkmark, Renew, UserMultiple } from "@carbon/icons-react";
import { useEffect, useMemo, useState } from "react";
import type { AddedParticipant, ColumnMapping, ImportedTable, MatchResult, RosterRecord, ValidationTarget } from "../types";
import { focusValidationTarget } from "../lib/focus";
import { addedParticipantFromRoster } from "../lib/participants";
import { ColumnMappingPanel } from "./ColumnMappingPanel";
import { FileSourcePicker } from "./FileSourcePicker";
import { ParticipantEditorModal } from "./ParticipantEditorModal";

const headers = [
  { key: "selected", header: "参加" }, { key: "response", header: "参加者の元データ" },
  { key: "matched", header: "全体名簿" }, { key: "status", header: "照合結果" }, { key: "confirmation", header: "確認・補正" },
];
const statusPresentation: Record<MatchResult["status"], { label: string; type: "green" | "blue" | "red" | "magenta" }> = {
  exact_id: { label: "学籍番号一致", type: "green" }, exact_name: { label: "氏名の一意一致", type: "blue" }, manual: { label: "確認済み", type: "green" },
  ambiguous: { label: "複数候補", type: "magenta" }, not_found: { label: "名簿になし", type: "red" }, conflict: { label: "情報が矛盾", type: "red" },
};
type RosterOption = { id: string; label: string; index: number };
type TableEntry = { id: string; kind: "handoff"; match: MatchResult } | { id: string; kind: "added"; added: AddedParticipant };
type EditTarget = { rosterIndex: number | null; addedParticipantId?: string };

interface ParticipantsStepProps {
  rosterPath: string; responsePath: string; handoffPath?: string; rosterTable: ImportedTable | null; responseTable: ImportedTable | null;
  rosterMapping: ColumnMapping; responseMapping: ColumnMapping; roster: RosterRecord[]; matches: MatchResult[]; selectedIds: Set<string>;
  addedParticipants: AddedParticipant[]; duplicateResponseIds: Set<string>; loadingRoster: boolean; loadingResponses: boolean; error: string;
  onPickRoster: () => void; onPickResponses: () => void; onClearRoster: () => void; onClearResponses: () => void;
  onRosterMappingChange: (mapping: ColumnMapping) => void; onResponseMappingChange: (mapping: ColumnMapping) => void;
  onSelectionChange: (ids: Set<string>) => void; onManualMatch: (responseId: string, rosterIndex: number | null) => void;
  onAddRosterParticipant: (rosterIndex: number) => void; onRemoveAddedParticipant: (id: string) => void;
  onParticipantOverride: (rosterIndex: number, participant: RosterRecord) => void; onAddedParticipantChange: (id: string, participant: RosterRecord) => void;
  onParticipantSaved: () => void; focusTarget: ValidationTarget | null; onFocusHandled: () => void;
}

export function ParticipantsStep(props: ParticipantsStepProps) {
  const [query, setQuery] = useState("");
  const [addCandidate, setAddCandidate] = useState<RosterOption | null>(null);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const selectedMatches = useMemo(() => props.matches.filter((match) => props.selectedIds.has(match.response.rowId)), [props.matches, props.selectedIds]);
  const selectedRosterIndices = useMemo(() => new Set(selectedMatches.flatMap((match) => match.rosterIndex === null ? [] : [match.rosterIndex])), [selectedMatches]);
  const rosterOptions = useMemo<RosterOption[]>(() => props.roster.flatMap((participant, index) => {
    const added = addedParticipantFromRoster(participant);
    if (!added || selectedRosterIndices.has(index) || props.addedParticipants.some((item) => item.id === added.id)) return [];
    return [{ id: String(index), label: `${participant.name || "氏名なし"} / ${participant.studentId || "学籍番号なし"}`, index }];
  }), [props.roster, props.addedParticipants, selectedRosterIndices]);
  const entries = useMemo<TableEntry[]>(() => [
    ...props.matches.map((match) => ({ id: `handoff-${match.response.rowId}`, kind: "handoff" as const, match })),
    ...props.addedParticipants.map((added) => ({ id: `added-${added.id}`, kind: "added" as const, added })),
  ], [props.matches, props.addedParticipants]);
  const filteredEntries = useMemo(() => {
    const normalized = query.normalize("NFKC").toLowerCase().trim();
    if (!normalized) return entries;
    return entries.filter((entry) => {
      const values = entry.kind === "handoff"
        ? [entry.match.response.name, entry.match.response.studentId, entry.match.rosterIndex === null ? "" : props.roster[entry.match.rosterIndex]?.name ?? ""]
        : [entry.added.participant.name, entry.added.participant.studentId, entry.added.participant.faculty];
      return values.join(" ").normalize("NFKC").toLowerCase().includes(normalized);
    });
  }, [entries, props.roster, query]);
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const dataRows = filteredEntries.map((entry) => ({ id: entry.id, selected: "", response: "", matched: "", status: "", confirmation: "" }));
  const unresolvedSelected = selectedMatches.filter((match) => match.rosterIndex === null).length;
  const editingParticipant = editTarget?.rosterIndex === null
    ? props.addedParticipants.find((item) => item.id === editTarget.addedParticipantId)?.participant ?? null
    : editTarget === null ? null : props.roster[editTarget.rosterIndex] ?? null;

  const toggleSelection = (id: string, checked: boolean) => {
    const next = new Set(props.selectedIds);
    if (checked) next.add(id); else next.delete(id);
    props.onSelectionChange(next);
  };
  useEffect(() => {
    const target = props.focusTarget;
    if (!target) return;
    if (target.participant && (editTarget?.rosterIndex !== target.participant.rosterIndex || editTarget?.addedParticipantId !== target.participant.addedParticipantId)) {
      setEditTarget({ rosterIndex: target.participant.rosterIndex, addedParticipantId: target.participant.addedParticipantId });
      return;
    }
    if (focusValidationTarget(target)) props.onFocusHandled();
  }, [editTarget, props.focusTarget, props.onFocusHandled]);

  return <section aria-labelledby="participants-heading">
    <div className="page-heading"><h1 id="participants-heading">参加者</h1></div>
    {props.error ? <InlineNotification kind="error" title="ファイルを読み込めませんでした" subtitle={props.error} hideCloseButton lowContrast /> : null}
    <div className="source-grid">
      <FileSourcePicker id="roster-file" label="1. サークル全体名簿" path={props.rosterPath} loading={props.loadingRoster} onPick={props.onPickRoster} onClear={props.onClearRoster} />
      <FileSourcePicker id="response-file" label="2. 企画者から受け取った引継ぎデータ" path={props.responsePath} loading={props.loadingResponses} onPick={props.onPickResponses} onClear={props.onClearResponses} />
    </div>
    {props.rosterTable ? <ColumnMappingPanel title="全体名簿" kind="roster" table={props.rosterTable} mapping={props.rosterMapping} onChange={props.onRosterMappingChange} /> : null}
    {props.responseTable ? <ColumnMappingPanel title="引継ぎデータ" kind="response" table={props.responseTable} mapping={props.responseMapping} onChange={props.onResponseMappingChange} /> : null}
    {entries.length ? <div className="participant-table-section" id="participant-matches" tabIndex={-1}>
      <div className="summary-line" aria-label="照合サマリー"><span>引継ぎデータ {props.matches.length}件</span><span>名簿から追加 {props.addedParticipants.length}人</span><span>参加者 {selectedMatches.length + props.addedParticipants.length}人</span><span>選択中の未照合 {unresolvedSelected}人</span><span>重複 {props.duplicateResponseIds.size}件</span></div>
      {props.duplicateResponseIds.size ? <InlineNotification kind="warning" title="重複した引継ぎデータがあります" subtitle="同じ学籍番号または氏名のデータが複数あります。参加する人だけを選択してください。" hideCloseButton lowContrast /> : null}
      <DataTable key={dataRows.map((row) => row.id).join(",")} rows={dataRows} headers={headers} isSortable>{({ rows, headers: renderedHeaders, getHeaderProps, getRowProps }) => <TableContainer title="今回の参加者と名簿の照合">
        <TableToolbar><Search size="lg" labelText="参加者を検索" placeholder="氏名または学籍番号" value={query} onChange={(event) => setQuery(event.target.value)} /><TableToolbarContent>{props.rosterTable ? <Button kind="tertiary" renderIcon={Add} onClick={() => setAddPanelOpen((open) => !open)}>{addPanelOpen ? "名簿から追加を閉じる" : "名簿から追加"}</Button> : null}<Button kind="ghost" renderIcon={Checkmark} onClick={() => props.onSelectionChange(new Set(props.matches.map((match) => match.response.rowId)))}>引継ぎをすべて選択</Button><Button kind="ghost" renderIcon={Renew} onClick={() => props.onSelectionChange(new Set())}>引継ぎを選択解除</Button></TableToolbarContent></TableToolbar>
        {addPanelOpen && props.rosterTable ? <div className="participant-add-panel"><ComboBox id="add-roster-participant" titleText="全体名簿を検索" items={rosterOptions} selectedItem={addCandidate} itemToString={(item) => item?.label ?? ""} placeholder="氏名または学籍番号" onChange={({ selectedItem }) => setAddCandidate(selectedItem ?? null)} /><div className="participant-add-panel__actions"><Button renderIcon={Add} disabled={!addCandidate} onClick={() => { if (!addCandidate) return; props.onAddRosterParticipant(addCandidate.index); setAddCandidate(null); setAddPanelOpen(false); }}>参加者に追加</Button><Button kind="ghost" onClick={() => { setAddCandidate(null); setAddPanelOpen(false); }}>閉じる</Button></div></div> : null}
        <Table size="lg" useZebraStyles><TableHead><TableRow>{renderedHeaders.map((header) => <TableHeader {...getHeaderProps({ header })} key={header.key}>{header.header}</TableHeader>)}</TableRow></TableHead><TableBody>{rows.map((row) => {
          const entry = entryById.get(row.id);
          if (!entry) return null;
          if (entry.kind === "added") {
            const participant = entry.added.participant;
            return <TableRow {...getRowProps({ row })} key={row.id}><TableCell><Checkbox id={`select-added-${entry.added.id}`} labelText="" checked disabled aria-label={`${participant.name || "参加者"}は参加者に追加済み`} /></TableCell><TableCell><span className="secondary-text">引継ぎデータなし</span></TableCell><TableCell><div>{participant.name || "氏名なし"}</div><div className="secondary-text">{participant.studentId || "学籍番号なし"} / {participant.faculty || "学部未入力"}</div></TableCell><TableCell><Tag type="blue">名簿から追加</Tag></TableCell><TableCell><div className="participant-row-actions"><Button kind="ghost" size="sm" renderIcon={UserMultiple} onClick={() => setEditTarget({ rosterIndex: null, addedParticipantId: entry.added.id })}>情報を確認</Button><Button kind="danger--ghost" size="sm" onClick={() => props.onRemoveAddedParticipant(entry.added.id)}>今回の参加者から外す</Button></div></TableCell></TableRow>;
          }
          const { match } = entry; const status = statusPresentation[match.status]; const rosterItem = match.rosterIndex === null ? null : props.roster[match.rosterIndex];
          const candidateItems = (match.candidateIndices.length ? match.candidateIndices : props.roster.map((_, index) => index)).filter((index) => !selectedRosterIndices.has(index) && !props.addedParticipants.some((added) => added.id === addedParticipantFromRoster(props.roster[index])?.id)).map((index) => ({ id: String(index), label: `${props.roster[index].name} / ${props.roster[index].studentId || "学籍番号なし"}`, index }));
          return <TableRow {...getRowProps({ row })} key={row.id}><TableCell><Checkbox id={`select-${match.response.rowId}`} labelText="" checked={props.selectedIds.has(match.response.rowId)} onChange={(_, { checked }) => toggleSelection(match.response.rowId, checked)} /></TableCell><TableCell><div>{match.response.name || "氏名なし"}</div><div className="secondary-text">{match.response.studentId || `元データ ${match.response.sourceRow}行目`}</div></TableCell><TableCell>{rosterItem ? <><div>{rosterItem.name}</div><div className="secondary-text">{rosterItem.studentId} / {rosterItem.faculty || "学部未入力"}</div></> : "未確定"}</TableCell><TableCell><Tag type={status.type}>{status.label}</Tag><div className="status-reason">{match.reason}</div></TableCell><TableCell>{match.rosterIndex === null ? <ComboBox id={`candidate-${match.response.rowId}`} titleText="名簿の本人" items={candidateItems} itemToString={(item) => item?.label ?? ""} placeholder="候補を選択" size="sm" onChange={({ selectedItem }) => props.onManualMatch(match.response.rowId, selectedItem?.index ?? null)} /> : <Button kind="ghost" size="sm" renderIcon={UserMultiple} onClick={() => setEditTarget({ rosterIndex: match.rosterIndex })}>情報を確認</Button>}</TableCell></TableRow>;
        })}</TableBody></Table></TableContainer>}</DataTable>
    </div> : <div className="empty-state">2つのファイルを読み込むと、ここに応募者と照合結果が表示されます。</div>}
    <ParticipantEditorModal open={editTarget !== null} participant={editingParticipant} invalidField={props.focusTarget?.participant && props.focusTarget.participant.rosterIndex === editTarget?.rosterIndex && props.focusTarget.participant.addedParticipantId === editTarget?.addedParticipantId ? props.focusTarget.participant.field : null} onClose={() => { setEditTarget(null); props.onFocusHandled(); }} onSave={(participant) => { const target = editTarget; if (!target) return; if (target.rosterIndex === null && target.addedParticipantId) props.onAddedParticipantChange(target.addedParticipantId, participant); else if (target.rosterIndex !== null) props.onParticipantOverride(target.rosterIndex, participant); setEditTarget(null); props.onFocusHandled(); props.onParticipantSaved(); }} />
  </section>;
}
