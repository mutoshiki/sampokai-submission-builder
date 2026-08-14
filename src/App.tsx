import { useEffect, useMemo, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo, listen } from "@tauri-apps/api/event";
import { DocumentExport } from "@carbon/icons-react";
import { AppHeader } from "./components/AppHeader";
import { AppShell } from "./components/AppShell";
import { ProjectList } from "./components/ProjectList";
import { ParticipantsStep } from "./components/ParticipantsStep";
import { OrganizerParticipantsStep } from "./components/OrganizerParticipantsStep";
import { OrganizerOverview } from "./components/OrganizerOverview";
import { ProjectStep } from "./components/ProjectStep";
import { PlanStep } from "./components/PlanStep";
import { ReviewStep } from "./components/ReviewStep";
import { allowRouteImagePreview, deleteProject, generateDocuments, getSampleDataDefaults, listProjects, loadProject, loadTabularFile, openOutputFolder, saveProject, writeParticipantCsv } from "./lib/api";
import { createProjectId, defaultProjectName, duplicateProjectSnapshot, projectRole, PROJECT_SCHEMA_VERSION } from "./lib/projects";
import { participantCsvExtension, toHandoffParticipants } from "./lib/handoff";
import { useDebugShortcut } from "./lib/debugShortcut";
import { buildItineraryText, durationBetween } from "./lib/itinerary";
import {
  applyRosterOverrides,
  buildResponseRecords,
  buildRosterRecords,
  changedRosterFields,
  detectMapping,
  emptyMapping,
} from "./lib/mapping";
import { findDuplicateResponseIds, matchResponses } from "./lib/matching";
import { resolveSelectedParticipants } from "./lib/participants";
import { validateLeaderSubmission } from "./lib/leaderValidation";
import { validateHikingPlan } from "./lib/hikingPlanValidation";
import { validateHandoff } from "./lib/handoffValidation";
import type {
  ColumnMapping,
  GenerationResult,
  ImportedTable,
  PlanInfo,
  PrivacyMode,
  ProjectInfo,
  ProjectSnapshot,
  ProjectRole,
  ProjectSummary,
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
  equipment: [],
  drinkQuantity: "2L程度",
  policeContacts: [{ id: "police-1", label: "", phone: "" }],
  lodgeContacts: [{ id: "lodge-1", label: "", phone: "" }],
  homeBaseRosterIndex: null,
  homeBaseName: "",
  homeBasePhone: "",
};

const emptyProjectSnapshot = (now = new Date().toISOString(), id: string = createProjectId()): ProjectSnapshot => ({
  schemaVersion: PROJECT_SCHEMA_VERSION, id, createdAt: now, updatedAt: now, step: 0, role: "organizer", handoffPath: "",
  rosterPath: "", responsePath: "", rosterMapping: emptyMapping(), responseMapping: emptyMapping(),
  manualMatches: {}, participantOverrides: {}, selectedIds: [], project: structuredClone(initialProject),
  plan: structuredClone(initialPlan), privacyMode: "full", outputRoot: "",
});

const isTauriRuntime = () => Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
type OrganizerEditorScope = "participants" | "plan";
type EditorNavigationRequest = { target: ValidationTarget; scope: OrganizerEditorScope };
const organizerEditorSteps = (scope: OrganizerEditorScope): StepId[] => scope === "participants" ? [0] : [2, 3];

