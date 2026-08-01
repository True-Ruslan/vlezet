from __future__ import annotations

import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
CI_PATH = ROOT / ".github/workflows/ci.yml"
SCRIPT_PATH = pathlib.Path(__file__).resolve()
START = "\n  # BEGIN M7_8A_LOCKFILE_PATCH\n"
END = "  # END M7_8A_LOCKFILE_PATCH\n"
BRANCH = "feat/m7-8a-recognition-benchmark-foundation"


def run(*args: str) -> None:
    subprocess.run(args, cwd=ROOT, check=True)


run("pnpm", "install", "--lockfile-only")
run("pnpm", "install", "--frozen-lockfile")

workflow = CI_PATH.read_text(encoding="utf-8")
if START not in workflow or END not in workflow:
    raise RuntimeError("Temporary CI patch markers are missing.")
before, remainder = workflow.split(START, 1)
_, after = remainder.split(END, 1)
CI_PATH.write_text(before + "\n" + after, encoding="utf-8")
SCRIPT_PATH.unlink()

run("git", "config", "user.name", "github-actions[bot]")
run("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
run("git", "add", "pnpm-lock.yaml", ".github/workflows/ci.yml", ".github/scripts/m7-8a-lockfile-patch.py")
run("git", "commit", "-m", "build: sync recognition benchmark lockfile")
run("git", "push", "origin", f"HEAD:{BRANCH}")
