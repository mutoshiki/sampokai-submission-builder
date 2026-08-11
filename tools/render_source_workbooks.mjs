import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = path.resolve(process.argv[2] ?? ".");
const outputDir = path.resolve(process.argv[3] ?? "tmp/workbook-renders");
await fs.mkdir(outputDir, { recursive: true });

const files = [
  { name: "三年生以上が企画に来た時の名簿(ダミーデータ).xlsx", range: "A1:D15" },
  { name: "通常名簿(ダミーデータ).xlsx", range: "A1:R20" },
];

for (const file of files) {
  const input = await FileBlob.load(path.join(root, file.name));
  const workbook = await SpreadsheetFile.importXlsx(input);
  const sheets = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 3000 });
  await fs.writeFile(path.join(outputDir, `${file.name}.inspect.ndjson`), sheets.ndjson, "utf8");
  const sheetName = workbook.worksheets.getItemAt(0).name;
  const preview = await workbook.render({ sheetName, range: file.range, scale: 1.4, format: "png" });
  await fs.writeFile(path.join(outputDir, `${file.name}.png`), new Uint8Array(await preview.arrayBuffer()));
  console.log(`${file.name}\t${sheetName}\t${file.range}`);
}
