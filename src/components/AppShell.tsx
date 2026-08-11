import type { ReactNode } from "react";
import {
  Button,
  Content,
  Header,
  HeaderName,
  ProgressIndicator,
  ProgressStep,
  Tag,
} from "@carbon/react";
import { ArrowLeft, ArrowRight } from "@carbon/icons-react";
import type { StepId } from "../types";

const steps = ["参加者", "企画情報", "登山計画", "確認・出力"];

interface AppShellProps {
  step: StepId;
  children: ReactNode;
  onBack: () => void;
  onNext: () => void;
  onStepChange: (step: StepId) => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextIcon?: typeof ArrowRight;
  debugAvailable?: boolean;
  debugMode?: boolean;
  onFillDebug?: () => void;
  onClearDebug?: () => void;
  headerActions?: ReactNode;
}

export function AppShell({
  step,
  children,
  onBack,
  onNext,
  onStepChange,
  nextLabel = "次へ",
  nextDisabled = false,
  nextIcon = ArrowRight,
  debugAvailable = false,
  debugMode = false,
  onFillDebug,
  onClearDebug,
  headerActions,
}: AppShellProps) {
  return (
    <div className="app-root">
      <Header aria-label="山歩会 提出書類作成">
        <HeaderName prefix="山歩会">提出書類作成</HeaderName>
        {debugAvailable ? (
          <div className="debug-controls">
            {debugMode ? <Tag type="purple">開発用デバッグ中</Tag> : null}
            <Button kind="ghost" size="sm" onClick={onFillDebug}>架空データを入力</Button>
            {debugMode ? <Button kind="ghost" size="sm" onClick={onClearDebug}>デバッグデータをクリア</Button> : null}
          </div>
        ) : null}
        <div className="local-only-label">完全ローカル</div>
        {headerActions ? <div className="update-controls">{headerActions}</div> : null}
      </Header>
      <div className="workspace-shell">
        <aside className="step-rail" aria-label="作成ステップ">
          <h2 className="step-rail__heading">作成ステップ</h2>
          <ProgressIndicator currentIndex={step} vertical>
            {steps.map((label, index) => (
              <ProgressStep
                key={label}
                label={label}
                complete={index < step}
                current={index === step}
                onClick={() => onStepChange(index as StepId)}
              />
            ))}
          </ProgressIndicator>
        </aside>
        <Content className="main-content">{children}</Content>
      </div>
      <footer className="action-footer">
        <Button kind="secondary" renderIcon={ArrowLeft} onClick={onBack} disabled={step === 0}>
          戻る
        </Button>
        <Button renderIcon={nextIcon} onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </Button>
      </footer>
    </div>
  );
}
