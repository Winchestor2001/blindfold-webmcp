// Application state.
//
// This is a plain observable store rather than React state, because tools are
// registered once at module scope and their `execute` runs outside the React
// tree. A tool reads and writes the same store the UI renders from, which is
// what makes the agent's actions and the human's actions genuinely symmetric:
// both go through the same operations and both land in the same audit log.

import { get, set } from "idb-keyval";

import { detectInPages } from "../core/detector";
import type {
  Actor,
  AuditEntry,
  EntityType,
  Finding,
  FindingStatus,
  LoadedDocument,
  RedactionRule,
  Stage
} from "../core/types";

// ---------------------------------------------------------------------------
// Human gates
// ---------------------------------------------------------------------------

export type DisclosureOutcome =
  | { granted: true; value: string }
  | { granted: false; reason: string };

/**
 * An agent asking to see one sensitive value. Suspended until a human answers.
 */
export type DisclosureRequest = {
  id: string;
  findingId: string;
  /** Why the agent says it needs the value. Shown verbatim to the human. */
  reason: string;
  requestedAt: string;
  settle: (outcome: DisclosureOutcome) => void;
};

export type ConfirmKind = "apply" | "export";

/** An irreversible operation waiting on a human. */
export type ConfirmRequest = {
  id: string;
  kind: ConfirmKind;
  headline: string;
  details: string[];
  requestedAt: string;
  settle: (approved: boolean) => void;
};

export type AppliedResult = {
  at: string;
  /** Finding ids that were burned out of the document. */
  redactedIds: string[];
  pages: number[];
};

export type VerificationResult = {
  at: string;
  clean: boolean;
  checked: number;
  /** Ids whose value survived into the exported bytes. Empty when clean. */
  residual: string[];
};

export type ExportResult = {
  at: string;
  filename: string;
  bytes: number;
  sha256: string;
};

export type TextSelection = {
  page: number;
  start: number;
  end: number;
  text: string;
};

export type State = {
  doc: LoadedDocument | null;
  scanned: boolean;
  findings: Finding[];
  rules: RedactionRule[];
  audit: AuditEntry[];
  applied: AppliedResult | null;
  verification: VerificationResult | null;
  exported: ExportResult | null;
  disclosures: DisclosureRequest[];
  confirms: ConfirmRequest[];
  selection: TextSelection | null;
  /**
   * When on, previews carry no surrounding context at all — only the entity
   * type. Defence in depth for the reviewer who does not want the agent to see
   * even the words around a redaction.
   */
  strictPreviews: boolean;
  /**
   * Set by preview_redaction_plan. The viewer dims everything that is staying
   * and lights up what would be removed, so the reviewer is approving something
   * they have actually looked at rather than a number in a dialog.
   */
  previewing: boolean;
};

function emptyState(): State {
  return {
    doc: null,
    scanned: false,
    findings: [],
    rules: [],
    audit: [],
    applied: null,
    verification: null,
    exported: null,
    disclosures: [],
    confirms: [],
    selection: null,
    strictPreviews: false,
    previewing: false
  };
}

let state: State = emptyState();
const listeners = new Set<() => void>();

export function getState(): State {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function commit(next: State): void {
  state = next;
  for (const listener of listeners) listener();
  schedulePersist();
}

export function update(mutate: (current: State) => State): void {
  commit(mutate(state));
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
//
// The document and every decision made about it stay on the device. IndexedDB
// is the only place any of this is written; there is no backend to write to.

const STORAGE_KEY = "blindfold:session:v1";

type Persisted = Omit<
  State,
  "disclosures" | "confirms" | "selection"
>;

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
  if (typeof indexedDB === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const { disclosures, confirms, selection, ...rest } = state;
    void set(STORAGE_KEY, rest satisfies Persisted).catch(() => {
      // A failed cache write must never break the workflow in progress.
    });
  }, 400);
}

export async function restore(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const saved = await get<Persisted>(STORAGE_KEY);
    if (!saved || !saved.doc) return false;
    commit({ ...emptyState(), ...saved });
    return true;
  } catch {
    return false;
  }
}

