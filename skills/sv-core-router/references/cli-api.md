# Standardized CLI JSON API & Log-CI Specification (`sv-v6.0`)

Formal JSON Schemas live at `<suite>/schemas/`:
- `schemas/cli_envelope.schema.json`
- `schemas/role_log.schema.json`
- `schemas/review_record.schema.json`

## 1. Standardized CLI Exit Codes
| Code | Meaning |
|---|---|
| `0` | Success / PASS — all requested checks or gate transitions succeeded |
| `1` | Domain CI / Lint Failure (`ci script\|voice\|design\|shots\|audio\|delivery`, `review submit`) |
| `2` | Log-CI Failure (`ci log`, `LG-01..LG-12`, or malformed `log` call) |
| `3` | Verification Gate Blocked (`gate check\|pass`: missing upstream gate, review, or cooldown) |
| `4` | Environment / Preflight Doctor Failure (`doctor`, `status`) |
| `5` | Role / Hook Policy Violation (`SV_ACTOR_ROLE != orchestrator` attempting `gate pass`) |

## 2. Standard JSON Envelope (`--json`)
Every `sv_cli.py` subcommand with `--json` returns ONE JSON object conforming to `schemas/cli_envelope.schema.json`:
```json
{
  "schema_version": "6.0",
  "ok": true,
  "exit_code": 0,
  "command": "gate check G5",
  "episode": {"slug": "tap-01", "root": "...", "track": "short", "format": "9:16", "suite_version": "6.0.0"},
  "stage": "G5",
  "unit": null,
  "actor": {"role": "orchestrator", "id": "coord-1"},
  "timestamp_utc": "2026-11-25T03:00:00Z",
  "duration_ms": 142,
  "inputs_sha": {},
  "outputs_sha": {},
  "metrics": {},
  "pillars": {
    "artifacts_and_domain_ci": {"ok": true, "summary": "PASS"},
    "executor_log_ci": {"ok": true, "summary": "PASS"},
    "reviewer_log_ci": {"ok": true, "summary": "PASS"},
    "orchestrator_log_ci": {"ok": true, "summary": "PASS"}
  },
  "checks": [],
  "errors": [],
  "warnings": [],
  "next_actions": ["python scripts/sv_cli.py gate pass G5 --actor coord-1"],
  "log_ref": "logs/gates.jsonl#L1"
}
```

## 3. 12-Rule Log-CI (`LG-01..LG-12`, `scripts/sv_log_lint.py`)
| ID | Enforced Invariant |
|---|---|
| `LG-01` | Role log file presence & JSON schema validity (`schemas/role_log.schema.json`) |
| `LG-02` | SHA-256 hash-chain integrity (`prev_sha` → `entry_sha`, tamper detection) |
| `LG-03` | Mandatory `read_skill` logged with verified SHA-256 matching the active track's skill |
| `LG-04` | Run lifecycle completeness (`init` → steps → `complete` with valid `verdict`) |
| `LG-05` | Executor Domain CI proof (`exit_code == 0`, cross-checked against `logs/ci_lint.jsonl`) |
| `LG-06` | Output artifact hash integrity (every output exists & matches current disk SHA-256) |
| `LG-07` | Visual/audio evidence inspection proof (`inspect_visual`/`inspect_audio`/`cross_check` matching disk SHA-256 + `>= 6`-word non-boilerplate note) |
| `LG-08` | Strict role separation (`reviewer.actor_id != executor.actor_id`; only `orchestrator` passes gates) |
| `LG-09` | Reviewer G5 blind-review submission (`submit_review` + `qa/review/NN.json` including `continuity`) |
| `LG-10` | Orchestrator G5 Cross-Check (`contact_p*.jpg` + `>= max(3, ceil(10% * N_shots))` cards + all HOT crops) |
| `LG-11` | Orchestrator user approval proof on `G1`/`G2`/`G4` (`user_approval` matching `gates/G#.review.md`) |
| `LG-12` | Chronological causal ordering (`Executor complete <= Reviewer complete <= Orchestrator complete`) |
