# Security Policy

## Supported code

Security fixes are made against the current `main` branch. Historical milestone branches and closed experimental recognition branches are not supported release lines.

## Reporting a vulnerability

**Do not publish exploit details, credentials, private apartment plans or other sensitive evidence in a public issue.**

Use GitHub's private vulnerability reporting / Security Advisory flow for this repository. Include only the information needed to reproduce and assess the problem:

- affected commit or version;
- affected area and prerequisites;
- minimal reproduction steps;
- expected vs actual security boundary;
- realistic impact;
- a minimal proof of concept when necessary;
- suggested mitigation, if known.

If the report involves a leaked credential, revoke/rotate it first and never paste the live secret into the report.

## Security boundaries

Vlezet intentionally follows these rules:

- `VlezetDocument` is the sole persistent apartment/layout source of truth;
- local editing must not require a network connection;
- API keys and provider credentials are runtime-only and must not be persisted in projects, backups, fixtures or evidence artifacts;
- user source plans are private by default and must not be committed to the repository without an explicit public-data decision;
- AI/CV output is non-authoritative and cannot bypass deterministic geometry validation;
- existing geometry is never silently replaced by recognition or AI;
- project files and migrations must fail closed on malformed/unsupported data rather than partially applying uncertain state;
- GitHub Actions should use least-privilege permissions and must not expose secrets to untrusted pull-request code.

## Repository hygiene

Before opening a pull request:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

For recognition-related work also run the repository-owned benchmark gates documented in `README.md` and `docs/PROJECT_STATE.md`.

Do not commit:

- `.env` files or API keys;
- private source plans;
- raw provider responses containing sensitive data;
- generated debug artifacts unless they are explicitly sanitized and required as reviewed evidence;
- production credentials in examples, tests or workflow files.

## Disclosure and fixes

Security reports are validated against the current repository state. A fix should include a regression test whenever the failure is mechanically reproducible. Public disclosure should happen only after the relevant secret is revoked and/or the fix is available.