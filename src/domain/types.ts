/* Core domain types for the cutover planner. */

export type SystemKey =
  | "clinical" | "sched" | "claims" | "remit" | "elig" | "pay" | "hist"
  | "erx" | "labs" | "portal" | "fax" | "email" | "cred" | "rcm" | "report";

export type Disposition = "move" | "stay" | "na";
export type DispositionMap = Record<SystemKey, Disposition>;

export type Owner = "EHR Team" | "Customer" | "Joint";

export type WorkstreamKey =
  | "setup" | "clinical" | "training" | "fax" | "payments" | "epx"
  | "billing" | "credentialing" | "data" | "rita" | "golive" | "stabilization";

/** Keys into the editable duration model (Settings). */
export type DurationKey =
  | "edi837" | "edi835" | "eft" | "credentialing" | "epxProofing" | "faxPort"
  | "underwriting" | "noteTemplates" | "training" | "legacyExtract" | "defaultTask";

export interface DurationSpec {
  /** Base duration, calendar days. */
  baseDays: number;
  /** Added days per unit of the scale driver. */
  perUnit?: number;
  scalesWith?: "providers" | "payers" | "staff" | "locations";
  label: string;
  note?: string;
}

export interface Scale {
  providers: number;
  locations: number;
  payers: number;
  staff: number;
}

export interface TaskDef {
  id: string;
  workstream: WorkstreamKey;
  title: string;
  owner: Owner;
  /**
   * Playbook target, in weeks before go-live the task must be DONE.
   * Negative = weeks after go-live (hypercare). Fractions allowed (0.5 = mid-week).
   */
  dueWeek: number;
  /** Precise due offset in days before go-live; overrides dueWeek (cutover week). */
  dueDays?: number;
  /** Duration model key; tasks without one use `defaultTask` unless `days` given. */
  durKey?: DurationKey;
  /** Fixed duration override in days (ignores settings). */
  days?: number;
  /** Scope condition. */
  when: (m: DispositionMap) => boolean;
  /** Predecessor task ids — only relationships that clearly exist. */
  deps?: string[];
  note?: string;
  /** Playbook section reference, e.g. "§9.3". */
  ref?: string;
}

export type TaskStatus = "pending" | "active" | "done" | "blocked" | "risk";

export type EnrollmentStatus = "none" | "submitted" | "approved";

export interface EnrollmentCell {
  status: EnrollmentStatus;
  submitted?: string; // ISO date
  approved?: string;  // ISO date
}

export interface PayerRow {
  id: string;
  name: string;
  /** Share of collections, percent 0..100. */
  share: number;
  e837: EnrollmentCell;
  e835: EnrollmentCell;
  eft: EnrollmentCell;
}

export interface Practice {
  id: string;
  name: string;
  goLive: string; // ISO date
  dispositions: DispositionMap;
  scale: Scale;
  taskStatus: Record<string, TaskStatus>;
  payers: PayerRow[];
  gateChecked: Record<string, boolean>;
  createdAt: string;
}

export interface DurationsConfig {
  [k: string]: DurationSpec;
}

export interface ScheduledTask extends TaskDef {
  durationDays: number;
  /** Days before go-live the task must start (latest start honoring deps + target). */
  startOffset: number;
  /** Days before go-live the task must be done. */
  endOffset: number;
  startDate: Date;
  endDate: Date;
  critical: boolean;
  /** True when the start was pulled earlier than the raw T-week target by a dependency chain. */
  pulledByDeps: boolean;
  status: TaskStatus;
}
