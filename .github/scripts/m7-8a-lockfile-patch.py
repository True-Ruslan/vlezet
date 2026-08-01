from __future__ import annotations

import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
BRANCH = "feat/m7-8a-recognition-benchmark-foundation"


def run(*args: str) -> None:
    subprocess.run(args, cwd=ROOT, check=True)


run("pnpm", "install", "--lockfile-only")
run("pnpm", "install", "--frozen-lockfile")
run("git", "config", "user.name", "github-actions[bot]")
run("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
run("git", "add", "pnpm-lock.yaml")
run("git", "commit", "-m", "build: sync recognition benchmark lockfile")
run("git", "push", "origin", f"HEAD:{BRANCH}")
