import { Add } from "@carbon/icons-react";
import { useMemo, useState } from "react";
import {
  Button,
  DataTable,
  InlineLoading,
  Modal,
  OverflowMenu,
  OverflowMenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TextInput,
  ToastNotification,
} from "@carbon/react";
import type { ProjectSummary } from "../types";
import { defaultProjectName } from "../lib/projects";

interface ProjectListProps {
  projects: ProjectSummary[];
  loading: boolean;
  error: string;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, projectName: string) => void;
  onDelete: (id: string) => void;
}

const headers = [
  { key: "mountainName", header: "企画名 / 山名" },
  { key: "date", header: "実施日" },
  { key: "organizerName", header: "企画者" },
  { key: "participantCount", header: "参加人数" },
  { key: "updatedAt", header: "最終更新" },
  { key: "actions", header: "操作" },
];

const formatDate = (value: string) => value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value)) : "—";
const formatUpdated = (value: string) => value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

export function ProjectList({ projects, loading, error, onCreate, onOpen, onDuplicate, onRename, onDelete }: ProjectListProps) {
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const rows = useMemo(() => projects.map((project) => ({ ...project, id: project.id })), [projects]);
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  return (
    <main className="project-list-page" aria-labelledby="project-list-heading">
      <div className="page-heading page-heading--projects">
        <h1 id="project-list-heading">企画一覧</h1>
        {projects.length === 0 && !loading ? <Button renderIcon={Add} onClick={onCreate}>新しい企画</Button> : null}
      </div>
      {error ? <ToastNotification kind="error" title="企画一覧を読み込めませんでした" subtitle={error} timeout={0} /> : null}
      {loading ? <InlineLoading description="企画を読み込み中" /> : projects.length === 0 ? (
        <section className="project-empty-state" aria-labelledby="project-empty-heading">
          <h2 id="project-empty-heading">まだ企画がありません</h2>
        </section>
      ) : (
        <DataTable rows={rows} headers={headers} isSortable>
          {({ rows: tableRows, headers: tableHeaders, getHeaderProps, getRowProps }) => (
            <TableContainer>
              <TableToolbar aria-label="企画一覧の操作">
                <TableToolbarContent>
                  <Button renderIcon={Add} onClick={onCreate}>新しい企画</Button>
                </TableToolbarContent>
              </TableToolbar>
              <Table className="project-table" size="lg" isSortable overflowMenuOnHover>
                <TableHead>
                  <TableRow>
                    {tableHeaders.map((header) => (
                      <TableHeader {...getHeaderProps({ header })} key={header.key}>{header.header}</TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map((row) => {
                    const project = projectsById.get(row.id)!;
                    const title = project.projectName || defaultProjectName(project.mountainName);
                    return (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        <TableCell>
                          <Button className="project-name-action" kind="ghost" size="sm" title={title} onClick={() => onOpen(row.id)}>{title}</Button>
                        </TableCell>
                        <TableCell>{formatDate(project.date)}</TableCell>
                        <TableCell>{project.organizerName || "—"}</TableCell>
                        <TableCell>{project.participantCount}人</TableCell>
                        <TableCell>{formatUpdated(project.updatedAt)}</TableCell>
                        <TableCell className="project-table__actions">
                          <OverflowMenu aria-label={`${title}の操作`} size="sm" flipped>
                            <OverflowMenuItem itemText="開く / 編集" onClick={() => onOpen(row.id)} />
                            <OverflowMenuItem itemText="名称を変更" onClick={() => { setRenameTarget(project); setRenameValue(title); }} />
                            <OverflowMenuItem itemText="複製" onClick={() => onDuplicate(row.id)} />
                            <OverflowMenuItem itemText="削除" isDelete onClick={() => setDeleteTarget(project)} />
                          </OverflowMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}
      <Modal
        open={Boolean(renameTarget)}
        modalHeading="企画名を変更"
        primaryButtonText="変更"
        secondaryButtonText="キャンセル"
        onRequestClose={() => setRenameTarget(null)}
        onRequestSubmit={() => {
          if (renameTarget) onRename(renameTarget.id, renameValue);
          setRenameTarget(null);
        }}
      >
        <TextInput
          id="project-name"
          labelText="企画名"
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          autoFocus
        />
      </Modal>
      <Modal
        open={Boolean(deleteTarget)}
        danger
        modalHeading="企画を削除しますか？"
        primaryButtonText="企画を削除"
        secondaryButtonText="キャンセル"
        onRequestClose={() => setDeleteTarget(null)}
        onRequestSubmit={() => { if (deleteTarget) onDelete(deleteTarget.id); setDeleteTarget(null); }}
      >
        <p>アプリ内に保存されたこの企画データを削除します。元のExcel、フォーム回答、ルート画像、生成済みWord/PDFは削除されません。</p>
      </Modal>
    </main>
  );
}
