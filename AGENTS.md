# Vision

# Project: RS-Obsidian

## 1. Goal

Build an Obsidian plugin for RS v0.2 (Research Shorthand).

Primary goal:
- keep research notes as normal Markdown;
- allow prose and RS structures to coexist;
- render RS structures visually;
- support real-time editing, linking, filtering, navigation, graphing, and research reasoning;
- preserve portability: removing the plugin must not destroy note readability.

Core principle:

Markdown = Source of Truth
Parser/AST = Derived Structure
UI = Interactive Projection

Never store essential research content only inside plugin state.


## 2. RS objects to support

### Entity
[TASK]
[METHOD]
[MECH]
[PRIOR]
[DATA]
[METRIC]
[FAIL]
[TOOL]
[THEME]

Example:

[METHOD] ALCNet
:: local contrast + bottom-up attention
| task:[[SIRST]]
| theme:[[Feature Preservation]]

### Reasoning
P Problem
Q Question
H Hypothesis
C Claim
E Evidence
A Assumption
X Limitation
T Test
R Result
D Decision
N Next

Example:

C1+:
Feature preservation is a core SIRST problem.
| sup:E1,E2
| @self:synthesis

### Explanation

### Explain — [[SCR]]

Normal Markdown prose...

### Source
@Kumar23
@self:synthesis
@self:inference
@self:hypothesis


## 3. Key UX principle

Raw RS syntax should remain available, but users should not need to stare at it all day.

Provide two simultaneous representations:

1. Raw Markdown
2. Visual RS representation

Support progressive disclosure:

compact:
[METHOD] ALCNet

expanded:
description + relations + source + explanation

full:
raw Markdown block


## 4. Main UI features

### A. Live Editor Decorations

In Obsidian Live Preview:

- color/tag styling for `[METHOD]`, `[FAIL]`, `[DATA]`, etc.
- badges for `C1+`, `H1?`, `Q2?`
- source chips for `@Paper23`
- clickable `[[Entity]]`
- collapsible property lines
- hover/side-panel preview
- status icons:
  + supported
  ? open
  ~ contested
  - defeated

Do NOT replace Markdown editing.
Decorate it.


### B. RS Reader View

Render a note into a readable research document.

Normal prose remains normal prose.

RS blocks become lightweight visual components:

Entity card
Claim block
Evidence block
Question block
Hypothesis block
Explanation block

Avoid card-per-line UI.
Group related objects visually.


### C. Entity Inspector

Click `[[SCR]]`, `[[ALCNet]]`, etc.

Side panel shows:

Name
Type
Definition
Formula
Properties
Relations
Mentions
Supporting claims
Related methods
Related datasets
Sources
Explanation blocks

Allow direct editing → writes back to Markdown.


### D. Domain Map

Generate:

TASK
  ↓
FAIL
  ↓
THEME
  ↓
METHOD
  ↓
MECH / PRIOR / TOOL
  ↓
DATA / METRIC

Interactive graph:

- click node → inspector
- filter by entity type
- filter by source
- collapse/expand themes
- highlight neighborhood
- jump to Markdown definition


### E. Reasoning Graph

Visualize:

P → Q → H → T → R → C → D → N

plus:

E → C
A → H/C
X → C/H

Features:

- unsupported claims detection
- hypotheses without tests
- tests without results
- decisions without evidence
- open questions
- contested claims


### F. Research Board

Kanban-like derived view:

Open Questions
Hypotheses
Tests Planned
Running Experiments
Results
Decisions
Next Actions

Derived from Q/H/T/R/D/N blocks.

No separate database.
Changing board state edits Markdown.


### G. Evidence View

Select a claim:

C3+

Show:

Supporting evidence
Counter evidence
Assumptions
Limitations
Sources

Example:

C3
├─ sup: E1
├─ sup: E4
├─ opp: E9
├─ dep: A2
└─ lim: X3

Useful for literature synthesis.


### H. Concept Learning View

For beginner-oriented study.

Select entity:

[METRIC] SCR

Display:

Definition
Formula
Variables
Explanation
Example
Related concepts
Methods using it
Research questions involving it

This is the visual layer for RS v0.2's `Explain` concept.


## 5. High-value editing operations

Context menu / command palette:

- Convert selection → Entity
- Convert selection → Claim
- Convert selection → Evidence
- Convert selection → Question
- Convert selection → Hypothesis
- Add Explanation
- Add Source
- Link evidence to claim
- Add limitation
- Promote limitation → Question
- Promote question → Hypothesis
- Create test from hypothesis
- Create next action
- Change epistemic status
- Merge duplicate entities
- Rename entity globally

Example workflow:

select sentence
→ "Create Claim"
→ generates C12:

select another sentence
→ "Create Evidence"
→ generates E21:

drag/link E21 → C12
→ writes `| sup:E21`


## 6. Quick Capture

Provide compact input:

Type:
[METHOD]

Name:
NS-FPN

Description:
noise suppression FPN

Relations:
theme → Noise Suppression
task → SIRST

Plugin writes:

[METHOD] NS-FPN
:: noise suppression FPN
| theme:[[Noise Suppression]]
| task:[[SIRST]]


## 7. Parser design

Important requirement:

RS must coexist with arbitrary Markdown.

Parser should recognize only explicit RS patterns.

Everything else = untouched prose.

Pipeline:

Markdown
→ RS tokenizer
→ RS AST
→ index
→ views

Suggested AST:

Entity {
  id
  name
  type
  definition
  properties
  relations
  sourceFile
  position
}

Reasoning {
  id
  type
  status
  text
  relations
  sources
  sourceFile
  position
}

Explanation {
  entityRef
  markdown
  sourceFile
  position
}

