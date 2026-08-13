from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one marker, got {count}")
    return text.replace(old, new, 1)


# PROJECT_STATE
path = Path("docs/PROJECT_STATE.md")
text = path.read_text()
old_status = "**Status:** M0–M8.1 are implemented, product-accepted and merged. M8.2 Precision Drawing / Direct Manipulation Foundation is implemented in Draft PR #87 but is **not product-accepted**. The latest product-owner confirmation reports room+furniture marquee **PASS**, window movement **PASS**, and hosted-door movement/runtime **functional PASS**, with one remaining UX finding: the door was still hard to acquire because pointer-down had to land on the thin leaf. The door wall-opening/leaf/arc hit-target correction is now product-code GREEN in Chromium and representative WebKit; a fresh exact-head gate is required after this documentation truth-sync. Final product-owner door-UX confirmation remains **PENDING**."
new_status = "**Status:** M0–M8.1 are implemented, product-accepted and merged. M8.2 Precision Drawing / Direct Manipulation Foundation is **PRODUCT-OWNER ACCEPTED** on head `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7` in PR #87. The final focused door-UX retest passed all three requested scenarios. Canonical acceptance record `docs/milestones/m8-2-acceptance.md` is created; protected merge remains pending until fresh exact-head CI + Chromium/WebKit Browser Acceptance are GREEN after this acceptance truth-sync. M8.3 remains blocked until M8.2 is integrated into `main`."
text = replace_once(text, old_status, new_status, "PROJECT_STATE status")
text = replace_once(
    text,
    "| M8.1 | product-owner accepted and squash-merged as `867ec54d21b1dcb94d519ace3bec0a3635717022` |\n\nM8.2 is **not** listed as accepted. Earlier GREEN evidence did not protect all real product-owner paths. The current correction suite now includes selected-furniture composite drag, current-host opening movement, whole-room no-modifier marquee, practical window hit targeting and a simulated preserved Turbopack/Fast Refresh store shape. Automated GREEN still does not replace explicit product-owner acceptance.",
    "| M8.1 | product-owner accepted and squash-merged as `867ec54d21b1dcb94d519ace3bec0a3635717022` |\n| M8.2 | product-owner accepted on `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7`; protected merge pending |\n\nM8.2 manual acceptance is closed. The accepted correction suite includes selected-furniture composite drag, current-host opening movement, whole-room no-modifier marquee, practical window and door hit targeting, compact room-label degradation and preserved Turbopack/Fast Refresh live-store repair. Integration still requires fresh exact-head delivery gates after this acceptance truth-sync.",
    "PROJECT_STATE accepted milestones",
)
text = replace_once(
    text,
    "### M8.2 structural precision / direct manipulation — not accepted\n\nDraft PR #87 implements the approved structural precision design plus later product-owner corrections while preserving M8.1 runtime and structural authority boundaries.",
    "### M8.2 structural precision / direct manipulation — product-owner accepted / merge pending\n\nPR #87 implements the approved structural precision design plus later product-owner corrections while preserving M8.1 runtime and structural authority boundaries. Product-owner acceptance was granted on `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7`; `docs/milestones/m8-2-acceptance.md` is the canonical acceptance record. Protected integration remains pending fresh exact-head delivery gates.",
    "PROJECT_STATE M8.2 heading",
)
text = replace_once(
    text,
    "**Current acceptance state:** these newly reported regressions are fixed and automated GREEN on the product-code head. A fresh exact-head CI + Browser Acceptance run is required after this documentation truth-sync. M8.2 remains Draft/not accepted until explicit product-owner PASS.",
    "**Acceptance state:** these regressions are fixed, automated GREEN and product-owner accepted. The later door hit-target correction below completed the final manual gate; only integration delivery gates remain.",
    "PROJECT_STATE runtime acceptance",
)
text = replace_once(
    text,
    "**Remaining acceptance gate:** fresh exact-head CI + Browser Acceptance after this truth-sync, then only a short product-owner confirmation that the door can be comfortably acquired from its wall-opening area without unexpected surrounding-click capture. The already reported marquee/window PASS does not need to be repeated.",
    "**Product-owner result:** the final focused retest passed all three requested door-UX scenarios. Manual acceptance is closed. Remaining work is delivery-only: synchronize acceptance state, run fresh exact-head CI + Chromium/WebKit Browser Acceptance, mark PR #87 Ready and perform the protected squash merge.",
    "PROJECT_STATE final door gate",
)
text = replace_once(
    text,
    "DONE  M8.1  Editor Interaction Foundation\nNOW   M8.2  Precision Drawing / Direct Manipulation Foundation\n      latest door hit-target correction PRODUCT-CODE AUTOMATED GREEN;\n      room marquee + window + functional door movement product-owner PASS;\n      final docs-head gate + focused door-UX confirmation required;\n      product-owner acceptance PENDING;\n      M8.2 remains Draft / not accepted\nTHEN  M8.3  Precision Reference Calibration",
    "DONE      M8.1  Editor Interaction Foundation\nACCEPTED  M8.2  Precision Drawing / Direct Manipulation Foundation\n          product-owner PASS on c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7;\n          acceptance record created;\nNOW       M8.2  Protected integration\n          fresh exact-head CI + Chromium/WebKit Browser Acceptance;\n          Ready + protected squash merge pending\nBLOCKED   M8.3  Precision Reference Calibration — until M8.2 merge",
    "PROJECT_STATE programme",
)
path.write_text(text)


