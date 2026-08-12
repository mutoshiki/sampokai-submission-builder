import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { DocumentExport } from "@carbon/icons-react";
import { AppHeader } from "./components/AppHeader";
import { AppShell } from "./components/AppShell";
import { ProjectList } from "./components/ProjectList";
import { ParticipantsStep } from "./components/ParticipantsStep";
import { ProjectStep } from "./components/ProjectStep";
import { PlanStep, standardEquipment } from "./components/PlanStep";
import { ReviewStep } from "./components/ReviewStep";
import { allowRouteImagePreview, deleteProject, generateDocuments, getSampleDataDefaults, listProjects, loadProject, loadTabularFile, openOutputFolder, saveProject } from "./lib/api";
import { createProjectId, defaultProjectName, duplicateProjectSnapshot, PROJECT_SCHEMA_VERSION } from "./lib/projects";
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
import { validateProject } from "./lib/validation";
import type {
  ColumnMapping,
  GenerationResult,
  ImportedTable,
  PlanInfo,
  PrivacyMode,
  ProjectInfo,
  ProjectSnapshot,
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
  equipment: standardEquipment,
  drinkQuantity: "2L程度",
  policeContacts: [{ id: "police-1", label: "", phone: "" }],
  lodgeContacts: [{ id: "lodge-1", label: "", phone: "" }],
  homeBaseRosterIndex: null,
  homeBaseName: "",
  homeBasePhone: "",
};

const emptyProjectSnapshot = (now = new Date().toISOString(), id: string = createProjectId()): ProjectSnapshot => ({
  schemaVersion: PROJECT_SCHEMA_VERSION, id, createdAt: now, updatedAt: now, step: 0,
  rosterPath: "", responsePath: "", rosterMapping: emptyMapping(), responseMapping: emptyMapping(),
  manualMatches: {}, participantOverrides: {}, selectedIds: [], project: structuredClone(initialProject),
  plan: structuredClone(initialPlan), privacyMode: "full", outputRoot: "",
});

const isTauriRuntime = () => Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

