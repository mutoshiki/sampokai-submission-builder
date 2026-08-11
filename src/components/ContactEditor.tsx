import { Button, TextInput } from "@carbon/react";
import { Add, TrashCan } from "@carbon/icons-react";
import type { ContactEntry } from "../types";

interface ContactEditorProps {
  title: string;
  contacts: ContactEntry[];
  onChange: (contacts: ContactEntry[]) => void;
  addLabel: string;
}

export function ContactEditor({ title, contacts, onChange, addLabel }: ContactEditorProps) {
  const update = (id: string, field: "label" | "phone", value: string) =>
    onChange(contacts.map((contact) => (contact.id === id ? { ...contact, [field]: value } : contact)));
  return (
    <div className="contact-editor">
      <div className="contact-editor__heading">
        <h3>{title}</h3>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={Add}
          onClick={() => onChange([...contacts, { id: crypto.randomUUID(), label: "", phone: "" }])}
        >
          {addLabel}
        </Button>
      </div>
      {contacts.map((contact, index) => (
        <div className="contact-row" key={contact.id}>
          <TextInput id={`${contact.id}-label`} labelText={`${title} ${index + 1}`} value={contact.label} onChange={(event) => update(contact.id, "label", event.target.value)} />
          <TextInput id={`${contact.id}-phone`} labelText="電話番号" value={contact.phone} onChange={(event) => update(contact.id, "phone", event.target.value)} />
          <Button hasIconOnly kind="ghost" size="md" renderIcon={TrashCan} iconDescription="削除" disabled={contacts.length === 1} onClick={() => onChange(contacts.filter((item) => item.id !== contact.id))} />
        </div>
      ))}
    </div>
  );
}
