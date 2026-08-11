import {
  Button,
  InlineLoading,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@carbon/react";
import { Folder, FolderOpen, Renew } from "@carbon/icons-react";
import { useEffect } from "react";
import { focusValidationTarget } from "../lib/focus";
import type {
  GenerationResult,
  OfficeStatus,
  PrivacyMode,
  RosterRecord,
  ValidationIssue,
  ValidationTarget,
} from "../types";

const noticeFaculties = ["人文学部", "教育学部", "経法学部", "理学部", "医学部", "工学部", "農学部", "繊維学部"];

interface ReviewStepProps {
  participants: RosterRecord[];
  issues: ValidationIssue[];
  privacyMode: PrivacyMode;
  office: OfficeStatus | null;
  outputRoot: string;
  generating: boolean;
  result: GenerationResult | null;
  generationError: string;
  onPrivacyChange: (mode: PrivacyMode) => void;
  onChooseOutput: () => void;
  onCheckOffice: () => void;
  onOpenOutput: () => void;
  focusTarget: ValidationTarget | null;
  onGoToTarget: (target: ValidationTarget) => void;
  onFocusHandled: () => void;
}

export function ReviewStep({
  participants,
  issues,
  privacyMode,
  office,
  outputRoot,
  generating,
  result,
  generationError,
  onPrivacyChange,
  onChooseOutput,
  onCheckOffice,
  onOpenOutput,
  focusTarget,
  onGoToTarget,
  onFocusHandled,
}: ReviewStepProps) {
  const counts = noticeFaculties.map((faculty) => {
    const members = participants.filter((participant) => participant.faculty === faculty);
    return {
      faculty: faculty.replace("学部", ""),
      male: members.filter((participant) => participant.gender.startsWith("男")).length,
      female: members.filter((participant) => participant.gender.startsWith("女")).length,
      total: members.length,
    };
  });
  const totals = counts.reduce(
    (value, current) => ({ male: value.male + current.male, female: value.female + current.female, total: value.total + current.total }),
    { male: 0, female: 0, total: 0 },
  );
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  useEffect(() => {
    if (focusTarget && focusValidationTarget(focusTarget)) onFocusHandled();
  }, [focusTarget, onFocusHandled]);
  return (
    <section aria-labelledby="review-heading">
      <div className="page-heading">
        <div>
          <h1 id="review-heading">確認・出力</h1>
          <p>必須項目と書類間の整合性を確認してから、提出書類をまとめて作成します。</p>
        </div>
      </div>

      <div className="validation-summary">
        <div><strong>{participants.length}</strong><span>参加者</span></div>
        <div><strong>{errorCount}</strong><span>修正が必要</span></div>
        <div><strong>{warningCount}</strong><span>警告</span></div>
      </div>

      <div className="issue-list">
        {issues.map((issue) => (
          <div className="issue-item" key={issue.id}>
            <InlineNotification
              kind={issue.severity}
              title={issue.title}
              subtitle={issue.detail}
              hideCloseButton
              lowContrast
            />
            {issue.severity !== "info" && issue.target ? (
              <Button
                kind="ghost"
                size="sm"
                onClick={() => {
                  if (issue.target) onGoToTarget(issue.target);
                }}
              >
                修正する
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      <TableContainer title="登山等届の学部別参加者集計" description="確定した参加者の身体の性別を男子・女子欄へ集計します。">
        <Table size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>区分</TableHeader>
              {counts.map((count) => <TableHeader key={count.faculty}>{count.faculty}</TableHeader>)}
              <TableHeader>計</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow><TableCell>男子</TableCell>{counts.map((count) => <TableCell key={`m-${count.faculty}`}>{count.male}</TableCell>)}<TableCell>{totals.male}</TableCell></TableRow>
            <TableRow><TableCell>女子</TableCell>{counts.map((count) => <TableCell key={`f-${count.faculty}`}>{count.female}</TableCell>)}<TableCell>{totals.female}</TableCell></TableRow>
            <TableRow><TableCell>計</TableCell>{counts.map((count) => <TableCell key={`t-${count.faculty}`}>{count.total}</TableCell>)}<TableCell>{totals.total}</TableCell></TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <div className="review-settings">
        <div>
          <h2>参加者名簿の個人情報欄</h2>
          <RadioButtonGroup
            name="privacy-mode"
            orientation="vertical"
            valueSelected={privacyMode}
            onChange={(value) => onPrivacyChange(value as PrivacyMode)}
          >
            <RadioButton value="full" id="privacy-full" labelText="現行運用：現住所・本人連絡先・緊急連絡先をすべて記載" />
            <RadioButton value="blank-address-emergency" id="privacy-template" labelText="テンプレート記載どおり：現住所・緊急連絡先を空欄、本人連絡先を記載" />
            <RadioButton value="minimal" id="privacy-minimal" labelText="最小限：現住所・本人連絡先・緊急連絡先をすべて空欄" />
          </RadioButtonGroup>
        </div>
        <div>
          <h2>出力環境</h2>
          <div className="setting-row">
            <div>
              <span className="setting-label">Word互換ソフト</span>
              <span>{office?.message ?? "確認中"}</span>
            </div>
            <Button kind="ghost" size="sm" renderIcon={Renew} onClick={onCheckOffice}>再確認</Button>
          </div>
          <div className="setting-row">
            <div>
              <span className="setting-label">出力先</span>
              <span className="path-text">{outputRoot || "未選択"}</span>
            </div>
            <Button id="output-root" kind="secondary" size="sm" renderIcon={Folder} onClick={onChooseOutput}>フォルダを選択</Button>
          </div>
        </div>
      </div>

      {generating ? <InlineLoading description="WordとPDFを生成しています。Officeを閉じずにお待ちください。" /> : null}
      {generationError ? <InlineNotification kind="error" title="書類を生成できませんでした" subtitle={generationError} hideCloseButton lowContrast /> : null}
      {result ? (
        <div className="success-result">
          <InlineNotification
            kind="success"
            title="提出書類を作成しました"
            subtitle={`${result.files.length}ファイルを新しい企画フォルダへ保存しました。`}
            hideCloseButton
            lowContrast
          />
          <Button kind="tertiary" size="sm" renderIcon={FolderOpen} onClick={onOpenOutput}>完成フォルダを開く</Button>
        </div>
      ) : null}
    </section>
  );
}
