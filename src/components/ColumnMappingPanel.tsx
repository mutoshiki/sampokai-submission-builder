import { Accordion, AccordionItem, Select, SelectItem } from "@carbon/react";
import { mappingLabels } from "../lib/mapping";
import type { ColumnMapping, ImportedTable } from "../types";

interface ColumnMappingPanelProps {
  title: string;
  kind: "roster" | "response";
  table: ImportedTable;
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

export function ColumnMappingPanel({ title, kind, table, mapping, onChange }: ColumnMappingPanelProps) {
  return (
    <Accordion align="start" size="sm">
      <AccordionItem title={`${title}の列割り当てを確認`}>
        <div className="mapping-grid">
          {mappingLabels
            .filter((field) => kind === "roster" || !field.rosterOnly)
            .map((field) => (
              <Select
                key={field.key}
                id={`${kind}-${field.key}`}
                labelText={field.label}
                value={mapping[field.key] === null ? "" : String(mapping[field.key])}
                onChange={(event) =>
                  onChange({
                    ...mapping,
                    [field.key]: event.target.value === "" ? null : Number(event.target.value),
                  })
                }
              >
                <SelectItem value="" text="使用しない" />
                {table.columns.map((column, index) => (
                  <SelectItem key={`${column}-${index}`} value={String(index)} text={column} />
                ))}
              </Select>
            ))}
        </div>
      </AccordionItem>
    </Accordion>
  );
}
