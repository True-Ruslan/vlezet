# Vlezet — Product Vision

**Audit phase:** M7.0 Product and UX Audit  
**Canonical role:** product purpose and trust principles for UX decisions

## 1. Product promise

Vlezet helps an apartment owner or buyer reproduce a real apartment, understand its usable dimensions and test furniture layouts without learning professional CAD.

The core promise is:

> Draw or import a real apartment, work with understandable real dimensions, place furniture and appliances, and see what fits, collides and remains usable.

The product must feel approachable while remaining precise. Simplicity is not achieved by hiding important geometry semantics or replacing structured data with an attractive image.

## 2. Primary users

### Apartment owner or buyer

A non-professional user who wants to answer practical questions:

- Will this bed, wardrobe or kitchen fit?
- How much usable space remains?
- Is the entered room size the clear internal size?
- Will a door open?
- Is there enough passage around furniture?
- Which layout is better for this specific apartment?

This user needs ordinary language, safe defaults, visible reversibility and confidence that measurements correspond to real physical geometry.

### Power user

A user who creates detailed plans, imports developer drawings, adjusts exact millimetres, reviews recognition, uses constraints and compares alternatives.

This user needs efficient repeated editing, predictable keyboard/pointer behaviour, stable numeric controls, inspectable evidence and no loss of advanced capability during simplification.

### Product-owner and validation role

During current development, representative real-browser validation is performed by the product owner on real apartment scenarios. M7 must convert those ad hoc findings into reconstructable evidence, acceptance criteria and a repeatable UX roadmap.

## 3. Jobs to be done

### Reproduce the apartment

- start from a blank project or a JPG/PNG/PDF plan;
- calibrate scale;
- create walls, rooms, doors and windows;
- name rooms and verify usable dimensions and area.

### Test furniture

- find common furniture and appliances;
- place or create items with exact dimensions;
- rotate and position them;
- understand containment, collision, door swing and recommended clearance issues.

### Compare layout decisions

- measure arbitrary distances;
- inspect the project in 2D and read-only 3D;
- ask for deterministic layout alternatives;
- express supported preferences manually or in ordinary language;
- Preview and explicitly Apply a selected proposal.

### Preserve and communicate work

- rely on local autosave;
- undo and redo safely;
- export PNG;
- create a portable Vlezet backup;
- restore the project without losing authoritative geometry.

## 4. Trust and precision principles

1. Millimetres are the canonical world unit.
2. `VlezetDocument` is the only persistent apartment/layout source of truth.
3. Canvas and Three.js are projections, never measurement authority.
4. Rooms, area, clear dimensions and 3D are derived from structured geometry.
5. A displayed measurement states what is measured: axis, inner surfaces, centres or contours.
6. Existing user geometry is never silently replaced.
7. Ambiguous meaning fails closed or asks for explicit intent.
8. Hard constraints, soft preferences, warnings and recommendations are visibly distinct.
9. Temporary Preview and persistent Apply are visibly distinct.
10. High-impact generated changes require explicit review and Apply.
11. Undo/Redo remains semantic and predictable.
12. Visual redesign cannot create a second product truth.

## 5. Local-first and AI-assistance boundaries

Core editing, persistence, fit validation, deterministic planning and 3D projection do not depend on a network service.

AI and CV are optional assistance:

- recognition creates an editable draft;
- natural-language interpretation creates a reviewable symbolic draft;
- API keys and raw provider responses remain runtime-only;
- provider failure never blocks manual editing;
- model output cannot generate authoritative coordinates, bypass validation or mutate the document directly.

The UI must explain these boundaries without making provider configuration dominate ordinary workflows.

## 6. Desktop platform position

M7 is desktop-first because precise spatial editing requires a large work surface and pointer interaction.

Primary environments:

- Chromium/Yandex Browser on macOS and Windows;
- Safari on macOS for core editing regression;
- common desktop widths and browser zoom from 100% through 200%.

M7 does not promise mobile-first editing. Narrow widths must preserve project access, avoid unreachable actions and explain when precise editing requires a larger screen.

## 7. What Vlezet is not

Vlezet is not:

- a professional BIM/CAD replacement;
- an image-only floor-plan generator;
- an autonomous interior designer that silently changes the apartment;
- a photorealistic renderer;
- a source of structural/removability conclusions without authoritative building data;
- a cloud account/collaboration service in the current local-first stage;
- a product where AI correctness is required for core use.

## 8. Product personality

The desired interface character is:

- precise;
- trustworthy;
- contemporary;
- restrained;
- calm under complex workflows;
- technical enough to explain truth;
- approachable enough for a non-professional.

The product should look intentionally designed, not like a collection of engineering controls, while preserving numeric transparency.

## 9. Product success signals

### Task success

- a new user can create or import a room and understand when it is complete;
- clear room dimensions and area match user expectations and share one geometry source;
- furniture-fit reasons lead to a corrective action;
- Preview is not mistaken for saved geometry;
- exported/restored projects preserve authoritative state.

### Comprehension

- the user knows what is selected;
- the active tool/mode is visible;
- the next action is predictable;
- disabled actions explain the unmet prerequisite;
- technical terms are either avoided or explained in context.

### Efficiency

- common actions remain prominent;
- advanced controls are discoverable through progressive disclosure;
- repeated numeric editing does not require unnecessary pointer travel;
- side panels do not consume the Canvas without clear value.

### Safety and resilience

- no data-loss or destructive surprise;
- local/network/provider errors have a recovery path;
- narrow widths and zoom do not make primary actions unreachable;
- no redesign regression changes document, geometry, persistence or planning authority.

## 10. M7 decision rule

When choosing between visual novelty and understandable product truth, understandable truth wins.

When choosing between a giant redesign and a bounded improvement with evidence, the bounded improvement wins.

When choosing the next implementation slice, actual high-reach findings and dependency value govern; speculative feature expansion does not bypass the accepted audit.
