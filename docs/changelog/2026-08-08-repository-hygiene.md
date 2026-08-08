# Repository hygiene — 2026-08-08

**Status:** accepted repository-maintenance work on `main`; no Vlezet product/runtime behaviour intentionally changed.

## Why

Before starting M8.1, the public repository was cleaned so that the visible GitHub surface, contribution path, CI ownership and security defaults matched the actual project rather than historical milestone scaffolding.

## Repository foundation

PR #63 (`0979fbc902d61435e103210de0e083a1f29e999e`) refreshed the public repository surface and added:

- a current product/architecture README;
- `SECURITY.md` and `CONTRIBUTING.md`;
- pull-request and structured issue templates;
- Dependabot configuration;
- `.editorconfig` and `.gitattributes`;
- read-only workflow permissions, non-persistent checkout credentials and stale-run cancellation.

Repository settings were also hardened outside Git history:

- squash-only merges;
- automatic branch deletion after merge;
- protected `main` with strict required `verify` status;
- linear history;
- force-push and branch deletion disabled;
- conversation resolution required;
- Secret Scanning and Push Protection enabled;
- Dependabot vulnerability alerts/security fixes enabled;
- Private Vulnerability Reporting enabled;
- default Actions `GITHUB_TOKEN` permission reduced to read-only;
- GitHub-managed CodeQL Default Setup enabled.

## Branch cleanup

Historical M7 feature/docs/temp branches and accidental placeholder branches were removed after preserving `main`, every open-PR head and Dependabot branches. The only long-lived development head intentionally retained is the current M8 design PR branch while PR #62 remains open.

## Workflow cleanup and correction

GitHub's Actions UI retained historical workflow registrations from old milestone/helper workflows. Inspection of the current default branch confirmed that the tracked repository-owned workflow set is only:

```text
.github/workflows/ci.yml
.github/workflows/m7-browser-audit.yml
.github/workflows/recognition-benchmark.yml
```

PR #72 (`493220f5f5f035c485c4768fa089fce932307ce7`) was titled as workflow cleanup, but its actual diff did not remove workflow files and accidentally introduced a root `package-lock.json` in the pnpm workspace. This was treated as a failed cleanup attempt rather than accepted evidence.

PR #73 (`bb178a03613f535ce0decb6f1ac80ad440190061`) corrected the fallout by:

- removing the accidental `package-lock.json`;
- removing invalid Dependabot label references that caused bot configuration warnings.

Its exact head passed the full `CI/verify` path before squash merge.

## Actions runtime modernization

The three active workflows were then upgraded one action at a time, with the exact PR head required to pass CI, Recognition Benchmark, Chromium acceptance and WebKit representative smoke before each merge:

```text
PR #65  actions/checkout        v4 -> v7  merge 9807792608a7163f7877310db35f7e4ff84fe675
PR #64  actions/upload-artifact v4 -> v7  merge 3111a2c4197f235b97caeead0f7be2095a772260
PR #66  actions/setup-node      v4 -> v7  merge ba69d2701594caaa2f78746ccb6345d5fdf58d5c
PR #74  pnpm/action-setup       v4 -> v6  merge b5f3677f8e62c8c5de303a1b56391f7ae9a52d97
```

The project pnpm version remains pinned to `11.15.1`; the action update did not silently change the package manager version.

## Ownership

PR #75 (`232d89e74979f76e87ce671534496cfc7275391a`) added a minimal `.github/CODEOWNERS` file with `@True-Ruslan` as the default repository owner. This documents ownership without changing the current zero-external-approval branch-protection policy.

## Dependency maintenance

PR #70 (`51f230e123a832901a5403f018434a59c2e9c9cd`) updated `pdfjs-dist` from `6.1.200` to `6.2.108`. The exact head passed CI, Recognition Benchmark, Chromium acceptance and WebKit representative smoke before squash merge.

The narrower Next.js security update remains intentionally gated by the pnpm `minimumReleaseAge` supply-chain policy until its newly resolved transitive dependency exits quarantine. The policy was not weakened or bypassed.

## Deliberate non-actions

- No license was selected automatically. Licensing is an owner/legal decision.
- Historical workflow run evidence was not deleted because milestone records reference exact runs/artifacts.
- Whole-plan recognition R&D was not restored to the beta-critical path.
- M8.1 product/runtime code was not started; PR #62's explicit implementation-approval gate remains authoritative.
- Dependabot major/grouped dependency updates are not auto-merged merely to reduce PR count.

## Result

The public repository now has a small active workflow surface, explicit ownership and contribution/security contracts, protected linear integration, GitHub-native security scanning, and substantially less stale branch noise. Repository maintenance remains separate from M8 product implementation.
