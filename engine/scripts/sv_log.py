#!/usr/bin/env python3
"""Immutable Hash-Chained Role Logger & Standardized CLI Envelope Helpers (v6.0.0).

Maintains tamper-evident SHA-256 hash-chained JSONL logs under <episode>/logs/:
  - logs/orchestrator.jsonl
  - logs/executor_<actor_id>.jsonl
  - logs/reviewer_<actor_id>.jsonl
  - logs/ci_lint.jsonl
  - logs/gates.jsonl

Every entry follows schemas/role_log.schema.json. Hand-editing or deleting any line
breaks the prev_sha -> entry_sha hash chain and fails Log-CI (LG-02).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

for _st in (sys.stdout, sys.stderr):
    if hasattr(_st, "reconfigure"):
        _st.reconfigure(encoding="utf-8", errors="replace")

SCHEMA_VERSION = "6.0"
GENESIS_SHA = "0" * 64
VALID_ROLES = ("orchestrator", "executor", "reviewer", "ci")
VALID_EVENTS = ("init", "step", "complete", "ci_result", "gate_pass", "gate_fail")
VALID_ACTIONS = (
    None,
    "read_skill",
    "read_evidence",
    "edit",
    "run_tool",
    "inspect_visual",
    "inspect_audio",
    "submit_review",
    "submit_design_scores",
    "cross_check",
    "user_approval",
    "decision",
    "handoff",
)
VALID_STAGE_RE = re.compile(r"^G[1-7](?:\.U\d+)?$")
ACTOR_SAFE_RE = re.compile(r"[^a-zA-Z0-9_-]+")


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def resolve_root(explicit: str | Path | None = None) -> Path:
    if explicit:
        return Path(explicit).resolve()
    here = Path(__file__).resolve().parent.parent
    markers = (".episode.json", ".suite.json", "script.json", "brief.md")
    if any((here / m).exists() for m in markers):
        return here
    cwd = Path.cwd().resolve()
    for p in (cwd, *cwd.parents):
        if any((p / m).exists() for m in markers):
            return p
    return cwd


def sha256_file(path: Path) -> str | None:
    if not path.is_file():
        return None
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_rel(root: Path, target: str) -> str | None:
    p = Path(target)
    if not p.is_absolute():
        p = root / target
    return sha256_file(p)


def canonical_entry_sha(entry_without_sha: dict[str, Any]) -> str:
    payload = {k: v for k, v in entry_without_sha.items() if k != "entry_sha"}
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


def resolve_episode_meta(root: Path) -> dict[str, Any]:
    ep_file = root / ".episode.json"
    suite_file = root / ".suite.json"
    sc_file = root / "script.json"

    track = "short"
    fmt = "9:16"
    suite_version = "6.0.0"

    if ep_file.is_file():
        try:
            d = json.loads(ep_file.read_text(encoding="utf-8"))
            track = str(d.get("track") or track)
            fmt = str(d.get("format") or ("16:9" if track == "long" else "9:16"))
            suite_version = str(d.get("suite_version") or suite_version)
        except Exception:
            pass
    else:
        if suite_file.is_file():
            try:
                suite_version = str(json.loads(suite_file.read_text(encoding="utf-8")).get("suite_version") or suite_version)
            except Exception:
                pass
        if sc_file.is_file():
            try:
                sc = json.loads(sc_file.read_text(encoding="utf-8"))
                if sc.get("format") == "16:9" or sc.get("length") == "long_16x9":
                    track = "long"
                    fmt = "16:9"
            except Exception:
                pass
    return {
        "slug": root.name,
        "root": str(root).replace("\\", "/"),
        "track": track if track in ("short", "long") else "short",
        "format": fmt if fmt in ("9:16", "16:9") else ("16:9" if track == "long" else "9:16"),
        "suite_version": suite_version,
    }


def sanitize_actor_id(actor_id: str) -> str:
    clean = ACTOR_SAFE_RE.sub("-", str(actor_id or "").strip()).strip("-")
    if len(clean) < 2:
        raise ValueError(f"invalid actor_id {actor_id!r} (need >= 2 alphanumeric/_/- chars)")
    return clean


def log_path_for(root: Path, role: str, actor_id: str | None = None) -> Path:
    logs_dir = root / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    if role == "orchestrator":
        return logs_dir / "orchestrator.jsonl"
    if role == "ci":
        return logs_dir / "ci_lint.jsonl"
    if role == "gate":
        return logs_dir / "gates.jsonl"
    if role in ("executor", "reviewer"):
        aid = sanitize_actor_id(actor_id or role)
        return logs_dir / f"{role}_{aid}.jsonl"
    raise ValueError(f"unknown role {role!r}")


def load_log(path: Path) -> tuple[list[dict[str, Any]], list[str]]:
    if not path.is_file():
        return [], []
    entries: list[dict[str, Any]] = []
    parse_errors: list[str] = []
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw.strip():
            continue
        try:
            obj = json.loads(raw)
            if not isinstance(obj, dict):
                parse_errors.append(f"{path.name}:L{lineno} entry is not a JSON object")
                continue
            entries.append(obj)
        except json.JSONDecodeError as exc:
            parse_errors.append(f"{path.name}:L{lineno} invalid JSON: {exc}")
    return entries, parse_errors


def verify_chain(path: Path) -> tuple[bool, list[str], list[dict[str, Any]]]:
    entries, errs = load_log(path)
    if errs:
        return False, errs, entries
    prev = GENESIS_SHA
    for idx, e in enumerate(entries, start=1):
        if e.get("seq") != idx:
            errs.append(f"{path.name}:L{idx} seq={e.get('seq')} expected {idx}")
        if e.get("prev_sha") != prev:
            errs.append(f"{path.name}:L{idx} prev_sha mismatch (hash chain broken / tampered)")
        expected_sha = canonical_entry_sha(e)
        if e.get("entry_sha") != expected_sha:
            errs.append(f"{path.name}:L{idx} entry_sha mismatch (line modified after write)")
        prev = str(e.get("entry_sha") or "")
    return len(errs) == 0, errs, entries


def append_entry(path: Path, fields: dict[str, Any]) -> tuple[dict[str, Any], int]:
    ok, chain_errs, existing = verify_chain(path)
    if not ok:
        raise RuntimeError(f"refusing to append to tampered log {path.name}: {chain_errs[0]}")
    seq = len(existing) + 1
    prev_sha = existing[-1]["entry_sha"] if existing else GENESIS_SHA
    entry: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "seq": seq,
        "timestamp_utc": utc_now(),
        **fields,
        "prev_sha": prev_sha,
    }
    entry["entry_sha"] = canonical_entry_sha(entry)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\n")
    return entry, seq


def find_run(root: Path, run_id: str) -> tuple[Path, dict[str, Any]] | None:
    logs_dir = root / "logs"
    if not logs_dir.is_dir():
        return None
    for p in sorted(logs_dir.glob("*.jsonl")):
        entries, errs = load_log(p)
        if errs:
            continue
        for e in entries:
            if e.get("run_id") == run_id and e.get("event") == "init":
                return p, e
    return None


def init_run(
    root: Path,
    *,
    role: str,
    actor_id: str,
    stage: str,
    task: str,
    scope: str | None = None,
    unit: str | None = None,
    inputs: list[str] | None = None,
) -> tuple[dict[str, Any], str]:
    if role not in ("orchestrator", "executor", "reviewer"):
        raise ValueError(f"role must be orchestrator|executor|reviewer (got {role!r})")
    if not VALID_STAGE_RE.match(stage):
        raise ValueError(f"invalid stage {stage!r} (expected G1..G7 or G5.U1)")
    aid = sanitize_actor_id(actor_id)
    meta = resolve_episode_meta(root)
    run_id = f"{stage.lower()}-{role[:4]}-{aid}-{uuid.uuid4().hex[:8]}"
    inputs_sha = {p: sha256_rel(root, p) for p in (inputs or [])}
    lp = log_path_for(root, role, aid)
    entry, lineno = append_entry(
        lp,
        {
            "run_id": run_id,
            "role": role,
            "actor_id": aid,
            "track": meta["track"],
            "stage": stage,
            "unit": unit,
            "event": "init",
            "action": None,
            "target": None,
            "target_sha": None,
            "command": None,
            "exit_code": None,
            "result": "ok",
            "verdict": None,
            "scope": scope or "",
            "approval": None,
            "user_quote": None,
            "inputs_sha": inputs_sha,
            "outputs_sha": {},
            "metrics": {},
            "note": task.strip(),
        },
    )
    return entry, f"logs/{lp.name}#L{lineno}"


def log_step(
    root: Path,
    *,
    run_id: str,
    action: str,
    target: str | None = None,
    command: str | None = None,
    exit_code: int | None = None,
    result: str = "ok",
    note: str = "",
    approval: str | None = None,
    user_quote: str | None = None,
    metrics: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], str]:
    if action not in VALID_ACTIONS or action is None:
        raise ValueError(f"invalid action {action!r}")
    found = find_run(root, run_id)
    if not found:
        raise ValueError(f"unknown run_id {run_id!r} — call `sv_cli.py log init` first")
    lp, init_entry = found
    t_sha = None
    if target:
        t_sha = sha256_rel(root, target)
        if action in ("read_skill", "read_evidence", "inspect_visual", "inspect_audio", "cross_check") and t_sha is None:
            raise FileNotFoundError(f"target file does not exist on disk: {target!r} (cannot log inspection of missing file)")
    entry, lineno = append_entry(
        lp,
        {
            "run_id": run_id,
            "role": init_entry["role"],
            "actor_id": init_entry["actor_id"],
            "track": init_entry["track"],
            "stage": init_entry["stage"],
            "unit": init_entry.get("unit"),
            "event": "step",
            "action": action,
            "target": target.replace("\\", "/") if target else None,
            "target_sha": t_sha,
            "command": command,
            "exit_code": exit_code,
            "result": result,
            "verdict": None,
            "scope": init_entry.get("scope"),
            "approval": approval,
            "user_quote": user_quote,
            "inputs_sha": {},
            "outputs_sha": {},
            "metrics": metrics or {},
            "note": note.strip(),
        },
    )
    return entry, f"logs/{lp.name}#L{lineno}"


def complete_run(
    root: Path,
    *,
    run_id: str,
    verdict: str,
    outputs: list[str] | None = None,
    note: str = "",
    metrics: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], str]:
    if verdict not in ("pass", "fix", "blocked"):
        raise ValueError(f"verdict must be pass|fix|blocked (got {verdict!r})")
    found = find_run(root, run_id)
    if not found:
        raise ValueError(f"unknown run_id {run_id!r}")
    lp, init_entry = found
    out_sha: dict[str, str | None] = {}
    missing: list[str] = []
    for p in outputs or []:
        p = p.strip()
        if not p:
            continue
        h = sha256_rel(root, p)
        if h is None:
            missing.append(p)
        out_sha[p.replace("\\", "/")] = h
    if missing and verdict == "pass":
        raise FileNotFoundError(f"cannot complete run with verdict=pass when outputs are missing: {missing}")
    entry, lineno = append_entry(
        lp,
        {
            "run_id": run_id,
            "role": init_entry["role"],
            "actor_id": init_entry["actor_id"],
            "track": init_entry["track"],
            "stage": init_entry["stage"],
            "unit": init_entry.get("unit"),
            "event": "complete",
            "action": None,
            "target": None,
            "target_sha": None,
            "command": None,
            "exit_code": 0 if verdict == "pass" else 1,
            "result": "ok" if verdict == "pass" else verdict,
            "verdict": verdict,
            "scope": init_entry.get("scope"),
            "approval": None,
            "user_quote": None,
            "inputs_sha": {},
            "outputs_sha": out_sha,
            "metrics": metrics or {},
            "note": note.strip(),
        },
    )
    return entry, f"logs/{lp.name}#L{lineno}"


def log_ci_event(
    root: Path,
    *,
    stage: str,
    domain: str,
    actor_id: str,
    command: str,
    exit_code: int,
    metrics: dict[str, Any],
    inputs_sha: dict[str, str | None] | None = None,
    outputs_sha: dict[str, str | None] | None = None,
    note: str = "",
    unit: str | None = None,
) -> tuple[dict[str, Any], str]:
    meta = resolve_episode_meta(root)
    lp = log_path_for(root, "ci")
    entry, lineno = append_entry(
        lp,
        {
            "run_id": f"ci-{domain}-{uuid.uuid4().hex[:8]}",
            "role": "ci",
            "actor_id": sanitize_actor_id(actor_id or "sv-ci"),
            "track": meta["track"],
            "stage": stage if VALID_STAGE_RE.match(stage) else "G1",
            "unit": unit,
            "event": "ci_result",
            "action": "run_tool",
            "target": domain,
            "target_sha": None,
            "command": command,
            "exit_code": int(exit_code),
            "result": "ok" if exit_code == 0 else "fail",
            "verdict": "pass" if exit_code == 0 else "fix",
            "scope": domain,
            "approval": None,
            "user_quote": None,
            "inputs_sha": inputs_sha or {},
            "outputs_sha": outputs_sha or {},
            "metrics": metrics or {},
            "note": note.strip(),
        },
    )
    return entry, f"logs/{lp.name}#L{lineno}"


def make_envelope(
    root: Path,
    *,
    ok: bool,
    exit_code: int,
    command: str,
    stage: str | None = None,
    unit: str | None = None,
    actor_role: str = "system",
    actor_id: str = "sv-cli",
    duration_ms: int = 0,
    inputs_sha: dict[str, str | None] | None = None,
    outputs_sha: dict[str, str | None] | None = None,
    metrics: dict[str, Any] | None = None,
    pillars: dict[str, Any] | None = None,
    checks: list[dict[str, Any]] | None = None,
    errors: list[str] | None = None,
    warnings: list[str] | None = None,
    next_actions: list[str] | None = None,
    log_ref: str | None = None,
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "ok": bool(ok),
        "exit_code": int(exit_code),
        "command": command,
        "episode": resolve_episode_meta(root),
        "stage": stage,
        "unit": unit,
        "actor": {"role": actor_role, "id": actor_id},
        "timestamp_utc": utc_now(),
        "duration_ms": max(0, int(duration_ms)),
        "inputs_sha": inputs_sha or {},
        "outputs_sha": outputs_sha or {},
        "metrics": metrics or {},
        "pillars": pillars,
        "checks": checks or [],
        "errors": errors or [],
        "warnings": warnings or [],
        "next_actions": next_actions or [],
        "log_ref": log_ref,
    }
