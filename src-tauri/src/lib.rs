use calamine::{open_workbook_auto, Data, DataType, Reader};
use chardetng::EncodingDetector;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{path::BaseDirectory, AppHandle, Manager};
use tempfile::NamedTempFile;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Debug, thiserror::Error)]
enum AppError {
    #[error("ファイルを読み込めませんでした。ファイルが開けることを確認してください。")]
    FileRead,
    #[error("対応していないファイル形式です。CSV、TSV、XLS、XLSXを選択してください。")]
    UnsupportedFile,
    #[error("表の見出し行を判定できませんでした。")]
    HeaderNotFound,
    #[error("Word互換ソフトを起動できませんでした。Microsoft WordまたはWPS Officeをインストールしてください。")]
    OfficeUnavailable,
    #[error("書類生成に失敗しました。入力内容と出力先を確認してください。")]
    GenerationFailed,
    #[error("ルート画像を読み込めません。PNG、JPEG、BMP形式の壊れていない画像を選択してください。")]
    RouteImageInvalid,
    #[error("ルート画像を登山計画書へ追加できません。別のPNG、JPEG、BMP画像を選択してください。")]
    RouteImageInsertFailed,
    #[error("出力先フォルダが無効です。")]
    InvalidOutput,
    #[error("アプリに同梱されたテンプレートが見つかりません。再インストールしてください。")]
    ResourceMissing,
    #[error("完成フォルダを開けませんでした。")]
    OpenOutputFailed,
    #[error("企画データを保存または読み込めませんでした。")]
    ProjectStorage,
    #[error("企画データが壊れているか、このアプリでは読み込めない形式です。")]
    ProjectDataInvalid,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportedTable {
    sheet_name: String,
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
    header_row_index: usize,
    total_rows: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OfficeStatus {
    available: bool,
    application_name: Option<String>,
    message: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerationResult {
  output_dir: String,
  files: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SampleDataDefaults {
    roster_path: String,
    response_path: String,
    route_image_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSummary {
    id: String,
    created_at: String,
    updated_at: String,
    mountain_name: String,
    project_name: String,
    date: String,
    organizer_name: String,
    participant_count: usize,
}

fn project_directory(app: &AppHandle) -> Result<PathBuf, AppError> {
    let directory = app.path().app_data_dir().map_err(|_| AppError::ProjectStorage)?.join("projects");
    fs::create_dir_all(&directory).map_err(|_| AppError::ProjectStorage)?;
    Ok(directory)
}

fn valid_project_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 128 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn project_path(directory: &Path, id: &str) -> Result<PathBuf, AppError> {
    if !valid_project_id(id) { return Err(AppError::ProjectDataInvalid); }
    Ok(directory.join(format!("{id}.json")))
}

fn read_project(path: &Path) -> Result<Value, AppError> {
    let bytes = fs::read(path).or_else(|_| fs::read(path.with_extension("bak"))).map_err(|_| AppError::ProjectStorage)?;
    let project = serde_json::from_slice::<Value>(&bytes).map_err(|_| AppError::ProjectDataInvalid)?;
    // Later versions add migrations at this gate; never deserialize unknown shapes into editor state.
    let valid = project.get("schemaVersion").and_then(Value::as_u64) == Some(1) && project.get("id").and_then(Value::as_str).is_some();
    if valid { Ok(project) } else { Err(AppError::ProjectDataInvalid) }
}

fn string_at(value: &Value, path: &[&str]) -> String {
    let mut current = value;
    for key in path { let Some(next) = current.get(*key) else { return String::new(); }; current = next; }
    current.as_str().unwrap_or_default().to_string()
}

fn project_summary(value: &Value) -> Option<ProjectSummary> {
    let id = string_at(value, &["id"]);
    if !valid_project_id(&id) { return None; }
    Some(ProjectSummary {
        id, created_at: string_at(value, &["createdAt"]), updated_at: string_at(value, &["updatedAt"]),
        mountain_name: string_at(value, &["project", "mountainName"]), project_name: string_at(value, &["project", "projectName"]), date: string_at(value, &["project", "date"]),
        organizer_name: string_at(value, &["project", "organizer", "name"]),
        participant_count: value.get("selectedIds").and_then(Value::as_array).map_or(0, Vec::len),
    })
}

fn save_project_file(path: &Path, project: &Value) -> Result<(), AppError> {
    let directory = path.parent().ok_or(AppError::ProjectStorage)?;
    let mut temp = tempfile::NamedTempFile::new_in(directory).map_err(|_| AppError::ProjectStorage)?;
    serde_json::to_writer_pretty(&mut temp, project).map_err(|_| AppError::ProjectStorage)?;
    temp.as_file_mut().sync_all().map_err(|_| AppError::ProjectStorage)?;
    let backup = path.with_extension("bak"); let had_current = path.exists();
    if backup.exists() { fs::remove_file(&backup).map_err(|_| AppError::ProjectStorage)?; }
    if had_current { fs::rename(path, &backup).map_err(|_| AppError::ProjectStorage)?; }
    if temp.persist(path).is_err() { if had_current { let _ = fs::rename(&backup, path); } return Err(AppError::ProjectStorage); }
    if backup.exists() { let _ = fs::remove_file(backup); }
    Ok(())
}

#[tauri::command]
fn list_projects(app: AppHandle) -> Result<Vec<ProjectSummary>, AppError> {
    let directory = project_directory(&app)?; let mut projects = Vec::new();
    for entry in fs::read_dir(directory).map_err(|_| AppError::ProjectStorage)? {
        let Ok(entry) = entry else { continue; }; let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("json") { continue; }
        if let Ok(project) = read_project(&path) { if let Some(summary) = project_summary(&project) { projects.push(summary); } }
    }
    projects.sort_by(|left, right| right.updated_at.cmp(&left.updated_at)); Ok(projects)
}

#[tauri::command]
fn load_project(app: AppHandle, id: String) -> Result<Value, AppError> {
    let path = project_path(&project_directory(&app)?, &id)?; let project = read_project(&path)?;
    if project.get("id").and_then(Value::as_str) != Some(id.as_str()) { return Err(AppError::ProjectDataInvalid); } Ok(project)
}

#[tauri::command]
fn save_project(app: AppHandle, project: Value) -> Result<(), AppError> {
    let id = project.get("id").and_then(Value::as_str).ok_or(AppError::ProjectDataInvalid)?;
    if project.get("schemaVersion").and_then(Value::as_u64) != Some(1) { return Err(AppError::ProjectDataInvalid); }
    let path = project_path(&project_directory(&app)?, id)?; save_project_file(&path, &project)
}

#[tauri::command]
fn delete_project(app: AppHandle, id: String) -> Result<(), AppError> {
    let path = project_path(&project_directory(&app)?, &id)?; if path.exists() { fs::remove_file(&path).map_err(|_| AppError::ProjectStorage)?; }
    let backup = path.with_extension("bak"); if backup.exists() { fs::remove_file(backup).map_err(|_| AppError::ProjectStorage)?; } Ok(())
}

fn data_to_string(value: &Data) -> String {
    match value {
        Data::Empty => String::new(),
        Data::String(value) => value.trim().to_string(),
        Data::Float(value) => {
            if value.fract() == 0.0 {
                format!("{value:.0}")
            } else {
                value.to_string()
            }
        }
        Data::Int(value) => value.to_string(),
        Data::Bool(value) => value.to_string(),
        Data::Error(_) => String::new(),
        Data::DateTime(value) => value.to_string(),
        Data::DateTimeIso(value) => value.clone(),
        Data::DurationIso(value) => value.clone(),
    }
}

fn known_header_score(value: &str) -> usize {
    let normalized = value.to_lowercase().replace([' ', '　', '\n', '\r'], "");
    [
        "タイムスタンプ",
        "学籍番号",
        "学生番号",
        "氏名",
        "名前",
        "name",
        "学部",
        "学科",
        "性別",
        "住所",
        "連絡先",
        "電話",
        "メール",
    ]
    .iter()
    .filter(|token| normalized.contains(*token))
    .count()
}

fn detect_header_row(rows: &[Vec<String>]) -> Option<usize> {
    rows.iter()
        .take(20)
        .enumerate()
        .filter(|(_, row)| row.iter().any(|cell| !cell.trim().is_empty()))
        .map(|(index, row)| {
            let non_empty = row.iter().filter(|cell| !cell.trim().is_empty()).count();
            let header_hits: usize = row.iter().map(|cell| known_header_score(cell)).sum();
            let distinct = row
                .iter()
                .filter(|cell| !cell.trim().is_empty())
                .collect::<std::collections::HashSet<_>>()
                .len();
            (index, header_hits * 100 + distinct * 2 + non_empty)
        })
        .max_by_key(|(_, score)| *score)
        .map(|(index, _)| index)
}

fn normalize_rectangular(mut rows: Vec<Vec<String>>) -> Vec<Vec<String>> {
    let width = rows.iter().map(Vec::len).max().unwrap_or(0);
    for row in &mut rows {
        row.resize(width, String::new());
    }
    rows
}

fn read_excel(path: &Path) -> Result<(String, Vec<Vec<String>>), AppError> {
    let mut workbook = open_workbook_auto(path).map_err(|_| AppError::FileRead)?;
    let sheet_name = workbook
        .sheet_names()
        .iter()
        .find(|name| {
            workbook
                .worksheet_range(name)
                .map(|range| range.rows().any(|row| row.iter().any(|cell| !cell.is_empty())))
                .unwrap_or(false)
        })
        .cloned()
        .or_else(|| workbook.sheet_names().first().cloned())
        .ok_or(AppError::FileRead)?;
    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|_| AppError::FileRead)?;
    let rows = range
        .rows()
        .map(|row| row.iter().map(data_to_string).collect::<Vec<_>>())
        .collect::<Vec<_>>();
    Ok((sheet_name, normalize_rectangular(rows)))
}

fn read_delimited(path: &Path, delimiter: u8) -> Result<(String, Vec<Vec<String>>), AppError> {
    let bytes = fs::read(path).map_err(|_| AppError::FileRead)?;
    let mut detector = EncodingDetector::new();
    detector.feed(&bytes, true);
    let encoding = detector.guess(None, true);
    let (decoded, _, _) = encoding.decode(&bytes);
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .has_headers(false)
        .flexible(true)
        .from_reader(decoded.as_bytes());
    let mut rows = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|_| AppError::FileRead)?;
        rows.push(record.iter().map(|value| value.trim().to_string()).collect());
    }
    Ok(("データ".to_string(), normalize_rectangular(rows)))
}

#[tauri::command]
fn load_tabular_file(path: String) -> Result<ImportedTable, AppError> {
    let source = PathBuf::from(path);
    if !source.is_file() {
        return Err(AppError::FileRead);
    }
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let (sheet_name, raw_rows) = match extension.as_str() {
        "xlsx" | "xls" | "xlsb" | "ods" => read_excel(&source)?,
        "csv" => read_delimited(&source, b',')?,
        "tsv" => read_delimited(&source, b'\t')?,
        _ => return Err(AppError::UnsupportedFile),
    };
    let header_row_index = detect_header_row(&raw_rows).ok_or(AppError::HeaderNotFound)?;
    let columns = raw_rows[header_row_index]
        .iter()
        .enumerate()
        .map(|(index, value)| {
            if value.trim().is_empty() {
                format!("列{}", index + 1)
            } else {
                value.trim().to_string()
            }
        })
        .collect::<Vec<_>>();
    let rows = raw_rows
        .into_iter()
        .skip(header_row_index + 1)
        .filter(|row| row.iter().any(|cell| !cell.trim().is_empty()))
        .map(|mut row| {
            row.resize(columns.len(), String::new());
            row.truncate(columns.len());
            row
        })
        .collect::<Vec<_>>();
    Ok(ImportedTable {
        sheet_name,
        columns,
        total_rows: rows.len(),
        rows,
        header_row_index,
    })
}

fn resolve_resource(app: &AppHandle, candidates: &[&str]) -> Result<PathBuf, AppError> {
    for candidate in candidates {
        if let Ok(path) = app.path().resolve(candidate, BaseDirectory::Resource) {
            if path.exists() {
                return Ok(path);
            }
        }
        let development_path = Path::new(env!("CARGO_MANIFEST_DIR")).join(candidate);
        if development_path.exists() {
            return Ok(development_path);
        }
    }
    Err(AppError::ResourceMissing)
}

#[tauri::command]
fn allow_route_image_preview(app: AppHandle, path: String) -> Result<(), AppError> {
    let source = PathBuf::from(path);
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !source.is_file() || !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "bmp") {
        return Err(AppError::FileRead);
    }
    app.asset_protocol_scope()
        .allow_file(source)
        .map_err(|_| AppError::FileRead)
}

#[tauri::command]
fn sample_data_defaults(app: AppHandle) -> Result<SampleDataDefaults, AppError> {
    let roster = resolve_resource(&app, &["resources/sample-data/通常名簿(ダミーデータ).xlsx"])?;
    let response = resolve_resource(&app, &["resources/sample-data/燕岳登山企画_応募フォーム回答_ダミー.xlsx"])?;
    let route_image = resolve_resource(&app, &["resources/sample-data/燕岳ルート図.png"])?;
    app.asset_protocol_scope()
        .allow_file(&route_image)
        .map_err(|_| AppError::ResourceMissing)?;
    Ok(SampleDataDefaults {
        roster_path: roster.to_string_lossy().into_owned(),
        response_path: response.to_string_lossy().into_owned(),
        route_image_path: route_image.to_string_lossy().into_owned(),
    })
}

fn hidden_powershell() -> Command {
    let mut command = Command::new("powershell.exe");
    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000);
    command.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass"]);
    command
}

