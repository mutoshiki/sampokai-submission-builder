import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { DocumentExport } from "@carbon/icons-react";
import { AppShell } from "./components/AppShell";
import { UpdateManager } from "./components/UpdateManager";
import { ParticipantsStep } from "./components/ParticipantsStep";
import { ProjectStep } from "./components/ProjectStep";
import { PlanStep, standardEquipment } from "./components/PlanStep";
import { ReviewStep } from "./components/ReviewStep";
import { allowRouteImagePreview, checkOffice, generateDocuments, getDebugDefaults, loadTabularFile } from "./lib/api";
import { buildItineraryText, durationBetween } from "./lib/itinerary";
import { buildResponseRecords, buildRosterRecords, detectMapping, emptyMapping } from "./lib/mapping";
import { findDuplicateResponseIds, matchResponses } from "./lib/matching";
import { validateProject } from "./lib/validation";
import type {
  ColumnMapping,
  GenerationResult,
  ImportedTable,
  OfficeStatus,
  PlanInfo,
  PrivacyMode,
  ProjectInfo,
  RosterRecord,
  StepId,
  ValidationTarget,
} from "./types";

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const initialProject: ProjectInfo = {
  mountainName: "",
  date: "",
  reserveDate: "",
  submissionDate: localDate(),
  area: "",
  noticePlace: "",
  meetingPlace: "信州大学 松本キャンパス サークルボックス前",
  meetingTime: "",
  weatherPolicy: "雨天中止",
  organizer: {
    rosterIndex: null,
    studentId: "",
    name: "",
    faculty: "",
    department: "",
    phone: "",
  },
};

const initialPlan: PlanInfo = {
  entryTime: "",
  exitTime: "",
  ascent: "",
  descent: "",
  distance: "",
  itinerary: [
    { id: "start", kind: "Start", name: "", arrivalTime: "", restMinutes: "0", travelMinutesToNext: "" },
    { id: "peak", kind: "Peak", name: "", arrivalTime: "", restMinutes: "0", travelMinutesToNext: "" },
    { id: "goal", kind: "Goal", name: "", arrivalTime: "", restMinutes: "0", travelMinutesToNext: "" },
  ],
  routeImagePath: "",
  escapePlan: "天候の急変、登山道の崩壊、熊の出没等の要因により企画続行不可能と判断した場合は、計画書のルートを使用し直ちに下山する。",
  equipment: standardEquipment,
  drinkQuantity: "2L程度",
  policeContacts: [{ id: "police-1", label: "", phone: "" }],
  lodgeContacts: [{ id: "lodge-1", label: "", phone: "" }],
  homeBaseRosterIndex: null,
  homeBaseName: "",
  homeBasePhone: "",
};

const isTauriRuntime = () => Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

const debugRosterTable: ImportedTable = {
  sheetName: "開発用架空名簿",
  columns: ["学籍番号", "氏名", "氏名（カナ）", "学部", "学科", "身体の性別", "現住所", "本人連絡先", "緊急連絡先"],
  rows: [
    ["DEBUG-001", "架空 岳人", "カクウ ガクト", "工学部", "架空工学科", "男性", "架空県架空市1-1", "000-0000-0001", "000-0000-1001"],
    ["DEBUG-002", "架空 花子", "カクウ ハナコ", "人文学部", "架空人文学科", "女性", "架空県架空市2-2", "000-0000-0002", "000-0000-1002"],
  ],
  headerRowIndex: 0,
  totalRows: 2,
};

const debugResponseTable: ImportedTable = {
  sheetName: "開発用架空フォーム回答",
  columns: ["学籍番号", "氏名", "住所"],
  rows: [["DEBUG-001", "架空 岳人", "架空県架空市1-1"], ["DEBUG-002", "架空 花子", "架空県架空市2-2"]],
  headerRowIndex: 0,
  totalRows: 2,
};

const debugRosterMapping: ColumnMapping = {
  studentId: 0, name: 1, nameKana: 2, faculty: 3, department: 4, gender: 5, address: 6, phone: 7, emergencyPhone: 8,
};

const debugResponseMapping: ColumnMapping = {
  studentId: 0, name: 1, nameKana: null, faculty: null, department: null, gender: null, address: 2, phone: null, emergencyPhone: null,
};

