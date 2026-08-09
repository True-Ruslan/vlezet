# 2026-08-09 — M8.2 Precision Drawing and Structural Editing

**Status:** IN DEVELOPMENT  
**Tracker:** #56  
**Implementation PR:** #87  
**Design:** PRODUCT-OWNER APPROVED — 2026-08-09  
**M8.1 base:** `867ec54d21b1dcb94d519ace3bec0a3635717022`  
**Plan/design head before production RED:** `19e8ae38e186f5d83e7af472ee0b8b70496b867c`

## Why

M8.2 makes exact manual apartment construction fast enough to stay on the Canvas while preserving Vlezet's millimetre, topology, hosted-opening and semantic-history authority.

Approved scope:

- named semantic snapping with deterministic priority and hysteresis;
- exact near-cursor wall length/angle input;
- direct endpoint/junction editing;
- contextual topology-safe wall-body translation;
- atomic centred multi-wall thickness editing;
- strict fail-closed structural clipboard dependency closure;
- hosted-opening preservation/revalidation;
- one semantic history command per committed structural operation;
- WCAG 2.2-oriented drag alternatives, target sizing and keyboard/focus behaviour.

## Engineering contract

- genuine RED → observed intended failure → minimal GREEN → regression/refactor;
- `@vlezet/geometry` owns pure snapping/angle calculations;
- `@vlezet/editor-core` owns structural candidate construction and validation;
- Canvas is intent/projection only;
- no partial mutation or silent topology repair;
- no weakening existing topology/opening/recognition thresholds;
- Chromium full flow + representative WebKit acceptance;
- acceptance and merge remain separate states.

## Pre-production baseline

```text
head:                       19e8ae38e186f5d83e7af472ee0b8b70496b867c
CI #4823:                   PASS
CI #4824:                   duplicate run from implementation PR; initially in progress
production M8.2 code:       none
```

PR #86 was closed without merge after design approval because the approved design/plan commits are carried forward by implementation PR #87.

## RED / GREEN evidence

No M8.2 production RED has been created yet.