#[tauri::command]
fn check_office(app: AppHandle) -> Result<OfficeStatus, AppError> {
    let script = resolve_resource(
        &app,
        &["resources/scripts/check-office.ps1", "scripts/check-office.ps1"],
    )?;
    let output = hidden_powershell()
        .arg("-File")
        .arg(script)
        .output()
        .map_err(|_| AppError::OfficeUnavailable)?;
    if !output.status.success() {
        return Ok(OfficeStatus {
            available: false,
            application_name: None,
            message: AppError::OfficeUnavailable.to_string(),
        });
    }
    serde_json::from_slice::<OfficeStatus>(&output.stdout).map_err(|_| AppError::OfficeUnavailable)
}

#[tauri::command]
fn generate_documents(
    app: AppHandle,
    payload: Value,
    output_root: String,
) -> Result<GenerationResult, AppError> {
    let output_root = PathBuf::from(output_root);
    if !output_root.is_dir() {
        return Err(AppError::InvalidOutput);
    }
    let script = resolve_resource(
        &app,
        &[
            "resources/scripts/generate-documents.ps1",
            "scripts/generate-documents.ps1",
        ],
    )?;
    let template_dir = resolve_resource(
        &app,
        &["resources/templates", "templates"],
    )?;
    let mut payload_file = NamedTempFile::new().map_err(|_| AppError::GenerationFailed)?;
    serde_json::to_writer(&mut payload_file, &payload).map_err(|_| AppError::GenerationFailed)?;
    let output = hidden_powershell()
        .arg("-File")
        .arg(script)
        .arg("-PayloadPath")
        .arg(payload_file.path())
        .arg("-TemplateDirectory")
        .arg(template_dir)
        .arg("-OutputRoot")
        .arg(&output_root)
        .output()
        .map_err(|_| AppError::GenerationFailed)?;
    if !output.status.success() {
        let error_output = String::from_utf8_lossy(&output.stderr);
        if error_output.contains("SAMP_IMAGE_READ:") {
            return Err(AppError::RouteImageInvalid);
        }
        if error_output.contains("SAMP_IMAGE_INSERT:") {
            return Err(AppError::RouteImageInsertFailed);
        }
        return Err(AppError::GenerationFailed);
    }
    serde_json::from_slice::<GenerationResult>(&output.stdout).map_err(|_| AppError::GenerationFailed)
}

