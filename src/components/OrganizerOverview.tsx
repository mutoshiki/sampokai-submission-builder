import { Button, ClickableTile, InlineLoading, InlineNotification, Tag, Tile } from "@carbon/react";
import { CheckmarkFilled, ChevronRight, Document, DocumentExport, FolderOpen } from "@carbon/icons-react";
import type { PlanInfo, ResponseRecord, ValidationIssue, ValidationTarget } from "../types";
import { validationTargets } from "../lib/validationTargets";

interface Props {
  plan: PlanInfo;
  participants: ResponseRecord[];
  handoffIssues: ValidationIssue[];
  handoffReady: boolean;
  handoffExporting: boolean;
  handoffError: string;
  exportedHandoffPath: string;
  planIssues: ValidationIssue[];
  planReady: boolean;
  planExporting: boolean;
  planExportError: string;
  exportedPlanPath: string;
  outputOpenError: string;
  onEdit: (target: ValidationTarget) => void;
  onExportHandoff: () => void;
  onExportPlan: () => void;
  onOpenHandoffOutput: () => void;
  onOpenPlanOutput: () => void;
}

interface InputStatusRowProps {
  title: string;
  missingCount: number;
  target: ValidationTarget;
  onEdit: (target: ValidationTarget) => void;
}

function InputStatusRow({ title, missingCount, target, onEdit }: InputStatusRowProps) {
  const complete = missingCount === 0;
  return <ClickableTile className="overview-input-row" onClick={() => onEdit(target)}>
    <div className="overview-input-row__content"><h3>{title}</h3><div className="overview-input-row__status"><Tag type={complete ? "green" : "gray"}>{complete ? "入力済み" : `要入力 ${missingCount}項目`}</Tag><ChevronRight size={20} /></div></div>
  </ClickableTile>;
}

function OutputResult({ path, onOpen }: { path: string; onOpen: () => void }) {
  const name = path.split(/[\\/]/).at(-1) || path;
  return <div className="output-result">
    <CheckmarkFilled size={20} aria-hidden="true" />
    <div className="output-result__detail"><span>作成済み</span><span className="output-result__path" title={path}>{name}</span></div>
    <Button kind="tertiary" size="sm" renderIcon={FolderOpen} onClick={onOpen}>フォルダを開く</Button>
  </div>;
}

export function OrganizerOverview(props: Props) {
  const planErrors = props.planIssues.filter((issue) => issue.severity === "error");
  const planWarnings = props.planIssues.filter((issue) => issue.severity === "warning");
  const firstPlanError = planErrors.find((issue) => issue.target?.step === 2)?.target
    ?? planErrors.find((issue) => issue.target?.step === 3)?.target
    ?? validationTargets.project.mountainName;

  return <section aria-labelledby="organizer-overview-heading">
    <div className="page-heading overview-heading"><h1 id="organizer-overview-heading">企画概要</h1></div>
    <div className="overview-layout">
      <section className="overview-layout__summary" aria-labelledby="input-status-heading">
        <div className="overview-column-heading"><h2 id="input-status-heading">入力状況</h2></div>
        <InputStatusRow title="参加者を選択" missingCount={props.handoffIssues.length} target={{ step: 0, fieldId: "participant-selection" }} onEdit={props.onEdit} />
        <InputStatusRow title="登山計画書の情報を入力" missingCount={planErrors.length} target={firstPlanError} onEdit={props.onEdit} />
      </section>
      <section className="overview-layout__outputs" aria-labelledby="outputs-heading">
        <div className="overview-column-heading"><h2 id="outputs-heading">成果物</h2></div>
        <Tile className="output-card">
          <div className="output-card__heading"><DocumentExport size={24} /><h2>サークル長への引継ぎデータ</h2></div>
          <div className="output-card__action"><Tag type={props.handoffReady ? "green" : "gray"}>{props.handoffReady ? "作成可能" : "参加者を選択してください"}</Tag><Button renderIcon={DocumentExport} onClick={props.onExportHandoff} disabled={!props.handoffReady || props.handoffExporting}>引継ぎデータを作成</Button></div>
          {props.handoffExporting ? <InlineLoading description="引継ぎデータを作成中" /> : null}
          {props.handoffError ? <InlineNotification kind="error" title="引継ぎデータを作成できませんでした" subtitle={props.handoffError} hideCloseButton lowContrast /> : null}
          {props.exportedHandoffPath ? <OutputResult path={props.exportedHandoffPath} onOpen={props.onOpenHandoffOutput} /> : null}
        </Tile>
        <Tile className="output-card">
          <div className="output-card__heading"><Document size={24} /><h2>登山計画書（Word）</h2></div>
          <div className="output-card__action"><Tag type={props.planReady ? "green" : "gray"}>{props.planReady ? "作成可能" : `${planErrors.length}項目未入力`}</Tag><Button renderIcon={Document} onClick={props.onExportPlan} disabled={!props.planReady || props.planExporting}>登山計画書を作成</Button></div>
          {planWarnings.length ? <InlineNotification kind="warning" title="作成前に確認が必要です" subtitle={planWarnings.map((issue) => issue.title).join("、")} hideCloseButton lowContrast /> : null}
          {props.planExporting ? <InlineLoading description="登山計画書を作成中" /> : null}
          {props.planExportError ? <InlineNotification kind="error" title="登山計画書を作成できませんでした" subtitle={props.planExportError} hideCloseButton lowContrast /> : null}
          {props.exportedPlanPath ? <OutputResult path={props.exportedPlanPath} onOpen={props.onOpenPlanOutput} /> : null}
        </Tile>
        {props.outputOpenError ? <InlineNotification kind="error" title="出力先フォルダを開けませんでした" subtitle={props.outputOpenError} hideCloseButton lowContrast /> : null}
      </section>
    </div>
  </section>;
}
