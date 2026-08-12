import type { ReactNode } from "react";
import {
  Button,
  Content,
  ProgressIndicator,
  ProgressStep,
} from "@carbon/react";
import { ArrowLeft, ArrowRight } from "@carbon/icons-react";
import type { StepId } from "../types";
import { AppHeader } from "./AppHeader";
import { ScrollCue } from "./ScrollCue";

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
  saveStatus?: "saving" | "saved" | "error";
  updateEnabled?: boolean;
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
  saveStatus,
  updateEnabled = true,
}: AppShellProps) {
  return (
    <div className="app-root">
      <AppHeader
        saveStatus={saveStatus}
        updateEnabled={updateEnabled}
      />
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
        <ScrollCue />
        <div className="action-footer__steps">
          <Button kind="secondary" renderIcon={ArrowLeft} onClick={onBack} disabled={step === 0}>戻る</Button>
          <Button renderIcon={nextIcon} onClick={onNext} disabled={nextDisabled}>{nextLabel}</Button>
        </div>
      </footer>
    </div>
  );
}
