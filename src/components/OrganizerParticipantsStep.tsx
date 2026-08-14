import { Button, Checkbox, DataTable, InlineNotification, Search, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, TableToolbar, TableToolbarContent } from "@carbon/react";
import { Checkmark, Renew } from "@carbon/icons-react";
import { useEffect, useMemo, useState } from "react";
import { focusValidationTarget } from "../lib/focus";
import type { ColumnMapping, ImportedTable, ResponseRecord, ValidationTarget } from "../types";
import { ColumnMappingPanel } from "./ColumnMappingPanel";
import { FileSourcePicker } from "./FileSourcePicker";

const headers = [
  { key: "selected", header: "選択" }, { key: "name", header: "氏名" }, { key: "studentId", header: "学籍番号" }, { key: "source", header: "回答行" },
];

interface Props {
  responsePath: string; responseTable: ImportedTable | null; responseMapping: ColumnMapping; responses: ResponseRecord[]; selectedIds: Set<string>;
  loading: boolean; error: string; onPick: () => void; onClear: () => void; onMappingChange: (mapping: ColumnMapping) => void; onSelectionChange: (ids: Set<string>) => void;
  focusTarget: ValidationTarget | null; onGoToTarget: (target: ValidationTarget) => void; onFocusHandled: () => void;
}

export function OrganizerParticipantsStep(props: Props) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.normalize("NFKC").toLocaleLowerCase("ja").trim();
    return normalized ? props.responses.filter((response) => `${response.name} ${response.studentId}`.normalize("NFKC").toLocaleLowerCase("ja").includes(normalized)) : props.responses;
  }, [props.responses, query]);
  const rows = filtered.map((response) => ({ id: response.rowId, selected: "", name: response.name, studentId: response.studentId, source: String(response.sourceRow) }));
  const toggle = (id: string, checked: boolean) => {
    const next = new Set(props.selectedIds);
    if (checked) next.add(id); else next.delete(id);
    props.onSelectionChange(next);
  };
  useEffect(() => {
    if (props.focusTarget && focusValidationTarget(props.focusTarget)) props.onFocusHandled();
  }, [props.focusTarget, props.onFocusHandled]);
  return <section aria-labelledby="organizer-participants-heading">
    <div className="page-heading"><h1 id="organizer-participants-heading">参加者選択</h1></div>
    {props.error ? <InlineNotification kind="error" title="回答ファイルを読み込めませんでした" subtitle={props.error} hideCloseButton lowContrast /> : null}
    <div className="source-grid source-grid--single"><FileSourcePicker id="response-file" label="Googleフォーム回答" path={props.responsePath} loading={props.loading} onPick={props.onPick} onClear={props.onClear} /></div>
    {props.responseTable ? <ColumnMappingPanel title="回答の列" kind="response" table={props.responseTable} mapping={props.responseMapping} onChange={props.onMappingChange} /> : null}
    {props.responses.length ? <div className="participant-table-section" id="participant-selection" tabIndex={-1}>
      <div className="summary-line"><span>回答 {props.responses.length}件</span><span>選択 {props.selectedIds.size}人</span></div>
      <DataTable rows={rows} headers={headers} isSortable>
        {({ rows: tableRows, headers: tableHeaders, getHeaderProps, getRowProps }) => <TableContainer title="参加者">
          <TableToolbar><Search size="lg" labelText="参加者を検索" placeholder="氏名または学籍番号" value={query} onChange={(event) => setQuery(event.target.value)} /><TableToolbarContent>
            <Button kind="ghost" renderIcon={Checkmark} onClick={() => props.onSelectionChange(new Set(props.responses.map((response) => response.rowId)))}>すべて選択</Button>
            <Button kind="ghost" renderIcon={Renew} onClick={() => props.onSelectionChange(new Set())}>選択解除</Button>
          </TableToolbarContent></TableToolbar>
          <Table size="lg" useZebraStyles><TableHead><TableRow>{tableHeaders.map((header) => <TableHeader {...getHeaderProps({ header })} key={header.key}>{header.header}</TableHeader>)}</TableRow></TableHead>
            <TableBody>{tableRows.map((row) => <TableRow {...getRowProps({ row })} id={`handoff-participant-${row.id}`} tabIndex={-1} key={row.id}>
              <TableCell><Checkbox id={`select-${row.id}`} labelText="" checked={props.selectedIds.has(row.id)} onChange={(_, { checked }) => toggle(row.id, checked)} /></TableCell>
              <TableCell>{row.cells.find((cell) => cell.info.header === "name")?.value || "未入力"}</TableCell>
              <TableCell>{row.cells.find((cell) => cell.info.header === "studentId")?.value || "未入力"}</TableCell>
              <TableCell>{row.cells.find((cell) => cell.info.header === "source")?.value}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>}
      </DataTable>
    </div> : <div className="empty-state">Googleフォーム回答を選択してください。</div>}
  </section>;
}
