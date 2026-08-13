from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one marker, got {count}")
    return text.replace(old, new, 1)

MERGE = "e323e331a435ae356b91decbdea80dde95028d8a"

# PROJECT_STATE
p = Path("docs/PROJECT_STATE.md")
t = p.read_text()
t = replace_once(t,
    "**Status:** M0–M8.1 are implemented, product-accepted and merged. M8.2 Precision Drawing / Direct Manipulation Foundation is **PRODUCT-OWNER ACCEPTED** on head `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7` in PR #87. The final focused door-UX retest passed all three requested scenarios. Canonical acceptance record `docs/milestones/m8-2-acceptance.md` is created; protected merge remains pending until fresh exact-head CI + Chromium/WebKit Browser Acceptance are GREEN after this acceptance truth-sync. M8.3 remains blocked until M8.2 is integrated into `main`.",
    f"**Status:** M0–M8.2 are implemented, product-accepted and merged. M8.2 Precision Drawing / Direct Manipulation Foundation was protected squash-merged into `main` as `{MERGE}` after final product-owner PASS, exact-head CI + Chromium/WebKit acceptance, and post-merge CI + CodeQL GREEN. Canonical acceptance record: `docs/milestones/m8-2-acceptance.md`. The next product milestone is M8.3 Precision Reference Calibration; before new product work, the active engineering priority is the project-wide testing-policy and coverage audit requested by the product owner.",
    "PROJECT_STATE status")
t = replace_once(t,
    "| M8.2 | product-owner accepted on `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7`; protected merge pending |",
    f"| M8.2 | product-owner accepted and protected squash-merged as `{MERGE}` |",
    "PROJECT_STATE milestone table")
t = replace_once(t,
    "### M8.2 structural precision / direct manipulation — product-owner accepted / merge pending",
    "### M8.2 structural precision / direct manipulation — accepted and merged",
    "PROJECT_STATE M8.2 heading")
t = replace_once(t,
    "PR #87 implements the approved structural precision design plus later product-owner corrections while preserving M8.1 runtime and structural authority boundaries. Product-owner acceptance was granted on `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7`; `docs/milestones/m8-2-acceptance.md` is the canonical acceptance record. Protected integration remains pending fresh exact-head delivery gates.",
    f"PR #87 implemented the approved structural precision design plus later product-owner corrections while preserving M8.1 runtime and structural authority boundaries. Product-owner acceptance was granted on `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7`; protected squash merge `{MERGE}` is now in `main`. `docs/milestones/m8-2-acceptance.md` is the canonical acceptance record.",
    "PROJECT_STATE M8.2 intro")
t = replace_once(t,
    "DONE      M8.1  Editor Interaction Foundation\nACCEPTED  M8.2  Precision Drawing / Direct Manipulation Foundation\n          product-owner PASS on c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7;\n          acceptance record created;\nNOW       M8.2  Protected integration\n          fresh exact-head CI + Chromium/WebKit Browser Acceptance;\n          Ready + protected squash merge pending\nBLOCKED   M8.3  Precision Reference Calibration — until M8.2 merge",
    f"DONE  M8.1  Editor Interaction Foundation\nDONE  M8.2  Precision Drawing / Direct Manipulation Foundation — merged {MERGE}\nNOW   Engineering testing-policy + coverage audit\nTHEN  M8.3  Precision Reference Calibration",
    "PROJECT_STATE sequence")
p.write_text(t)

# ROADMAP
p = Path("docs/ROADMAP.md")
t = p.read_text()
t = replace_once(t,
    "ACCEPTED    M8.2 Precision Drawing / Direct Manipulation Foundation\n            product-owner PASS on c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7;\n            acceptance record created;\nNOW         M8.2 protected integration\n            fresh exact-head CI + Chromium/WebKit Browser Acceptance;\n            Ready + protected squash merge pending\nBLOCKED     M8.3 Precision Reference Calibration — until M8.2 merge",
    f"DONE        M8.2 Precision Drawing / Direct Manipulation Foundation — merged {MERGE}\nNOW         Engineering testing-policy + coverage audit\nTHEN        M8.3 Precision Reference Calibration",
    "ROADMAP summary")
t = replace_once(t,
    "M8.2 is **PRODUCT-OWNER ACCEPTED** in PR #87 on `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7`. Multiple product-owner rounds deliberately reopened the gate whenever a real interaction gap was found; the final door-acquisition correction is now manually confirmed PASS. Canonical acceptance record: `docs/milestones/m8-2-acceptance.md`. The active work is delivery-only: fresh exact-head CI + Chromium/WebKit Browser Acceptance after acceptance truth-sync, then Ready state and protected squash merge. M8.3 remains blocked until integration.",
    f"M8.2 is **PRODUCT-OWNER ACCEPTED AND MERGED**. PR #87 was protected squash-merged into `main` as `{MERGE}` after final exact-head CI + Chromium/WebKit acceptance; post-merge CI #5097 and CodeQL also passed. Canonical acceptance record: `docs/milestones/m8-2-acceptance.md`. M8.3 is technically unblocked, but the product owner requested a project-wide testing-policy and coverage audit before further product development, so that engineering-quality initiative is the current priority.",
    "ROADMAP M8.2 paragraph")