Source {
  id
  metadata?
}


## 8. Index architecture

Build a vault-wide in-memory index.

Index:

entity name → definitions/mentions
reasoning ID → block
source → statements
entity → claims
claim → evidence
question → hypotheses
hypothesis → tests

Update incrementally on:

file create
file modify
file rename
file delete

Avoid rescanning whole vault on every keystroke.


## 9. Markdown remains canonical

Never require hidden binary/database state.

Plugin data may cache:

- index
- layout positions
- UI preferences
- graph filters

But must NOT contain unique research knowledge.

If plugin is removed:

all notes remain valid Markdown.


## 10. Visual grammar

Keep UI restrained.

Entity:
colored small type badge

Reasoning:
P / Q / H / C / E etc. left marker

Status:
+ ? ~ -

Source:
small `@source` chip

Relations:
render as compact links

Explanation:
normal prose with optional callout-like header

Avoid turning every atomic statement into a large card.


## 11. Search / Query

Examples:

type:METHOD theme:"Noise Suppression"

type:H status:?

type:C source:@Kumar23

claims supported-by:[[DNA-Net]]

questions related-to:[[Domain Shift]]

methods task:[[SIRST]]

datasets real:true

Allow results as:

list
table
graph


## 12. Research diagnostics

Optional "RS Lint" panel:

- duplicate reasoning IDs
- undefined entity references
- undefined evidence references
- claim without source/evidence
- hypothesis without test
- result without test
- decision without evidence/result
- unresolved source
- duplicate entities
- malformed RS syntax

Diagnostics should be warnings, not hard errors.


## 13. AI integration — later phase

Expose current RS structure to AI as JSON.

Example:

getCurrentResearchContext()
getEntity(name)
getOpenQuestions()
getUnsupportedClaims()
getHypothesesWithoutTests()
getEvidenceForClaim(id)

AI actions:

- extract RS entities from prose
- propose entity links
- identify duplicate concepts
- generate candidate questions
- detect claim/evidence mismatch
- summarize domain map
- convert paper summary → RS

AI suggestions must be previewed before writing Markdown.


## 14. Import / Export

Future:

RS Markdown
↔ JSON AST
↔ YAML
↔ GraphML
↔ RDF / knowledge graph
↔ Knows-like representation
↔ Lara-like argument structure

Keep internal AST independent of any one external standard.


## 15. MVP

Phase 1:
- RS parser
- syntax highlighting/decorations
- entity/reasoning index
- entity inspector
- click-to-jump
- basic lint
- quick-create commands

Phase 2:
- domain map
- reasoning graph
- evidence inspector
- research board
- advanced search

Phase 3:
- visual editing writes Markdown
- drag relation creation
- merge/rename entities
- concept learning view

Phase 4:
- AI extraction/assistance
- external format export
- advanced reasoning diagnostics


## 16. Suggested Obsidian architecture

src/
  main.ts

  parser/
    tokenizer.ts
    parser.ts
    ast.ts

  index/
    vault-index.ts
    relations.ts

  editor/
    decorations.ts
    commands.ts

  views/
    entity-view.ts
    domain-map.ts
    reasoning-graph.ts
    research-board.ts

  ui/
    entity-card.ts
    reasoning-block.ts
    source-chip.ts

  lint/
    diagnostics.ts

  services/
    markdown-writer.ts
    rename-service.ts

  settings/
    settings.ts


## 17. Critical design constraints

1. Markdown-first.
2. No vendor lock-in.
3. Normal prose always allowed.
4. RS syntax must remain manually writable.
5. Visual operations must write deterministic Markdown.
6. Never silently rewrite large note regions.
7. All automated edits should support Undo.
8. Entity and reasoning namespaces stay separate.
9. Source provenance must be preserved.
10. UI should reduce visual complexity, not create more of it.


## 18. Product principle

The plugin should transform:

"Markdown full of research syntax"

into:

"a readable research workspace backed by Markdown".

Raw representation:
portable / editable / Git-friendly / AI-readable

Visual representation:
navigable / understandable / interactive

Both must always describe the same underlying research state.

# Repository Guidelines

## Project Structure & Module Organization

`src/parser.ts` recognizes RS Markdown; `src/index.ts` maintains the vault-wide index; `src/visual-model.ts` prepares evidence and entity groups; `src/editor.ts` decorates Live Preview; `src/inspector.ts` renders the side panel; and `src/main.ts` wires Obsidian events and commands. Parser and index tests live in `tests/`. Obsidian loads `manifest.json`, the built `main.js`, and `styles.css` from the plugin directory.

## Build, Test, and Development Commands

Run `npm install` once. `npm run build` type-checks and bundles the plugin, `npm run dev` watches source files, and `npm test` runs parser/index tests. Reload the plugin in Obsidian after a build to check Live Preview and inspector behavior.

## Coding Style & Naming Conventions

Use TypeScript with strict checks and two-space indentation. Use `PascalCase` for classes and types, `camelCase` for variables and functions, and `kebab-case` for assets. Keep the parser independent of Obsidian APIs and treat Markdown as the only source of research content. Do not silently rewrite note text.

## Testing Guidelines

Use Node's built-in test runner (`npm test`). Add focused tests for explicit syntax, ordinary prose, fenced code, cross-file references, and index updates. Name files `*.test.ts`. Include manual Obsidian verification steps for editor and side-panel changes; no coverage target is set.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects, such as `Add evidence navigation`. Pull requests to `jasonshelter0/obsidian-seshra` should explain the change, list verification performed, link a related issue when one exists, and include screenshots for visible UI changes. Keep credentials and personal vault data out of commits.
