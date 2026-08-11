from __future__ import annotations

import json
import sys
from pathlib import Path


def esc(value: object) -> str:
    if value is None:
        return ""
    return str(value).replace("\n", "\\n").replace("|", "\\|")


def summarize_docx(report: dict) -> list[str]:
    lines = ["### Sections"]
    for section in report["sections"]:
        lines.append(f"- {json.dumps(section, ensure_ascii=False)}")
    lines += [
        "",
        f"- Inline shapes: {report['inline_shapes']}; drawings: {report['drawings']}; legacy pictures: {report['legacy_pictures']}",
        f"- Text boxes: {json.dumps(report['textboxes'], ensure_ascii=False)}",
        f"- Bookmarks: {json.dumps(report['bookmarks'], ensure_ascii=False)}",
        f"- Content controls: {json.dumps(report['content_controls'], ensure_ascii=False)}",
        "",
        "### Body paragraphs",
    ]
    for paragraph in report["paragraphs"]:
        if paragraph["text"] or paragraph["runs"]:
            lines.append(
                f"- P{paragraph['index']} [{esc(paragraph['style'])}; {esc(paragraph['alignment'])}]: {esc(paragraph['text'])}"
            )
    lines.append("")
    lines.append("### Tables")
    for table in report["tables"]:
        lines.append(f"- Table {table['index']} style={esc(table['style'])} rows={len(table['rows'])}")
        for row in table["rows"]:
            values = [cell["text"] for cell in row["cells"]]
            lines.append(f"  - R{row['row']}: {json.dumps(values, ensure_ascii=False)}")
    return lines


def summarize_xlsx(report: dict) -> list[str]:
    lines = []
    for sheet in report["sheets"]:
        lines.append(f"### Sheet: {sheet['title']}")
        lines.append(
            "- "
            + json.dumps(
                {
                    k: sheet[k]
                    for k in [
                        "state",
                        "max_row",
                        "max_column",
                        "freeze_panes",
                        "auto_filter",
                        "merged_cells",
                        "column_dimensions",
                        "row_dimensions",
                        "print_area",
                        "print_title_rows",
                        "page_setup",
                    ]
                },
                ensure_ascii=False,
            )
        )
        lines.append("- Non-empty cells:")
        for cell in sheet["cells"]:
            if cell["value"] is not None:
                lines.append(
                    f"  - {cell['coordinate']}: {esc(cell['value'])} [type={cell['data_type']}, fmt={esc(cell['number_format'])}, style={cell['style_id']}]"
                )
        lines.append("")
    return lines


def summarize_pdf(report: dict) -> list[str]:
    lines = [f"- Metadata: {json.dumps(report['metadata'], ensure_ascii=False)}"]
    for page in report["pages"]:
        lines.append(
            f"### Page {page['index']} ({page['width_pt']:.2f} x {page['height_pt']:.2f} pt, rotation={page['rotation']})"
        )
        lines.append(page["text"].strip())
        lines.append("")
    return lines


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    report_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "tmp/source-inspection")
    output_path = Path(sys.argv[2] if len(sys.argv) > 2 else report_dir / "summary.md")
    lines = ["# Source inspection summary", ""]
    for report_path in sorted(report_dir.glob("*.json")):
        if report_path.name == "manifest.json":
            continue
        report = json.loads(report_path.read_text(encoding="utf-8"))
        lines.append(f"## {Path(report['path']).name}")
        lines.append("")
        if report["type"] == "docx":
            lines += summarize_docx(report)
        elif report["type"] == "xlsx":
            lines += summarize_xlsx(report)
        else:
            lines += summarize_pdf(report)
        lines.append("")
    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(output_path)


if __name__ == "__main__":
    main()