# ROADMAP
path = Path("docs/ROADMAP.md")
text = path.read_text()
text = replace_once(
    text,
    "NOW         M8.2 Precision Drawing / Direct Manipulation Foundation\n            original product-owner scenarios PASS;\n            latest door hit-target usability correction PRODUCT-CODE AUTOMATED GREEN;\n            room marquee + window + functional door movement product-owner PASS;\n            final documentation-head CI/Browser + focused door-UX confirmation required;\n            product-owner acceptance PENDING;\n            M8.2 remains Draft / not accepted\nTHEN        M8.3 Precision Reference Calibration",
    "ACCEPTED    M8.2 Precision Drawing / Direct Manipulation Foundation\n            product-owner PASS on c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7;\n            acceptance record created;\nNOW         M8.2 protected integration\n            fresh exact-head CI + Chromium/WebKit Browser Acceptance;\n            Ready + protected squash merge pending\nBLOCKED     M8.3 Precision Reference Calibration — until M8.2 merge",
    "ROADMAP summary",
)
old_para = "M8.2 remains the active Draft delivery slice in PR #87 and is **not product-accepted**. Multiple product-owner rounds have deliberately reopened the acceptance gate when real interaction gaps were found. The runtime/marquee/window round is now manually confirmed for the marquee and window paths and functionally confirmed for hosted-door movement. That confirmation exposed one final usability gap: the door itself was still too hard to acquire because only the thin leaf was a practical target. The wall-opening/leaf/arc hit-target correction now has genuine RED evidence and product-code GREEN in Chromium and representative WebKit. A fresh exact-head gate plus one focused door-UX confirmation remain; automation alone does not accept M8.2."
new_para = "M8.2 is **PRODUCT-OWNER ACCEPTED** in PR #87 on `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7`. Multiple product-owner rounds deliberately reopened the gate whenever a real interaction gap was found; the final door-acquisition correction is now manually confirmed PASS. Canonical acceptance record: `docs/milestones/m8-2-acceptance.md`. The active work is delivery-only: fresh exact-head CI + Chromium/WebKit Browser Acceptance after acceptance truth-sync, then Ready state and protected squash merge. M8.3 remains blocked until integration."
text = replace_once(text, old_para, new_para, "ROADMAP status paragraph")
text = replace_once(
    text,
    "**Remaining M8.2 gate:** fresh exact-head verification after documentation sync, then only focused product-owner confirmation that door acquisition from the wall opening feels practical and does not steal surrounding interaction. The room-marquee and window scenarios are already product-owner PASS. M8.3 remains blocked until M8.2 is accepted and protected-merged.",
    "**M8.2 acceptance gate:** CLOSED — final focused product-owner door-UX retest PASS on 2026-08-13. Remaining work is delivery-only: fresh exact-head verification after acceptance truth-sync, Ready state and protected squash merge. M8.3 remains blocked until M8.2 is integrated into `main`.",
    "ROADMAP remaining gate",
)
path.write_text(text)


# UX ROADMAP
path = Path("docs/product/UX_ROADMAP.md")
text = path.read_text()
text = replace_once(
    text,
    "NOW\nM8.2 Precision Drawing / Direct Manipulation Foundation\n  - runtime/marquee/window correction confirmed; marquee + window PASS, functional door movement PASS\n  - final door hit-target usability correction PRODUCT-CODE Chromium + WebKit GREEN\n  - final docs-head CI/Browser + focused door-UX confirmation required\n  - product-owner acceptance PENDING\n  - Draft / not accepted\n\nTHEN\nM8.3 Precision Reference Calibration",
    "ACCEPTED\nM8.2 Precision Drawing / Direct Manipulation Foundation\n  - final focused product-owner door-UX retest PASS\n  - accepted head c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7\n  - acceptance record docs/milestones/m8-2-acceptance.md\n\nNOW\nM8.2 protected integration\n  - fresh exact-head CI + Chromium/WebKit Browser Acceptance\n  - Ready + protected squash merge pending\n\nBLOCKED\nM8.3 Precision Reference Calibration — until M8.2 merge",
    "UX current sequence",
)
text = replace_once(
    text,
    "M8.2: #56 / Draft PR #87. M8.3: #57.",
    "M8.2: #56 / PR #87 — product-owner accepted, protected merge pending. M8.3: #57.",
    "UX tracker line",
)
text = replace_once(
    text,
    "**Status:** IN DEVELOPMENT — LATEST PRODUCT-OWNER REGRESSIONS FIXED / PRODUCT-CODE AUTOMATED GREEN / PRODUCT-OWNER ACCEPTANCE PENDING.",
    "**Status:** PRODUCT-OWNER ACCEPTED on `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7` / PROTECTED MERGE PENDING. Canonical record: `docs/milestones/m8-2-acceptance.md`.",
    "UX M8.2 status",
)
text = replace_once(
    text,
    "11. **Product gate still open.** Chromium + representative WebKit GREEN is necessary but not sufficient; explicit product-owner PASS remains required.",
    "11. **Product gate closed.** Chromium + representative WebKit GREEN remained necessary but not sufficient; explicit product-owner PASS was received on 2026-08-13. Only protected delivery/integration remains.",
    "UX correction contract gate",
)
path.write_text(text)