#[tauri::command]
fn open_output_folder(path: String) -> Result<(), AppError> {
    let output_dir = PathBuf::from(path);
    if !output_dir.is_dir() {
        return Err(AppError::InvalidOutput);
    }
    Command::new("explorer.exe")
        .arg(&output_dir)
        .spawn()
        .map_err(|_| AppError::OpenOutputFailed)?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            load_tabular_file,
            check_office,
            generate_documents,
            open_output_folder,
            allow_route_image_preview,
            sample_data_defaults,
            list_projects,
            load_project,
            save_project,
            delete_project
        ])
        .run(tauri::generate_context!())
        .expect("failed to run application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn detects_header_after_intro_rows() {
        let rows = vec![
            vec!["回答データ".to_string(), String::new()],
            vec!["学籍番号".to_string(), "氏名".to_string()],
            vec!["25T0001A".to_string(), "山田 太郎".to_string()],
        ];
        assert_eq!(detect_header_row(&rows), Some(1));
    }

    #[test]
    fn imports_provided_roster_workbook() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../通常名簿(ダミーデータ).xlsx");
        let table = load_tabular_file(path.to_string_lossy().into_owned()).expect("roster workbook");
        assert!(table.total_rows > 0);
        assert!(table.columns.iter().any(|column| column.contains("学籍番号")));
        assert!(table.columns.iter().any(|column| column.contains("氏名")));
    }

    #[test]
    fn imports_provided_form_export() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../燕岳登山企画_応募フォーム回答_ダミー.xlsx");
        let table = load_tabular_file(path.to_string_lossy().into_owned()).expect("form workbook");
        assert!(table.total_rows > 0);
        assert!(table.columns.iter().any(|column| column.contains("名前")));
    }

    #[test]
    fn project_file_round_trip_is_atomic_and_keeps_snapshot_fields() {
        let directory = tempfile::tempdir().expect("project directory");
        let path = project_path(directory.path(), "project-001").expect("safe id");
        let project = serde_json::json!({
            "schemaVersion": 1, "id": "project-001", "createdAt": "2026-01-01T00:00:00Z",
            "updatedAt": "2026-01-01T00:00:01Z", "selectedIds": ["response-0"],
            "project": { "projectName": "テスト岳企画", "mountainName": "テスト岳", "date": "2026-02-01", "organizer": { "name": "山田" } },
            "rosterPath": "C:\\source.xlsx", "responsePath": "C:\\form.xlsx"
        });
        save_project_file(&path, &project).expect("save project");
        assert_eq!(read_project(&path).expect("load project"), project);
        let summary = project_summary(&project).expect("summary");
        assert_eq!(summary.participant_count, 1);
        assert_eq!(summary.project_name, "テスト岳企画");
        assert_eq!(summary.mountain_name, "テスト岳");
        assert!(!path.with_extension("bak").exists());
    }

    #[test]
    fn imports_utf8_csv_without_fixed_column_names() {
        let mut file = tempfile::Builder::new()
            .suffix(".csv")
            .tempfile()
            .expect("temporary csv");
        writeln!(file, "回答者コード,お名前,参加希望").expect("header");
        writeln!(file, "A001,架空 花子,はい").expect("row");
        let table = load_tabular_file(file.path().to_string_lossy().into_owned()).expect("csv import");
        assert_eq!(table.total_rows, 1);
        assert_eq!(table.columns[0], "回答者コード");
        assert_eq!(table.rows[0][1], "架空 花子");
    }
}
