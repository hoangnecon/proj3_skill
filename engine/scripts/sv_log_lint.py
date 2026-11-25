#!/usr/bin/env python3
"""Log-CI / Log-Lint Gate (LG-01..LG-12) for story-video-skills v6.0.0.

Every Executor run, Reviewer run, and Orchestrator audit run MUST pass Log-CI BEFORE
its stage output can enter the Verification Gate (`sv_gate.py pass` / `sv_cli.py gate pass`).

Rules implemented (LG-01..LG-12):
  LG-01  Log file presence & JSON schema validity (`schemas/role_log.schema.json`)
  LG-02  SHA-256 hash-chain integrity (`prev_sha` -> `entry_sha`, tamper detection)
  LG-03  Mandatory `read_skill` logged matching the episode track (`sv-core-*` / `sv-short-*` / `sv-long-*`)
  LG-04  Run lifecycle completeness (`init` -> steps -> `complete` with valid verdict)
  LG-05  Executor Domain CI execution proof (`exit_code == 0`, cross-checked against `logs/ci_lint.jsonl`)
  LG-06  Output artifact hash integrity (every output exists & matches current disk SHA-256)
  LG-07  Visual/audio evidence inspection proof (on-disk SHA-256 match + concrete note >= 6w, no boilerplate)
  LG-08  Strict role separation (`reviewer.actor_id != executor.actor_id`; only `orchestrator` passes gates)
  LG-09  Reviewer G5 blind-review completeness (`qa/review/NN.json` hash + `blind_sha` + `continuity` check)
  LG-10  Orchestrator G5 Cross-Check (`contact_p*.jpg` + >= max(3, ceil(10% * N_shots)) shot cards + HOT crops)
  LG-11  Orchestrator user approval proof on G1/G2/G4 (`user_approval` matching `gates/G#.review.md`)
  LG-12  Chronological causal ordering (Executor complete <= Reviewer complete <= Orchestrator pass)

Usage:
  python scripts/sv_log_lint.py --stage G5 [--role executor|reviewer|orchestrator|all] [--actor <id>] [--unit U1] [--json]

Exit codes: 0 = PASS, 2 = Log-CI FAIL.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sv_log as L

BOILERPLATE_NOTES = {
    "looks good",
    "looks great",
    "look good",
    "all good",
    "lgtm",
    "ok",
    "okay",
    "pass",
    "passed",
    "fine",
    "nice",
    "done",
    "checked",
    "verified",
    "good",
    "ổn",
    "đẹp",
    "xong",
    "đạt",
}

REQUIRED_DOMAIN_CI = {
    "G1": [],
    "G2": ["script"],
    "G3": ["voice"],
    "G4": ["design"],
    "G5": ["shots"],
    "G6": ["audio"],
    "G7": ["delivery"],
}

REQUIRED_SKILLS_BY_TRACK = {
    "short": {
        "G1": ("sv-short-script", "sv-core-bible"),
        "G2": ("sv-short-script",),
        "G3": ("sv-core-voice",),
        "G4": ("sv-short-design",),
        "G5": ("sv-short-production",),
        "G6": ("sv-core-audio",),
        "G7": ("sv-core-delivery",),
    },
    "long": {
        "G1": ("sv-long-script", "sv-core-bible"),
        "G2": ("sv-long-script",),
        "G3": ("sv-core-voice",),
        "G4": ("sv-long-design",),
        "G5": ("sv-long-production",),
        "G6": ("sv-core-audio",),
        "G7": ("sv-core-delivery",),
    },
}

# Stages that require an independent Reviewer log before Verification Gate PASS
REVIEWER_REQUIRED_STAGES = {"G1", "G2", "G4", "G5", "G7"}
USER_APPROVAL_STAGES = {"G1", "G2", "G4"}


def _is_meaningful_note(note: str, min_words: int = 6) -> bool:
    clean = re.sub(r"[^\w\sÀ-ỹ]", " ", str(note or "").strip().lower())
    clean = " ".join(clean.split())
    if not clean or clean in BOILERPLATE_NOTES:
        return False
    words = re.findall(r"[\wÀ-ỹ]+", clean)
    return len(words) >= min_words


def _stage_base(stage: str) -> str:
    return stage.split(".", 1)[0]


def _collect_role_logs(root: Path, role: str, actor_filter: str | None = None) -> list[Path]:
    logs_dir = root / "logs"
    if not logs_dir.is_dir():
        return []
    if role == "orchestrator":
        p = logs_dir / "orchestrator.jsonl"
        return [p] if p.is_file() else []
    if actor_filter:
        aid = L.sanitize_actor_id(actor_filter)
        p = logs_dir / f"{role}_{aid}.jsonl"
        return [p] if p.is_file() else []
    return sorted(logs_dir.glob(f"{role}_*.jsonl"))


def _group_runs(entries: list[dict[str, Any]], stage: str, unit: str | None = None) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for e in entries:
        rid = str(e.get("run_id") or "")
        if not rid:
            continue
        if e.get("stage") != stage:
            continue
        if unit and e.get("unit") not in (None, unit):
            continue
        if rid not in by_id:
            by_id[rid] = {"run_id": rid, "init": None, "steps": [], "complete": None, "all": []}
            order.append(rid)
        g = by_id[rid]
        g["all"].append(e)
        ev = e.get("event")
        if ev == "init":
            g["init"] = e
        elif ev == "step":
            g["steps"].append(e)
        elif ev == "complete":
            g["complete"] = e
    return [by_id[rid] for rid in order]


def _latest_complete_run(
    root: Path,
    role: str,
    stage: str,
    *,
    actor_filter: str | None = None,
    unit: str | None = None,
) -> tuple[Path | None, dict[str, Any] | None, list[str]]:
    paths = _collect_role_logs(root, role, actor_filter)
    errs: list[str] = []
    best_path: Path | None = None
    best_run: dict[str, Any] | None = None
    best_ts = ""
    for p in paths:
        ok, c_errs, entries = L.verify_chain(p)
        if not ok:
            errs.extend([f"LG-02 {e}" for e in c_errs])
            continue
        for run in _group_runs(entries, stage, unit=unit):
            comp = run.get("complete")
            ts = str((comp or run.get("init") or {}).get("timestamp_utc") or "")
            if comp is not None and ts >= best_ts:
                best_ts = ts
                best_path = p
                best_run = run
            elif best_run is None and run.get("init") is not None:
                best_path = p
                best_run = run
    return best_path, best_run, errs


def audit_logs(
    root: Path,
    *,
    stage: str,
    role: str = "all",
    actor_filter: str | None = None,
    unit: str | None = None,
    allow_fix_verdict: bool = False,
) -> dict[str, Any]:
    t0 = time.monotonic()
    meta = L.resolve_episode_meta(root)
    track = meta["track"]
    sbase = _stage_base(stage)
    checks: list[dict[str, Any]] = []
    errors: list[str] = []
    warnings: list[str] = []

    def add_check(cid: str, group: str, ok: bool, msg: str, *, value: Any = None, expected: Any = None, severity: str = "error") -> None:
        checks.append({
            "id": cid,
            "group": group,
            "ok": ok,
            "severity": "info" if ok else severity,
            "value": value,
            "expected": expected,
            "message": msg,
        })
        if not ok:
            if severity == "warning":
                warnings.append(f"[{cid}] {msg}")
            else:
                errors.append(f"[{cid}] {msg}")

    # Load CI log once (verify hash chain too!)
    ci_path = root / "logs" / "ci_lint.jsonl"
    ci_entries: list[dict[str, Any]] = []
    if ci_path.is_file():
        ci_ok, ci_errs, ci_entries = L.verify_chain(ci_path)
        add_check("LG-02", "ci_log", ci_ok, "logs/ci_lint.jsonl hash chain valid" if ci_ok else "; ".join(ci_errs))
    else:
        ci_entries = []

    roles_to_check = ["executor", "reviewer", "orchestrator"] if role == "all" else [role]
    found_runs: dict[str, dict[str, Any] | None] = {}
    found_actors: dict[str, str | None] = {}

    for rname in roles_to_check:
        af = actor_filter if role != "all" else None
        is_optional_reviewer = (rname == "reviewer" and sbase not in REVIEWER_REQUIRED_STAGES and role == "all")
        lp, run, chain_errs = _latest_complete_run(root, rname, stage, actor_filter=af, unit=unit)
        for ce in chain_errs:
            add_check("LG-02", rname, False, ce)

        if run is None:
            if is_optional_reviewer:
                add_check("LG-01", rname, True, f"{stage}: independent reviewer log optional for {sbase}")
                found_runs[rname] = None
                found_actors[rname] = None
                continue
            add_check(
                "LG-01",
                rname,
                False,
                f"no {rname} log run found for {stage} under logs/ — initialize with `sv_cli.py log init --role {rname} --stage {stage}`",
            )
            found_runs[rname] = None
            found_actors[rname] = None
            continue

        found_runs[rname] = run
        init_e = run.get("init")
        comp_e = run.get("complete")
        steps = run.get("steps", [])
        actor_id = str((init_e or comp_e or {}).get("actor_id") or "")
        found_actors[rname] = actor_id

        # LG-01 / LG-04: Schema & Lifecycle completeness
        has_init = init_e is not None
        has_comp = comp_e is not None
        verdict = (comp_e or {}).get("verdict")
        valid_verdict = verdict in ("pass", "fix") if (rname == "reviewer" and allow_fix_verdict) else (verdict == "pass")
        add_check(
            "LG-04",
            rname,
            has_init and has_comp and valid_verdict,
            f"{rname} ({actor_id}) run {run['run_id']} lifecycle complete (verdict={verdict})"
            if (has_init and has_comp and valid_verdict)
            else f"{rname} ({actor_id}) run {run['run_id']} incomplete or non-passing (init={has_init}, complete={has_comp}, verdict={verdict})",
            value=verdict,
            expected="pass" if not (rname == "reviewer" and allow_fix_verdict) else "pass|fix",
        )

        # LG-03: Mandatory read_skill for executor & reviewer
        if rname in ("executor", "reviewer"):
            req_skills = REQUIRED_SKILLS_BY_TRACK.get(track, REQUIRED_SKILLS_BY_TRACK["short"]).get(sbase, ())
            skill_steps = [s for s in steps if s.get("action") == "read_skill" and s.get("target_sha")]
            matched = []
            for sk in req_skills:
                if any(sk in str(s.get("target") or "") for s in skill_steps):
                    matched.append(sk)
            # Reviewer may read review-cards.md or the stage production/design skill
            if rname == "reviewer" and sbase == "G5":
                has_rev_doc = any(
                    ("review-cards" in str(s.get("target") or "") or any(sk in str(s.get("target") or "") for sk in req_skills))
                    for s in skill_steps
                )
                add_check(
                    "LG-03",
                    rname,
                    has_rev_doc,
                    f"reviewer ({actor_id}) logged reading review skill/reference with verified SHA-256"
                    if has_rev_doc
                    else f"reviewer ({actor_id}) missing `read_skill` step for {req_skills} or review-cards.md",
                )
            else:
                ok_sk = len(matched) >= 1 if req_skills else True
                add_check(
                    "LG-03",
                    rname,
                    ok_sk,
                    f"{rname} ({actor_id}) logged reading track skill {matched} (track={track})"
                    if ok_sk
                    else f"{rname} ({actor_id}) missing `read_skill` step for track='{track}' skill {list(req_skills)} with real target_sha",
                    value=matched,
                    expected=list(req_skills),
                )

        # LG-05: Executor Domain CI proof (cross-checked against logs/ci_lint.jsonl & on-disk lint reports)
        if rname == "executor":
            req_domains = REQUIRED_DOMAIN_CI.get(sbase, [])
            for dom in req_domains:
                step_ok = any(
                    s.get("action") == "run_tool"
                    and s.get("exit_code") == 0
                    and (dom in str(s.get("target") or "").lower() or dom in str(s.get("command") or "").lower())
                    for s in steps
                )
                dom_ci_recs = [c for c in ci_entries if c.get("event") == "ci_result" and c.get("target") == dom]
                ci_ok_rec = bool(dom_ci_recs) and dom_ci_recs[-1].get("exit_code") == 0
                ci_contradicted = bool(dom_ci_recs) and dom_ci_recs[-1].get("exit_code") != 0
                eff_unit_exec = unit or (stage.split(".", 1)[1] if "." in stage else None)
                disk_errs: list[str] = []
                if eff_unit_exec is None:
                    if dom in ("design", "shots") and (root / "qa" / "lint.json").is_file():
                        try:
                            lj = json.loads((root / "qa" / "lint.json").read_text(encoding="utf-8"))
                            disk_errs = list(lj.get("errors") or [])
                        except Exception:
                            disk_errs = ["unreadable qa/lint.json"]
                    elif dom == "script" and (root / "qa" / "script_lint.json").is_file():
                        try:
                            sj = json.loads((root / "qa" / "script_lint.json").read_text(encoding="utf-8"))
                            disk_errs = list(sj.get("errors") or [])
                        except Exception:
                            disk_errs = ["unreadable qa/script_lint.json"]
                ok_lg05 = (step_ok or ci_ok_rec) and not ci_contradicted and len(disk_errs) == 0
                add_check(
                    "LG-05",
                    rname,
                    ok_lg05,
                    f"executor ({actor_id}) passed required Domain CI '{dom}' (exit_code=0)"
                    if ok_lg05
                    else (
                        f"executor ({actor_id}) logged passing '{dom}' CI, but on-disk report/ci_lint still has failure(s): {disk_errs[:3]}"
                        if (ci_contradicted or disk_errs)
                        else f"executor ({actor_id}) missing passing Domain CI '{dom}' run — execute `sv_cli.py ci {dom}` and log step"
                    ),
                    value={"step": step_ok, "ci_log": ci_ok_rec, "disk_errors": len(disk_errs)},
                    expected=f"ci:{dom} exit_code=0, disk_errors=0",
                )

            # LG-06: Output artifact hash integrity
            outs = (comp_e or {}).get("outputs_sha") or {}
            if not outs:
                add_check("LG-06", rname, False, f"executor ({actor_id}) complete entry lists 0 outputs in outputs_sha")
            else:
                stale_outs = []
                for rel_p, logged_h in outs.items():
                    cur_h = L.sha256_rel(root, rel_p)
                    if not cur_h or cur_h != logged_h:
                        stale_outs.append(rel_p)
                add_check(
                    "LG-06",
                    rname,
                    len(stale_outs) == 0,
                    f"all {len(outs)} executor output SHA-256 hashes match disk"
                    if not stale_outs
                    else f"executor output(s) missing or modified after logging: {stale_outs[:6]}",
                    value=len(outs) - len(stale_outs),
                    expected=len(outs),
                )

        # LG-07: Visual / Audio evidence inspection proof (reviewer & orchestrator)
        if rname in ("reviewer", "orchestrator") and sbase in ("G3", "G4", "G5", "G6", "G7"):
            insp_actions = {"inspect_visual", "inspect_audio", "cross_check", "read_evidence"}
            insp_steps = [s for s in steps if s.get("action") in insp_actions]
            bad_insp = []
            valid_targets = set()
            for s in insp_steps:
                tgt = str(s.get("target") or "")
                t_sha = s.get("target_sha")
                cur_sha = L.sha256_rel(root, tgt) if tgt else None
                if not cur_sha or cur_sha != t_sha:
                    bad_insp.append(f"{tgt} (stale/missing SHA)")
                elif not _is_meaningful_note(str(s.get("note") or ""), min_words=6):
                    bad_insp.append(f"{tgt} (thin/boilerplate note <6w)")
                else:
                    valid_targets.add(Path(tgt).name)
            need_min = 1
            if sbase == "G4":
                need_min = 2  # at least cast + sets overview
            elif sbase == "G5" and rname == "reviewer":
                need_min = 1
            ok_insp = len(valid_targets) >= need_min and len(bad_insp) == 0
            add_check(
                "LG-07",
                rname,
                ok_insp,
                f"{rname} ({actor_id}) verified {len(valid_targets)} evidence file(s) with on-disk SHA-256 & concrete remarks"
                if ok_insp
                else f"{rname} ({actor_id}) visual/audio inspection invalid (valid={len(valid_targets)}/{need_min}, bad={bad_insp[:4]})",
                value=len(valid_targets),
                expected=f">={need_min}, 0 stale/thin",
            )

        # LG-09: Reviewer G5 blind review submission & full shot coverage check
        if rname == "reviewer" and sbase == "G5":
            rev_dir = root / "qa" / "review"
            rev_files = sorted(rev_dir.glob("*.json")) if rev_dir.is_dir() else []
            submit_steps = [s for s in steps if s.get("action") == "submit_review" and s.get("exit_code") == 0]
            eff_unit_rev = unit or (stage.split(".", 1)[1] if "." in stage else None)
            expected_shot_ids: list[int] = []
            pack_p = (
                (root / "qa" / "blind_review" / f"unit_{eff_unit_rev}.json")
                if eff_unit_rev
                else (root / "qa" / "blind_review" / "manifest.json")
            )
            if pack_p.is_file():
                try:
                    pk = json.loads(pack_p.read_text(encoding="utf-8"))
                    expected_shot_ids = sorted(
                        int(s["shot"]) for s in (pk.get("shots") or []) if isinstance(s, dict) and "shot" in s
                    )
                except Exception:
                    pass
            missing_shots = [
                f"{sid:02d}.json" for sid in expected_shot_ids if not (rev_dir / f"{sid:02d}.json").is_file()
            ]
            target_rev_files = (
                [rev_dir / f"{sid:02d}.json" for sid in expected_shot_ids if (rev_dir / f"{sid:02d}.json").is_file()]
                if expected_shot_ids
                else rev_files
            )
            missing_cont = []
            for rf in target_rev_files:
                try:
                    rd = json.loads(rf.read_text(encoding="utf-8"))
                    ch = rd.get("checks") or {}
                    if "continuity" not in ch:
                        missing_cont.append(rf.name)
                except Exception:
                    missing_cont.append(rf.name)
            ok_lg09 = len(submit_steps) >= 1 and len(target_rev_files) > 0 and len(missing_shots) == 0 and len(missing_cont) == 0
            add_check(
                "LG-09",
                rname,
                ok_lg09,
                f"reviewer ({actor_id}) submitted {len(target_rev_files)} blind review record(s) with full shot coverage & continuity check"
                if ok_lg09
                else f"reviewer ({actor_id}) G5 review proof incomplete (submit_steps={len(submit_steps)}, reviewed={len(target_rev_files)}, missing_shots={missing_shots[:5]}, missing_continuity={missing_cont[:5]})",
            )

        # LG-10: Orchestrator G5 / G5.U* Cross-Check proof
        if rname == "orchestrator" and sbase == "G5":
            insp_steps = [s for s in steps if s.get("action") in ("inspect_visual", "cross_check", "read_evidence") and s.get("target_sha")]
            insp_names = {Path(str(s.get("target") or "")).name for s in insp_steps if _is_meaningful_note(str(s.get("note") or ""), 6)}
            eff_unit = unit or (stage.split(".", 1)[1] if "." in stage else None)
            if eff_unit:
                unit_contact_name = f"{eff_unit}_contact.jpg"
                contact_pages = [unit_contact_name] if (root / "qa" / "units" / unit_contact_name).is_file() else [unit_contact_name]
                missing_contacts = [c for c in contact_pages if c not in insp_names]
                unit_shot_ids: set[int] = set()
                unit_pack_p = root / "qa" / "blind_review" / f"unit_{eff_unit}.json"
                if unit_pack_p.is_file():
                    try:
                        up = json.loads(unit_pack_p.read_text(encoding="utf-8"))
                        unit_shot_ids = {int(s["shot"]) for s in (up.get("shots") or []) if isinstance(s, dict) and "shot" in s}
                    except Exception:
                        pass
                all_cards = sorted(p.name for p in (root / "qa" / "cards").glob("*.jpg")) if (root / "qa" / "cards").is_dir() else []
                card_files = [f"{i:02d}.jpg" for i in sorted(unit_shot_ids) if f"{i:02d}.jpg" in all_cards] if unit_shot_ids else all_cards
                req_cards = min(len(card_files), max(1, math.ceil(len(card_files) * 0.10))) if card_files else 0
                insp_cards = [c for c in card_files if c in insp_names]
                hot_json = root / "qa" / "hot.json"
                raw_hot = list(json.loads(hot_json.read_text(encoding="utf-8")).keys()) if hot_json.is_file() else []
                hot_ids = [h for h in raw_hot if (not unit_shot_ids or int(h) in unit_shot_ids)]
            else:
                contact_pages = sorted(p.name for p in (root / "qa").glob("contact_p*.jpg")) if (root / "qa").is_dir() else []
                missing_contacts = [c for c in contact_pages if c not in insp_names]
                card_files = sorted(p.name for p in (root / "qa" / "cards").glob("*.jpg")) if (root / "qa" / "cards").is_dir() else []
                req_cards = min(len(card_files), max(3, math.ceil(len(card_files) * 0.10))) if card_files else 0
                insp_cards = [c for c in card_files if c in insp_names]
                hot_json = root / "qa" / "hot.json"
                hot_ids = list(json.loads(hot_json.read_text(encoding="utf-8")).keys()) if hot_json.is_file() else []
            missing_hot = [
                f"{int(h):02d}.jpg"
                for h in hot_ids
                if (root / "qa" / "crops" / f"{int(h):02d}.jpg").is_file()
                and not any(f"crops/{int(h):02d}.jpg" in str(s.get("target") or "").replace("\\", "/") for s in insp_steps)
            ]
            ok_lg10 = len(missing_contacts) == 0 and len(insp_cards) >= req_cards and len(missing_hot) == 0
            add_check(
                "LG-10",
                rname,
                ok_lg10,
                f"orchestrator cross-checked all {len(contact_pages)} contact sheet(s), {len(insp_cards)}/{req_cards} spot-check cards, and all HOT crops"
                if ok_lg10
                else f"orchestrator {stage} Cross-Check incomplete (missing_contacts={missing_contacts[:4]}, cards={len(insp_cards)}/{req_cards}, missing_hot_crops={missing_hot[:4]})",
            )

        # LG-11: Orchestrator user approval on G1/G2/G4
        if rname == "orchestrator" and sbase in USER_APPROVAL_STAGES:
            ap_steps = [
                s for s in steps
                if s.get("action") == "user_approval"
                and s.get("approval") in ("user", "delegated")
                and len(str(s.get("user_quote") or "").strip()) >= 4
            ]
            rv_file = root / "gates" / f"{sbase}.review.md"
            quote_matches = False
            if ap_steps and rv_file.is_file():
                rv_txt = rv_file.read_text(encoding="utf-8")
                q = str(ap_steps[-1]["user_quote"]).strip()
                quote_matches = q in rv_txt
            ok_lg11 = len(ap_steps) >= 1 and rv_file.is_file() and quote_matches
            add_check(
                "LG-11",
                rname,
                ok_lg11,
                f"orchestrator logged {sbase} user_approval matching gates/{sbase}.review.md"
                if ok_lg11
                else f"orchestrator missing `user_approval` step (approval=user|delegated, verbatim user_quote matching gates/{sbase}.review.md)",
            )

    # LG-08 & LG-12: Cross-role checks when checking "all"
    if role == "all":
        exec_actor = found_actors.get("executor")
        rev_actor = found_actors.get("reviewer")
        if exec_actor and rev_actor:
            sep_ok = exec_actor != rev_actor
            add_check(
                "LG-08",
                "separation",
                sep_ok,
                f"role separation verified: executor='{exec_actor}' != reviewer='{rev_actor}'"
                if sep_ok
                else f"role separation violated: executor and reviewer share actor_id '{exec_actor}'",
            )
        exec_run = found_runs.get("executor")
        rev_run = found_runs.get("reviewer")
        orch_run = found_runs.get("orchestrator")
        e_ts = str(((exec_run or {}).get("complete") or {}).get("timestamp_utc") or "")
        r_ts = str(((rev_run or {}).get("complete") or {}).get("timestamp_utc") or "")
        o_ts = str(((orch_run or {}).get("complete") or {}).get("timestamp_utc") or "")
        chrono_ok = True
        chrono_msg = "chronological causal order verified"
        if e_ts and r_ts and r_ts < e_ts:
            chrono_ok = False
            chrono_msg = f"reviewer complete ({r_ts}) predates executor complete ({e_ts}) — stale review!"
        if r_ts and o_ts and o_ts < r_ts:
            chrono_ok = False
            chrono_msg = f"orchestrator audit ({o_ts}) predates reviewer complete ({r_ts}) — re-audit required!"
        if e_ts and o_ts and o_ts < e_ts:
            chrono_ok = False
            chrono_msg = f"orchestrator audit ({o_ts}) predates executor complete ({e_ts}) — re-audit required!"
        add_check("LG-12", "chronology", chrono_ok, chrono_msg)

    ok_all = len(errors) == 0
    dt_ms = int((time.monotonic() - t0) * 1000)
    return L.make_envelope(
        root,
        ok=ok_all,
        exit_code=0 if ok_all else 2,
        command=f"ci log --stage {stage} --role {role}",
        stage=stage,
        unit=unit,
        actor_role="ci",
        actor_id="sv-log-lint",
        duration_ms=dt_ms,
        metrics={
            "roles_checked": roles_to_check,
            "actors": found_actors,
            "checks_total": len(checks),
            "checks_passed": sum(1 for c in checks if c["ok"]),
            "errors": len(errors),
            "warnings": len(warnings),
        },
        checks=checks,
        errors=errors,
        warnings=warnings,
        next_actions=(
            []
            if ok_all
            else [f"Fix Log-CI errors above and re-run: python scripts/sv_cli.py ci log --stage {stage} --role {role}"]
        ),
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Story Video Skills v6.0 Log-CI / Log-Lint Gate (LG-01..LG-12).")
    ap.add_argument("--root", default=None, help="Episode directory root")
    ap.add_argument("--stage", required=True, help="Gate stage (G1..G7 or G5.U1)")
    ap.add_argument("--role", default="all", choices=["all", "executor", "reviewer", "orchestrator"])
    ap.add_argument("--actor", default=None, help="Filter specific actor_id")
    ap.add_argument("--unit", default=None, help="Episodic unit id (for Long track)")
    ap.add_argument("--allow-fix", action="store_true", help="Allow reviewer verdict='fix' to pass Log-CI")
    ap.add_argument("--json", action="store_true", help="Emit standardized v6.0 JSON API envelope")
    args = ap.parse_args()

    root = L.resolve_root(args.root)
    env = audit_logs(
        root,
        stage=args.stage,
        role=args.role,
        actor_filter=args.actor,
        unit=args.unit,
        allow_fix_verdict=args.allow_fix,
    )
    if args.json:
        print(json.dumps(env, ensure_ascii=False, indent=2))
    else:
        status = "PASS" if env["ok"] else "FAIL"
        print(f"sv_log_lint [{env['stage']} · role={args.role} · track={env['episode']['track']}]: {status} "
              f"({env['metrics']['checks_passed']}/{env['metrics']['checks_total']} checks, {len(env['errors'])} errors)")
        for e in env["errors"]:
            print("  ERROR", e)
        for w in env["warnings"]:
            print("  WARN ", w)
    sys.exit(env["exit_code"])


if __name__ == "__main__":
    main()
