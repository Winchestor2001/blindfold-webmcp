// Core domain types.
//
// The privacy invariant lives here: `Finding.value` is the only field holding a
// sensitive string, and it must never be serialised into a tool result unless
// `disclosed` is true, which only a human click can set. See CLAUDE.md, Rule 6.

export type EntityType =
  | "PERSON"
  | "EMAIL"
  | "PHONE"
  | "ADDRESS"
  | "DATE"
  | "NATIONAL_ID"
  | "ACCOUNT"
  | "ORG"
  | "URL"
  | "IP"
  | "MONEY";

export const ENTITY_TYPES: EntityType[] = [
  "PERSON",
  "EMAIL",
  "PHONE",
  "ADDRESS",
  "DATE",
  "NATIONAL_ID",
  "ACCOUNT",
  "ORG",
  "URL",
  "IP",
  "MONEY"
];

/** What the reviewer has decided about a finding. */
export type FindingStatus = "unreviewed" | "redact" | "keep";

/** Who made a decision. Drives the provenance badges in the UI. */
export type Actor = "agent" | "human";

export type Finding = {
  /** Stable within a scan, e.g. "f12". The agent addresses findings by this. */
  id: string;
  type: EntityType;
  /** 1-based. */
  page: number;
  /** Character offsets into the page's plain text. */
  start: number;
  end: number;
  /** Sensitive. Never leaves the page unless the human discloses it. */
  value: string;
  /** 0..1, from the detector. Surfaced to the agent to help it prioritise. */
  confidence: number;
  status: FindingStatus;
  /** Null while unreviewed. */
  decidedBy: Actor | null;
  /** Set when a rule, rather than a direct call, decided this finding. */
  ruleId: string | null;
  /** True once the human has released this value to the agent. */
  disclosed: boolean;
};

export type RedactionRule = {
  id: string;
  /** Types this rule covers. Empty means every type. */
  types: EntityType[];
  /** Pages this rule covers. Empty means every page. */
  pages: number[];
  action: Exclude<FindingStatus, "unreviewed">;
  /** Human-readable restatement, shown in the UI and the audit log. */
  label: string;
  createdBy: Actor;
};

export type DocumentPage = {
  /** 1-based. */
  number: number;
  text: string;
};

export type LoadedDocument = {
  id: string;
  title: string;
  /** How the document entered the app. */
  source: "sample" | "upload";
  kind: string;
  pages: DocumentPage[];
};

export type AuditEntry = {
  /** ISO timestamp. */
  at: string;
  actor: Actor;
  action: string;
  /** Never contains a sensitive value. */
  detail: string;
};

/** Where the workflow stands. Drives which tools are registered. */
export type Stage =
  | "no_document"
  | "document_open"
  | "scanned"
  | "applied"
  | "verified";