p.write_text(t)

# UX ROADMAP
p = Path("docs/product/UX_ROADMAP.md")
t = p.read_text()
t = replace_once(t,
    "ACCEPTED\nM8.2 Precision Drawing / Direct Manipulation Foundation\n  - final focused product-owner door-UX retest PASS\n  - accepted head c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7\n  - acceptance record docs/milestones/m8-2-acceptance.md\n\nNOW\nM8.2 protected integration\n  - fresh exact-head CI + Chromium/WebKit Browser Acceptance\n  - Ready + protected squash merge pending\n\nBLOCKED\nM8.3 Precision Reference Calibration — until M8.2 merge",
    f"DONE\nM8.2 Precision Drawing / Direct Manipulation Foundation\n  - product-owner PASS\n  - protected squash merge {MERGE}\n  - post-merge CI + CodeQL GREEN\n\nNOW\nEngineering testing-policy + coverage audit\n\nTHEN\nM8.3 Precision Reference Calibration",
    "UX sequence")
t = replace_once(t,
    "M8.2: #56 / PR #87 — product-owner accepted, protected merge pending. M8.3: #57.",
    f"M8.2: #56 / PR #87 — accepted and merged as `{MERGE}`. M8.3: #57.",
    "UX tracker")
t = replace_once(t,
    "**Status:** PRODUCT-OWNER ACCEPTED on `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7` / PROTECTED MERGE PENDING. Canonical record: `docs/milestones/m8-2-acceptance.md`.",
    f"**Status:** PRODUCT-OWNER ACCEPTED / PROTECTED SQUASH-MERGED as `{MERGE}`. Post-merge CI and CodeQL GREEN. Canonical record: `docs/milestones/m8-2-acceptance.md`.",
    "UX M8.2 status")
p.write_text(t)

# ACCEPTANCE RECORD
p = Path("docs/milestones/m8-2-acceptance.md")
t = p.read_text()
t = replace_once(t,
    "**Status:** PRODUCT-OWNER ACCEPTED — PROTECTED MERGE PENDING",
    f"**Protected squash merge:** `{MERGE}`  \n**Status:** PRODUCT-OWNER ACCEPTED — MERGED / POST-MERGE VERIFIED",
    "acceptance status")
t = replace_once(t,
    "## Remaining delivery gate\n\nProduct acceptance does not by itself constitute merge. Before integration:\n\n1. synchronize canonical M8.2 acceptance state in `docs/CHANGELOG.md`, `docs/PROJECT_STATE.md`, `docs/ROADMAP.md` and `docs/product/UX_ROADMAP.md`;\n2. run fresh exact-head CI and Chromium/WebKit Browser Acceptance after those documentation changes;\n3. mark PR #87 Ready only after those gates are green;\n4. perform the repository's protected squash merge using the accepted delivery authorization;\n5. verify the actual squash-merge identity and required Actions on `main`;\n6. close #56 only after successful integration and update canonical state if the merge identity requires a post-merge record.\n\nM8.3 must not begin before M8.2 is integrated into `main`.",
    f"## Integration result\n\nPR #87 was protected squash-merged into `main` as `{MERGE}`. Post-merge verification on that exact SHA completed successfully:\n\n```text\nmain merge SHA:                 {MERGE}\nCI #5097 / run 31683756642:    PASS\nGitHub CodeQL run 31683756298: PASS\nissue #56:                      CLOSED / completed\n```\n\nM8.2 delivery is complete. M8.3 is technically unblocked; the product owner requested a project-wide testing-policy and coverage audit before further product development.",
    "acceptance integration")
p.write_text(t)

# CHANGELOG
p = Path("docs/CHANGELOG.md")
t = p.read_text()
t = replace_once(t,
    "## 2026-08-13 — M8.2 product-owner accepted; protected integration pending\n\n**Status:** PRODUCT-OWNER ACCEPTED on `c1fbf6e5619f179c1e0c1afe4b3dd948a21516b7`; protected merge remains pending fresh acceptance-head delivery gates.",
    f"## 2026-08-13 — M8.2 product-owner accepted and merged\n\n**Status:** PRODUCT-OWNER ACCEPTED / PROTECTED SQUASH-MERGED as `{MERGE}` / POST-MERGE VERIFIED.",
    "CHANGELOG heading")
t = replace_once(t,
    "Next delivery gate: fresh exact-head CI + Chromium/WebKit after this acceptance truth-sync, then Ready state and protected squash merge. M8.3 remains blocked until M8.2 is integrated into `main`.",
    f"Integration completed as `{MERGE}`. Post-merge CI #5097 and CodeQL run 31683756298 both PASS; issue #56 is closed. M8.3 is technically unblocked, but the product owner requested a project-wide testing-policy and coverage audit before further product work.",
    "CHANGELOG integration")
p.write_text(t)
