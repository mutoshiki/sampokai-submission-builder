/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantEditorModal } from "./ParticipantEditorModal";
import type { RosterRecord } from "../types";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

afterEach(cleanup);

const participant: RosterRecord = {
  rowId: "roster-0",
  sourceRow: 2,
  studentId: "26T0001A",
  name: "山田 太郎",
  nameKana: "ヤマダ タロウ",
  faculty: "",
  department: "工学科",
  gender: "男性",
  address: "長野県",
  phone: "090-0000-0001",
  emergencyPhone: "090-0000-0002",
};

describe("ParticipantEditorModal", () => {
  it("closes completely after saving a missing faculty", () => {
    const onSave = vi.fn();
    const Harness = () => {
      const [open, setOpen] = useState(true);
      return (
        <ParticipantEditorModal
          open={open}
          participant={participant}
          invalidField="faculty"
          onClose={() => setOpen(false)}
          onSave={(updated) => {
            onSave(updated);
            setOpen(false);
          }}
        />
      );
    };

    render(<Harness />);
    fireEvent.change(screen.getByLabelText("学部"), { target: { value: "工学部" } });
    fireEvent.click(screen.getByRole("button", { name: "この企画で使用" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ faculty: "工学部" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes completely from close button", () => {
    const Harness = () => {
      const [open, setOpen] = useState(true);
      return <ParticipantEditorModal open={open} participant={participant} invalidField="faculty" onClose={() => setOpen(false)} onSave={vi.fn()} />;
    };

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
