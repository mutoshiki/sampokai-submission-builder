import { InlineNotification, Modal, Tag } from "@carbon/react";

interface UsageHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function UsageHelpModal({ open, onClose }: UsageHelpModalProps) {
  return <Modal
    open={open}
    passiveModal
    size="lg"
    modalLabel="使い方"
    modalHeading="企画者とサークル長の流れ"
    onRequestClose={onClose}
  >
    <div className="usage-help">
      <div className="usage-help__flows">
        <section className="usage-help__flow" aria-labelledby="usage-help-organizer">
          <Tag type="blue">企画者</Tag>
          <h2 id="usage-help-organizer">参加者を選び、必要な書類を作成</h2>
          <ol>
            <li>Googleフォーム回答を選ぶ</li>
            <li>今回の参加者を選ぶ</li>
            <li>サークル長への引継ぎデータを作成</li>
            <li>必要な場合のみ、登山計画書を入力・作成</li>
          </ol>
          <InlineNotification kind="info" title="引継ぎデータは参加者を選べば作成できます" subtitle="登山計画書の入力は不要です。" hideCloseButton lowContrast />
        </section>

        <section className="usage-help__flow" aria-labelledby="usage-help-leader">
          <Tag type="purple">サークル長</Tag>
          <h2 id="usage-help-leader">引継ぎデータを名簿と照合し、提出</h2>
          <ol>
            <li>引継ぎデータとサークル全体名簿を選ぶ</li>
            <li>参加者を照合し、必要な個人情報を補完</li>
            <li>提出情報を入力し、学務提出書類を作成</li>
          </ol>
        </section>
      </div>
    </div>
  </Modal>;
}
