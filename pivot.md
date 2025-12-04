# **00–Market-Overview.md**

## **Market Overview & Competitive Landscape**

### 📘 Summary

There is a **glaring underserved niche** between “cheap but low-quality converters” (Calibre, Sigil, Kindle Create) and “expensive, rigid, platform-locked professional tools” (Vellum, Atticus).

Authors want:

- beautiful EPUB
- beautiful print PDF
- real styling
- cross-platform GUI
- easy editing
- multi-format consistency
- reasonable pricing
- a browser-based option
- AI-powered fixes

**No existing competitor delivers all of this.**

---

## 📚 Competitor Matrix

| Tool              | Strengths                         | Weaknesses                                      | Gap You Fill                                    |
| ----------------- | --------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| **Calibre**       | Free; powerful conversions        | messy HTML/CSS; ugly; unpredictable; bad PDFs   | clean, reliable output; real CSS; pro workflows |
| **Sigil**         | Good for manual EPUB editing      | technical, unpolished, no PDF                   | user-friendly templates + clean EPUB            |
| **Kindle Create** | Easy; Amazon-backed               | no CSS; no PDF; rigid; KPF only                 | full CSS, EPUB, non-Amazon distribution         |
| **Vellum**        | Polished; easy; good templates    | macOS-only; expensive; limited CSS; limited PDF | browser-based; cheaper; CSS-enabled             |
| **Atticus**       | Cross-platform Vellum-alternative | buggy; limited templates; mid-quality output    | stable; high-typography output; better EPUB     |
| **Pressbooks**    | Web-based; decent templates       | expensive; academic focus; weak EPUB            | consumer-friendly; better styling               |
| **InDesign**      | Top-tier print layout             | expensive; complex; separate EPUB workflow      | integrated EPUB/PDF workflow                    |

---

## 🎯 Positioning

**“A professional, cross-platform, browser-based book formatter that outputs clean EPUB + beautiful print PDFs from one source using real CSS — with AI assistance.”**

This is a totally open lane.

---

# **01–PRD.md**

# **Product Requirements Document (PRD)**

## **Product Name (working):** VivlioFlow

### A vivliostyle-powered EPUB/PDF publishing engine with clean CSS, real-time preview, and AI-assisted formatting.

---

## 1. **Goal**

Create a browser-based book formatting tool that outputs:

- **Reflowable EPUB 3.2** (Kindle-safe mode)
- **Print-ready PDF** (later, not v1)
- **Editable project files**

Built on:

- Vivliostyle Core (forked)
- A new EPUB-export backend
- Custom project storage
- AI deep agents ("EPUB Doctor", "EPUB Designer")

---

## 2. **Key Use Cases**

1. **Indie author uploads manuscript (MD/DOCX/EPUB)** → formats → exports EPUB.
2. **Small press uses it to standardize formatting** across multiple books.
3. **Technical writer uses Markdown → EPUB/PDF** for multi-format distribution.
4. **Illustrated book author uses themes + custom CSS** for layout.
5. **Author returns later** — loads project from cloud storage.
6. **AI agent cleans up messy EPUB or DOCX** using heuristics + rules.
7. **AI agent designs a theme** (fonts, spacing, margins, TOC, chapter styles).

---

## 3. **Out of Scope (for v1)**

- PDF improvements
- GUI WYSIWYG editor
- Full DOCX round-trip editing
- Collaboration
- Print cover designer
- InDesign-like page editing

---

## 4. **Core Requirements (v1)**

### A. Inputs Supported

- Markdown (.md)
- HTML
- DOCX (via backend converter)
- EPUB (unzipped + normalized)

### B. Output Formats

- **EPUB 3.2**
- Kindle-safe CSS
- Validates via EPUBCheck

### C. Styling

- CSS themes (baked-in + user-editable override)
- Theme preview in real time
- AI-generated style suggestions

### D. Preview

- Vivliostyle Viewer used for live preview
- Two modes:

  - “EPUB (reflow)”
  - “PDF (paged)” (future)

### E. Project System

