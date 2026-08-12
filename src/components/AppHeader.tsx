import { Header, HeaderGlobalBar, HeaderName, Tag, Button } from "@carbon/react";
import type { ReactNode } from "react";
import { UpdateManager } from "./UpdateManager";

interface AppHeaderProps {
  debugAvailable?: boolean;
  debugMode?: boolean;
  onFillDebug?: () => void;
  onClearDebug?: () => void;
  updateEnabled?: boolean;
  children?: ReactNode;
}

export function AppHeader({
  debugAvailable = false,
  debugMode = false,
  onFillDebug,
  onClearDebug,
  updateEnabled = true,
  children,
}: AppHeaderProps) {
  return (
    <Header aria-label="山歩会 提出書類作成ツール">
      <HeaderName prefix="山歩会">提出書類作成ツール</HeaderName>
      {debugAvailable ? (
        <div className="app-header__debug">
          {debugMode ? <Tag type="purple">デバッグ中</Tag> : null}
          <Button kind="ghost" size="sm" onClick={onFillDebug}>架空データを入力</Button>
          {debugMode ? <Button kind="ghost" size="sm" onClick={onClearDebug}>デバッグを終了</Button> : null}
        </div>
      ) : null}
      {children}
      {updateEnabled ? <HeaderGlobalBar><UpdateManager enabled /></HeaderGlobalBar> : null}
    </Header>
  );
}