export default function App() {
  const projectWindowId = useMemo(() => new URLSearchParams(window.location.search).get("project"), []);
  const isProjectWindow = Boolean(projectWindowId);
  const [screen, setScreen] = useState<"list" | "editor">(isProjectWindow ? "editor" : "list");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [activeProject, setActiveProject] = useState<{ id: string; createdAt: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">("saved");
  const [step, setStep] = useState<StepId>(0);
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
  const [generationError, setGenerationError] = useState("");
  const [outputOpenError, setOutputOpenError] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [validationTarget, setValidationTarget] = useState<ValidationTarget | null>(null);
  const [sampleDataControlVisible, setSampleDataControlVisible] = useState(false);

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
    const organizer = rosterIndex === null ? null : roster[rosterIndex];
    if (!organizer) return project;
    return {
      ...project,
      organizer: {
        rosterIndex,
        studentId: organizer.studentId,
        name: organizer.name,
        faculty: organizer.faculty,
        department: organizer.department,
        phone: organizer.phone,
      },
    };
  }, [project, roster]);
  const issues = useMemo(
    () => validateProject({ selectedMatches, participants: resolvedParticipants, project: currentProject, plan, outputRoot, privacyMode }),
    [selectedMatches, resolvedParticipants, currentProject, plan, outputRoot, privacyMode],
  );

  useEffect(() => {
    if (!isTauriRuntime() || isProjectWindow) return;
    void refreshProjects();
  }, [isProjectWindow]);

  const snapshot = (): ProjectSnapshot | null => activeProject ? {
    schemaVersion: PROJECT_SCHEMA_VERSION, id: activeProject.id, createdAt: activeProject.createdAt,
    updatedAt: new Date().toISOString(), step, rosterPath, responsePath, rosterMapping, responseMapping,
    manualMatches, participantOverrides, selectedIds: [...selectedIds], project: currentProject, plan, privacyMode, outputRoot,
  } : null;

  useEffect(() => {
    const current = snapshot();
    if (!current || screen !== "editor" || !isTauriRuntime()) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      void saveProject(current).then(() => setSaveStatus("saved")).catch(() => setSaveStatus("error"));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [screen, activeProject, step, rosterPath, responsePath, rosterMapping, responseMapping, manualMatches, participantOverrides, selectedIds, currentProject, plan, privacyMode, outputRoot]);

  const toggleDebugControls = () => setSampleDataControlVisible((visible) => !visible);
  useDebugShortcut(toggleDebugControls, isTauriRuntime());

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

  const applySnapshot = async (saved: ProjectSnapshot) => {
    setActiveProject({ id: saved.id, createdAt: saved.createdAt });
    setStep(saved.step); setRosterPath(saved.rosterPath); setResponsePath(saved.responsePath);
    setRosterMapping(saved.rosterMapping); setResponseMapping(saved.responseMapping);
    setManualMatches(saved.manualMatches); setParticipantOverrides(saved.participantOverrides);
    setSelectedIds(new Set(saved.selectedIds)); setProject(saved.project); setPlan(saved.plan);
    setPrivacyMode(saved.privacyMode); setOutputRoot(saved.outputRoot); setResult(null); setGenerationError("");
    setImportError(""); setValidationTarget(null);
    const missing: string[] = [];
    if (saved.rosterPath) {
      try { setRosterTable(await loadTabularFile(saved.rosterPath)); } catch { setRosterTable(null); missing.push("元名簿"); }
    } else setRosterTable(null);
    if (saved.responsePath) {
      try { setResponseTable(await loadTabularFile(saved.responsePath)); } catch { setResponseTable(null); missing.push("フォーム回答"); }
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
      await existing.show();
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

  const createProject = async () => {
    const saved = emptyProjectSnapshot();
    setSaveStatus("saving");
    try { await saveProject(saved); await refreshProjects(); await openProjectInWindow(saved.id); setSaveStatus("saved"); }
    catch (error) { setProjectsError(String(error)); }
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
        equipment: [...standardEquipment],
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

  const enterSampleData = async () => {
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
          ? { ...emptyProjectSnapshot(activeProject.createdAt, activeProject.id), createdAt: activeProject.createdAt }
          : emptyProjectSnapshot(),
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
    setValidationTarget(target);
    setStep(target.step);
  };

  const clearValidationTarget = () => setValidationTarget(null);

  useEffect(() => {
    if (!projectWindowId || !isTauriRuntime()) return;
    void loadProject(projectWindowId)
      .then((saved) => applySnapshot(saved))
      .then(() => setScreen("editor"))
      .catch((error) => setProjectsError(String(error)));
  }, []);

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
  if (screen === "list") {
    return (
      <div className="app-root">
        <AppHeader dataEntryAvailable={sampleDataControlVisible} onEnterSampleData={() => void enterSampleData()} updateEnabled={isTauriRuntime()} />
        <ProjectList projects={projects} loading={projectsLoading} error={projectsError} onCreate={() => void createProject()} onOpen={(id) => void openProject(id)} onDuplicate={(id) => void duplicateProject(id)} onRename={(id, name) => void renameProject(id, name)} onDelete={(id) => void removeProject(id)} />
      </div>
    );
  }
  return (
    <AppShell
      step={step}
      onBack={() => setStep((Math.max(0, step - 1) as StepId))}
      onNext={handleNext}
      onStepChange={setStep}
      nextLabel={step === 3 ? "提出書類を作成" : "次へ"}
      nextDisabled={nextDisabled}
      nextIcon={step === 3 ? DocumentExport : undefined}
      projectTitle={currentProject.projectName?.trim() || defaultProjectName(currentProject.mountainName)}
      dataEntryAvailable={sampleDataControlVisible}
      onEnterSampleData={() => void enterSampleData()}
      saveStatus={activeProject ? saveStatus : undefined}
      updateEnabled={isTauriRuntime()}
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
          onFocusHandled={clearValidationTarget}
        />
      ) : null}
      {step === 1 ? <ProjectStep project={currentProject} roster={roster} onChange={setProject} focusTarget={validationTarget} onFocusHandled={clearValidationTarget} /> : null}
      {step === 2 ? <PlanStep plan={plan} roster={roster} onChange={setPlan} onPickRoute={() => void chooseRoute()} focusTarget={validationTarget} onFocusHandled={clearValidationTarget} /> : null}
      {step === 3 ? (
        <ReviewStep
          participants={participants}
          issues={issues}
          privacyMode={privacyMode}
          outputRoot={outputRoot}
          generating={generating}
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
        />
      ) : null}
    </AppShell>
  );
}