- Users can:

  - “New Project”
  - Upload manuscript
  - Save in cloud
  - Reopen later

- Stored as:

```
/project
   manuscript/
   theme/
   meta.json
   user.css (optional)
   snapshots/
```

### F. AI Integration

1. **EPUB Doctor**

   - cleans HTML
   - rewrites messy DOCX exports
   - normalizes structure
   - fixes CSS
   - produces clean XHTML

2. **EPUB Designer**

   - suggests or generates theme CSS
   - typography recommendations
   - spacing and margin tweaks

---

# **02–Architecture.md**

# **System Architecture Overview**

## **High-Level Diagram (text)**

```
[Browser UI] —— WebSocket for live preview —> [Vivliostyle Viewer]
     |
     | REST/GraphQL
     v
[API Backend] ———→ [Job Queue] → [Worker: Vivliostyle Engine + EPUB exporter]
     |
     → [Storage: S3/supabase]
     |
     → [AI Agents]
```

---

## **Backend Services**

### 1. **API Server** (FastAPI / Node / Bun)

Responsible for:

- Auth
- Project CRUD
- Uploads/files
- Export job initiation
- AI agent orchestration
- Returning build results

---

### 2. **Worker Pods**

Container that includes:

- Vivliostyle Core (forked)
- Your new EPUB-export-backend
- DOCX → HTML converter
- Markdown processor
- EPUBCheck
- CSS sanitizer
- Resource collector

Runs jobs like:

- “build EPUB”
- “run EPUB doctor”
- “generate theme”
- “sanitize CSS”

---

## **Frontend**

### Panels:

- Editor (Markdown/HTML)
- CSS panel
- Theme presets
- Live preview
- Export panel
- AI action sidebar

---

# **03–Feature-Spec–EPUB-Exporter.md**

# **EPUB Exporter Specification**

## **Goal:**

Add a new backend to Vivliostyle Core that outputs **clean, valid, reflowable EPUB 3.2**.

---

## **Modules**

1. **DOM Extractor**
2. **Structure Analyzer**

   - chapter detection
   - heading hierarchy
   - landmark roles

3. **CSS Sanitizer**

   - removes Kindle-unsafe rules
   - flattens complex selectors

4. **Resource Collector**

   - images
   - fonts
   - CSS

5. **XHTML Generator**

   - splits into chapters
   - ensures valid XHTML

6. **OPF Writer**
7. **nav.xhtml Writer**
8. **toc.ncx Writer**
9. **Packager**

   - builds ZIP
   - stores required mimetype file

---

## **CLI Command**

```
vivliostyle epub input.html \
   --out book.epub \
   --theme theme.css \
   --kindle-safe \
   --validate
```

---

# **04–Vivliostyle–Core–Audit.md**

# **Audit: Vivliostyle Core — What We Keep, Ignore, or Extend**

| Component                                  | Keep?              | Reason                                          |
| ------------------------------------------ | ------------------ | ----------------------------------------------- |
| **CSS parser/cascade**                     | ✔ Keep            | needed for theme + AI modifications             |
| **Font loader**                            | ✔ Keep            | EPUB needs embedded fonts                       |
| **View tree (vgen/vtree)**                 | ✔ Keep            | needed for structure analysis                   |
| **Paged media + PDF logic**                | ✖ Ignore for now  | out of scope for v1, keep code but don’t extend |
| **Viewer**                                 | ✔ Keep            | use for real-time preview                       |
| **EPUB input handler**                     | ✔ Keep            | supports “continue editing”                     |
| **Templates/themes**                       | ✔ Keep & build on | central to project                              |
| **Layout (regions, floats, page masters)** | ✖ Ignore for now  | not relevant for reflowable EPUB                |
| **CLI**                                    | ✔ Extend          | add new `epub` command                          |

---

# **05–Data-Model–Project-Storage.md**

# **Data Model: Project Storage**

## **Project Directory Structure**

```
project/
  manuscript/
    index.html
    chapters/*.html
  theme/
    base.css
    user.css
  assets/
    images/
    fonts/
  meta.json
  snapshots/
    2025-xx-xx--v1.zip
```

