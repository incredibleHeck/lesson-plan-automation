# HeckTeck 2.0 — Enterprise Academic Operations Proposal

**Prepared for:** St. Adelaide International Schools — School Board  
**Subject:** Annual academic compliance and quality system (automation + reporting)  
**Tone:** Administrative / board-facing

---

## Executive summary

St. Adelaide runs a high-expectation academic program. Lesson plans are the operational backbone of teaching quality and regulatory assurance. Today, tracking **who submitted what**, **whether submissions are complete**, and **whether quality meets our bar** relies on manual vigilance—an approach that does not scale and leaves predictable gaps (“ghost” classes, partial weeks, inconsistent follow-up).

**HeckTeck 2.0** is a unified intake-to-insight system: teachers submit once; the system **files work**, **audits against Cambridge-aligned criteria**, **enforces the official teaching-load matrix** (what each teacher owes each week), **flags partial weekly lesson packs**, and **surfaces performance in a live dashboard** suitable for leadership and board oversight.

This proposal frames an annual investment in the **mid four figures** (e.g. **USD $1,300+** annually, inclusive of tooling, integration, and sustainment—exact line items to be confirmed with procurement) against **measurable reductions in compliance risk**, **VP/HOD time returned to instructional leadership**, and **consistent academic quality visibility** across departments.

---

## The problem (why the board should care)

1. **Compliance risk:** Missing or late plans for specific class/subject combinations can go unnoticed when reports only ask “Did the teacher submit *something*?”
2. **Partial work:** A single PDF may not cover the full weekly obligation (lessons per week from the official load). Without systematic counting, schools discover gaps too late.
3. **Inconsistent accountability:** Revision cycles and resubmissions need a clear audit trail; otherwise the same issues recur without visibility.
4. **Leadership bandwidth:** Chasing submissions, reconciling spreadsheets, and preparing trust-worthy board metrics competes with coaching teachers and supporting learners.

---

## The solution — what HeckTeck 2.0 delivers

### A. Zero-friction intake

Teachers use the existing Google Form. Submissions are timestamped, routed by HOD selection, and stored in a controlled master spreadsheet structure.

### B. Automated filing and traceability

Submitted files are organized in Drive with consistent naming and week structure so audits, approvals, and retrieval are predictable.

### C. AI-supported academic audit (quality, not novelty)

Each submission is reviewed against **Cambridge-aligned pedagogical expectations** with **strict output formatting** so leadership receives comparable, scannable feedback (strengths, flags, rating, status). The model is instructed to respect **subject continuity** where prior-week context exists.

Processing is **queued**: heavy generation does not block the form submit path; a scheduled job drains the queue in **single-row** steps so operations stay within platform time limits at high volume.

### D. Deliverables matrix enforcement

The **Teaching Load** spreadsheet is the system of record for what each teacher must submit (teacher + class + subject). Weekly reports compare **submissions against that matrix**, so “ghosting” a class/subject is surfaced explicitly.

### E. Weekly lesson completeness

The **Lessons/WK** value from the matrix is fed into the audit as a hard expectation; leadership gets structured signals when a submission appears to cover fewer lesson periods than required. Telegram can highlight **partial submission warnings** for immediate attention.

### F. Board-ready reporting (Looker Studio)

Leadership can present a **live Academic Performance Dashboard** connected to the same operational data: submission volume, average audit score, department comparisons, punctuality trends, and filters for teacher/subject/week—without manually rebuilding charts each term.

---

## Outcomes the board can recognize (administrative KPIs)

| Area | Outcome |
|------|--------|
| Compliance | Fewer undetected missing class/subject submissions; clearer weekly “what’s owed” picture |
| Quality | Consistent structured feedback and scoring across subjects and weeks; enforced 7.0/10 automated threshold |
| Punctuality | Time-based patterns visible by week; supports accountability without argument |
| Leadership time | Less manual spreadsheet reconciliation; **one-click form dropdown sync** from the sheet (**HecTech Tools** menu) and matrix management |
| Governance | A defensible story for parents, inspectors, and partners: “We measure and monitor instructional planning systematically.” |

*Specific percentage targets should be set after one full term of baseline data.*

---

## Investment rationale (~$1,300+ annual contract)

A realistic annual package typically covers:

- **Platform and API usage** (document intelligence / model access at operational volume)
- **Integration maintenance** (form, sheet, Drive, Telegram, reporting)
- **Security and continuity** (controlled keys, backups of configuration, controlled change management)
- **Support window** (break/fix during term time, minor adjustments to rubric language, **sheet-driven form dropdown sync**, or reporting)

The board is not buying “AI hype.” It is buying **repeatable operations**: the same rules applied every week, to every submission, with evidence preserved in the sheet and visible in the dashboard.

---

## Looker Studio — important data note (for VP / data owner)

Automation writes **AI Audit**, **Days Late**, and **HOD Check** onto **weekly tabs** (`Week 1`, `Week 2`, …), not onto **Form responses 1**. For correct charts:

- **Either** point Looker Studio at those **weekly** tables (and blend them), **or**
- Add a single **rollup sheet** (e.g. `All_Submissions`) that each logged row copies into—best long-term for BI.

Calculated fields such as extracting **RATING** and **LESSONS DETECTED** should reference the column that actually contains **AI Audit** (typically **“AI Audit”** on the weekly/rollup table). In Looker, numeric comparisons for completeness usually work most reliably when both sides are **CAST(... AS NUMBER)**.

---

## Implementation status (Complete)

- **Phase 1 — Resubmission & re-audit:** Prior feedback is carried into the next audit; Telegram marks resubmissions.
- **Phase 2 — Deliverables matrix:** Friday reporting and **Telegram Defaulters** ask “Did they submit what they **owe**?” using **Teaching Load** + **Staff Roster** routing.
- **Phase 3 — Lessons/WK completeness:** Expected weekly lesson count drives the audit and Telegram partial-submission warnings (**Granular Tracking**).
- **Phase 4 — Form alignment:** Class / Subject / Teacher dropdowns are populated from **Teaching Load** and **Staff Roster** via **`updateAllFormDropdowns`**, triggered manually from the spreadsheet (**HecTech Tools → Sync Form Dropdowns**) to protect Forms API quotas.
- **Phase 5 — Enterprise resilience:** **Queued Pro audits** (pending placeholder + **10-minute** processor, one completion per run) avoid Apps Script **6-minute** timeouts; **Gemini** backoff on overload; **hourly** sweeper **resets** failed audit cells to pending (no inline re-generation); **Telegram** send backoff on **429**.
- **Phase 6 — Autonomous calendar:** Reminders and reporting aligned to a **Term Schedule** for zero-touch operation.

---

## Recommended board decision

Approve HeckTeck 2.0 as the **standard operating model** for lesson-plan compliance and quality monitoring for the academic year, with:

1. **Teaching Load** kept current (names aligned with the form; spacing/case handled by normalization).
2. **One official dashboard** reviewed monthly by VP and shared with the board on a fixed cadence.
3. **Annual contract** for tooling + sustainment at or above the referenced band, subject to final vendor quote.

---

## Next steps

1. Confirm **rollup vs. weekly-tab** reporting strategy for Looker Studio.
2. Freeze **Teaching Load** ownership (who updates it weekly).
3. Schedule a **15-minute board walkthrough** of the dashboard (filters + two KPIs: average score + punctuality trend).
