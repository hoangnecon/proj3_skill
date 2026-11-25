#!/usr/bin/env python3
"""Unified Story Video Skills CLI & Standardized JSON API Dispatcher (v6.0.0).

Single canonical CLI for Orchestrator, Executor, and Reviewer roles:
  python scripts/sv_cli.py status [--json]
  python scripts/sv_cli.py doctor --stage <G> [--json]
  python scripts/sv_cli.py log init --role <r> --actor <id> --stage <G> --task "<t>" [--scope "<s>"] [--unit <U>] [--inputs p1,p2] [--json]
  python scripts/sv_cli.py log step --run <id> --action <a> [--target "<p>"] [--cmd "<c>"] [--exit-code 0] [--result ok] [--note "<n>"] [--approval user|delegated] [--user-quote "<q>"] [--json]
  python scripts/sv_cli.py log complete --run <id> --verdict <pass|fix|blocked> --outputs "<p1,p2>" --note "<n>" [--json]
  python scripts/sv_cli.py ci <script|voice|design|shots|audio|delivery|log> [--stage <G>] [--role <r>] [--actor <id>] [--unit <U>] [--allow-fix] [--json]
  python scripts/sv_cli.py review submit --batch <file.jsonl> --actor <id> --run <run_id> [--json]
  python scripts/sv_cli.py gate check <G> [--unit <U>] [--json]
  python scripts/sv_cli.py gate pass <G> --actor <orch_id> [--unit <U>] [--json]

Exit Codes (standardized):
  0 = PASS / OK
  1 = Domain CI / Lint Failure
  2 = Log-CI Failure (LG-01..LG-12)
  3 = Verification Gate Blocked (missing upstream gate, user approval, role violation, or cooldown)
  4 = Environment / Preflight Doctor Failure
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))
import sv_log as L
import sv_log_lint as LL

DOMAIN_STAGE_MAP = {
    "script": "G2",
    "voice": "G3",
    "design": "G4",
    "shots": "G5",
    "audio": "G6",
    "delivery": "G7",
}


def _py_for_audio() -> str:
    sv_py = os.environ.get("SV_PY")
    if sv_py and Path(sv_py).is_file():
        return sv_py
    win_default = Path(r"C:\Work\Tools\VieNeu-TTS\.venv\Scripts\python.exe")
    if win_default.is_file():
        return str(win_default)
    return sys.executable


def _run_proc(cmd: list[str], cwd: Path, timeout_s: int = 300) -> tuple[int, str, str, int]:
    t0 = time.monotonic()
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout_s)
    dt = int((time.monotonic() - t0) * 1000)
    return r.returncode, r.stdout, r.stderr, dt


def _emit(env: dict[str, Any], as_json: bool) -> None:
    if as_json:
        print(json.dumps(env, ensure_ascii=False, indent=2))
    else:
        badge = "PASS" if env["ok"] else f"FAIL(exit={env['exit_code']})"
        ep = env["episode"]
        st = f" · {env['stage']}" if env.get("stage") else ""
        un = f" ({env['unit']})" if env.get("unit") else ""
        print(f"[sv_cli v6.0] {env['command']}{st}{un} · {ep['slug']} [{ep['track']}/{ep['format']}] -> {badge} ({env['duration_ms']} ms)")
        if env.get("pillars"):
            for pname, pval in env["pillars"].items():
                pok = "OK" if pval.get("ok") else "FAIL"
                print(f"  pillar {pname:<20}: {pok}  {pval.get('summary', '')}")
        if env.get("metrics"):
            m_str = "  ".join(f"{k}={v}" for k, v in env["metrics"].items() if not isinstance(v, (dict, list)))
            if m_str:
                print(f"  metrics: {m_str}")
        for e in env.get("errors", []):
            print(f"  ERROR: {e}")
        for w in env.get("warnings", []):
            print(f"  WARN : {w}")
        if env.get("log_ref"):
            print(f"  log  : {env['log_ref']}")
        for na in env.get("next_actions", []):
            print(f"  next : {na}")
    sys.exit(env["exit_code"])


def cmd_status(root: Path, as_json: bool) -> None:
    t0 = time.monotonic()
    rc, out, err_s, dt = _run_proc([sys.executable, str(root / "scripts" / "sv_gate.py"), "status", "--brief"], root)
    state_p = root / "qa" / "state.json"
    state = json.loads(state_p.read_text(encoding="utf-8")) if state_p.is_file() else {}
    logs_dir = root / "logs"
    log_summary = {}
    if logs_dir.is_dir():
        for lf in sorted(logs_dir.glob("*.jsonl")):
            ok_c, c_errs, entries = L.verify_chain(lf)
            log_summary[lf.name] = {
                "entries": len(entries),
                "chain_ok": ok_c,
                "last_stage": entries[-1].get("stage") if entries else None,
                "last_event": entries[-1].get("event") if entries else None,
                "errors": c_errs[:2],
            }
    next_cmds = []
    if isinstance(state.get("next"), str) and state["next"]:
        next_cmds.append(state["next"])
    env = L.make_envelope(
        root,
        ok=(rc == 0),
        exit_code=0 if rc == 0 else 4,
        command="status",
        actor_role="system",
        actor_id="sv-cli",
        duration_ms=dt,
        metrics={"gates": state.get("gates", {}), "logs": log_summary},
        errors=[err_s.strip()] if rc != 0 and err_s.strip() else [],
        next_actions=next_cmds,
    )
    if not as_json and out.strip():
        print(out.strip())
    _emit(env, as_json)


def cmd_doctor(root: Path, stage: str, as_json: bool) -> None:
    cmd = [sys.executable, str(root / "scripts" / "sv_doctor.py"), "--stage", stage, "--json"]
    rc, out, err_s, dt = _run_proc(cmd, root)
    parsed = {}
    try:
        parsed = json.loads(out)
    except Exception:
        parsed = {"raw": out[-500:]}
    env = L.make_envelope(
        root,
        ok=(rc == 0),
        exit_code=0 if rc == 0 else 4,
        command=f"doctor --stage {stage}",
        stage=stage if stage != "all" else None,
        actor_role="system",
        actor_id="sv-doctor",
        duration_ms=dt,
        metrics={"doctor_ok": rc == 0, "summary": parsed.get("stages") if isinstance(parsed, dict) else None},
        errors=[] if rc == 0 else [err_s.strip() or f"sv_doctor failed for {stage}"],
    )
    _emit(env, as_json)


def cmd_log(root: Path, args: argparse.Namespace) -> None:
    t0 = time.monotonic()
    try:
        if args.log_cmd == "init":
            inps = [x.strip() for x in (args.inputs or "").split(",") if x.strip()]
            entry, ref = L.init_run(
                root,
                role=args.role,
                actor_id=args.actor,
                stage=args.stage,
                task=args.task,
                scope=args.scope,
                unit=args.unit,
                inputs=inps,
            )
            env = L.make_envelope(
                root,
                ok=True,
                exit_code=0,
                command="log init",
                stage=args.stage,
                unit=args.unit,
                actor_role=args.role,
                actor_id=entry["actor_id"],
                duration_ms=int((time.monotonic() - t0) * 1000),
                inputs_sha=entry["inputs_sha"],
                metrics={"run_id": entry["run_id"], "seq": entry["seq"]},
                log_ref=ref,
            )
        elif args.log_cmd == "step":
            entry, ref = L.log_step(
                root,
                run_id=args.run,
                action=args.action,
                target=args.target,
                command=args.step_cmd,
                exit_code=args.exit_code,
                result=args.result,
                note=args.note,
                approval=args.approval,
                user_quote=args.user_quote,
            )
            env = L.make_envelope(
                root,
                ok=True,
                exit_code=0,
                command=f"log step ({args.action})",
                stage=entry["stage"],
                unit=entry.get("unit"),
                actor_role=entry["role"],
                actor_id=entry["actor_id"],
                duration_ms=int((time.monotonic() - t0) * 1000),
                metrics={"run_id": entry["run_id"], "seq": entry["seq"], "target_sha": entry.get("target_sha")},
                log_ref=ref,
            )
        elif args.log_cmd == "complete":
            outs = [x.strip() for x in (args.outputs or "").split(",") if x.strip()]
            entry, ref = L.complete_run(
                root,
                run_id=args.run,
                verdict=args.verdict,
                outputs=outs,
                note=args.note,
            )
            env = L.make_envelope(
                root,
                ok=True,
                exit_code=0,
                command="log complete",
                stage=entry["stage"],
                unit=entry.get("unit"),
                actor_role=entry["role"],
                actor_id=entry["actor_id"],
                duration_ms=int((time.monotonic() - t0) * 1000),
                outputs_sha=entry["outputs_sha"],
                metrics={"run_id": entry["run_id"], "verdict": entry["verdict"], "outputs": len(entry["outputs_sha"])},
                log_ref=ref,
                next_actions=[f"python scripts/sv_cli.py ci log --stage {entry['stage']} --role {entry['role']} --actor {entry['actor_id']}"],
            )
        else:
            raise ValueError(f"unknown log subcommand {args.log_cmd}")
    except Exception as exc:
        env = L.make_envelope(
            root,
            ok=False,
            exit_code=2,
            command=f"log {args.log_cmd}",
            actor_role=getattr(args, "role", "system") or "system",
            actor_id=getattr(args, "actor", "sv-cli") or "sv-cli",
            duration_ms=int((time.monotonic() - t0) * 1000),
            errors=[str(exc)],
        )
    _emit(env, args.json)


def cmd_ci(root: Path, args: argparse.Namespace) -> None:
    dom = args.domain
    if dom == "log":
        if not args.stage:
            _emit(
                L.make_envelope(root, ok=False, exit_code=2, command="ci log", errors=["--stage is required for `ci log`"]),
                args.json,
            )
        env = LL.audit_logs(
            root,
            stage=args.stage,
            role=args.role,
            actor_filter=args.actor,
            unit=args.unit,
            allow_fix_verdict=args.allow_fix,
        )
        _, ref = L.log_ci_event(
            root,
            stage=args.stage,
            domain="log",
            actor_id=args.actor or "sv-log-lint",
            command=env["command"],
            exit_code=env["exit_code"],
            metrics=env["metrics"],
            note="Log-CI PASS" if env["ok"] else "; ".join(env["errors"][:3]),
            unit=args.unit,
        )
        env["log_ref"] = ref
        _emit(env, args.json)
        return

    stage = args.stage or DOMAIN_STAGE_MAP[dom]
    errors: list[str] = []
    warnings: list[str] = []
    metrics: dict[str, Any] = {}
    in_sha: dict[str, str | None] = {}
    out_sha: dict[str, str | None] = {}

    if dom == "script":
        cmd = [sys.executable, str(root / "scripts" / "script_lint.py")]
        in_sha = {f: L.sha256_rel(root, f) for f in ("brief.md", "beats.md", "script.json")}
        rc, out, err_s, dt = _run_proc(cmd, root)
        rep_p = root / "qa" / "script_lint.json"
        if rep_p.is_file():
            rep = json.loads(rep_p.read_text(encoding="utf-8"))
            errors = list(rep.get("errors", []))
            warnings = list(rep.get("warns", []))
            metrics = {k: rep.get(k) for k in ("segments", "words", "est_seconds", "sent_mean", "sent_sd") if k in rep}
            out_sha["qa/script_lint.json"] = L.sha256_file(rep_p)
        elif rc != 0:
            errors = [err_s.strip() or out.strip()[-300:]]
    elif dom == "voice":
        cmd = [sys.executable, str(root / "scripts" / "sv_gate.py"), "check", "G3"]
        in_sha = {f: L.sha256_rel(root, f) for f in ("script.json", "standards/voice_standard.json", "standards/pacing.json")}
        rc, out, err_s, dt = _run_proc(cmd, root)
        vr_p = root / "qa" / "voice_report.json"
        if vr_p.is_file():
            vr = json.loads(vr_p.read_text(encoding="utf-8"))
            metrics = {"total_s": vr.get("total"), "words": vr.get("words"), "overall_wps": vr.get("wps"), "failed_lines": len(vr.get("failed_lines") or {})}
            for c in vr.get("episode_checks", []):
                if not c.get("ok"):
                    errors.append(f"{c['group']}.{c['check']} = {c['value']} outside {c['range']}")
            for sid, fails in (vr.get("failed_lines") or {}).items():
                errors.append(f"line {sid} failed: {fails}")
            out_sha["qa/voice_report.json"] = L.sha256_file(vr_p)
            rc = 0 if not errors else 1
        else:
            errors = ["qa/voice_report.json missing — run python scripts/voice.py"]
            rc = 1
    elif dom in ("design", "shots"):
        cmd = ["node", str(root / "scripts" / "lint.mjs"), dom]
        rc, out, err_s, dt = _run_proc(cmd, root)
        for ln in out.splitlines():
            if ln.startswith("ERROR"):
                errors.append(ln)
            elif ln.startswith("WARN"):
                warnings.append(ln)
        if rc != 0 and not errors:
            errors.append(err_s.strip() or out.strip()[-300:])
        metrics = {"errors": len(errors), "warnings": len(warnings)}
        if (root / "qa" / "lint.json").is_file():
            out_sha["qa/lint.json"] = L.sha256_file(root / "qa" / "lint.json")
    elif dom == "audio":
        cmd = [_py_for_audio(), str(root / "scripts" / "audio_qa.py")]
        in_sha = {f: L.sha256_rel(root, f) for f in ("audio.json", "standards/mix_targets.json")}
        rc, out, err_s, dt = _run_proc(cmd, root)
        mr_p = root / "qa" / "mix_report.json"
        if mr_p.is_file():
            mr = json.loads(mr_p.read_text(encoding="utf-8"))
            qa_checks = (mr.get("qa") or {}).get("checks") or []
            for c in qa_checks:
                if not c.get("ok"):
                    errors.append(f"{c['group']}.{c['check']} = {c['value']} outside {c['range']}")
            metrics = {"checks_total": len(qa_checks), "checks_passed": sum(1 for c in qa_checks if c.get("ok"))}
            out_sha["qa/mix_report.json"] = L.sha256_file(mr_p)
        elif rc != 0:
            errors = [err_s.strip() or out.strip()[-300:]]
    elif dom == "delivery":
        cmd = [_py_for_audio(), str(root / "scripts" / "audio_qa.py"), "--video", "out/final.mp4"]
        rc, out, err_s, dt = _run_proc(cmd, root)
        dr_p = root / "qa" / "deliver_report.json"
        va_p = root / "qa" / "video_audio.json"
        if dr_p.is_file():
            dr = json.loads(dr_p.read_text(encoding="utf-8"))
            metrics.update({k: dr.get(k) for k in ("duration", "expected", "width", "height", "fps")})
            out_sha["qa/deliver_report.json"] = L.sha256_file(dr_p)
        else:
            errors.append("qa/deliver_report.json missing — run node scripts/deliver.mjs")
        if va_p.is_file():
            va = json.loads(va_p.read_text(encoding="utf-8"))
            for c in (va.get("final.mp4") or {}).get("checks", []):
                if not c.get("ok"):
                    errors.append(f"final.mp4 audio {c['check']} = {c['value']} outside {c['range']}")
            out_sha["qa/video_audio.json"] = L.sha256_file(va_p)
        elif rc != 0:
            errors.append(err_s.strip() or "video audio QA failed")
        rc = 0 if not errors and rc == 0 else 1
    else:
        raise SystemExit(f"unknown domain {dom}")

    ok = rc == 0 and len(errors) == 0
    _, ref = L.log_ci_event(
        root,
        stage=stage,
        domain=dom,
        actor_id=args.actor or "sv-ci",
        command=" ".join(cmd),
        exit_code=0 if ok else 1,
        metrics=metrics,
        inputs_sha=in_sha,
        outputs_sha=out_sha,
        note=f"{dom} CI PASS" if ok else f"{dom} CI FAIL ({len(errors)} errors)",
        unit=args.unit,
    )
    env = L.make_envelope(
        root,
        ok=ok,
        exit_code=0 if ok else 1,
        command=f"ci {dom}",
        stage=stage,
        unit=args.unit,
        actor_role="ci",
        actor_id=args.actor or "sv-ci",
        duration_ms=dt,
        inputs_sha=in_sha,
        outputs_sha=out_sha,
        metrics=metrics,
        errors=errors,
        warnings=warnings,
        log_ref=ref,
        next_actions=(
            [f"python scripts/sv_cli.py log step --run <run_id> --action run_tool --target {dom} --exit-code 0 --result ok --note \"...\""]
            if ok
            else [f"Fix all {len(errors)} {dom} CI error(s) and re-run `python scripts/sv_cli.py ci {dom}`"]
        ),
    )
    _emit(env, args.json)


def cmd_review_submit(root: Path, args: argparse.Namespace) -> None:
    t0 = time.monotonic()
    batch_p = Path(args.batch)
    if not batch_p.is_absolute():
        batch_p = root / args.batch
    if not batch_p.is_file():
        _emit(
            L.make_envelope(root, ok=False, exit_code=1, command="review submit", stage="G5", errors=[f"batch file missing: {args.batch}"]),
            args.json,
        )
    cmd = ["node", str(root / "scripts" / "qa.mjs"), "review", "--batch", str(batch_p)]
    rc, out, err_s, dt = _run_proc(cmd, root)
    ok_count = 0
    fix_items: list[dict[str, Any]] = []
    for ln in batch_p.read_text(encoding="utf-8").splitlines():
        if not ln.strip():
            continue
        try:
            rec = json.loads(ln)
            if rec.get("verdict") == "ok":
                ok_count += 1
            else:
                fix_items.append({"shot": rec.get("shot"), "note": rec.get("note")})
        except Exception:
            pass
    step_ref = None
    rev_stage = "G5"
    rev_unit = None
    if args.run:
        found_run = L.find_run(root, args.run)
        if found_run:
            rev_stage = str(found_run[1].get("stage") or "G5")
            rev_unit = found_run[1].get("unit")
        _, step_ref = L.log_step(
            root,
            run_id=args.run,
            action="submit_review",
            target=str(batch_p.relative_to(root)).replace("\\", "/") if batch_p.is_relative_to(root) else str(batch_p),
            command=" ".join(cmd),
            exit_code=rc,
            result="ok" if (rc == 0 and not fix_items) else ("fix" if rc == 0 else "fail"),
            note=f"Submitted blind review batch ({ok_count} ok, {len(fix_items)} fix, rc={rc})",
            metrics={"ok_count": ok_count, "fix_count": len(fix_items)},
        )
    unit_suffix = f" --unit {rev_unit}" if rev_unit else ""
    env = L.make_envelope(
        root,
        ok=(rc == 0),
        exit_code=0 if rc == 0 else 1,
        command="review submit",
        stage=rev_stage,
        unit=rev_unit,
        actor_role="reviewer",
        actor_id=args.actor,
        duration_ms=int((time.monotonic() - t0) * 1000),
        metrics={"ok_count": ok_count, "fix_count": len(fix_items), "fix_shots": [x["shot"] for x in fix_items]},
        errors=[] if rc == 0 else [err_s.strip() or out.strip()[-400:]],
        log_ref=step_ref,
        next_actions=(
            [f"Complete reviewer run with verdict={'fix' if fix_items else 'pass'} and run `sv_cli.py ci log --stage {rev_stage} --role reviewer --actor {args.actor}{unit_suffix}`"]
            if rc == 0
            else ["Fix batch JSONL validation error and re-submit"]
        ),
    )
    _emit(env, args.json)


def cmd_gate(root: Path, args: argparse.Namespace) -> None:
    t0 = time.monotonic()
    raw_stage = str(args.stage or "").strip()
    unit = str(args.unit).strip() if args.unit else None
    if raw_stage.upper().startswith("G5.") and not unit:
        unit = raw_stage.split(".", 1)[1]
        stage = "G5"
    else:
        stage = raw_stage.upper()
    gate_stage = f"G5.{unit}" if (stage == "G5" and unit) else stage

    # Pillar 1 & 2: Domain gate check via sv_gate.py check
    sub = ["check-unit", unit] if (stage == "G5" and unit) else ["check", stage]
    rc_dom, out_dom, err_dom, _ = _run_proc([sys.executable, str(root / "scripts" / "sv_gate.py"), *sub], root)
    dom_errs = [ln.strip() for ln in out_dom.splitlines() if ln.strip().startswith("-") or "FAIL" in ln]

    # Pillars 3, 4, 5: Role Log-CI (executor + reviewer + orchestrator)
    log_env = LL.audit_logs(root, stage=gate_stage, role="all", unit=unit)
    exec_errs = [c["message"] for c in log_env["checks"] if c["group"] == "executor" and not c["ok"]]
    rev_errs = [c["message"] for c in log_env["checks"] if c["group"] in ("reviewer", "separation") and not c["ok"]]
    orch_errs = [c["message"] for c in log_env["checks"] if c["group"] in ("orchestrator", "chronology") and not c["ok"]]

    pillars = {
        "artifacts_and_domain_ci": {"ok": rc_dom == 0, "summary": "PASS" if rc_dom == 0 else f"{len(dom_errs)} issue(s)"},
        "executor_log_ci": {"ok": len(exec_errs) == 0, "summary": "PASS" if not exec_errs else exec_errs[0]},
        "reviewer_log_ci": {"ok": len(rev_errs) == 0, "summary": "PASS" if not rev_errs else rev_errs[0]},
        "orchestrator_log_ci": {"ok": len(orch_errs) == 0, "summary": "PASS" if not orch_errs else orch_errs[0]},
    }
    all_errors = ([] if rc_dom == 0 else [out_dom.strip() or err_dom.strip()]) + log_env["errors"]
    all_ok = rc_dom == 0 and log_env["ok"]

    if args.gate_cmd == "check":
        exit_c = 0 if all_ok else (2 if (rc_dom == 0 and not log_env["ok"]) else 3)
        env = L.make_envelope(
            root,
            ok=all_ok,
            exit_code=exit_c,
            command=f"gate check {gate_stage}",
            stage=gate_stage,
            unit=unit,
            actor_role="orchestrator",
            actor_id=args.actor or "coordinator",
            duration_ms=int((time.monotonic() - t0) * 1000),
            pillars=pillars,
            checks=log_env["checks"],
            errors=all_errors,
            warnings=log_env["warnings"],
            next_actions=(
                [f"python scripts/sv_cli.py gate pass {stage} --actor {args.actor or 'coordinator'}" + (f" --unit {unit}" if unit else "")]
                if all_ok
                else ["Resolve all failing pillars before running `gate pass`"]
            ),
        )
        _emit(env, args.json)
        return

    # gate pass — enforce orchestrator role + all 5 pillars!
    caller_role = os.environ.get("SV_ACTOR_ROLE", "orchestrator").strip().lower()
    if caller_role != "orchestrator":
        _emit(
            L.make_envelope(
                root,
                ok=False,
                exit_code=5,
                command=f"gate pass {gate_stage}",
                stage=gate_stage,
                unit=unit,
                actor_role="system",
                actor_id=args.actor or caller_role,
                duration_ms=int((time.monotonic() - t0) * 1000),
                errors=[f"ROLE_VIOLATION: SV_ACTOR_ROLE={caller_role!r} is forbidden from running `gate pass` (only orchestrator may pass gates)"],
            ),
            args.json,
        )
    if not args.actor:
        _emit(
            L.make_envelope(root, ok=False, exit_code=3, command=f"gate pass {gate_stage}", stage=gate_stage, errors=["--actor <orchestrator_id> is required"]),
            args.json,
        )
    if not all_ok:
        exit_c = 2 if (rc_dom == 0 and not log_env["ok"]) else 3
        _emit(
            L.make_envelope(
                root,
                ok=False,
                exit_code=exit_c,
                command=f"gate pass {gate_stage}",
                stage=gate_stage,
                unit=unit,
                actor_role="orchestrator",
                actor_id=args.actor,
                duration_ms=int((time.monotonic() - t0) * 1000),
                pillars=pillars,
                checks=log_env["checks"],
                errors=all_errors,
            ),
            args.json,
        )

    pass_sub = ["pass-unit", unit] if (stage == "G5" and unit) else ["pass", stage]
    env_vars = os.environ.copy()
    env_vars["SV_CLI_VERIFIED"] = "1"
    env_vars["SV_ACTOR_ROLE"] = "orchestrator"
    env_vars["SV_ACTOR_ID"] = args.actor
    r_pass = subprocess.run(
        [sys.executable, str(root / "scripts" / "sv_gate.py"), *pass_sub],
        cwd=root,
        env=env_vars,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    ok_pass = r_pass.returncode == 0
    log_ref = None
    if ok_pass:
        _, log_ref = L.append_entry(
            L.log_path_for(root, "gate"),
            {
                "run_id": f"gate-{gate_stage.lower()}",
                "role": "orchestrator",
                "actor_id": L.sanitize_actor_id(args.actor),
                "track": L.resolve_episode_meta(root)["track"],
                "stage": gate_stage,
                "unit": unit,
                "event": "gate_pass",
                "action": "decision",
                "target": gate_stage,
                "target_sha": L.sha256_rel(root, "gates/log.jsonl"),
                "command": f"sv_cli.py gate pass {gate_stage}",
                "exit_code": 0,
                "result": "pass",
                "verdict": "pass",
                "scope": gate_stage,
                "approval": None,
                "user_quote": None,
                "inputs_sha": {},
                "outputs_sha": {"gates/log.jsonl": L.sha256_rel(root, "gates/log.jsonl")},
                "metrics": log_env["metrics"],
                "note": f"5-pillar Verification Gate {gate_stage} PASSED by orchestrator {args.actor}",
            },
        )
    env = L.make_envelope(
        root,
        ok=ok_pass,
        exit_code=0 if ok_pass else 3,
        command=f"gate pass {gate_stage}",
        stage=gate_stage,
        unit=unit,
        actor_role="orchestrator",
        actor_id=args.actor,
        duration_ms=int((time.monotonic() - t0) * 1000),
        pillars=pillars,
        checks=log_env["checks"],
        errors=[] if ok_pass else [r_pass.stdout.strip() or r_pass.stderr.strip()],
        log_ref=log_ref,
    )
    _emit(env, args.json)


def main() -> None:
    ap = argparse.ArgumentParser(prog="sv_cli.py", description="Story Video Skills v6.0 Unified CLI & JSON API.")
    ap.add_argument("--root", default=None, help="Episode directory root")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_st = sub.add_parser("status", help="Show episode track, gate DAG, and role log status")
    p_st.add_argument("--json", action="store_true")

    p_doc = sub.add_parser("doctor", help="Run zero-cost stage preflight doctor")
    p_doc.add_argument("--stage", default="all")
    p_doc.add_argument("--json", action="store_true")

    p_log = sub.add_parser("log", help="Write immutable hash-chained role logs")
    lsub = p_log.add_subparsers(dest="log_cmd", required=True)

    p_li = lsub.add_parser("init")
    p_li.add_argument("--role", required=True, choices=["orchestrator", "executor", "reviewer"])
    p_li.add_argument("--actor", required=True)
    p_li.add_argument("--stage", required=True)
    p_li.add_argument("--task", required=True)
    p_li.add_argument("--scope", default="")
    p_li.add_argument("--unit", default=None)
    p_li.add_argument("--inputs", default="")
    p_li.add_argument("--json", action="store_true")

    p_ls = lsub.add_parser("step")
    p_ls.add_argument("--run", required=True)
    p_ls.add_argument("--action", required=True)
    p_ls.add_argument("--target", default=None)
    p_ls.add_argument("--cmd", dest="step_cmd", default=None)
    p_ls.add_argument("--exit-code", type=int, default=None)
    p_ls.add_argument("--result", default="ok", choices=["ok", "fail", "fix", "blocked", "pass"])
    p_ls.add_argument("--note", default="")
    p_ls.add_argument("--approval", default=None, choices=["user", "delegated"])
    p_ls.add_argument("--user-quote", default=None)
    p_ls.add_argument("--json", action="store_true")

    p_lc = lsub.add_parser("complete")
    p_lc.add_argument("--run", required=True)
    p_lc.add_argument("--verdict", required=True, choices=["pass", "fix", "blocked"])
    p_lc.add_argument("--outputs", default="")
    p_lc.add_argument("--note", default="")
    p_lc.add_argument("--json", action="store_true")

    p_ci = sub.add_parser("ci", help="Run Domain CI or Log-CI (LG-01..LG-12)")
    p_ci.add_argument("domain", choices=["script", "voice", "design", "shots", "audio", "delivery", "log"])
    p_ci.add_argument("--stage", default=None)
    p_ci.add_argument("--role", default="all", choices=["all", "executor", "reviewer", "orchestrator"])
    p_ci.add_argument("--actor", default=None)
    p_ci.add_argument("--unit", default=None)
    p_ci.add_argument("--allow-fix", action="store_true")
    p_ci.add_argument("--json", action="store_true")

    p_rev = sub.add_parser("review", help="Blind review submission wrapper")
    rsub = p_rev.add_subparsers(dest="rev_cmd", required=True)
    p_rs = rsub.add_parser("submit")
    p_rs.add_argument("--batch", required=True)
    p_rs.add_argument("--actor", required=True)
    p_rs.add_argument("--run", default=None)
    p_rs.add_argument("--json", action="store_true")

    p_gate = sub.add_parser("gate", help="5-pillar Verification Gate (check / pass)")
    gsub = p_gate.add_subparsers(dest="gate_cmd", required=True)
    for gname in ("check", "pass"):
        pg = gsub.add_parser(gname)
        pg.add_argument("stage")
        pg.add_argument("--actor", default=None)
        pg.add_argument("--unit", default=None)
        pg.add_argument("--json", action="store_true")

    args = ap.parse_args()
    root = L.resolve_root(args.root)
    if args.cmd == "status":
        cmd_status(root, args.json)
    elif args.cmd == "doctor":
        cmd_doctor(root, args.stage, args.json)
    elif args.cmd == "log":
        cmd_log(root, args)
    elif args.cmd == "ci":
        cmd_ci(root, args)
    elif args.cmd == "review":
        cmd_review_submit(root, args)
    elif args.cmd == "gate":
        cmd_gate(root, args)


if __name__ == "__main__":
    main()