export function resetSession(): void {
  for (const request of state.disclosures) {
    request.settle({ granted: false, reason: "The session was reset." });
  }
  for (const request of state.confirms) request.settle(false);
  commit(emptyState());
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export function stageOf(current: State = state): Stage {
  if (!current.doc) return "no_document";
  if (!current.scanned) return "document_open";
  if (current.verification?.clean) return "verified";
  if (current.applied) return "applied";
  return "scanned";
}

export function planCounts(current: State = state): {
  redact: number;
  keep: number;
  unreviewed: number;
} {
  const counts = { redact: 0, keep: 0, unreviewed: 0 };
  for (const finding of current.findings) counts[finding.status] += 1;
  return counts;
}

export function findingById(id: string, current: State = state): Finding | undefined {
  return current.findings.find((finding) => finding.id === id);
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export function record(actor: Actor, action: string, detail: string): void {
  const entry: AuditEntry = {
    at: new Date().toISOString(),
    actor,
    action,
    detail
  };
  update((current) => ({ ...current, audit: [...current.audit, entry] }));
}

// ---------------------------------------------------------------------------
// Document operations
// ---------------------------------------------------------------------------

export function openDocument(doc: LoadedDocument, actor: Actor): void {
  commit({
    ...emptyState(),
    doc,
    audit: [
      ...state.audit,
      {
        at: new Date().toISOString(),
        actor,
        action: "open_document",
        detail: `${doc.title} (${doc.pages.length} pages)`
      }
    ]
  });
}

export function scan(actor: Actor): Finding[] {
  const doc = state.doc;
  if (!doc) return [];
  const findings = detectInPages(doc.pages);

  // A scan mints new ids, so everything downstream of the last one is about
  // findings that no longer exist: the rules, the plan, the application, the
  // proof and the export all describe a set that has just been thrown away.
  // Keep any of it and the header goes on saying "verified — safe to export"
  // over a document with nothing marked for redaction — the same badge lying
  // that withPlanChange exists to stop, reached through another door.
  //
  // The rules go with the rest rather than being re-run against the new
  // findings. A person approved a plan of specific values; silently rebuilding
  // one they have not seen is the sort of decision this application does not
  // take on its own.
  const discarded =
    state.rules.length > 0 || state.applied !== null || state.verification !== null;

  update((current) => ({
    ...current,
    findings,
    scanned: true,
    rules: [],
    applied: null,
    verification: null,
    exported: null,
    previewing: false
  }));
  record(
    actor,
    "scan_for_sensitive_data",
    `${findings.length} candidate values across ${doc.pages.length} pages` +
      (discarded ? " — earlier rules, plan and proof discarded" : "")
  );
  return findings;
}

// ---------------------------------------------------------------------------
// Plan operations
// ---------------------------------------------------------------------------

/** The ids the current plan would remove. */
function redactIds(current: State): Set<string> {
  return new Set(
    current.findings.filter((finding) => finding.status === "redact").map((finding) => finding.id)
  );
}

/**
 * A proof is about a specific set of values. Change which values are being
 * removed and the proof stops covering the plan, so it has to go, along with any
 * export made under it. Without this the header keeps saying "verified" over a
 * plan that has since grown — a badge claiming a proof it no longer has, which
 * is the exact failure this project exists to rule out. Re-marking findings that
 * were already in the plan changes nothing and leaves the proof standing.
 */
function withPlanChange(current: State, next: State): State {
  if (!current.verification && !current.exported) return next;
  const before = redactIds(current);
  const after = redactIds(next);
  if (before.size === after.size && [...after].every((id) => before.has(id))) return next;
  return { ...next, verification: null, exported: null };
}

export function setStatuses(
  ids: string[],
  status: Exclude<FindingStatus, "unreviewed">,
  actor: Actor,
  ruleId: string | null = null
): { updated: string[]; unknown: string[] } {
  const known = new Set(state.findings.map((finding) => finding.id));
  const updated = ids.filter((id) => known.has(id));
  const unknown = ids.filter((id) => !known.has(id));
  if (updated.length === 0) return { updated, unknown };

  const target = new Set(updated);
  update((current) =>
    withPlanChange(current, {
      ...current,
      findings: current.findings.map((finding) =>
        target.has(finding.id)
          ? { ...finding, status, decidedBy: actor, ruleId }
          : finding
      )
    })
  );
  return { updated, unknown };
}

export function addRule(
  rule: Omit<RedactionRule, "id">
): { rule: RedactionRule; matched: string[] } {
  const id = `r${state.rules.length + 1}`;
  const full: RedactionRule = { ...rule, id };

  const matched = state.findings
    .filter((finding) => {
      if (rule.types.length > 0 && !rule.types.includes(finding.type)) return false;
      if (rule.pages.length > 0 && !rule.pages.includes(finding.page)) return false;
      return true;
    })
    .map((finding) => finding.id);

  update((current) => ({ ...current, rules: [...current.rules, full] }));
  setStatuses(matched, rule.action, rule.createdBy, id);
  record(
    rule.createdBy,
    "add_redaction_rule",
    `${full.label} — matched ${matched.length} findings`
  );
  return { rule: full, matched };
}

/** Adds a finding for text the human highlighted in the viewer. */
export function addManualFinding(
  selection: TextSelection,
  type: EntityType,
  actor: Actor
): Finding {
  const id = `m${state.findings.filter((f) => f.id.startsWith("m")).length + 1}`;
  const finding: Finding = {
    id,
    type,
    page: selection.page,
    start: selection.start,
    end: selection.end,
    value: selection.text,
    confidence: 1,
    status: "redact",
    decidedBy: actor,
    ruleId: null,
    disclosed: false
  };
  update((current) =>
    withPlanChange(current, { ...current, findings: [...current.findings, finding] })
  );
  record(actor, "redact_selection", `${type} on page ${selection.page}`);
  return finding;
}

export function setSelection(selection: TextSelection | null): void {
  update((current) => ({ ...current, selection }));
}

export function setPreviewing(on: boolean): void {
  update((current) => ({ ...current, previewing: on }));
}

export function setStrictPreviews(on: boolean): void {
  update((current) => ({ ...current, strictPreviews: on }));
  record("human", "set_strict_previews", on ? "on" : "off");
}

// ---------------------------------------------------------------------------
// Disclosure gate
// ---------------------------------------------------------------------------

const DISCLOSURE_TIMEOUT_MS = 120_000;
let requestCounter = 0;

/**
 * Suspends until a human answers in the UI. There is no way for an agent to
 * read a sensitive value that does not pass through here.
 */
export function requestDisclosure(
  findingId: string,
  reason: string,
  signal?: AbortSignal
): Promise<DisclosureOutcome> {
  return new Promise<DisclosureOutcome>((resolve) => {
    requestCounter += 1;
    const id = `d${requestCounter}`;
    let done = false;

    const finish = (outcome: DisclosureOutcome) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      update((current) => ({
        ...current,
        disclosures: current.disclosures.filter((request) => request.id !== id)
      }));
      resolve(outcome);
    };

    const onAbort = () =>
      finish({ granted: false, reason: "The agent cancelled the request." });

    const timer = setTimeout(
      () =>
        finish({
          granted: false,
          reason:
            "No answer from the reviewer within two minutes. The value was not disclosed."
        }),
      DISCLOSURE_TIMEOUT_MS
    );

    signal?.addEventListener("abort", onAbort, { once: true });

    const request: DisclosureRequest = {
      id,
      findingId,
      reason,
      requestedAt: new Date().toISOString(),
      settle: finish
    };

    update((current) => ({
      ...current,
      disclosures: [...current.disclosures, request]
    }));
    record("agent", "request_disclosure", `${findingId} — ${reason}`);
  });
}

export function answerDisclosure(id: string, grant: boolean, denialReason?: string): void {
  const request = state.disclosures.find((entry) => entry.id === id);
  if (!request) return;
  const finding = findingById(request.findingId);

  if (!grant || !finding) {
    record("human", "deny_disclosure", request.findingId);
    request.settle({
      granted: false,
      reason:
        denialReason ??
        "The reviewer declined to disclose this value. Work from the type and position instead, or explain why the value is needed and ask again."
    });
    return;
  }

  update((current) => ({
    ...current,
    findings: current.findings.map((entry) =>
      entry.id === finding.id ? { ...entry, disclosed: true } : entry
    )
  }));
  record("human", "grant_disclosure", `${finding.id} (${finding.type})`);
  request.settle({ granted: true, value: finding.value });
}

// ---------------------------------------------------------------------------
// Confirmation gate for irreversible operations
// ---------------------------------------------------------------------------

const CONFIRM_TIMEOUT_MS = 180_000;

export function requestConfirmation(
  kind: ConfirmKind,
  headline: string,
  details: string[],
  signal?: AbortSignal
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    requestCounter += 1;
    const id = `c${requestCounter}`;
    let done = false;

    const finish = (approved: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      update((current) => ({
        ...current,
        confirms: current.confirms.filter((request) => request.id !== id)
      }));
      resolve(approved);
    };

    const onAbort = () => finish(false);
    const timer = setTimeout(() => finish(false), CONFIRM_TIMEOUT_MS);
    signal?.addEventListener("abort", onAbort, { once: true });

    update((current) => ({
      ...current,
      confirms: [
        ...current.confirms,
        { id, kind, headline, details, requestedAt: new Date().toISOString(), settle: finish }
      ]
    }));
    record("agent", `request_confirmation:${kind}`, headline);
  });
}

export function answerConfirmation(id: string, approved: boolean): void {
  const request = state.confirms.find((entry) => entry.id === id);
  if (!request) return;
  record("human", approved ? "approve" : "reject", `${request.kind} — ${request.headline}`);
  request.settle(approved);
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export function setApplied(result: AppliedResult): void {
  update((current) => ({ ...current, applied: result, verification: null, exported: null }));
}

export function setVerification(result: VerificationResult): void {
  update((current) => ({ ...current, verification: result }));
}

export function setExported(result: ExportResult): void {
  update((current) => ({ ...current, exported: result }));
}
