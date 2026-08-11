import { useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Renew } from "@carbon/icons-react";
import { Button, InlineLoading, Modal, ProgressBar, ToastNotification } from "@carbon/react";

type CheckMode = "automatic" | "manual";
type UpdatePhase = "idle" | "downloading" | "installing";

interface Notification {
  kind: "success" | "error" | "info";
  title: string;
  subtitle: string;
}

interface UpdateManagerProps {
  enabled: boolean;
}

export function UpdateManager({ enabled }: UpdateManagerProps) {
  const automaticCheckStarted = useRef(false);
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const [installError, setInstallError] = useState("");
  const [notification, setNotification] = useState<Notification | null>(null);

  const checkForUpdates = async (mode: CheckMode) => {
    if (!enabled || checking || phase !== "idle") return;

    setChecking(true);
    if (mode === "manual") setNotification(null);

    try {
      const availableUpdate = await check({ timeout: 10_000 });
      if (availableUpdate) {
        setInstallError("");
        setUpdate(availableUpdate);
      } else if (mode === "manual") {
        setNotification({
          kind: "success",
          title: "最新版です",
          subtitle: "このアプリは最新バージョンです。",
        });
      }
    } catch {
      if (mode === "manual") {
        const offline = typeof navigator !== "undefined" && navigator.onLine === false;
        setNotification({
          kind: "error",
          title: offline ? "オフラインです" : "更新を確認できませんでした",
          subtitle: offline
            ? "インターネット接続を確認してから、もう一度お試しください。"
            : "ネットワーク接続または更新設定を確認して、もう一度お試しください。",
        });
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!enabled || automaticCheckStarted.current) return;
    automaticCheckStarted.current = true;
    void checkForUpdates("automatic");
  }, [enabled]);

  const installUpdate = async () => {
    if (!update || phase !== "idle") return;

    setInstallError("");
    setDownloadedBytes(0);
    setTotalBytes(null);
    setPhase("downloading");

    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            setTotalBytes(event.data.contentLength ?? null);
            break;
          case "Progress":
            setDownloadedBytes((current) => current + event.data.chunkLength);
            break;
          case "Finished":
            setPhase("installing");
            break;
        }
      });

      await relaunch();
    } catch {
      setPhase("idle");
      setInstallError("更新を完了できませんでした。アプリはそのまま利用できます。時間をおいて再試行してください。");
    }
  };

  const busy = phase !== "idle";
  const progress = totalBytes && totalBytes > 0 ? Math.min((downloadedBytes / totalBytes) * 100, 100) : null;

  return (
    <>
      <Button
        kind="ghost"
        size="sm"
        renderIcon={Renew}
        disabled={!enabled || checking || busy}
        onClick={() => void checkForUpdates("manual")}
      >
        {checking ? "更新を確認中" : "更新を確認"}
      </Button>

      {notification ? (
        <ToastNotification
          kind={notification.kind}
          title={notification.title}
          subtitle={notification.subtitle}
          timeout={7000}
          onCloseButtonClick={() => setNotification(null)}
        />
      ) : null}

      <Modal
        open={Boolean(update)}
        modalLabel="アプリの更新"
        modalHeading="新しいバージョンがあります"
        primaryButtonText={busy ? "更新中" : "更新して再起動"}
        secondaryButtonText="あとで"
        primaryButtonDisabled={busy}
        preventCloseOnClickOutside={busy}
        onRequestClose={() => {
          if (!busy) setUpdate(null);
        }}
        onRequestSubmit={() => void installUpdate()}
      >
        {update ? (
          <div className="update-manager__content">
            <p>現在: {update.currentVersion}</p>
            <p>新しいバージョン: {update.version}</p>
            <h3>更新内容</h3>
            <p className="update-manager__notes">{update.body?.trim() || "更新内容はありません。"}</p>
            {phase === "downloading" ? (
              progress === null ? (
                <InlineLoading description="更新をダウンロード中…" />
              ) : (
                <ProgressBar label="更新をダウンロード中" helperText={`${Math.round(progress)}%`} value={progress} max={100} />
              )
            ) : null}
            {phase === "installing" ? <InlineLoading description="署名を検証し、更新をインストール中…" /> : null}
            {installError ? <p className="update-manager__error">{installError}</p> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