export default function App() {
  const projectWindowId = useMemo(() => new URLSearchParams(window.location.search).get("project"), []);
  const windowMode = useMemo(() => new URLSearchParams(window.location.search).get("mode"), []);
  const isEditorWindow = windowMode === "editor";
  const requestedEditorScope = useMemo<OrganizerEditorScope>(() => new URLSearchParams(window.location.search).get("scope") === "participants" ? "participants" : "plan", []);
  const requestedEditorTarget = useMemo<ValidationTarget | null>(() => {
    if (!isEditorWindow) return null;
    const search = new URLSearchParams(window.location.search);
    const step = Number(search.get("step"));
    const fieldId = search.get("field");
    if (!Number.isInteger(step) || step < 0 || step > 3 || !fieldId) return null;
    const tab = search.get("tab");
    return { step: step as StepId, fieldId, ...(tab === null ? {} : { tabIndex: Number(tab) }) };
  }, [isEditorWindow]);
  const isProjectWindow = Boolean(projectWindowId);
  const [screen, setScreen] = useState<"list" | "editor">(isProjectWindow ? "editor" : "list");
  const [editorScope, setEditorScope] = useState<OrganizerEditorScope>(requestedEditorScope);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [activeProject, setActiveProject] = useState<{ id: string; createdAt: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">("saved");
  const [step, setStep] = useState<StepId>(0);
  const [role, setRole] = useState<ProjectRole>("organizer");
  const [handoffPath, setHandoffPath] = useState("");
  const [rosterPath, setRosterPath] = useState("");
  const [responsePath, setResponsePath] = useState("");
  const [rosterTable, setRosterTable] = useState<ImportedTable | null>(null);
  const [responseTable, setResponseTable] = useState<ImportedTable | null>(null);
  const [rosterMapping, setRosterMapping] = useState<ColumnMapping>(emptyMapping);
  const [responseMapping, setResponseMapping] = useState<ColumnMapping>(emptyMapping);
  const [manualMatches, setManualMatches] = useState<Record<string, number | null>>({});
  const [participantOverrides, setParticipantOverrides] = useState<Record<number, Partial<RosterRecord>>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [project, setProject] = useState<ProjectInfo>(initialProject);
  const [plan, setPlan] = useState<PlanInfo>(initialPlan);
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("full");
  const [outputRoot, setOutputRoot] = useState("");
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [importError, setImportError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [outputOpenError, setOutputOpenError] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [handoffExporting, setHandoffExporting] = useState(false);
  const [handoffError, setHandoffError] = useState("");
  const [exportedHandoffPath, setExportedHandoffPath] = useState("");
  const [planExporting, setPlanExporting] = useState(false);
  const [planExportError, setPlanExportError] = useState("");
  const [exportedPlanPath, setExportedPlanPath] = useState("");
  const [validationTarget, setValidationTarget] = useState<ValidationTarget | null>(null);
  const [validationReturnStep, setValidationReturnStep] = useState<StepId | null>(null);
  const [sampleDataControlVisible, setSampleDataControlVisible] = useState(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const autosaveTimer = useRef<number | null>(null);

  const refreshProjects = async () => {
    if (!isTauriRuntime()) return;
    setProjectsLoading(true); setProjectsError("");
    try { setProjects(await listProjects()); } catch (error) { setProjectsError(String(error)); }
    finally { setProjectsLoading(false); }
  };

  const baseRoster = useMemo(() => buildRosterRecords(rosterTable, rosterMapping), [rosterTable, rosterMapping]);
  const roster = useMemo(() => applyRosterOverrides(baseRoster, participantOverrides), [baseRoster, participantOverrides]);
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
  const resolvedParticipants = useMemo(
    () => resolveSelectedParticipants(selectedMatches, roster),
    [selectedMatches, roster],
  );
  const participants = useMemo(
    () => resolvedParticipants.map(({ participant }) => participant),
    [resolvedParticipants],
  );
  const currentProject = useMemo(() => {
    const rosterIndex = project.organizer.rosterIndex;
    const inferred = rosterIndex === null && role === "leader"
      ? matchResponses([{ rowId: "organizer", sourceRow: 0, studentId: project.organizer.studentId, name: project.organizer.name, address: "" }], roster, {})[0]?.rosterIndex
      : null;
    const organizer = rosterIndex === null ? (inferred === null ? null : roster[inferred]) : roster[rosterIndex];
    if (!organizer) return project;
    return {
      ...project,
      organizer: {
        rosterIndex: rosterIndex ?? inferred,
        studentId: organizer.studentId,
        name: organizer.name,
        faculty: organizer.faculty,
        department: organizer.department,
        phone: organizer.phone,
      },
    };
  }, [project, roster, role]);
  const issues = useMemo(() => role === "leader"
    ? validateLeaderSubmission(selectedMatches, resolvedParticipants, currentProject, outputRoot)
    : [],
  [role, selectedMatches, resolvedParticipants, currentProject, outputRoot]);
  const isOrganizerOverview = !isEditorWindow && role === "organizer" && step === 1;

  useEffect(() => {
    if (!isTauriRuntime() || isProjectWindow) return;
    void refreshProjects();
  }, [isProjectWindow]);

  const snapshot = (): ProjectSnapshot | null => activeProject ? {
    schemaVersion: PROJECT_SCHEMA_VERSION, id: activeProject.id, createdAt: activeProject.createdAt,
    updatedAt: new Date().toISOString(), step, role, handoffPath, rosterPath, responsePath, rosterMapping, responseMapping,
    manualMatches, participantOverrides, selectedIds: [...selectedIds], project: currentProject, plan, privacyMode, outputRoot,
  } : null;

  const queueSave = async (current: ProjectSnapshot) => {
    const task = saveQueue.current.catch(() => undefined).then(async () => {
      await saveProject(current);
      if (isEditorWindow) void emitTo(`project-${current.id}`, "project-updated", { id: current.id }).catch(() => undefined);
    });
    saveQueue.current = task;
    await task;
  };

  const saveCurrentProject = async () => {
    const current = snapshot();
    if (!current || !isTauriRuntime()) return true;
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    setSaveStatus("saving");
    try { await queueSave(current); setSaveStatus("saved"); return true; }
    catch { setSaveStatus("error"); return false; }
  };

  useEffect(() => {
    const current = snapshot();
    if (!current || screen !== "editor" || !isTauriRuntime() || isOrganizerOverview) return;
    setSaveStatus("saving");
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null;
      void queueSave(current).then(() => setSaveStatus("saved")).catch(() => setSaveStatus("error"));
    }, 700);
    return () => {
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    };
  }, [screen, activeProject, step, role, handoffPath, rosterPath, responsePath, rosterMapping, responseMapping, manualMatches, participantOverrides, selectedIds, currentProject, plan, privacyMode, outputRoot, isOrganizerOverview]);

  const toggleDebugControls = () => setSampleDataControlVisible((visible) => !visible);
  useDebugShortcut(toggleDebugControls, isTauriRuntime());

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    void getCurrentWebviewWindow().onDragDropEvent((event) => {
      if (role !== "organizer" || step !== 3 || event.payload.type !== "drop") return;
      const image = event.payload.paths.find((path) => /\.(png|jpe?g|bmp)$/i.test(path));
      if (image) {
        void allowRouteImagePreview(image).then(() => {
          setPlan((current) => ({ ...current, routeImagePath: image }));
        });
      }
    }).then((callback) => { unlisten = callback; });
    return () => unlisten?.();
  }, [role, step]);

  const applySnapshot = async (saved: ProjectSnapshot, editorTarget: ValidationTarget | null = null) => {
    setActiveProject({ id: saved.id, createdAt: saved.createdAt });
    const savedRole = projectRole(saved);
    setRole(savedRole); setHandoffPath(saved.handoffPath ?? "");
    const organizerStep: StepId = 1;
    const editorStep: StepId = editorTarget?.step ?? (saved.step === 2 || saved.step === 3 ? saved.step : 0);
    setStep((savedRole === "leader" ? Math.min(saved.step, 2) : isEditorWindow ? editorStep : organizerStep) as StepId); setRosterPath(saved.rosterPath); setResponsePath(saved.responsePath);
    setRosterMapping(saved.rosterMapping); setResponseMapping(saved.responseMapping);
    setManualMatches(saved.manualMatches); setParticipantOverrides(saved.participantOverrides);
    setSelectedIds(new Set(saved.selectedIds)); setProject(saved.project); setPlan(saved.plan);
    setPrivacyMode(savedRole === "leader" ? "full" : saved.privacyMode); setOutputRoot(saved.outputRoot); setResult(null); setGenerationError("");
    setImportError(""); setValidationTarget(editorTarget);
    const missing: string[] = [];
    if (saved.rosterPath) {
      try { setRosterTable(await loadTabularFile(saved.rosterPath)); } catch { setRosterTable(null); missing.push("元名簿"); }
    } else setRosterTable(null);
    if (saved.responsePath) {
      try { setResponseTable(await loadTabularFile(saved.responsePath)); } catch { setResponseTable(null); missing.push(savedRole === "leader" ? "引継ぎデータ" : "Googleフォーム回答"); }
    } else setResponseTable(null);
    if (saved.plan.routeImagePath) {
      try { await allowRouteImagePreview(saved.plan.routeImagePath); } catch { missing.push("ルート画像"); }
    }
    if (missing.length) setImportError(`${missing.join("、")}が見つかりません。該当する入力欄から元ファイルを再選択してください。`);
  };

  const openProjectInWindow = async (id: string) => {
    const label = `project-${id}`;
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      if (await existing.isMinimized()) await existing.unminimize();
      await existing.setFocus();
      return;
    }
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("project", id);
    new WebviewWindow(label, {
      title: "山歩会 提出書類作成ツール",
      url: url.href,
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 680,
      resizable: true,
      center: true,
    });
  };

  const openOrganizerEditor = async (target: ValidationTarget) => {
    if (!activeProject || !isTauriRuntime()) return;
    const scope: OrganizerEditorScope = target.step === 0 ? "participants" : "plan";
    const label = `project-editor-${activeProject.id}`;
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await emitTo(label, "project-edit-target", { target, scope } satisfies EditorNavigationRequest);
      if (await existing.isMinimized()) await existing.unminimize();
      await existing.setFocus();
      return;
    }
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("project", activeProject.id);
    url.searchParams.set("mode", "editor");
    url.searchParams.set("scope", scope);
    url.searchParams.set("step", String(target.step));
    url.searchParams.set("field", target.fieldId);
    if (target.tabIndex !== undefined) url.searchParams.set("tab", String(target.tabIndex));
    new WebviewWindow(label, {
      title: `${currentProject.projectName?.trim() || defaultProjectName(currentProject.mountainName)} - 編集`,
      url: url.href,
      width: 1180,
      height: 800,
      minWidth: 1024,
      minHeight: 680,
      resizable: true,
      center: true,
    });
  };

  const createProject = async (role: ProjectRole) => {
    const saved = { ...emptyProjectSnapshot(), role };
    setSaveStatus("saving");
    try { await saveProject(saved); await refreshProjects(); await openProjectInWindow(saved.id); setSaveStatus("saved"); }
    catch (error) { setProjectsError(String(error)); }
  };

  const importHandoff = async () => {
    if (!isTauriRuntime()) return;
    const selected = await open({ multiple: false, directory: false, filters: [{ name: "サークル長に渡すデータ", extensions: ["csv"] }] });
    if (typeof selected !== "string") return;
    try {
      const table = await loadTabularFile(selected);
      const saved = {
        ...emptyProjectSnapshot(), role: "leader" as const, handoffPath: "", responsePath: selected,
        responseMapping: detectMapping(table, "response"), selectedIds: table.rows.map((_, index) => `response-${index}`),
        project: structuredClone(initialProject),
        plan: structuredClone(initialPlan), privacyMode: "full" as const,
      };
      await saveProject(saved); await refreshProjects(); await openProjectInWindow(saved.id);
    } catch (error) { setProjectsError(String(error)); }
  };

  const openProject = async (id: string) => {
    try { await openProjectInWindow(id); }
    catch (error) { setProjectsError(String(error)); }
  };

  const duplicateProject = async (id: string) => {
    try { const copy = duplicateProjectSnapshot(await loadProject(id), new Date().toISOString()); await saveProject(copy); await refreshProjects(); }
    catch (error) { setProjectsError(String(error)); }
  };

  const renameProject = async (id: string, projectName: string) => {
    try {
      const saved = await loadProject(id);
      await saveProject({
        ...saved,
        updatedAt: new Date().toISOString(),
        project: { ...saved.project, projectName: projectName.trim() },
      });
      await refreshProjects();
    } catch (error) { setProjectsError(String(error)); }
  };

  const removeProject = async (id: string) => {
    try { await deleteProject(id); await refreshProjects(); } catch (error) { setProjectsError(String(error)); }
  };

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

  const chooseHandoff = async () => {
    if (!isTauriRuntime()) return;
    const selected = await open({ multiple: false, directory: false, filters: [{ name: "サークル長に渡すデータ", extensions: ["csv"] }] });
    if (typeof selected !== "string") return;
    setLoadingResponses(true); setImportError("");
    try {
      const table = await loadTabularFile(selected);
      setHandoffPath(""); setResponsePath(selected); setResponseTable(table); setResponseMapping(detectMapping(table, "response"));
      setSelectedIds(new Set(table.rows.map((_, index) => `response-${index}`))); setManualMatches({});
      setPrivacyMode("full");
    } catch (error) { setImportError(String(error)); } finally { setLoadingResponses(false); }
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

  const buildSampleSnapshot = (
    base: ProjectSnapshot,
    defaults: Awaited<ReturnType<typeof getSampleDataDefaults>>,
    sampleRosterTable: ImportedTable,
    sampleResponseTable: ImportedTable,
  ): ProjectSnapshot => {
    const sampleRosterMapping = detectMapping(sampleRosterTable, "roster");
    const sampleResponseMapping = detectMapping(sampleResponseTable, "response");
    const sampleRoster = buildRosterRecords(sampleRosterTable, sampleRosterMapping);
    const sampleResponses = buildResponseRecords(sampleResponseTable, sampleResponseMapping);
    const organizer = sampleRoster[0];
    const homeBase = sampleRoster[1] ?? organizer;

    return {
      ...base,
      updatedAt: new Date().toISOString(),
      step: 3,
      rosterPath: defaults.rosterPath,
      responsePath: defaults.responsePath,
      rosterMapping: sampleRosterMapping,
      responseMapping: sampleResponseMapping,
      manualMatches: {},
      participantOverrides: {},
      selectedIds: sampleResponses.map(({ rowId }) => rowId),
      project: {
        ...structuredClone(initialProject),
        projectName: "燕岳夏山企画",
        mountainName: "燕岳",
        date: "2026-10-18",
        reserveDate: "2026-10-25",
        submissionDate: "2026-09-20",
        area: "燕岳（長野県安曇野市）",
        noticePlace: "長野県安曇野市 燕岳",
        meetingPlace: "松本駅 東口",
        meetingTime: "06:30",
        weatherPolicy: "雨天中止",
        organizer: organizer ? {
          rosterIndex: 0,
          studentId: organizer.studentId,
          name: organizer.name,
          faculty: organizer.faculty,
          department: organizer.department,
          phone: organizer.phone,
        } : structuredClone(initialProject.organizer),
      },
      plan: {
        ...structuredClone(initialPlan),
        entryTime: "07:00",
        exitTime: "10:15",
        ascent: "650",
        descent: "650",
        distance: "8.4",
        itinerary: [
          { id: "sample-start", kind: "Start", name: "中房温泉", arrivalTime: "07:00", restMinutes: "0", travelMinutesToNext: "90" },
          { id: "sample-peak", kind: "Peak", name: "燕岳", arrivalTime: "08:30", restMinutes: "30", travelMinutesToNext: "75" },
          { id: "sample-goal", kind: "Goal", name: "中房温泉", arrivalTime: "10:15", restMinutes: "0", travelMinutesToNext: "" },
        ],
        routeImagePath: defaults.routeImagePath,
        escapePlan: "天候悪化または体調不良時は直ちに引き返し、中房温泉から下山します。",
        equipment: [],
        drinkQuantity: "2L程度",
        policeContacts: [{ id: "sample-police", label: "長野県警察本部", phone: "026-233-0110" }],
        lodgeContacts: [{ id: "sample-lodge", label: "燕山荘", phone: "0263-32-1535" }],
        homeBaseRosterIndex: homeBase ? sampleRoster.indexOf(homeBase) : null,
        homeBaseName: homeBase?.name ?? "",
        homeBasePhone: homeBase?.phone ?? "",
      },
      privacyMode: "full",
      outputRoot: "",
    };
  };

  const enterSampleData = async (sampleRole = role) => {
    if (!isTauriRuntime()) return;
    setProjectsError("");
    setSaveStatus("saving");
    try {
      const defaults = await getSampleDataDefaults();
      const [rosterTable, responseTable] = await Promise.all([
        loadTabularFile(defaults.rosterPath),
        loadTabularFile(defaults.responsePath),
      ]);
      await allowRouteImagePreview(defaults.routeImagePath);
      const sample = buildSampleSnapshot(
        activeProject
          ? { ...emptyProjectSnapshot(activeProject.createdAt, activeProject.id), createdAt: activeProject.createdAt, role: sampleRole }
          : { ...emptyProjectSnapshot(), role: sampleRole },
        defaults,
        rosterTable,
        responseTable,
      );
      await saveProject(sample);
      if (activeProject) await applySnapshot(sample);
      else await openProjectInWindow(sample.id);
      await refreshProjects();
      setSaveStatus("saved");
      setSampleDataControlVisible(false);
    } catch (error) {
      setSaveStatus("error");
      setProjectsError(String(error));
    }
  };

  const goToValidationTarget = (target: ValidationTarget) => {
    setValidationReturnStep(target.participant ? step : null);
    setValidationTarget(target);
    setStep(target.step);
  };

  const clearValidationTarget = () => setValidationTarget(null);

  useEffect(() => {
    if (!projectWindowId || !isTauriRuntime()) return;
    void loadProject(projectWindowId)
      .then((saved) => applySnapshot(saved, requestedEditorTarget))
      .then(() => setScreen("editor"))
      .catch((error) => setProjectsError(String(error)));
  }, []);

  useEffect(() => {
    if (!projectWindowId || !isTauriRuntime() || isEditorWindow) return;
    const reloadProject = () => void loadProject(projectWindowId).then((saved) => applySnapshot(saved)).catch((error) => setProjectsError(String(error)));
    let unlisten: (() => void) | undefined;
    void listen<{ id: string }>("project-updated", (event) => {
      if (event.payload.id === projectWindowId) reloadProject();
    }).then((callback) => { unlisten = callback; });
    window.addEventListener("focus", reloadProject);
    return () => { window.removeEventListener("focus", reloadProject); unlisten?.(); };
  }, [projectWindowId, isEditorWindow]);

  useEffect(() => {
    if (!isEditorWindow || !isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    void listen<EditorNavigationRequest>("project-edit-target", (event) => {
      setValidationReturnStep(null);
      setEditorScope(event.payload.scope);
      setValidationTarget(event.payload.target);
      setStep(event.payload.target.step);
    }).then((callback) => { unlisten = callback; });
    return () => unlisten?.();
  }, [isEditorWindow]);

  useEffect(() => {
    if (!isTauriRuntime() || screen !== "list") return;
    const refreshOnFocus = () => void refreshProjects();
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [screen]);

  const chooseOutput = async () => {
    if (!isTauriRuntime()) return;
    const selected = await open({ multiple: false, directory: true });
    if (typeof selected === "string") setOutputRoot(selected);
  };

  const buildPayload = () => ({
    mode: "submission",
    privacyMode,
    participants,
    project: currentProject,
    plan: {
      ...plan,
      totalDurationText: durationBetween(plan.entryTime, plan.exitTime),
      itineraryText: buildItineraryText(plan.itinerary),
      equipmentText: `□${[...plan.equipment, `飲料（${plan.drinkQuantity}）`].join("　□")}\n（※印の物は、ある人は持参する）`,
    },
  });

  const buildPlanPayload = () => ({
    mode: "plan",
    privacyMode: "minimal",
    participants: [],
    project: currentProject,
    plan: {
      ...plan,
      totalDurationText: durationBetween(plan.entryTime, plan.exitTime),
      itineraryText: buildItineraryText(plan.itinerary),
    },
  });

  const generate = async () => {
    if (issues.some((issue) => issue.severity === "error") || generating) return;
    setGenerationError("");
    setResult(null);
    setGenerationStage("生成準備中");
    setGenerating(true);
    try {
      setResult(await generateDocuments(buildPayload(), outputRoot, setGenerationStage));
    } catch (error) {
      setGenerationError(String(error));
    } finally {
      setGenerating(false);
    }
  };

  const exportHandoff = async () => {
    if (!isTauriRuntime() || handoffExporting) return;
    const selected = await save({ defaultPath: `${defaultProjectName(project.mountainName)}_参加者.csv`, filters: [{ name: "サークル長に渡すデータ", extensions: [participantCsvExtension] }] });
    if (typeof selected !== "string") return;
    setHandoffExporting(true); setHandoffError("");
    try { await writeParticipantCsv(selected, toHandoffParticipants(responses.filter((response) => selectedIds.has(response.rowId)))); setExportedHandoffPath(selected); }
    catch (error) { setHandoffError(String(error)); } finally { setHandoffExporting(false); }
  };

  const planIssues = useMemo(() => validateHikingPlan(currentProject, plan), [currentProject, plan]);
  const planErrors = planIssues.filter((issue) => issue.severity === "error");
  const exportPlan = async () => {
    if (!isTauriRuntime() || planExporting || planErrors.length) return;
    const selected = await open({ multiple: false, directory: true });
    if (typeof selected !== "string") return;
    setPlanExporting(true); setPlanExportError("");
    try {
      const result = await generateDocuments(buildPlanPayload(), selected, () => {});
      setExportedPlanPath(result.files[0] ?? "");
    }
    catch (error) { setPlanExportError(String(error)); } finally { setPlanExporting(false); }
  };

  const finishOrganizerEditing = async () => {
    if (!await saveCurrentProject()) return;
    const parent = activeProject ? await WebviewWindow.getByLabel(`project-${activeProject.id}`) : null;
    if (parent) { if (await parent.isMinimized()) await parent.unminimize(); await parent.setFocus(); }
    await getCurrentWebviewWindow().close();
  };

  const handleEditorBack = () => {
    if (role === "organizer" && isEditorWindow) {
      const steps = organizerEditorSteps(editorScope);
      const index = steps.indexOf(step);
      if (index <= 0) { void finishOrganizerEditing(); return; }
      setStep(steps[index - 1]);
      return;
    }
    setStep((Math.max(0, step - 1) as StepId));
  };

  const handleNext = () => {
    if (role === "organizer") {
      if (isEditorWindow) {
        const steps = organizerEditorSteps(editorScope);
        const index = steps.indexOf(step);
        if (index >= steps.length - 1) { void finishOrganizerEditing(); return; }
        setStep(steps[Math.max(index, 0) + 1]);
        return;
      }
      if (step === 0) void saveCurrentProject().then((saved) => { if (saved) setStep(1); });
      return;
    }
    const lastStep = role === "leader" ? 2 : 3;
    if (step < lastStep) setStep((step + 1) as StepId);
    else if (role === "leader") void generate();
  };

  const handoffParticipants = useMemo(() => responses.filter((response) => selectedIds.has(response.rowId)), [responses, selectedIds]);
  const handoffIssues = useMemo(() => validateHandoff(handoffParticipants), [handoffParticipants]);
  const handoffReady = !handoffIssues.some((issue) => issue.severity === "error");
  const nextDisabled = role === "organizer"
    ? !isEditorWindow && step === 0 && !handoffReady
    : step === 2 && (generating || issues.some((issue) => issue.severity === "error"));
  if (screen === "list") {
    return (
      <div className="app-root">
        <AppHeader
          dataEntryAvailable={sampleDataControlVisible}
          onEnterPlanSampleData={() => void enterSampleData("organizer")}
          onEnterSubmissionSampleData={() => void enterSampleData("leader")}
          updateEnabled={isTauriRuntime()}
        />
        <ProjectList projects={projects} loading={projectsLoading} error={projectsError} onCreate={(role) => void createProject(role)} onImport={() => void importHandoff()} onOpen={(id) => void openProject(id)} onDuplicate={(id) => void duplicateProject(id)} onRename={(id, name) => void renameProject(id, name)} onDelete={(id) => void removeProject(id)} />
      </div>
    );
  }
  if (isOrganizerOverview) {
    return <div className="app-root">
      <AppHeader
        windowTitle={currentProject.projectName?.trim() || defaultProjectName(currentProject.mountainName)}
        dataEntryAvailable={sampleDataControlVisible}
        onEnterSampleData={() => void enterSampleData()}
        saveStatus={activeProject ? saveStatus : undefined}
        updateEnabled={isTauriRuntime()}
      />
      <main className="overview-home">
        <OrganizerOverview
          plan={plan} participants={handoffParticipants} handoffIssues={handoffIssues} handoffReady={handoffReady}
          handoffExporting={handoffExporting} handoffError={handoffError} exportedHandoffPath={exportedHandoffPath}
          planIssues={planIssues} planReady={!planErrors.length} planExporting={planExporting} planExportError={planExportError} exportedPlanPath={exportedPlanPath} outputOpenError={outputOpenError}
          onEdit={(target) => void openOrganizerEditor(target)} onExportHandoff={() => void exportHandoff()} onExportPlan={() => void exportPlan()}
          onOpenHandoffOutput={() => { if (!exportedHandoffPath) return; setOutputOpenError(""); void openOutputFolder(exportedHandoffPath.replace(/[\\/][^\\/]+$/, "")).catch((error) => setOutputOpenError(String(error))); }}
          onOpenPlanOutput={() => { if (!exportedPlanPath) return; setOutputOpenError(""); void openOutputFolder(exportedPlanPath.replace(/[\\/][^\\/]+$/, "")).catch((error) => setOutputOpenError(String(error))); }}
        />
      </main>
    </div>;
  }
  return (
    <AppShell
      step={step}
      onBack={handleEditorBack}
      onNext={handleNext}
      onStepChange={setStep}
      nextLabel={(role === "organizer" && isEditorWindow && step === organizerEditorSteps(editorScope).at(-1)) ? "編集を完了" : (role === "leader" && step === 2) ? "提出書類を作成" : "次へ"}
      role={role}
      organizerEditing={role === "organizer" && isEditorWindow ? editorScope : false}
      hideNext={role === "organizer" && !isEditorWindow && step !== 0}
      nextDisabled={nextDisabled}
      nextIcon={role === "leader" && step === 2 ? DocumentExport : undefined}
      projectTitle={currentProject.projectName?.trim() || defaultProjectName(currentProject.mountainName)}
      dataEntryAvailable={sampleDataControlVisible}
      onEnterSampleData={() => void enterSampleData()}
      saveStatus={activeProject ? saveStatus : undefined}
      updateEnabled={isTauriRuntime()}
    >
      {step === 0 && role === "organizer" ? <OrganizerParticipantsStep
          responsePath={responsePath} responseTable={responseTable} responseMapping={responseMapping} responses={responses} selectedIds={selectedIds}
          loading={loadingResponses} error={importError} onPick={() => void chooseFile("response")} onClear={() => { setResponsePath(""); setResponseTable(null); setResponseMapping(emptyMapping()); setSelectedIds(new Set()); }} onMappingChange={setResponseMapping} onSelectionChange={setSelectedIds}
           focusTarget={validationTarget} onGoToTarget={goToValidationTarget} onFocusHandled={clearValidationTarget}
        /> : null}
      {step === 0 && role === "leader" ? (
        <ParticipantsStep
          rosterPath={rosterPath}
          responsePath={responsePath}
          handoffPath={handoffPath}
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
          onPickResponses={() => void chooseHandoff()}
          onClearRoster={() => { setRosterPath(""); setRosterTable(null); setRosterMapping(emptyMapping()); setParticipantOverrides({}); }}
          onClearResponses={() => { setHandoffPath(""); setResponsePath(""); setResponseTable(null); setResponseMapping(emptyMapping()); setSelectedIds(new Set()); }}
          onRosterMappingChange={setRosterMapping}
          onResponseMappingChange={setResponseMapping}
          onSelectionChange={setSelectedIds}
          onManualMatch={(responseId, rosterIndex) => setManualMatches((current) => ({ ...current, [responseId]: rosterIndex }))}
          onParticipantOverride={(rosterIndex, participant) => {
            const baseParticipant = baseRoster[rosterIndex];
            if (!baseParticipant) return;
            const changes = changedRosterFields(baseParticipant, participant);
            setParticipantOverrides((current) => {
              const next = { ...current };
              if (Object.keys(changes).length) next[rosterIndex] = changes;
              else delete next[rosterIndex];
              return next;
            });
            if (project.organizer.rosterIndex === rosterIndex) {
              setProject((current) => ({ ...current, organizer: { rosterIndex, studentId: participant.studentId, name: participant.name, faculty: participant.faculty, department: participant.department, phone: participant.phone } }));
            }
          }}
           focusTarget={validationTarget}
           onParticipantSaved={() => { if (validationReturnStep !== null) setStep(validationReturnStep); setValidationReturnStep(null); }}
           onFocusHandled={clearValidationTarget}
        />
      ) : null}
      {step === 1 && role === "leader" ? <ProjectStep project={currentProject} role={role} roster={roster} onChange={setProject} focusTarget={validationTarget} onFocusHandled={clearValidationTarget} /> : null}
      {step === 2 && role === "organizer" ? <ProjectStep project={currentProject} role={role} roster={roster} onChange={setProject} focusTarget={validationTarget} onFocusHandled={clearValidationTarget} /> : null}
      {step === 3 && role === "organizer" ? <PlanStep plan={plan} roster={roster} onChange={setPlan} onPickRoute={() => void chooseRoute()} includeHomeBase focusTarget={validationTarget} onFocusHandled={clearValidationTarget} /> : null}
      {step === 2 && role === "leader" ? (
        <ReviewStep
          participants={participants}
          issues={issues}
          privacyMode={privacyMode}
          outputRoot={outputRoot}
          generating={generating}
          generationStage={generationStage}
          result={result}
          generationError={generationError}
          outputOpenError={outputOpenError}
          onPrivacyChange={setPrivacyMode}
          onChooseOutput={() => void chooseOutput()}
          onOpenOutput={() => {
            if (!result) return;
            setOutputOpenError("");
            void openOutputFolder(result.outputDir).catch((error) => setOutputOpenError(String(error)));
          }}
          focusTarget={validationTarget}
          onGoToTarget={goToValidationTarget}
          onFocusHandled={clearValidationTarget}
          privacyLocked
          submissionMode
        />
      ) : null}
    </AppShell>
  );
}
