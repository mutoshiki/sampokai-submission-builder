import { Add, Upload } from "@carbon/icons-react";
import { useMemo, useState } from "react";
import { Button, DataTable, InlineLoading, Modal, OverflowMenu, OverflowMenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, TableToolbar, TableToolbarContent, TextInput, ToastNotification } from "@carbon/react";
import type { ProjectRole, ProjectSummary } from "../types";
import { defaultProjectName } from "../lib/projects";
import { projectEntryRoles } from "../lib/projectEntry";

interface ProjectListProps {
  projects: ProjectSummary[]; loading: boolean; error: string; onCreate: (role: ProjectRole) => void; onImport: () => void;
  onOpen: (id: string) => void; onDuplicate: (id: string) => void; onRename: (id: string, projectName: string) => void; onDelete: (id: string) => void;
}

const headers = [
  { key: "document", header: "作成する書類" }, { key: "mountainName", header: "企画名 / 山名" }, { key: "date", header: "実施日" }, { key: "participantCount", header: "参加者" }, { key: "updatedAt", header: "更新" }, { key: "actions", header: "操作" },
];
const formatDate = (value: string) => value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value)) : "—";
const formatUpdated = (value: string) => value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const documentLabel = (role?: ProjectRole) => role === "leader" ? "学務提出書類" : "登山計画書";

export function ProjectList({ projects, loading, error, onCreate, onImport, onOpen, onDuplicate, onRename, onDelete }: ProjectListProps) {
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const rows = useMemo(() => projects.map((project) => ({ ...project, id: project.id, document: documentLabel(project.role) })), [projects]);
  const byId = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const createActions = <div className="project-actions"><Button renderIcon={Add} onClick={() => onCreate(projectEntryRoles.organizer)}>登山計画書・引継ぎデータを作る</Button><Button kind="secondary" renderIcon={Upload} onClick={onImport}>学務への提出書類を作る</Button></div>;

  return <main className="project-list-page" aria-labelledby="project-list-heading">
    <div className="page-heading page-heading--projects"><h1 id="project-list-heading">企画一覧</h1>{projects.length === 0 && !loading ? createActions : null}</div>
    {error ? <ToastNotification kind="error" title="企画一覧を読み込めませんでした" subtitle={error} timeout={0} /> : null}
    {loading ? <InlineLoading description="企画を読み込み中" /> : projects.length === 0 ? <section className="project-empty-state"><h2>企画がありません</h2></section> : <DataTable rows={rows} headers={headers} isSortable>
      {({ rows: tableRows, headers: tableHeaders, getHeaderProps, getRowProps }) => <TableContainer><TableToolbar><TableToolbarContent>{createActions}</TableToolbarContent></TableToolbar>
        <Table className="project-table" size="lg" isSortable overflowMenuOnHover><TableHead><TableRow>{tableHeaders.map((header) => <TableHeader {...getHeaderProps({ header })} key={header.key}>{header.header}</TableHeader>)}</TableRow></TableHead>
          <TableBody>{tableRows.map((row) => {
            const project = byId.get(row.id)!; const title = project.projectName || defaultProjectName(project.mountainName);
            return <TableRow {...getRowProps({ row })} key={row.id}><TableCell>{documentLabel(project.role)}</TableCell><TableCell><Button className="project-name-action" kind="ghost" size="sm" title={title} onClick={() => onOpen(row.id)}>{title}</Button></TableCell><TableCell>{formatDate(project.date)}</TableCell><TableCell>{project.participantCount}人</TableCell><TableCell>{formatUpdated(project.updatedAt)}</TableCell><TableCell className="project-table__actions"><OverflowMenu aria-label={`${title}の操作`} size="sm" flipped><OverflowMenuItem itemText="開く" onClick={() => onOpen(row.id)} /><OverflowMenuItem itemText="名前を変更" onClick={() => { setRenameTarget(project); setRenameValue(title); }} /><OverflowMenuItem itemText="複製" onClick={() => onDuplicate(row.id)} /><OverflowMenuItem itemText="削除" isDelete onClick={() => setDeleteTarget(project)} /></OverflowMenu></TableCell></TableRow>;
          })}</TableBody>
        </Table></TableContainer>}
    </DataTable>}
    <Modal open={Boolean(renameTarget)} modalHeading="企画名を変更" primaryButtonText="変更" secondaryButtonText="キャンセル" onRequestClose={() => setRenameTarget(null)} onRequestSubmit={() => { if (renameTarget) onRename(renameTarget.id, renameValue); setRenameTarget(null); }}><TextInput id="project-name" labelText="企画名" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus /></Modal>
    <Modal open={Boolean(deleteTarget)} danger modalHeading="企画を削除しますか" primaryButtonText="削除" secondaryButtonText="キャンセル" onRequestClose={() => setDeleteTarget(null)} onRequestSubmit={() => { if (deleteTarget) onDelete(deleteTarget.id); setDeleteTarget(null); }}><p>保存済みの企画データを削除します。元のExcel・CSV・Wordファイルは削除されません。</p></Modal>
  </main>;
}
