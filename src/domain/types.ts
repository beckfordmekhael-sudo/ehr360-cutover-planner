/* Core domain types — v2, per Playbook v5 and the Claude Code build brief. */

export type SystemKey =
  | "clinical" | "sched" | "claims" | "remit" | "elig" | "pay" | "hist"
  | "erx" | "labs" | "portal" | "fax" | "email" | "cred" | "rcm" | "report";

export type Disposition = "move" | "stay" | "na";
export type DispositionMap = Record<SystemKey, Disposition>;

export type Owner = "EHR" | "Cust" | "Joint";
export type Clock = "build" | "external" | "post";

/** Implementation type per v5 §2. */
export type ImplType = "A" | "B" | "C" | "D";

/** The four classification questions, answered in order at kickoff. */
export interface Classification {
  /** Q1: Is the EHR being replaced? No → Type D. */
  ehrReplaced: boolean;
  /** Q2: Does the practice hold payer contracts under this TIN? No → Type C. */
  contractsUnderTin: boolean;
  /** Q3: Already served by the RCM business (clearinghouse/telephony/payments in place)? Yes → B, No → A. */
  rcmClient: boolean;
  /** Q4: Does the submitter of record change? Yes → §11b in scope in full, whatever the type. */
  submitterChanges: boolean;
}

/** Declarative scope condition — the language of tasks.json / deliverables.json / readiness.json. */
export type Cond =
  | { always: true }
  | { anyMove: true }
  | { mixedScope: true }
  | { moves: SystemKey }
  | { stays: SystemKey }
  | { type: ImplType[] }
  | { sub11b: true }
  | { submitterChanges: true }
  | { hasPrescribers: true }
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond };

/** Evaluation context for conditions. */
export interface ScopeCtx {
  dispositions: DispositionMap;
  implType: ImplType;
  classification: Classification;
  prescribers: number;
}

export type DurationKey =
  | "edi837" | "edi835" | "eft" | "credentialing" | "epcsProofing" | "telephonyPort"
  | "underwriting" | "noteTemplates" | "training" | "legacyExtract" | "defaultTask";

export interface DurationSpec {
  baseDays: number;
  perUnit?: number;
  scalesWith?: "providers" | "payers" | "staff" | "locations" | "prescribers";
  label: string;
  note?: string;
}
export interface DurationsConfig { [k: string]: DurationSpec; }

export interface Scale {
  providers: number;
  locations: number;
  payers: number;
  prescribers: number;
  staff: number;
}

/** Task record as stored in tasks.json (data, not code). */
export interface TaskDef {
  id: string;
  stream: string;
  title: string;
  owner: Owner;
  dueWeek: number;
  dueDays?: number;
  gate?: boolean;
  clock?: Clock; // default "build"
  days?: number;
  durKey?: DurationKey;
  deps?: string[];
  applies: Cond;
  note?: string;
  ref?: string;
}

export type TaskStatus = "pending" | "active" | "done" | "blocked" | "risk";

export interface TaskProgress {
  status: TaskStatus;
  /** ISO date the task was marked done — feeds planned-vs-actual. */
  completedOn?: string;
}

export type EnrollmentStatus = "none" | "submitted" | "approved";

export interface EnrollmentCell {
  status: EnrollmentStatus;
  submitted?: string;
  approved?: string;
  /** 835 only: receiver confirmed as EHR 360. EFT only: deposit account confirmed. */
  confirmed?: boolean;
}

export interface PayerRow {
  id: string;
  name: string;
  payerId: string;
  /** Name variants observed in the legacy payer table for this payer ID. */
  variants: number;
  /** Variant collapse / clearinghouse re-map complete for this payer. */
  remapped: boolean;
  share: number;
  e837: EnrollmentCell;
  e835: EnrollmentCell;
  eft: EnrollmentCell;
}

/** The 835 cutover sequencing decision — recorded, never hard-coded (v5 §11b). */
export interface EraDecision {
  order: "" | "835-before-837" | "837-before-835" | "same-time";
  billingLead: string;
  rationale: string;
  decidedOn?: string;
}

export interface GateState {
  checked: boolean;
  evidenceRef?: string;
  /** Documented exception recorded by the named decision-maker. */
  exception?: string;
  exceptionBy?: string;
}

export interface Practice {
  id: string;
  name: string;
  goLive: string;
  classification: Classification;
  dispositions: DispositionMap;
  scale: Scale;
  progress: Record<string, TaskProgress>;
  payers: PayerRow[];
  gate: Record<string, GateState>;
  eraDecision: EraDecision;
  /** Duration assumptions PINNED at creation; "recalculate" copies current globals. */
  assumptions: DurationsConfig;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ScheduledTask extends TaskDef {
  durationDays: number;
  startOffset: number;
  endOffset: number;
  startDate: Date;
  endDate: Date;
  critical: boolean;
  pulledByDeps: boolean;
  status: TaskStatus;
  completedOn?: string;
  clockResolved: Clock;
}

export interface AuditEntry {
  id: number;
  ts: string;
  user: string;
  practiceId: string;
  summary: string;
}
