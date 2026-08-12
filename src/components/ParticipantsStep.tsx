import {
  Button,
  Checkbox,
  ComboBox,
  DataTable,
  InlineNotification,
  Search,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  Tag,
} from "@carbon/react";
import { Checkmark, Renew, UserMultiple } from "@carbon/icons-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ColumnMapping,
  ImportedTable,
  MatchResult,
  RosterRecord,
  ValidationTarget,
} from "../types";
import { focusValidationTarget } from "../lib/focus";
import { ColumnMappingPanel } from "./ColumnMappingPanel";
import { FileSourcePicker } from "./FileSourcePicker";
import { ParticipantEditorModal } from "./ParticipantEditorModal";

const headers = [
  { key: "selected", header: "参加" },
  { key: "response", header: "フォーム回答" },
  { key: "matched", header: "全体名簿" },
  { key: "status", header: "照合結果" },
  { key: "confirmation", header: "確認・補正" },
];

const statusPresentation: Record<MatchResult["status"], { label: string; type: "green" | "blue" | "red" | "magenta" }> = {
  exact_id: { label: "学籍番号一致", type: "green" },
  exact_name: { label: "氏名の一意一致", type: "blue" },
  manual: { label: "確認済み", type: "green" },
  ambiguous: { label: "複数候補", type: "magenta" },
  not_found: { label: "名簿になし", type: "red" },
  conflict: { label: "情報が矛盾", type: "red" },
};

interface ParticipantsStepProps {
  rosterPath: string;
  responsePath: string;
  rosterTable: ImportedTable | null;
  responseTable: ImportedTable | null;
  rosterMapping: ColumnMapping;
  responseMapping: ColumnMapping;
  roster: RosterRecord[];
  matches: MatchResult[];
  selectedIds: Set<string>;
  duplicateResponseIds: Set<string>;
  loadingRoster: boolean;
  loadingResponses: boolean;
  error: string;
  onPickRoster: () => void;
  onPickResponses: () => void;
  onClearRoster: () => void;
  onClearResponses: () => void;
  onRosterMappingChange: (mapping: ColumnMapping) => void;
  onResponseMappingChange: (mapping: ColumnMapping) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onManualMatch: (responseId: string, rosterIndex: number | null) => void;
  onParticipantOverride: (rosterIndex: number, participant: RosterRecord) => void;
  focusTarget: ValidationTarget | null;
  onFocusHandled: () => void;
}

