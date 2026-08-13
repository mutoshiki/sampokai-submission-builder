import { Button, Header, HeaderGlobalBar, HeaderName, InlineLoading } from "@carbon/react";
import type { ReactNode } from "react";
import { UpdateManager } from "./UpdateManager";

interface AppHeaderProps {
  windowTitle?: string;
  dataEntryAvailable?: boolean;
  onEnterSampleData?: () => void;
  onEnterPlanSampleData?: () => void;
  onEnterSubmissionSampleData?: () => void;
  saveStatus?: "saving" | "saved" | "error";
  updateEnabled?: boolean;
  children?: ReactNode;
}

export function AppHeader({
  windowTitle,
  dataEntryAvailable = false,
  onEnterSampleData,
  onEnterPlanSampleData,
  onEnterSubmissionSampleData,
  saveStatus,
  updateEnabled = true,
  children,
}: AppHeaderProps) {
  const saveIndicator = saveStatus === "saving"
    ? <InlineLoading status="active" description="保存中" />
    : saveStatus === "error"
      ? <InlineLoading status="error" description="保存に失敗しました" />
      : <InlineLoading status="finished" description="保存済み" />;

  return (
    <Header aria-label={windowTitle ?? "アプリケーション操作"}>
      {windowTitle ? <HeaderName prefix="">{windowTitle}</HeaderName> : null}
      {saveStatus ? <div className="app-header__save-status" aria-live="polite">{saveIndicator}</div> : null}
      {dataEntryAvailable ? (
        <div className="app-header__debug">
          {onEnterPlanSampleData && onEnterSubmissionSampleData ? (
            <>
              <Button kind="ghost" size="sm" onClick={onEnterPlanSampleData}>登山計画書を入力</Button>
              <Button kind="ghost" size="sm" onClick={onEnterSubmissionSampleData}>学務提出書類を入力</Button>
            </>
          ) : <Button kind="ghost" size="sm" onClick={onEnterSampleData}>データを入力</Button>}
        </div>
      ) : null}
      {children}
      {updateEnabled ? <HeaderGlobalBar><UpdateManager enabled /></HeaderGlobalBar> : null}
    </Header>
  );
}
