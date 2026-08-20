import type { DispositionMap, SystemKey, TaskDef, WorkstreamKey } from "./types";

/*
 * Task library.
 *
 * Source of truth: EHR 360 Implementation Playbook v3, Section 3–12 master
 * schedule (task, owner, T-week target), merged with the systems-disposition
 * scoping and gap tasks from the v1 planner. `dueWeek` is the playbook target
 * in weeks before go-live; `dueDays` overrides it for cutover-week precision.
 *
 * Dependencies (`deps`) are limited to relationships that clearly exist.
 * Where the true relationship is unclear the task is left unchained and is
 * anchored to its T-week target only.
 */

const mv = (k: SystemKey) => (m: DispositionMap) => m[k] === "move";
const stays = (k: SystemKey) => (m: DispositionMap) => m[k] === "stay";
const anyMove = (m: DispositionMap) => Object.values(m).some((v) => v === "move");
const any = (...fns: ((m: DispositionMap) => boolean)[]) => (m: DispositionMap) => fns.some((f) => f(m));
const all = (...fns: ((m: DispositionMap) => boolean)[]) => (m: DispositionMap) => fns.every((f) => f(m));

export const WORKSTREAMS: { k: WorkstreamKey; label: string; color: string }[] = [
  { k: "setup", label: "Practice & user setup", color: "#2A6F97" },
  { k: "clinical", label: "Clinical configuration", color: "#5C6E2F" },
  { k: "training", label: "Training", color: "#7A3E7E" },
  { k: "fax", label: "Fax & telephony", color: "#946200" },
  { k: "payments", label: "Payments — Sola", color: "#3E6B48" },
  { k: "epx", label: "e-Prescribing — ePx", color: "#8A3A5B" },
  { k: "billing", label: "Billing & clearinghouse", color: "#0B6E6E" },
  { k: "credentialing", label: "Credentialing", color: "#6E3B0B" },
  { k: "data", label: "Data migration", color: "#8A5A1E" },
  { k: "rita", label: "Rita — practice rules", color: "#4A5FA5" },
  { k: "golive", label: "Cutover week", color: "#A82F0E" },
  { k: "stabilization", label: "Hypercare & stabilization", color: "#6B5FA8" },
];