export function ParticipantsStep(props: ParticipantsStepProps) {
  const [query, setQuery] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const filteredMatches = useMemo(() => {
    const normalized = query.normalize("NFKC").toLowerCase().trim();
    if (!normalized) return props.matches;
    return props.matches.filter((match) => {
      const rosterName = match.rosterIndex === null ? "" : props.roster[match.rosterIndex]?.name ?? "";
      return `${match.response.name} ${match.response.studentId} ${rosterName}`.normalize("NFKC").toLowerCase().includes(normalized);
    });
  }, [props.matches, props.roster, query]);

  const dataRows = filteredMatches.map((match) => ({
    id: match.response.rowId,
    selected: props.selectedIds.has(match.response.rowId) ? "選択" : "",
    response: `${match.response.name || "氏名なし"}${match.response.studentId ? ` / ${match.response.studentId}` : ""}`,
    matched: match.rosterIndex === null ? "未確定" : `${props.roster[match.rosterIndex]?.name} / ${props.roster[match.rosterIndex]?.studentId}`,
    status: statusPresentation[match.status].label,
    confirmation: "",
  }));

  const selectedMatches = props.matches.filter((match) => props.selectedIds.has(match.response.rowId));
  const unresolvedSelected = selectedMatches.filter((match) => match.rosterIndex === null).length;
  const toggleSelection = (id: string, checked: boolean) => {
    const next = new Set(props.selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    props.onSelectionChange(next);
  };
  useEffect(() => {
    const target = props.focusTarget;
    if (!target) return;
    if (target.participant && editIndex !== target.participant.rosterIndex) {
      setEditIndex(target.participant.rosterIndex);
      return;
    }
    if (focusValidationTarget(target)) props.onFocusHandled();
  }, [editIndex, props.focusTarget, props.onFocusHandled]);

  return (
    <section aria-labelledby="participants-heading">
      <div className="page-heading">
        <h1 id="participants-heading">参加者</h1>
      </div>

      {props.error ? <InlineNotification kind="error" title="ファイルを読み込めませんでした" subtitle={props.error} hideCloseButton lowContrast /> : null}

      <div className="source-grid">
        <FileSourcePicker
          id="roster-file"
          label="1. サークル全体名簿"
          path={props.rosterPath}
          loading={props.loadingRoster}
          onPick={props.onPickRoster}
          onClear={props.onClearRoster}
        />
        <FileSourcePicker
          id="response-file"
          label="2. Googleフォーム回答の書き出し"
          path={props.responsePath}
          loading={props.loadingResponses}
          onPick={props.onPickResponses}
          onClear={props.onClearResponses}
        />
      </div>

      {props.rosterTable ? (
        <ColumnMappingPanel title="全体名簿" kind="roster" table={props.rosterTable} mapping={props.rosterMapping} onChange={props.onRosterMappingChange} />
      ) : null}
      {props.responseTable ? (
        <ColumnMappingPanel title="フォーム回答" kind="response" table={props.responseTable} mapping={props.responseMapping} onChange={props.onResponseMappingChange} />
      ) : null}

      {props.matches.length ? (
        <div className="participant-table-section" id="participant-matches" tabIndex={-1}>
          <div className="summary-line" aria-label="照合サマリー">
            <span>回答 {props.matches.length}件</span>
            <span>参加者 {props.selectedIds.size}人</span>
            <span>選択中の未照合 {unresolvedSelected}人</span>
            <span>重複回答 {props.duplicateResponseIds.size}件</span>
          </div>
          {props.duplicateResponseIds.size ? (
            <InlineNotification
              kind="warning"
              title="重複回答があります"
              subtitle="同じ学籍番号または氏名の回答が複数あります。参加する回答だけを選択してください。"
              hideCloseButton
              lowContrast
            />
          ) : null}
          <DataTable rows={dataRows} headers={headers} isSortable>
            {({ rows, headers: renderedHeaders, getHeaderProps, getRowProps }) => (
              <TableContainer title="応募者と名簿の照合">
                <TableToolbar>
                  <Search size="lg" labelText="応募者を検索" placeholder="氏名または学籍番号" value={query} onChange={(event) => setQuery(event.target.value)} />
                  <TableToolbarContent>
                    <Button kind="ghost" renderIcon={Checkmark} onClick={() => props.onSelectionChange(new Set(props.matches.map((match) => match.response.rowId)))}>
                      すべて選択
                    </Button>
                    <Button kind="ghost" renderIcon={Renew} onClick={() => props.onSelectionChange(new Set())}>
                      選択解除
                    </Button>
                  </TableToolbarContent>
                </TableToolbar>
                <Table size="lg" useZebraStyles>
                  <TableHead>
                    <TableRow>
                      {renderedHeaders.map((header) => (
                        <TableHeader {...getHeaderProps({ header })} key={header.key}>{header.header}</TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const match = props.matches.find((item) => item.response.rowId === row.id)!;
                      const status = statusPresentation[match.status];
                      const rosterItem = match.rosterIndex === null ? null : props.roster[match.rosterIndex];
                      const candidateItems = (match.candidateIndices.length ? match.candidateIndices : props.roster.map((_, index) => index)).map((index) => ({
                        id: String(index),
                        label: `${props.roster[index].name} / ${props.roster[index].studentId || "学籍番号なし"}`,
                        index,
                      }));
                      return (
                        <TableRow {...getRowProps({ row })} key={row.id}>
                          <TableCell>
                            <Checkbox
                              id={`select-${row.id}`}
                              labelText=""
                              checked={props.selectedIds.has(row.id)}
                              onChange={(_, { checked }) => toggleSelection(row.id, checked)}
                            />
                          </TableCell>
                          <TableCell>
                            <div>{match.response.name || "氏名なし"}</div>
                            <div className="secondary-text">{match.response.studentId || `元データ ${match.response.sourceRow}行目`}</div>
                          </TableCell>
                          <TableCell>
                            {rosterItem ? (
                              <>
                                <div>{rosterItem.name}</div>
                                <div className="secondary-text">{rosterItem.studentId} / {rosterItem.faculty || "学部未入力"}</div>
                              </>
                            ) : "未確定"}
                          </TableCell>
                          <TableCell>
                            <Tag type={status.type}>{status.label}</Tag>
                            <div className="status-reason">{match.reason}</div>
                          </TableCell>
                          <TableCell>
                            {match.rosterIndex === null ? (
                              <ComboBox
                                id={`candidate-${row.id}`}
                                titleText="名簿の本人"
                                items={candidateItems}
                                itemToString={(item) => item?.label ?? ""}
                                placeholder="候補を選択"
                                size="sm"
                                onChange={({ selectedItem }) => props.onManualMatch(row.id, selectedItem?.index ?? null)}
                              />
                            ) : (
                              <Button kind="ghost" size="sm" renderIcon={UserMultiple} onClick={() => setEditIndex(match.rosterIndex)}>
                                情報を確認
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
        </div>
      ) : (
        <div className="empty-state">2つのファイルを読み込むと、ここに応募者と照合結果が表示されます。</div>
      )}

      <ParticipantEditorModal
        open={editIndex !== null}
        participant={editIndex === null ? null : props.roster[editIndex]}
        invalidField={
          props.focusTarget?.participant?.rosterIndex === editIndex
            ? props.focusTarget.participant.field
            : null
        }
        onClose={() => {
          setEditIndex(null);
          props.onFocusHandled();
        }}
        onSave={(participant) => {
          if (editIndex !== null) props.onParticipantOverride(editIndex, participant);
          setEditIndex(null);
          props.onFocusHandled();
        }}
      />
    </section>
  );
}
