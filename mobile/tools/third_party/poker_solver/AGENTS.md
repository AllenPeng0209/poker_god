# Repository Guidelines

## Project Overview
This repo builds a no-limit Texas hold'em river subgame solver, starting with Kuhn and Leduc poker. Core algorithms include CFR, CFR+, external-sampling MCCFR, Fictitious Play (simul/alt), and FLOP. The Python implementation is the reference; the optimized C++ implementation lives in `cpp/`. Optimize only after matching Python results.

## Project Structure & Module Organization
- `python/` reference implementation with `python/src/algorithms/`, `python/src/games/`, `python/src/cli/`, and `python/tests/`.
- `cpp/` optimized river solver (performance-focused).
- `docs/` design notes and algorithm references (add if needed).
- `configs/` run configs (YAML/JSON) for reproducible experiments (add if needed).
- `scripts/` or `experiments/` reproducible runs and benchmarks (add if needed).
- `artifacts/` generated results; keep large outputs out of git (add if needed).

## Build, Test, and Development Commands
Standardize developer commands in a `Makefile` (add if missing) and keep targets stable:
- `make setup` - install dependencies and tooling.
- `make test` - run the full test suite (all languages present).
- `make lint` - static checks.
- `make fmt` - formatting.
- `make run LANG=python GAME=kuhn ALGO=cfr` - local run for a given game/algorithm.
Until a `Makefile` exists, use direct commands like `python -m pytest python/tests`.

## Coding Style & Naming Conventions
- Indentation: 4 spaces, no tabs; keep files ASCII.
- Names: `snake_case` for functions/modules, `PascalCase` for types, `UPPER_SNAKE` for constants.
- Prefer pure functions and immutable data where practical; centralize RNG and logging.
- Tooling: Python uses `ruff` (format/lint) and `mypy` (types); Rust uses `rustfmt` and `clippy`; C++ uses `clang-format` and `clang-tidy` once configured.

## Testing Guidelines
- Framework: `pytest` for Python unit and convergence tests.
- Naming: `python/tests/test_*.py`; use deterministic seeds.
- Add regression tests for exploitability thresholds on Kuhn/Leduc; ports must match these results.
- Coverage: keep algorithm modules at >=90%; justify any exclusions.

## Commit & Pull Request Guidelines
- Git history is not established yet; use Conventional Commits (e.g., `feat: add leduc infoset abstraction`).
- Keep commits scoped to a single change; land Python changes before porting to Rust/C++.
- PRs include summary, motivation, tests run, and any convergence plots/metrics; link related issues.

## Reproducibility & Configuration
- Keep experiment configs in `configs/` (YAML/JSON).
- Log seed, game parameters, and algorithm settings for every run.
- Store outputs under `artifacts/` and avoid committing large files.
