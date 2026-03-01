from __future__ import annotations

import subprocess
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]

CHECKS: list[tuple[str, list[str], Path]] = [
    (
        "backend unit tests (US-001)",
        [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_validation_error_contract.py", "-q"],
        API_ROOT,
    ),
    (
        "backend compile sanity",
        [sys.executable, "-m", "py_compile", "app/main.py", "app/services.py", "app/schemas.py"],
        API_ROOT,
    ),
]


def run_check(label: str, command: list[str], cwd: Path) -> None:
    print(f"\n[quality-gate] {label}")
    print("$", " ".join(command))
    completed = subprocess.run(command, cwd=cwd, check=False)
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


def main() -> None:
    for label, command, cwd in CHECKS:
        run_check(label, command, cwd)
    print("\n[quality-gate] PASS")


if __name__ == "__main__":
    main()
