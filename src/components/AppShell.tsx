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

const leaderSteps: { step: StepId; label: string }[] = [
  { step: 0, label: "引継ぎ・名簿照合" }, { step: 1, label: "提出情報" }, { step: 2, label: "提出書類" },
];
const organizerParticipantSteps: { step: StepId; label: string }[] = [
  { step: 0, label: "参加者" },
];
const organizerPlanSteps: { step: StepId; label: string }[] = [
  { step: 2, label: "基本情報" }, { step: 3, label: "登山計画" },
];

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
  hideNavigation?: boolean;
  projectTitle: string;
  dataEntryAvailable?: boolean;
  onEnterSampleData?: () => void;
  saveStatus?: "saving" | "saved" | "error";
  updateEnabled?: boolean;
  role?: "organizer" | "leader";
  organizerEditing?: "participants" | "plan" | false;
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
  hideNavigation = false,
  projectTitle,
  dataEntryAvailable = false,
  onEnterSampleData,
  saveStatus,
  updateEnabled = true,
  role = "leader",
  organizerEditing = false,
}: AppShellProps) {
  const steps = role === "organizer" && organizerEditing
    ? organizerEditing === "participants" ? organizerParticipantSteps : organizerPlanSteps
    : leaderSteps;
  const showProgress = steps.length > 1;
  const currentIndex = Math.max(0, steps.findIndex((item) => item.step === step));
  return (
    <div className="app-root">
      <AppHeader
        windowTitle={projectTitle}
        dataEntryAvailable={dataEntryAvailable}
        onEnterSampleData={onEnterSampleData}
        saveStatus={saveStatus}
        updateEnabled={updateEnabled}
      />
      <div className={`workspace-shell${showProgress ? "" : " workspace-shell--no-rail"}`}>
        {showProgress ? <aside className="step-rail" aria-label="作成ステップ">
          <h2 className="step-rail__heading">作成ステップ</h2>
          <ProgressIndicator currentIndex={currentIndex} vertical>
            {steps.map((item, index) => (
              <ProgressStep
                key={item.step}
                label={item.label}
                complete={index < currentIndex}
                current={index === currentIndex}
                onClick={() => onStepChange(item.step)}
              />
            ))}
          </ProgressIndicator>
        </aside> : null}
        <Content className="main-content">
          <div className="step-content">{children}</div>
          {!hideNavigation ? <footer className="step-navigation">
            <div className="step-navigation__buttons">
              <Button kind="secondary" renderIcon={ArrowLeft} onClick={onBack} disabled={step === 0 && !organizerEditing}>戻る</Button>
              {!hideNext ? <Button renderIcon={nextIcon} onClick={onNext} disabled={nextDisabled}>{nextLabel}</Button> : null}
            </div>
          </footer> : null}
        </Content>
      </div>
      <ScrollCue key={step} />
    </div>
  );
}