export const TASKS: TaskDef[] = [
  /* ---------------- Practice, provider & user setup — §3 ---------------- */
  { id: "SU1", workstream: "setup", title: "Issue the customer document request package and roster template", owner: "EHR Team", dueWeek: 8, days: 2, when: anyMove, ref: "§3.3" },
  { id: "SU2", workstream: "setup", title: "Return completed practice information sheet and provider roster", owner: "Customer", dueWeek: 7, days: 5, deps: ["SU1"], when: anyMove, ref: "§3.3",
    note: "Hard gate on the rest of the build — nothing is configured until practice and provider records exist." },
  { id: "SU3", workstream: "setup", title: "Provision the practice tenant, environment, and database", owner: "EHR Team", dueWeek: 7, days: 3, when: any(mv("clinical"), mv("sched"), mv("claims")), ref: "§3.3" },
  { id: "SU4", workstream: "setup", title: "Build locations, departments, and Place of Service mapping", owner: "EHR Team", dueWeek: 6, days: 4, deps: ["SU2"], when: any(mv("clinical"), mv("sched"), mv("claims")), ref: "§3.3" },
  { id: "SU5", workstream: "setup", title: "Build provider records with NPI, DEA, license, taxonomy, and PTAN", owner: "EHR Team", dueWeek: 6, days: 4, deps: ["SU2"], when: any(mv("clinical"), mv("sched"), mv("claims")), ref: "§3.3" },
  { id: "SU6", workstream: "setup", title: "Supply full staff list with names, emails, roles, and site assignment", owner: "Customer", dueWeek: 6, days: 4, when: anyMove, ref: "§3.3 / §5.3" },
  { id: "SU7", workstream: "setup", title: "Create user accounts and assign role-based security profiles", owner: "EHR Team", dueWeek: 5, days: 3, deps: ["SU6"], when: anyMove, ref: "§3.3" },
  { id: "SU8", workstream: "setup", title: "Confirm role permissions and approve the security matrix", owner: "Customer", dueWeek: 5, days: 2, deps: ["SU7"], when: anyMove, ref: "§3.3" },
  { id: "SU9", workstream: "setup", title: "Build provider schedule templates, sessions, blocks, and holiday calendar", owner: "EHR Team", dueWeek: 4, days: 5, when: mv("sched"), ref: "§3.3" },
  { id: "SU10", workstream: "setup", title: "Configure patient portal branding, self-scheduling rules, and intake forms", owner: "EHR Team", dueWeek: 3, days: 5, when: mv("portal"), ref: "§3.3",
    note: "Patients do not carry portal accounts across. Plan the re-invite wave." },

  /* ---------------- Clinical configuration — §4 ---------------- */
  { id: "CL1", workstream: "clinical", title: "Provide sample notes (3–5 per provider, de-identified) from the legacy system", owner: "Customer", dueWeek: 7, days: 5, when: mv("clinical"), ref: "§4.5" },
  { id: "CL2", workstream: "clinical", title: "Provide the current visit type list with durations and scheduling rules", owner: "Customer", dueWeek: 7, days: 3, when: any(mv("sched"), mv("clinical")), ref: "§4.5" },
  { id: "CL3", workstream: "clinical", title: "Provide the in-office procedure list with CPT codes", owner: "Customer", dueWeek: 7, days: 3, when: any(mv("clinical"), mv("claims")), ref: "§4.5" },
  { id: "CL4", workstream: "clinical", title: "Provide the CPT and ICD-10 preference lists / superbill in use", owner: "Customer", dueWeek: 7, days: 3, when: mv("claims"), ref: "§4.5" },
  { id: "CL5", workstream: "clinical", title: "Export the existing .phrases / macro library from the legacy system", owner: "Customer", dueWeek: 6, days: 5, when: mv("clinical"), ref: "§4.5", note: "Where an export is available." },
  { id: "CL6", workstream: "clinical", title: "Build the service type catalog", owner: "EHR Team", dueWeek: 6, days: 4, deps: ["CL2"], when: any(mv("sched"), mv("clinical")), ref: "§4.5",
    note: "Service types come first — visit types are mapped to them." },
  { id: "CL7", workstream: "clinical", title: "Build visit types mapped to service type, duration, template, and charge list", owner: "EHR Team", dueWeek: 5, days: 5, deps: ["CL6"], when: any(mv("sched"), mv("clinical")), ref: "§4.5" },
  { id: "CL8", workstream: "clinical", title: "Build provider note templates by specialty and by provider", owner: "EHR Team", dueWeek: 5, durKey: "noteTemplates", deps: ["CL1"], when: mv("clinical"), ref: "§4.5",
    note: "Built from the practice's actual documentation, not a generic default set." },
  { id: "CL9", workstream: "clinical", title: "Build the shared practice .phrases library and load provider-personal .phrases", owner: "EHR Team", dueWeek: 4, days: 7, when: mv("clinical"), ref: "§4.5" },
  { id: "CL10", workstream: "clinical", title: "Build charge preference lists, order sets, and favorite labs and imaging", owner: "EHR Team", dueWeek: 4, days: 5, when: any(mv("clinical"), mv("claims")), ref: "§4.5" },
  { id: "CL11", workstream: "clinical", title: "Configure lab interfaces — account numbers for each reference lab", owner: "Joint", dueWeek: 4, days: 10, when: mv("labs"), ref: "§4.5",
    note: "Standard labs interface path is an open question (lifecycle Q7). Confirm per lab vendor." },
  { id: "CL12", workstream: "clinical", title: "Configure document and fax routing rules, inbox queues, and result routing", owner: "EHR Team", dueWeek: 3, days: 3, when: any(mv("clinical"), mv("fax")), ref: "§4.5" },
  { id: "CL13", workstream: "clinical", title: "Provider review and sign-off on note templates and .phrases", owner: "Customer", dueWeek: 3, days: 4, deps: ["CL8"], when: mv("clinical"), ref: "§4.5" },
  { id: "CL14", workstream: "clinical", title: "Apply revisions from provider review", owner: "EHR Team", dueWeek: 2, days: 4, deps: ["CL13"], when: mv("clinical"), ref: "§4.5" },

  /* ---------------- Training — §5 ---------------- */
  { id: "TR1", workstream: "training", title: "Identify and name at least one super user per site", owner: "Customer", dueWeek: 6, days: 3, when: anyMove, ref: "§5.3" },
  { id: "TR2", workstream: "training", title: "Provide outside billing company contact, BAA, scope of work, and user list", owner: "Customer", dueWeek: 6, days: 5, when: all(mv("claims"), stays("rcm")), ref: "§5.2",
    note: "The outside biller is a project stakeholder, not an afterthought. BAA before any access." },
  { id: "TR3", workstream: "training", title: "Publish the training calendar and send calendar invitations", owner: "EHR Team", dueWeek: 4, days: 2, when: anyMove, ref: "§5.3" },
  { id: "TR4", workstream: "training", title: "Block protected training time and confirm staff coverage", owner: "Customer", dueWeek: 4, days: 3, when: anyMove, ref: "§5.3" },
  { id: "TR5", workstream: "training", title: "Load the training environment with practice-specific configuration and sample patients", owner: "EHR Team", dueWeek: 4, days: 3, when: anyMove, ref: "§5.3",
    note: "Train in a sandbox of the live environment where possible — demo environments drift." },
  { id: "TR6", workstream: "training", title: "Deliver role-based training: provider, MA/clinical, front desk, biller", owner: "EHR Team", dueWeek: 2, durKey: "training", deps: ["TR5"], when: anyMove, ref: "§5.1/5.3",
    note: "Scheduled in the three weeks before go-live, never in the final three days. Provider sessions first — highest risk, lowest availability." },
  { id: "TR7", workstream: "training", title: "Deliver super user and admin training", owner: "EHR Team", dueWeek: 2, days: 3, when: anyMove, ref: "§5.3" },
  { id: "TR8", workstream: "training", title: "Distribute quick reference guides, recorded sessions, and workflow one-pagers", owner: "EHR Team", dueWeek: 2, days: 2, when: anyMove, ref: "§5.3" },
  { id: "TR9", workstream: "training", title: "Complete post-training competency check; identify make-up needs", owner: "Joint", dueWeek: 1, days: 3, deps: ["TR6"], when: anyMove, ref: "§5.3" },
  { id: "TR10", workstream: "training", title: "Deliver make-up and refresher sessions", owner: "EHR Team", dueWeek: 1, days: 3, deps: ["TR9"], when: anyMove, ref: "§5.3" },

  /* ---------------- Fax & telephony — RingCentral — §6 ---------------- */
  { id: "FX1", workstream: "fax", title: "Inventory all phone and fax numbers; confirm which will port", owner: "Joint", dueWeek: 8, days: 3, when: mv("fax"), ref: "§6.2" },
  { id: "FX2", workstream: "fax", title: "Request the CSR from the current carrier", owner: "Customer", dueWeek: 8, days: 5, when: mv("fax"), ref: "§6.2" },
  { id: "FX3", workstream: "fax", title: "Provide CSR, signed LOA, recent bill, account number, PIN, and exact service address", owner: "Customer", dueWeek: 7, days: 5, deps: ["FX2"], when: mv("fax"), ref: "§6.2",
    note: "Service-address mismatch against the carrier record is the most common port rejection." },
  { id: "FX4", workstream: "fax", title: "Submit the port order to RingCentral", owner: "EHR Team", dueWeek: 7, days: 2, deps: ["FX3"], when: mv("fax"), ref: "§6.2" },
  { id: "FX5", workstream: "fax", title: "Provision the RingCentral account, extensions, and interim numbers", owner: "EHR Team", dueWeek: 6, days: 5, when: mv("fax"), ref: "§6.2" },
  { id: "FX6", workstream: "fax", title: "Track the port to Firm Order Commitment; resolve rejections", owner: "EHR Team", dueWeek: 2, durKey: "faxPort", deps: ["FX4"], when: mv("fax"), ref: "§6.2",
    note: "Do NOT let the practice cancel the losing carrier before the port completes — cancellation releases the number." },
  { id: "FX7", workstream: "fax", title: "Configure the ported number as outbound caller ID", owner: "EHR Team", dueWeek: 2, days: 2, deps: ["FX6"], when: mv("fax"), ref: "§6.2" },
  { id: "FX8", workstream: "fax", title: "Configure inbound fax delivery into the EHR 360 inbox and routing queues", owner: "EHR Team", dueWeek: 2, days: 3, when: mv("fax"), ref: "§6.2" },
  { id: "FX9", workstream: "fax", title: "Configure fax cover sheet, outbound fax from the chart, and confirmations", owner: "EHR Team", dueWeek: 2, days: 2, when: mv("fax"), ref: "§6.2" },
  { id: "FX10", workstream: "fax", title: "Configure call routing, auto-attendant, ring groups, voicemail, after-hours", owner: "EHR Team", dueWeek: 2, days: 3, when: mv("fax"), ref: "§6.2" },
  { id: "FX11", workstream: "fax", title: "Test inbound fax to every queue and outbound fax from within a chart", owner: "Joint", dueWeek: 1, days: 2, deps: ["FX7", "FX8"], when: mv("fax"), ref: "§6.2" },
  { id: "FX12", workstream: "fax", title: "Test outbound calling and confirm correct caller ID", owner: "Joint", dueWeek: 1, days: 1, deps: ["FX7"], when: mv("fax"), ref: "§6.2" },

  /* ---------------- Payments — Sola — §7 ---------------- */
  { id: "PA1", workstream: "payments", title: "Confirm payment scope, POS terminal need, and site count", owner: "Joint", dueWeek: 8, days: 3, when: mv("pay"), ref: "§7.3" },
  { id: "PA2", workstream: "payments", title: "Document pricing in writing and obtain practice acknowledgment", owner: "EHR Team", dueWeek: 8, days: 3, when: mv("pay"), ref: "§7.2",
    note: "Rate structure, per-transaction, monthly, terminal, chargeback, PCI — in writing before signature." },
  { id: "PA3", workstream: "payments", title: "Provide bank account owner name and application email address", owner: "Customer", dueWeek: 8, days: 2, when: mv("pay"), ref: "§7.1",
    note: "Only two items needed — the application can go out in week one." },
  { id: "PA4", workstream: "payments", title: "Send the Sola application to the practice", owner: "EHR Team", dueWeek: 8, days: 1, deps: ["PA3"], when: mv("pay"), ref: "§7.3" },
  { id: "PA5", workstream: "payments", title: "Complete and submit the Sola application directly to Sola", owner: "Customer", dueWeek: 6, days: 5, deps: ["PA4"], when: mv("pay"), ref: "§7.3" },
  { id: "PA6", workstream: "payments", title: "Track merchant underwriting to approval", owner: "EHR Team", dueWeek: 3, durKey: "underwriting", deps: ["PA5"], when: mv("pay"), ref: "§7.3" },
  { id: "PA7", workstream: "payments", title: "Order POS terminals in the confirmed quantity per location", owner: "EHR Team", dueWeek: 3, days: 2, deps: ["PA6"], when: mv("pay"), ref: "§7.3",
    note: "Merchant approval gates terminal ordering." },
  { id: "PA8", workstream: "payments", title: "Receive terminals, confirm delivery, and stage them at each site", owner: "Joint", dueWeek: 2, days: 5, deps: ["PA7"], when: mv("pay"), ref: "§7.3" },
  { id: "PA9", workstream: "payments", title: "Configure the Sola integration and map to payment posting", owner: "EHR Team", dueWeek: 2, days: 3, deps: ["PA6"], when: mv("pay"), ref: "§7.3" },
  { id: "PA10", workstream: "payments", title: "Configure copay collection, card-on-file, and payment plans", owner: "EHR Team", dueWeek: 2, days: 3, when: mv("pay"), ref: "§7.3" },
  { id: "PA11", workstream: "payments", title: "Run a live test transaction, void, and refund; confirm posting", owner: "Joint", dueWeek: 1, days: 2, deps: ["PA8", "PA9"], when: mv("pay"), ref: "§7.3" },
  { id: "PA12", workstream: "payments", title: "Confirm the first settlement deposits to the practice bank account", owner: "Joint", dueWeek: 1, days: 2, deps: ["PA11"], when: mv("pay"), ref: "§7.3" },
  { id: "PA13", workstream: "payments", title: "Train front desk on terminals, receipts, and end-of-day reconciliation", owner: "EHR Team", dueWeek: 1, days: 2, deps: ["PA8"], when: mv("pay"), ref: "§7.3" },

  /* ---------------- e-Prescribing — ePx — §8 ---------------- */
  { id: "EP1", workstream: "epx", title: "Collect the prescriber roster: names, NPIs, DEAs, cell phones, emails", owner: "Customer", dueWeek: 7, days: 5, when: mv("erx"), ref: "§8.2",
    note: "Legal name exactly as registered with the DEA. Cell phone required for identity proofing." },
  { id: "EP2", workstream: "epx", title: "Create ePx accounts for every prescriber and prescribing agent", owner: "EHR Team", dueWeek: 6, days: 3, deps: ["EP1"], when: mv("erx"), ref: "§8.2" },
  { id: "EP3", workstream: "epx", title: "Schedule identity proofing sessions with each provider individually", owner: "EHR Team", dueWeek: 6, days: 3, deps: ["EP2"], when: mv("erx"), ref: "§8.2" },
  { id: "EP4", workstream: "epx", title: "Every provider completes identity proofing personally; track to 100%", owner: "Customer", dueWeek: 4, durKey: "epxProofing", deps: ["EP3"], when: mv("erx"), ref: "§8.2",
    note: "Cannot be done on the provider's behalf. Zero tolerance for slippage — a provider who cannot prescribe on day one cannot see patients." },
  { id: "EP5", workstream: "epx", title: "Enable EPCS; issue and register the second authentication factor", owner: "EHR Team", dueWeek: 4, days: 5, deps: ["EP4"], when: mv("erx"), ref: "§8.2",
    note: "Hardware tokens ship physically." },
  { id: "EP6", workstream: "epx", title: "Two designated administrators complete EPCS logical access control", owner: "Customer", dueWeek: 3, days: 2, deps: ["EP5"], when: mv("erx"), ref: "§8.2" },
  { id: "EP7", workstream: "epx", title: "Confirm PDMP registration and configure access where integrated", owner: "Joint", dueWeek: 3, days: 3, when: mv("erx"), ref: "§8.2" },
  { id: "EP8", workstream: "epx", title: "Configure prescriber-agent relationships and refill request routing", owner: "EHR Team", dueWeek: 3, days: 2, when: mv("erx"), ref: "§8.2" },
  { id: "EP9", workstream: "epx", title: "Load pharmacy directory, preferred pharmacies, formulary and benefit checking", owner: "EHR Team", dueWeek: 3, days: 3, when: mv("erx"), ref: "§8.2" },
  { id: "EP10", workstream: "epx", title: "Enable medication history retrieval and consent handling", owner: "EHR Team", dueWeek: 3, days: 2, when: mv("erx"), ref: "§8.2" },
  { id: "EP11", workstream: "epx", title: "Send test prescriptions per prescriber, incl. one controlled where EPCS", owner: "Joint", dueWeek: 2, days: 3, deps: ["EP4", "EP6"], when: mv("erx"), ref: "§8.2" },
  { id: "EP12", workstream: "epx", title: "Verify refill request inbox routing and renewal response workflow", owner: "Joint", dueWeek: 2, days: 2, when: mv("erx"), ref: "§8.2" },
  { id: "EP13", workstream: "epx", title: "Confirm every prescriber transmits successfully before go-live approval", owner: "EHR Team", dueWeek: 1, days: 2, deps: ["EP11"], when: mv("erx"), ref: "§8.2" },

  /* ---------------- Billing, clearinghouse & revenue cycle — §9 ---------------- */
  { id: "BL1", workstream: "billing", title: "Provide the payer and credentialing list with effective dates and provider-level status", owner: "Customer", dueWeek: 8, days: 5, when: any(mv("claims"), mv("remit")), ref: "§9.3" },
  { id: "BL2", workstream: "billing", title: "Set up the practice on the clearinghouse and obtain submitter credentials", owner: "EHR Team", dueWeek: 8, days: 5, when: mv("claims"), ref: "§9.3" },
  { id: "BL3", workstream: "billing", title: "837 claim enrollment, every payer — begin at kickoff", owner: "EHR Team", dueWeek: 1, durKey: "edi837", deps: ["BL1", "BL2"], when: mv("claims"), ref: "§9.3",
    note: "The single longest-lead item. Starts week one, before the build and before training. Track per payer in the enrollment tracker." },
  { id: "BL4", workstream: "billing", title: "835 ERA enrollment, every payer", owner: "EHR Team", dueWeek: 1, durKey: "edi835", deps: ["BL1", "BL2"], when: mv("remit"), ref: "§9.3",
    note: "ERA approval trails claim approval by weeks. Redirect existing ERA destinations explicitly." },
  { id: "BL5", workstream: "billing", title: "EFT and bank deposit enrollment", owner: "Joint", dueWeek: 1, durKey: "eft", deps: ["BL1"], when: mv("remit"), ref: "§9.3" },
  { id: "BL6", workstream: "billing", title: "Sign all payer enrollment forms and EDI agreements", owner: "Customer", dueWeek: 7, days: 5, when: any(mv("claims"), mv("remit")), ref: "§9.3" },
  { id: "BL7", workstream: "billing", title: "Track enrollment approvals payer by payer; escalate stalls (weekly)", owner: "EHR Team", dueWeek: 1, days: 5, when: any(mv("claims"), mv("remit")), ref: "§9.3" },
  { id: "BL8", workstream: "billing", title: "Flag payers with incomplete credentialing; agree a hold-billing plan", owner: "Joint", dueWeek: 6, days: 3, when: mv("claims"), ref: "§9.3" },
  { id: "BL9", workstream: "billing", title: "Configure the clearinghouse connection in EHR 360 and map payer IDs", owner: "EHR Team", dueWeek: 4, days: 5, deps: ["BL2"], when: mv("claims"), ref: "§9.3" },
  { id: "BL10", workstream: "billing", title: "Load contracted fee schedules and expected allowed amounts", owner: "EHR Team", dueWeek: 4, days: 5, when: mv("claims"), ref: "§9.3" },
  { id: "BL11", workstream: "billing", title: "Configure claim scrubbing rules, edits, and the rejection work queue", owner: "EHR Team", dueWeek: 3, days: 5, when: mv("claims"), ref: "§9.3" },
  { id: "BL12", workstream: "billing", title: "Configure ERA auto-posting rules, adjustment mapping, and denial routing", owner: "EHR Team", dueWeek: 3, days: 5, when: mv("remit"), ref: "§9.3" },
  { id: "BL13", workstream: "billing", title: "Test real-time eligibility against each major payer", owner: "Joint", dueWeek: 3, days: 3, when: mv("elig"), ref: "§9.3" },
  { id: "BL14", workstream: "billing", title: "Configure patient statements, statement cycle, and text-to-pay", owner: "EHR Team", dueWeek: 2, days: 3, when: mv("claims"), ref: "§9.3" },
  { id: "BL15", workstream: "billing", title: "Submit a test claim batch and confirm clean acceptance end to end", owner: "EHR Team", dueWeek: 2, days: 5, deps: ["BL9"], when: mv("claims"), ref: "§9.3",
    note: "Acceptance at the clearinghouse is not acceptance at the payer." },
  { id: "BL16", workstream: "billing", title: "Agree the legacy A/R plan — who works it, in which system, for how long", owner: "Joint", dueWeek: 2, days: 3, when: mv("claims"), ref: "§9.3",
    note: "OPEN QUESTION: no standard answer exists. Claims in flight do not migrate; two systems run in parallel, possibly 90+ days." },

  /* ---------------- Credentialing (new group NPI) ---------------- */
  { id: "CR1", workstream: "credentialing", title: "CAQH refresh and roster attestation", owner: "Customer", dueWeek: 8, days: 10, when: mv("cred"), ref: "Lifecycle Step 1" },
  { id: "CR2", workstream: "credentialing", title: "Group NPI and payer credentialing applications, tracked to approval", owner: "EHR Team", dueWeek: 3, durKey: "credentialing", deps: ["CR1"], when: mv("cred"), ref: "Lifecycle Step 1",
    note: "Commercial payers run 90–180 days and cannot be compressed. If this is in scope, the go-live date is set by credentialing, not the reverse." },

  /* ---------------- Data migration — §10 ---------------- */
  { id: "DM1", workstream: "data", title: "Confirm legacy vendor export capability, cost, and notice period", owner: "Customer", dueWeek: 8, days: 5, when: any(mv("clinical"), mv("hist")), ref: "§10.3" },
  { id: "DM2", workstream: "data", title: "Secure legacy data access: export format spec and sample file delivered", owner: "Customer", dueWeek: 7, durKey: "legacyExtract", deps: ["DM1"], when: any(mv("clinical"), mv("hist")), ref: "§10.3",
    note: "The hardest gate in the project. Vendor-dependent, historically the largest variance. Nothing downstream is real until this lands." },
  { id: "DM3", workstream: "data", title: "Agree and document migration scope — discrete versus PDF, by data element", owner: "Joint", dueWeek: 6, days: 5, when: any(mv("clinical"), mv("hist")), ref: "§10.2",
    note: "OPEN QUESTION: discrete vs PDF notes depends on the source EMR and determines whether staff re-key history after go-live. Must be known before it is promised." },
  { id: "DM4", workstream: "data", title: "Set and confirm in writing the test export date and production export date", owner: "Joint", dueWeek: 6, days: 3, when: any(mv("clinical"), mv("hist")), ref: "§10.3" },
  { id: "DM5", workstream: "data", title: "Build the field mapping specification and code crosswalks", owner: "EHR Team", dueWeek: 5, days: 7, deps: ["DM2"], when: any(mv("clinical"), mv("hist")), ref: "§10.3",
    note: "Legacy data access gates field mapping." },
  { id: "DM6", workstream: "data", title: "Consolidate the legacy payer table before import", owner: "EHR Team", dueWeek: 4, days: 5, when: all(any(mv("clinical"), mv("hist")), any(mv("claims"), mv("remit"))), ref: "Lifecycle Step 8",
    note: "Legacy payer tables commonly hold multiple name variants per payer ID (Neuro Heart: 79 variants for 52 IDs). Importing as-is breaks reporting permanently." },
  { id: "DM7", workstream: "data", title: "Deliver the test export from the legacy system", owner: "Customer", dueWeek: 5, days: 3, deps: ["DM4"], when: any(mv("clinical"), mv("hist")), ref: "§10.3" },
  { id: "DM8", workstream: "data", title: "Run the test import into the sandbox environment", owner: "EHR Team", dueWeek: 4, days: 5, deps: ["DM5", "DM7"], when: any(mv("clinical"), mv("hist")), ref: "§10.3" },
  { id: "DM9", workstream: "data", title: "Validate the test import — spot-check charts, reconcile record counts", owner: "Customer", dueWeek: 3, days: 5, deps: ["DM8"], when: any(mv("clinical"), mv("hist")), ref: "§10.3",
    note: "A provider who has not opened their own migrated chart has not validated." },
  { id: "DM10", workstream: "data", title: "Correct mapping issues from validation; re-run if required", owner: "EHR Team", dueWeek: 3, days: 3, deps: ["DM9"], when: any(mv("clinical"), mv("hist")), ref: "§10.3" },
  { id: "DM11", workstream: "data", title: "Written sign-off on the test migration", owner: "Customer", dueWeek: 2, days: 2, deps: ["DM9"], when: any(mv("clinical"), mv("hist")), ref: "§10.3",
    note: "No production import proceeds without this sign-off." },
  { id: "DM12", workstream: "data", title: "Migrate future appointments onto the new visit types", owner: "EHR Team", dueWeek: 2, days: 3, deps: ["CL7"], when: mv("sched"), ref: "§10.2",
    note: "Visit type build gates future-appointment migration." },
  { id: "DM13", workstream: "data", title: "Confirm the legacy data entry freeze time; communicate practice-wide", owner: "Joint", dueWeek: 1, days: 2, when: any(mv("clinical"), mv("hist"), mv("sched")), ref: "§10.3",
    note: "Anything entered after the freeze is re-keyed by hand on Monday." },
  { id: "DM14", workstream: "data", title: "Deliver the final production export — data available Friday", owner: "Customer", dueWeek: 0, dueDays: 3, days: 2, deps: ["DM11"], when: any(mv("clinical"), mv("hist")), ref: "§10.3" },
  { id: "DM15", workstream: "data", title: "Run the production import across the weekend; reconcile counts", owner: "EHR Team", dueWeek: 0, dueDays: 1, days: 2, deps: ["DM14"], when: any(mv("clinical"), mv("hist")), ref: "§10.3",
    note: "Friday export → weekend import → Monday open. This pattern is not negotiable without moving the go-live date." },
  { id: "DM16", workstream: "data", title: "Confirm data available and correct before Monday open", owner: "Joint", dueWeek: 0, dueDays: 1, days: 1, deps: ["DM15"], when: any(mv("clinical"), mv("hist")), ref: "§10.3" },

  /* ---------------- Rita — practice rules — §11 ---------------- */
  { id: "RT1", workstream: "rita", title: "Provide existing triage protocols, phone scripts, and scheduling rules", owner: "Customer", dueWeek: 6, days: 5, when: any(mv("sched"), mv("portal")), ref: "§11.2" },
  { id: "RT2", workstream: "rita", title: "Conduct the Rita rules discovery session with leadership and clinical staff", owner: "Joint", dueWeek: 5, days: 2, deps: ["RT1"], when: any(mv("sched"), mv("portal")), ref: "§11.2",
    note: "Source material is how the practice actually operates today, not how it would like to." },
  { id: "RT3", workstream: "rita", title: "Document the practice rule set; obtain written confirmation", owner: "EHR Team", dueWeek: 5, days: 3, deps: ["RT2"], when: any(mv("sched"), mv("portal")), ref: "§11.2" },
  { id: "RT4", workstream: "rita", title: "Configure triage logic, symptom routing, and urgency classification", owner: "EHR Team", dueWeek: 4, days: 5, deps: ["RT3"], when: any(mv("sched"), mv("portal")), ref: "§11.2" },
  { id: "RT5", workstream: "rita", title: "Configure scheduling rules, visit type routing, and provider preferences", owner: "EHR Team", dueWeek: 4, days: 5, deps: ["RT3"], when: mv("sched"), ref: "§11.2" },
  { id: "RT6", workstream: "rita", title: "Configure hours, holiday calendar, after-hours handling, on-call escalation", owner: "EHR Team", dueWeek: 4, days: 3, when: any(mv("sched"), mv("portal")), ref: "§11.2" },
  { id: "RT7", workstream: "rita", title: "Configure message queues, routing, and response-time expectations", owner: "EHR Team", dueWeek: 3, days: 3, when: mv("portal"), ref: "§11.2" },
  { id: "RT8", workstream: "rita", title: "Configure escalation paths and notification recipients", owner: "EHR Team", dueWeek: 3, days: 2, when: any(mv("sched"), mv("portal")), ref: "§11.2" },
  { id: "RT9", workstream: "rita", title: "Run scenario testing against real call and message patterns", owner: "Joint", dueWeek: 2, days: 3, deps: ["RT4"], when: any(mv("sched"), mv("portal")), ref: "§11.2" },
  { id: "RT10", workstream: "rita", title: "Practice review and sign-off on Rita rules", owner: "Customer", dueWeek: 2, days: 2, deps: ["RT9"], when: any(mv("sched"), mv("portal")), ref: "§11.2" },

  /* ---------------- Cutover week — §12.1 ---------------- */
  { id: "GL1", workstream: "golive", title: "Reduce the first-week schedule to 50–70% of normal volume", owner: "Customer", dueWeek: 2, days: 3, when: anyMove, ref: "§12.1",
    note: "Those slots are already booked — the decision must be made early enough to act on." },
  { id: "GL2", workstream: "golive", title: "Hold the go/no-go call against the readiness gate (Appendix B)", owner: "Joint", dueWeek: 0, dueDays: 5, days: 1, when: anyMove, ref: "§12.1",
    note: "Wednesday before go-live. OPEN QUESTION: the deciding authority is not named in any source document." },
  { id: "GL3", workstream: "golive", title: "Run the full dress rehearsal — schedule, check-in, document, prescribe, charge, collect, submit", owner: "Joint", dueWeek: 0, dueDays: 4, days: 2, when: anyMove, ref: "§12.1" },
  { id: "GL4", workstream: "golive", title: "Confirm all systems live: EHR, fax, phone, ePx, payments, clearinghouse", owner: "EHR Team", dueWeek: 0, dueDays: 1, days: 1, when: anyMove, ref: "§12.1" },

  /* ---------------- Hypercare & stabilization — §12.2 ---------------- */
  { id: "ST1", workstream: "stabilization", title: "Week 1: on-site/on-call support, daily huddle and end-of-day debrief", owner: "EHR Team", dueWeek: -1, days: 5, when: anyMove, ref: "§12.2" },
  { id: "ST2", workstream: "stabilization", title: "Monitor the first claim batch through clearinghouse acceptance", owner: "EHR Team", dueWeek: -1, days: 5, when: mv("claims"), ref: "§12.2" },
  { id: "ST3", workstream: "stabilization", title: "Confirm the first ERA posts correctly; reconcile to the bank deposit", owner: "EHR Team", dueWeek: -2, days: 5, when: mv("remit"), ref: "§12.2",
    note: "The first 835 posting run is where enrollment gaps finally show up." },
  { id: "ST4", workstream: "stabilization", title: "Weeks 2–4: check-ins, template and .phrase refinement, Rita tuning", owner: "EHR Team", dueWeek: -4, days: 14, when: anyMove, ref: "§12.2" },
  { id: "ST5", workstream: "stabilization", title: "Implementation review, open-issue handoff, transition to standard support", owner: "Joint", dueWeek: -4, days: 3, when: anyMove, ref: "§12.2",
    note: "Planned-vs-actual by step feeds back into the duration assumptions — this is how estimates become observed data." },
  { id: "ST6", workstream: "stabilization", title: "Monitor legacy A/R runout to zero", owner: "Joint", dueWeek: -13, days: 90, when: mv("claims"), ref: "Lifecycle Step 9",
    note: "Named owner per the legacy A/R plan. Two systems in parallel, potentially 90+ days." },
  { id: "ST7", workstream: "stabilization", title: "Verify legacy read-only access arrangement is in place as contracted", owner: "Customer", dueWeek: -1, days: 2, when: anyMove, ref: "Lifecycle Step 9",
    note: "OPEN QUESTION: duration, cost, and who pays should be a contract standard, not negotiated per deal." },
];

export const TASK_BY_ID = new Map(TASKS.map((t) => [t.id, t]));