# FOCUSED DOOR CHANGELOG
path = Path("docs/changelog/2026-08-13-m8-2-door-hit-target-correction.md")
text = path.read_text()
text = replace_once(
    text,
    "Status: **AUTOMATED GREEN / FINAL PRODUCT-OWNER DOOR-UX CONFIRMATION PENDING**\n\nThis record documents the final focused M8.2 usability correction requested during product-owner acceptance. It is not an acceptance record. PR #87 remains Draft, issue #56 remains open and M8.3 remains blocked until explicit product-owner PASS.",
    "Status: **PRODUCT-OWNER PASS / M8.2 ACCEPTANCE RECORDED / PROTECTED MERGE PENDING**\n\nThis record documents the final focused M8.2 usability correction requested during product-owner acceptance. Canonical milestone acceptance is recorded separately in `docs/milestones/m8-2-acceptance.md`. PR #87 remains unmerged until fresh acceptance-head delivery gates and protected integration complete.",
    "door changelog status",
)
old_remaining = "## Remaining acceptance gate\n\nThe product owner has already reported PASS for:\n\n- room + furniture marquee/movement;\n- representative window movement;\n- functional hosted-door movement/runtime.\n\nAfter this hit-target correction, only a short real-session confirmation is still needed:\n\n> clicking/dragging the door from the wall-opening area feels comfortably targetable and surrounding room interaction is not unexpectedly stolen.\n\nIf that focused door-UX check is PASS, no repetition of the already automated/manual-passed marquee and window scenarios is required. The normal M8.2 acceptance record / Ready / issue closure / protected merge workflow may then proceed."
new_remaining = "## Product-owner acceptance result\n\nOn 2026-08-13 the product owner completed the final focused retest and reported: **«Все 3 теста PASS»**. This confirms comfortable acquisition from the wall-opening area, continued leaf/arc targeting and no unexpected click capture by the non-listening swing sector.\n\nThe earlier room + furniture marquee/movement, representative window movement and functional hosted-door movement/runtime checks were already PASS. No manual M8.2 acceptance scenario remains open. Canonical acceptance record: `docs/milestones/m8-2-acceptance.md`.\n\nRemaining work is delivery-only: fresh exact-head CI + Chromium/WebKit Browser Acceptance after acceptance truth-sync, Ready state, protected squash merge and integration verification on `main`."
text = replace_once(text, old_remaining, new_remaining, "door changelog acceptance")
path.write_text(text)


# MAIN CHANGELOG
path = Path("docs/CHANGELOG.md")
text = path.read_text()
marker = "This is a milestone changelog rather than a package-release log. Detailed acceptance records remain in `docs/milestones/`.\n\n"
entry = """## 2026-08-13 — M8.2 product-owner accepted; protected integration pending

**Status:** PRODUCT-OWNER ACCEPTED on `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7`; protected merge remains pending fresh acceptance-head delivery gates.

The final focused door-UX retest returned **«Все 3 теста PASS»**. The product owner confirmed comfortable door acquisition from the wall-opening area, continued leaf/arc targeting and that the deliberately non-listening filled swing sector does not steal surrounding room/furniture interaction. Earlier room + furniture marquee/movement and representative window movement scenarios were already PASS.

Canonical acceptance record: `docs/milestones/m8-2-acceptance.md`.

Pre-acceptance exact-head evidence:

```text
accepted head:                  c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7
CI #5090 / run 31680995080:    PASS
Browser Acceptance #1540:      PASS — Chromium + WebKit
browser artifact:               9173706386
artifact digest:                sha256:b020c1cf31ef4ecbfdb1dbc1907f54ceaa60abf0f11b8b89082adf7a9220f1c0
unresolved review threads:      0
product-owner final retest:     PASS — «Все 3 теста PASS»
```

No architecture authority, project schema, M2 fit/collision rules, hosted-opening validation, `wallId`, recognition threshold or semantic-history contract was weakened to obtain acceptance.

Next delivery gate: fresh exact-head CI + Chromium/WebKit after this acceptance truth-sync, then Ready state and protected squash merge. M8.3 remains blocked until M8.2 is integrated into `main`.

---

"""
text = replace_once(text, marker, marker + entry, "CHANGELOG acceptance entry")
text = replace_once(
    text,
    "**Status:** product-code GREEN in Draft PR #87; final docs-head verification and one focused product-owner door-UX confirmation remain **PENDING**.",
    "**Status:** product-code GREEN and final product-owner door-UX confirmation **PASS**; superseded by the M8.2 milestone acceptance entry above.",
    "CHANGELOG door status",
)
path.write_text(text)
