# Diagrams — DRRCP Release 1.0 (D-03)

Exports live here so evaluators don't need StarUML (`.mdj`) or draw.io
(`.drawio`). Sources stay in `D:\College\Third Year 2026-2027\SEM-V\SE`
(outside the repo); this folder holds PNG/JPG copies made in Batch 6.

How each file was produced — nothing was faked:
- **Embedded-raster extraction** (lossless, via `pypdf`): images stored inside
  a PDF are byte-copies, not re-renders.
- **pdf.js render** (Chromium + Mozilla pdf.js @4.10.38, scale 2×): for
  vector-only StarUML/Mermaid PDFs, which contain no embedded rasters.
- **Direct copy**: sources that already shipped as PNG/JPG.

| Diagram | File here | Source file | Method | Notes |
|---------|-----------|-------------|--------|-------|
| Class diagram | `class-diagram.png` | `Class Diagram Updated.png` | copy | Canonical class diagram |
| Class diagram (alt) | — | `class diagram.png`, `Class Diagram by Mermaid.png`, `Class Diagram.mdj` | not exported | Near-duplicates of the canonical one; `.mdj` needs StarUML — see below |
| Use case | `usecase-diagram-full.jpg` | `UseCaseDiagram.jpg` | copy | — |
| Sequence (submit→verify→priority→availability) | `sequence-1.png` | `Sequence_&_Collaboration_…_sejal_&_harsh.pdf` p1 img 1 | embedded extract | Part 1 of 3 (one flow, three images) |
| Sequence (assign→accept→on-the-way) | `sequence-2.png` | same PDF p1 img 2 | embedded extract | Part 2 of 3 |
| Sequence (report→resolved) | `sequence-3.png` | same PDF p1 img 3 | embedded extract | Part 3 of 3 |
| Collaboration (full 10-step flow) | `collaboration-1.png` | same PDF p2 img 1 (also in `….docx` media) | embedded extract | — |
| Activity (color) | `activity-diagram.png` | `Activity_Diagram_Sejal_and_Harsh_247_241.pdf` | pdf.js render 2× | Mermaid export; UNREGISTERED watermarks are in the source |
| Activity (mono variant) | `activity-diagram-variant.png` | `Activity _Diagram_Sejal_Harsh_247_241.pdf` | pdf.js render 2× | Same flow, monochrome style |
| DFD Level 0 (context) | `dfd-level-0-context.png` | SRS PDF p16, `Figure 3` | embedded extract | External entities + platform + map/notify service |
| Request state machine | `request-state-machine.png` | SRS PDF p16 (3rd figure) | embedded extract | Matches `REQUEST_TRANSITIONS` incl. VERIFIED→CANCELLED (see R-03) |
| ER overview | `er-overview.png` | SRS PDF p15, `Figure 2` | embedded extract | — |
| WBS | `wbs.png` | `WBS.drawio.png` | copy | — |
| Schedule | `schedule.png` | `Schedule Diagram .drawio.png` | copy | — |

## Could NOT be exported — needs manual export

| Diagram | Source | Why | To export manually |
|---------|--------|-----|--------------------|
| Sequence/Communication `.mdj` originals | `Sequence Diagram.mdj`, `Activity Diagram.mdj`, `Activity _Diagram…` (n/a), `Class Diagram.mdj` | StarUML proprietary format; PDFs already covered the same content above | Open in StarUML → Export Diagram as PNG into this folder |
| Communication diagram | `COMMUNICATION DIAGRAM.drawio` | draw.io source with no PDF twin; no local renderer | Open in draw.io (app.diagrams.net) → Export as PNG |
| DFD Level 0 (draw.io) | `DFD LEVEL_0.drawio` | Same as above (SRS context figure covers the same level) | Same |
| DFD Level 1 | `DFD LEVEL_1.drawio` | Same as above | Same |

Verification: every `*.png`/`*.jpg` above was opened and visually checked
(StarUML sequence/collaboration flows, Mermaid activity flow, SRS context +
state-machine + ER figures); Chromium-screenshot attempts of raw PDFs return
blank (PDF plugin doesn't paint headless) — pdf.js canvas rendering was used
instead.