---

## **meta.json Structure**

```json
{
  "title": "Puppy Hero",
  "author": "Vincent Chan",
  "createdAt": "...",
  "updatedAt": "...",
  "theme": "classic-serif",
  "kindleSafe": true,
  "aiAssisted": true,
  "docStructure": {
    "chapters": [...],
    "headings": [...]
  }
}
```

---

## **Persistence**

- Stored in **S3/Supabase storage**
- Indexed in database (Postgres/Dynamo/Supabase)
- Versioning via snapshots
- “Restore previous version” supported

---

# **06–AI-Agent–Specs.md**

# **AI Agent Specifications**

## **1. EPUB Doctor**

### Tasks:

- Identify invalid XHTML
- Fix broken markup
- Normalize headings
- Remove Word inline styles
- Suggest structural fixes
- Rewrite messy CSS
- Flatten overly complex rules
- Ensure Kindle-safe output

### Workflow:

```
HTML → AI → cleaned HTML → EPUB exporter → epubcheck → final.epub
```

---

## **2. EPUB Designer**

### Tasks:

- Suggest typography themes
- Generate CSS presets
- Improve spacing/margins
- Suggest fonts
- Create CSS variables
- Optimize readability

### Inputs:

- sample text
- author preferences
- genre presets

---

# **07–SaaS–Roadmap.md**

# **SaaS Roadmap**

## **Phase 1 — Uncharted Deliverable**

- Fork Vivliostyle
- Add EPUB exporter backend
- Include CSS sanitizer
- CLI command
- Basic project saving
- Simple browser UI with preview

---

## **Phase 2 — MVP SaaS**

- User accounts
- Project dashboard
- DOCX/MD ingestion
- Basic AI EPUB Doctor
- Theme presets
- EPUB & PDF export
- Job processing in backend

---

## **Phase 3 — Pro Features**

- Full EPUB Designer AI
- Custom theme builder GUI
- Collaboration
- Version history UI
- Template marketplace
- Real-time co-editing

---

## **Phase 4 — Publisher Suite**

- Bulk processing
- Team workflows
- CI integration (book builds)
- White-label formatting pipelines

---

# **08–Licensing-Strategy.md**

# **Licensing Strategy**

Vivliostyle Core is **AGPLv3**.

### ✔ Your modifications to Vivliostyle Core must also be AGPL.

That’s fine — the EPUB exporter backend is open-source.

### ✔ Your SaaS platform can remain proprietary

As long as:

- Vivliostyle runs as a **separate worker container**
- Your backend talks to it via CLI process invocation
- No code linking or embedding AGPL code within proprietary binaries

This is industry-standard (Metabase, GitLab, etc.)

### ✔ GUI/frontend can be proprietary

No problem here.

### ✔ AI models + pipelines + tooling

Are proprietary.

### ✔ You may dual-license extra components

E.g. themes, templates, design packs.

---

# **09–7-Day-Uncharted-Plan.md**

# **7-Day Implementation Plan (Uncharted Challenge)**

## **Day 1 — Fork + Codebase Mapping**

- Fork `vivliostyle/vivliostyle.js`
- Summarize directory structure
- Identify hook points for EPUB exporter
- Validate build + tests

## **Day 2 — EPUB Exporter Scaffolding**

- Create exporter folder
- Add CLI command stub
- Write code that extracts DOM + CSS cascade

## **Day 3 — Structure + CSS Sanitization**

- Implement structural analyzer
- Implement Kindle-safe CSS sanitizer
- Build resource collector

## **Day 4 — XHTML + OPF + nav.xhtml**

- Write XHTML chapter splitter
- Implement OPF writer
- Implement nav writer
- Integrate with packager

## **Day 5 — End-to-End Build**

- Build minimal EPUB
- Run EPUBCheck
- Fix issues
- Polish CLI

## **Day 6 — Documentation + Polishing**

- Write README
- Document architecture
- Prepare demo project

## **Day 7 — Final Demo**

- Record walkthrough video
- Show HTML → cleaned → EPUB
- Show sanitizer in action
- Show real-time preview
