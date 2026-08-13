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

const leaderSteps = ["引継ぎ・名簿照合", "提出情報", "提出書類"];
const organizerSteps = ["参加者選択", "登山計画書", "行程・連絡先", "登山計画書出力"];

interface AppShellProps {
  step: StepId;
  children: ReactNode;
  onBack: () => void;
  onNext: () => void;
  onStepChange: (step: StepId) => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextIcon?: typeof ArrowRight;
  hideNext?: boolean;
  projectTitle: string;
  dataEntryAvailable?: boolean;
  onEnterSampleData?: () => void;
  saveStatus?: "saving" | "saved" | "error";
  updateEnabled?: boolean;
  role?: "organizer" | "leader";
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
  hideNext = false,
  projectTitle,
  dataEntryAvailable = false,
  onEnterSampleData,
  saveStatus,
  updateEnabled = true,
  role = "leader",
}: AppShellProps) {
  const steps = role === "organizer" ? organizerSteps : leaderSteps;
  return (
    <div className="app-root">
      <AppHeader
        windowTitle={projectTitle}
        dataEntryAvailable={dataEntryAvailable}
        onEnterSampleData={onEnterSampleData}
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
        <Content className="main-content">
          <div className="step-content">{children}</div>
          <footer className="step-navigation">
            <div className="step-navigation__buttons">
              <Button kind="secondary" renderIcon={ArrowLeft} onClick={onBack} disabled={step === 0}>戻る</Button>
              {!hideNext ? <Button renderIcon={nextIcon} onClick={onNext} disabled={nextDisabled}>{nextLabel}</Button> : null}
            </div>
          </footer>
        </Content>
      </div>
      <ScrollCue key={step} />
    </div>
  );
}