export default function App() {
  const [step, setStep] = useState<StepId>(0);
  const [rosterPath, setRosterPath] = useState("");
  const [responsePath, setResponsePath] = useState("");
  const [rosterTable, setRosterTable] = useState<ImportedTable | null>(null);
  const [responseTable, setResponseTable] = useState<ImportedTable | null>(null);
  const [rosterMapping, setRosterMapping] = useState<ColumnMapping>(emptyMapping);
  const [responseMapping, setResponseMapping] = useState<ColumnMapping>(emptyMapping);
  const [manualMatches, setManualMatches] = useState<Record<string, number | null>>({});
  const [participantOverrides, setParticipantOverrides] = useState<Record<number, RosterRecord>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [project, setProject] = useState<ProjectInfo>(initialProject);
  const [plan, setPlan] = useState<PlanInfo>(initialPlan);
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("full");
  const [outputRoot, setOutputRoot] = useState("");
  const [office, setOffice] = useState<OfficeStatus | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [importError, setImportError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [validationTarget, setValidationTarget] = useState<ValidationTarget | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [debugControlsVisible, setDebugControlsVisible] = useState(false);

  const baseRoster = useMemo(() => buildRosterRecords(rosterTable, rosterMapping), [rosterTable, rosterMapping]);
  const roster = useMemo(
    () => baseRoster.map((record, index) => participantOverrides[index] ?? record),
    [baseRoster, participantOverrides],
  );
  const responses = useMemo(
    () => buildResponseRecords(responseTable, responseMapping),
    [responseTable, responseMapping],
  );
  const matches = useMemo(
    () => matchResponses(responses, roster, manualMatches),
    [responses, roster, manualMatches],
  );
  const duplicateResponseIds = useMemo(() => findDuplicateResponseIds(responses), [responses]);
  const selectedMatches = useMemo(
    () => matches.filter((match) => selectedIds.has(match.response.rowId)),
    [matches, selectedIds],
  );
  const participants = useMemo(
    () => selectedMatches.flatMap((match) => (match.rosterIndex === null ? [] : [roster[match.rosterIndex]])),
    [selectedMatches, roster],
  );
  const issues = useMemo(
    () => validateProject({ selectedMatches, participants, project, plan, outputRoot, office, privacyMode }),
    [selectedMatches, participants, project, plan, outputRoot, office, privacyMode],
  );

  const refreshOffice = async () => {
    if (!isTauriRuntime()) {
      setOffice({ available: false, applicationName: null, message: "デスクトップアプリで確認します。" });
      return;
    }
    try {
      setOffice(await checkOffice());
    } catch (error) {
      setOffice({ available: false, applicationName: null, message: String(error) });
    }
  };

  useEffect(() => {
    void refreshOffice();
  }, []);

  useEffect(() => {
    const toggleDebugControls = (event: KeyboardEvent) => {
      if (!isTauriRuntime() || event.repeat || !event.ctrlKey || !event.shiftKey || event.code !== "KeyD") return;
      event.preventDefault();
      setDebugControlsVisible((visible) => !visible);
    };
    window.addEventListener("keydown", toggleDebugControls);
    return () => window.removeEventListener("keydown", toggleDebugControls);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    void getCurrentWebviewWindow().onDragDropEvent((event) => {
      if (step !== 2 || event.payload.type !== "drop") return;
      const image = event.payload.paths.find((path) => /\.(png|jpe?g|bmp)$/i.test(path));
      if (image) {
        void allowRouteImagePreview(image).then(() => {
          setPlan((current) => ({ ...current, routeImagePath: image }));
        });
      }
    }).then((callback) => { unlisten = callback; });
    return () => unlisten?.();
  }, [step]);

  const chooseFile = async (kind: "roster" | "response") => {
    if (!isTauriRuntime()) return;
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "表データ", extensions: ["xlsx", "xls", "csv", "tsv"] }],
    });
    if (typeof selected !== "string") return;
    setImportError("");
    const setLoading = kind === "roster" ? setLoadingRoster : setLoadingResponses;
    setLoading(true);
    try {
      const table = await loadTabularFile(selected);
      const mapping = detectMapping(table, kind);
      if (kind === "roster") {
        setRosterPath(selected);
        setRosterTable(table);
        setRosterMapping(mapping);
        setParticipantOverrides({});
      } else {
        setResponsePath(selected);
        setResponseTable(table);
        setResponseMapping(mapping);
        setSelectedIds(new Set());
        setManualMatches({});
      }
    } catch (error) {
      setImportError(String(error));
    } finally {
      setLoading(false);
    }
  };

  const chooseRoute = async () => {
    if (!isTauriRuntime()) return;
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "ルート画像", extensions: ["png", "jpg", "jpeg", "bmp"] }],
    });
    if (typeof selected !== "string") return;
    await allowRouteImagePreview(selected);
    setPlan((current) => ({ ...current, routeImagePath: selected }));
  };

  const fillDebugData = async () => {
    if (!isTauriRuntime()) return;
    const defaults = await getDebugDefaults();
    setRosterPath("開発用架空名簿（メモリ）");
    setResponsePath("開発用架空フォーム回答（メモリ）");
    setRosterTable(debugRosterTable);
    setResponseTable(debugResponseTable);
    setRosterMapping(debugRosterMapping);
    setResponseMapping(debugResponseMapping);
    setManualMatches({});
    setParticipantOverrides({});
    setSelectedIds(new Set(["response-0", "response-1"]));
    setProject({
      mountainName: "架空岳",
      date: "2026-10-18",
      reserveDate: "2026-10-25",
      submissionDate: "2026-09-20",
      area: "架空岳（架空県架空市）",
      noticePlace: "架空県架空市 架空岳",
      meetingPlace: "架空駅 東口",
      meetingTime: "06:30",
      weatherPolicy: "雨天中止",
      organizer: { rosterIndex: 0, studentId: "DEBUG-001", name: "架空 岳人", faculty: "工学部", department: "架空工学科", phone: "000-0000-0001" },
    });
    setPlan({
      entryTime: "07:00",
      exitTime: "10:15",
      ascent: "650",
      descent: "650",
      distance: "8.4",
      itinerary: [
        { id: "debug-start", kind: "Start", name: "架空登山口", arrivalTime: "07:00", restMinutes: "0", travelMinutesToNext: "90" },
        { id: "debug-peak", kind: "Peak", name: "架空岳山頂", arrivalTime: "08:30", restMinutes: "30", travelMinutesToNext: "75" },
        { id: "debug-goal", kind: "Goal", name: "架空登山口", arrivalTime: "10:15", restMinutes: "0", travelMinutesToNext: "" },
      ],
      routeImagePath: defaults.routeImagePath,
      escapePlan: "天候悪化または体調不良時は直ちに引き返し、架空登山口から下山します。",
      equipment: [...standardEquipment],
      drinkQuantity: "2L程度",
      policeContacts: [{ id: "debug-police", label: "架空県山岳警察署", phone: "000-0000-1100" }],
      lodgeContacts: [{ id: "debug-lodge", label: "架空山荘", phone: "000-0000-2200" }],
      homeBaseRosterIndex: 1,
      homeBaseName: "架空 花子",
      homeBasePhone: "000-0000-0002",
    });
    setPrivacyMode("full");
    setOutputRoot(defaults.outputRoot);
    setImportError("");
    setGenerationError("");
    setResult(null);
    setDebugMode(true);
    setValidationTarget(null);
    setStep(3);
  };

  const clearDebugData = () => {
    setStep(0);
    setRosterPath("");
    setResponsePath("");
    setRosterTable(null);
    setResponseTable(null);
    setRosterMapping(emptyMapping());
    setResponseMapping(emptyMapping());
    setManualMatches({});
    setParticipantOverrides({});
    setSelectedIds(new Set());
    setProject(initialProject);
    setPlan(initialPlan);
    setPrivacyMode("full");
    setOutputRoot("");
    setImportError("");
    setGenerationError("");
    setResult(null);
    setValidationTarget(null);
    setDebugMode(false);
  };

  const goToValidationTarget = (target: ValidationTarget) => {
    setValidationTarget(target);
    setStep(target.step);
  };

  const clearValidationTarget = () => setValidationTarget(null);

  const chooseOutput = async () => {
    if (!isTauriRuntime()) return;
    const selected = await open({ multiple: false, directory: true });
    if (typeof selected === "string") setOutputRoot(selected);
  };

  const buildPayload = () => ({
    privacyMode,
    participants,
    project,
    plan: {
      ...plan,
      totalDurationText: durationBetween(plan.entryTime, plan.exitTime),
      itineraryText: buildItineraryText(plan.itinerary),
      equipmentText: `□${[...plan.equipment, `飲料（${plan.drinkQuantity}）`].join("　□")}\n（※印の物は、ある人は持参する）`,
    },
  });

  const generate = async () => {
    if (issues.some((issue) => issue.severity === "error") || generating) return;
    setGenerationError("");
    setResult(null);
    setGenerating(true);
    try {
      setResult(await generateDocuments(buildPayload(), outputRoot));
    } catch (error) {
      setGenerationError(String(error));
    } finally {
      setGenerating(false);
    }
  };

  const handleNext = () => {
    if (step < 3) setStep((step + 1) as StepId);
    else void generate();
  };

  const nextDisabled = step === 3 && (generating || issues.some((issue) => issue.severity === "error"));
  return (
    <AppShell
      step={step}
      onBack={() => setStep((Math.max(0, step - 1) as StepId))}
      onNext={handleNext}
      onStepChange={setStep}
      nextLabel={step === 3 ? "提出書類を作成" : "次へ"}
      nextDisabled={nextDisabled}
      nextIcon={step === 3 ? DocumentExport : undefined}
      debugAvailable={debugControlsVisible}
      debugMode={debugMode}
      onFillDebug={() => void fillDebugData()}
      onClearDebug={clearDebugData}
      headerActions={isTauriRuntime() ? <UpdateManager enabled /> : undefined}
    >
      {step === 0 ? (
        <ParticipantsStep
          rosterPath={rosterPath}
          responsePath={responsePath}
          rosterTable={rosterTable}
          responseTable={responseTable}
          rosterMapping={rosterMapping}
          responseMapping={responseMapping}
          roster={roster}
          matches={matches}
          selectedIds={selectedIds}
          duplicateResponseIds={duplicateResponseIds}
          loadingRoster={loadingRoster}
          loadingResponses={loadingResponses}
          error={importError}
          onPickRoster={() => void chooseFile("roster")}
          onPickResponses={() => void chooseFile("response")}
          onClearRoster={() => { setRosterPath(""); setRosterTable(null); setRosterMapping(emptyMapping()); setParticipantOverrides({}); }}
          onClearResponses={() => { setResponsePath(""); setResponseTable(null); setResponseMapping(emptyMapping()); setSelectedIds(new Set()); }}
          onRosterMappingChange={setRosterMapping}
          onResponseMappingChange={setResponseMapping}
          onSelectionChange={setSelectedIds}
          onManualMatch={(responseId, rosterIndex) => setManualMatches((current) => ({ ...current, [responseId]: rosterIndex }))}
          onParticipantOverride={(rosterIndex, participant) => {
            setParticipantOverrides((current) => ({ ...current, [rosterIndex]: participant }));
            if (project.organizer.rosterIndex === rosterIndex) {
              setProject((current) => ({ ...current, organizer: { rosterIndex, studentId: participant.studentId, name: participant.name, faculty: participant.faculty, department: participant.department, phone: participant.phone } }));
            }
          }}
          focusTarget={validationTarget}
          onFocusHandled={clearValidationTarget}
        />
      ) : null}
      {step === 1 ? <ProjectStep project={project} roster={roster} onChange={setProject} focusTarget={validationTarget} onFocusHandled={clearValidationTarget} /> : null}
      {step === 2 ? <PlanStep plan={plan} roster={roster} onChange={setPlan} onPickRoute={() => void chooseRoute()} focusTarget={validationTarget} onFocusHandled={clearValidationTarget} /> : null}
      {step === 3 ? (
        <ReviewStep
          participants={participants}
          issues={issues}
          privacyMode={privacyMode}
          office={office}
          outputRoot={outputRoot}
          generating={generating}
          result={result}
          generationError={generationError}
          onPrivacyChange={setPrivacyMode}
          onChooseOutput={() => void chooseOutput()}
          onCheckOffice={() => void refreshOffice()}
          onOpenOutput={() => { if (result) void openPath(result.outputDir); }}
          focusTarget={validationTarget}
          onGoToTarget={goToValidationTarget}
          onFocusHandled={clearValidationTarget}
        />
      ) : null}
    </AppShell>
  );
}
