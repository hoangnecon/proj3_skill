#!/usr/bin/env python3
"""End-to-end automated verification suite for story-video-skills v6.0.0.

Proves all 8 core architectural guarantees inside isolated temporary sandboxes:
  1. Suite integrity & zero-drift validation (tools/validate_skills.py -> 0 errors, 0 warnings)
  2. Explicit 3-track scaffolding (--track short vs --track long, .episode.json, split standards)
  3. Empirical v4.0 voice corridor CI (4.02 FAIL, 4.90 FAIL, 4.57 PASS)
  4. Hash-chained role logs & 12-rule Log-CI (LG-02 tamper, LG-03 read_skill, LG-06/07 evidence/boilerplate, LG-08 separation)
  5. 5-Pillar Verification Gate & CLI JSON API envelope + Role Violation (exit 5)
  6. Antigravity native hook guard (hooks/sv_guard.py H1..H6 via cmd/sh invocation)
  7. General physics & placement CI (GE-21 non-airborne floor contact, PR-10 wide-shot partial-body)
  8. 3-shot continuity context_window & 9/11-check blind_pack.mjs schema

Usage:
  python tests/test_v6_suite.py
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

for _st in (sys.stdout, sys.stderr):
    if hasattr(_st, "reconfigure"):
        _st.reconfigure(encoding="utf-8", errors="replace")

SUITE = Path(__file__).resolve().parents[1]
PY = sys.executable


def _run(cmd: list[str], cwd: Path, env: dict[str, str] | None = None, stdin_text: str | None = None) -> subprocess.CompletedProcess:
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    return subprocess.run(
        cmd,
        cwd=cwd,
        env=full_env,
        input=stdin_text,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def _sha16(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()[:16]


def _invoke_hook(payload: dict) -> dict:
    shell_cmd = ["cmd", "/c", "python hooks/sv_guard.py"] if os.name == "nt" else ["sh", "-c", "python3 hooks/sv_guard.py"]
    r = _run(shell_cmd, cwd=SUITE, stdin_text=json.dumps(payload))
    assert r.returncode == 0, f"hook crashed (rc={r.returncode}): {r.stderr}"
    return json.loads(r.stdout.strip())


def _log_init(ep: Path, role: str, actor: str, stage: str, task: str) -> str:
    r = _run(
        [PY, "scripts/sv_cli.py", "log", "init", "--role", role, "--actor", actor, "--stage", stage, "--task", task, "--json"],
        cwd=ep,
    )
    assert r.returncode == 0, f"log init failed: {r.stdout}\n{r.stderr}"
    d = json.loads(r.stdout)
    return str(d["metrics"]["run_id"])


def _log_step(ep: Path, run_id: str, action: str, *, target: str | None = None, cmd: str | None = None,
              exit_code: int | None = None, result: str = "ok", note: str = "",
              approval: str | None = None, user_quote: str | None = None) -> None:
    args = [PY, "scripts/sv_cli.py", "log", "step", "--run", run_id, "--action", action, "--result", result, "--note", note, "--json"]
    if target is not None:
        args += ["--target", target]
    if cmd is not None:
        args += ["--cmd", cmd]
    if exit_code is not None:
        args += ["--exit-code", str(exit_code)]
    if approval is not None:
        args += ["--approval", approval]
    if user_quote is not None:
        args += ["--user-quote", user_quote]
    r = _run(args, cwd=ep)
    assert r.returncode == 0, f"log step failed ({action}): {r.stdout}\n{r.stderr}"


def _log_complete(ep: Path, run_id: str, verdict: str, outputs: str, note: str) -> None:
    r = _run(
        [PY, "scripts/sv_cli.py", "log", "complete", "--run", run_id, "--verdict", verdict, "--outputs", outputs, "--note", note, "--json"],
        cwd=ep,
    )
    assert r.returncode == 0, f"log complete failed: {r.stdout}\n{r.stderr}"


def test_1_validate_skills() -> None:
    r = _run([PY, str(SUITE / "tools" / "validate_skills.py"), str(SUITE)], cwd=SUITE)
    assert r.returncode == 0, f"validate_skills failed:\n{r.stdout}\n{r.stderr}"
    assert "11 skills" in r.stdout, f"expected 11 skills: {r.stdout}"
    assert "0 errors, 0 warnings" in r.stdout, f"expected 0 errors/warnings: {r.stdout}"
    print("[PASS] Test 1: validate_skills.py -> 11 skills, 0 errors, 0 warnings")


def test_2_track_scaffolding(tmp: Path) -> tuple[Path, Path]:
    ep_short = tmp / "ep-short"
    ep_long = tmp / "ep-long"

    r_s = _run([PY, str(SUITE / "tools" / "new_episode.py"), str(ep_short), "--track", "short"], cwd=SUITE)
    assert r_s.returncode == 0, f"short scaffold failed:\n{r_s.stdout}\n{r_s.stderr}"
    meta_s = json.loads((ep_short / ".episode.json").read_text(encoding="utf-8"))
    pa_s = json.loads((ep_short / "standards" / "pacing.json").read_text(encoding="utf-8"))
    vs_s = json.loads((ep_short / "standards" / "voice_standard.json").read_text(encoding="utf-8"))
    assert meta_s["track"] == "short" and meta_s["format"] == "9:16" and meta_s["resolution"] == [1080, 1920]
    assert (ep_short / "logs").is_dir()
    assert pa_s["voice"]["overall_wps"] == [4.42, 4.74], f"unexpected short wps: {pa_s['voice']}"
    assert vs_s["rhythm"]["target_ups"] == 5.05 and vs_s["rhythm"]["pitch_ratio"] == 1.0

    r_l = _run([PY, str(SUITE / "tools" / "new_episode.py"), str(ep_long), "--track", "long"], cwd=SUITE)
    assert r_l.returncode == 0, f"long scaffold failed:\n{r_l.stdout}\n{r_l.stderr}"
    meta_l = json.loads((ep_long / ".episode.json").read_text(encoding="utf-8"))
    pa_l = json.loads((ep_long / "standards" / "pacing.json").read_text(encoding="utf-8"))
    sc_l = json.loads((ep_long / "script.json").read_text(encoding="utf-8"))
    assert meta_l["track"] == "long" and meta_l["format"] == "16:9" and meta_l["resolution"] == [1920, 1080]
    assert pa_l["voice"]["overall_wps"] == [4.40, 4.74], f"unexpected long wps: {pa_l['voice']}"
    assert sc_l["format"] == "16:9" and sc_l["length"] == "long_16x9"

    print("[PASS] Test 2: 3-track scaffolding (--track short & --track long, .episode.json, split standards)")
    return ep_short, ep_long


def test_3_voice_corridor_ci(ep_short: Path) -> None:
    def _write_vr(wps: float, pause_share: float = 0.064) -> None:
        vr = {
            "voice": "Hải Đăng",
            "script_sha": _sha16(ep_short / "script.json"),
            "standard_sha": _sha16(ep_short / "standards" / "voice_standard.json"),
            "pacing_sha": _sha16(ep_short / "standards" / "pacing.json"),
            "engine": {"clone": False, "mode": "per_sentence_rhythm", "takes": 1},
            "rhythm": {"target_ups": 5.05, "pitch_ratio": 1.00},
            "failed_lines": {},
            "stale_lines": [],
            "total": 115.0,
            "episode_checks": [
                {"group": "voice", "check": "overall_wps", "value": wps, "range": [4.42, 4.74], "ok": 4.42 <= wps <= 4.74},
                {"group": "voice", "check": "pause_share", "value": pause_share, "range": [0.05, 0.14], "ok": 0.05 <= pause_share <= 0.14},
            ],
        }
        (ep_short / "qa" / "voice_report.json").write_text(json.dumps(vr, indent=2), encoding="utf-8")

    # 4.02 wps (historical slow bug) -> MUST FAIL (exit 1 = Domain CI fail)
    _write_vr(4.02)
    r_slow = _run([PY, "scripts/sv_cli.py", "ci", "voice", "--json"], cwd=ep_short)
    d_slow = json.loads(r_slow.stdout)
    assert r_slow.returncode == 1 and not d_slow["ok"], f"4.02 wps should fail voice CI: {d_slow}"

    # 4.90 wps (rushed) -> MUST FAIL (exit 1)
    _write_vr(4.90)
    r_fast = _run([PY, "scripts/sv_cli.py", "ci", "voice", "--json"], cwd=ep_short)
    d_fast = json.loads(r_fast.stdout)
    assert r_fast.returncode == 1 and not d_fast["ok"], f"4.90 wps should fail voice CI: {d_fast}"

    # 4.57 wps (calibrated v4.0) -> MUST PASS (exit 0)
    _write_vr(4.57)
    r_ok = _run([PY, "scripts/sv_cli.py", "ci", "voice", "--json"], cwd=ep_short)
    d_ok = json.loads(r_ok.stdout)
    assert r_ok.returncode == 0 and d_ok["ok"], f"4.57 wps should pass voice CI: {d_ok}"

    print("[PASS] Test 3: Empirical v4.0 voice corridor CI (4.02 FAIL, 4.90 FAIL, 4.57 PASS)")


def test_4_role_logs_and_log_ci(ep_short: Path) -> None:
    img1 = ep_short / "qa" / "design" / "cast_episode_p1_v.jpg"
    img2 = ep_short / "qa" / "design" / "overview_sets.jpg"
    img1.parent.mkdir(parents=True, exist_ok=True)
    img1.write_bytes(b"\xff\xd8\xff\xe0FAKECASTJPEG")
    img2.write_bytes(b"\xff\xd8\xff\xe0FAKESETSJPEG")
    (ep_short / "gates" / "G4.review.md").write_text(
        'verdict: pass\napproval: user\nuser_quote: "bo cuc nhan vat va boi canh on roi em"\n',
        encoding="utf-8",
    )
    design_skill = str(SUITE / "skills" / "sv-short-design" / "SKILL.md")

    # Clean G4 lifecycle across Executor -> Reviewer -> Orchestrator
    r_orch = _log_init(ep_short, "orchestrator", "coord-1", "G4", "Orchestrate G4 design phase")

    r_exec = _log_init(ep_short, "executor", "exec-design", "G4", "Author cast sets and subjects")
    _log_step(ep_short, r_exec, "read_skill", target=design_skill, note="Read Short 9:16 design system rules before editing")
    _log_step(ep_short, r_exec, "run_tool", target="design", cmd="sv_cli.py ci design", exit_code=0, note="Design lint completed cleanly with zero errors")
    _log_complete(ep_short, r_exec, "pass", "src/episode/cast.ts,src/episode/sets.tsx", "Built cast and grounded floor sets passing design CI")

    r_rev = _log_init(ep_short, "reviewer", "rev-design", "G4", "Independent design audit")
    _log_step(ep_short, r_rev, "read_skill", target=design_skill, note="Loaded Short 9:16 design checklist for audit")
    _log_step(ep_short, r_rev, "inspect_visual", target="qa/design/cast_episode_p1_v.jpg", note="Checked cast sheet p1: four distinct silhouettes and canonical Nhim red cap")
    _log_step(ep_short, r_rev, "inspect_visual", target="qa/design/overview_sets.jpg", note="Checked sets overview: clear floor lanes, consistent landmarks across sub-scenes")
    _log_complete(ep_short, r_rev, "pass", "qa/design/cast_episode_p1_v.jpg,qa/design/overview_sets.jpg", "Independent visual design audit verified on-model")

    _log_step(ep_short, r_orch, "cross_check", target="qa/design/cast_episode_p1_v.jpg", note="Confirmed cast silhouettes and proportions match brief before user presentation")
    _log_step(ep_short, r_orch, "cross_check", target="qa/design/overview_sets.jpg", note="Confirmed connected spatial sub-scenes and clean stateless background plates")
    _log_step(ep_short, r_orch, "user_approval", approval="user", user_quote="bo cuc nhan vat va boi canh on roi em", note="User explicitly approved G4 design sheets")
    _log_complete(ep_short, r_orch, "pass", "gates/G4.review.md", "All G4 logs and user approval verified")

    r_ok = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G4", "--role", "all", "--json"], cwd=ep_short)
    d_ok = json.loads(r_ok.stdout)
    assert r_ok.returncode == 0 and d_ok["ok"], f"valid G4 logs failed ci log: {d_ok}"

    # Tamper 1 byte in executor log -> MUST trigger LG-02
    exec_log = ep_short / "logs" / "executor_exec-design.jsonl"
    orig_exec = exec_log.read_text(encoding="utf-8")
    exec_log.write_text(orig_exec.replace("zero errors", "Zero Errors"), encoding="utf-8")
    r_tamp = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G4", "--role", "executor", "--json"], cwd=ep_short)
    d_tamp = json.loads(r_tamp.stdout)
    assert r_tamp.returncode == 2 and any("[LG-02]" in e for e in d_tamp["errors"]), f"tamper should trigger LG-02: {d_tamp}"
    exec_log.write_text(orig_exec, encoding="utf-8")

    # Bad G5 logs:
    # (a) logging inspect_visual on a missing file is rejected immediately at write time (exit 2)
    r_be = _log_init(ep_short, "executor", "same-bot", "G5", "Build G5")
    _log_complete(ep_short, r_be, "pass", "src/episode/shotlist.ts", "Done G5 build")
    r_br = _log_init(ep_short, "reviewer", "same-bot", "G5", "Review G5")
    r_miss = _run(
        [PY, "scripts/sv_cli.py", "log", "step", "--run", r_br, "--action", "inspect_visual", "--target", "qa/does_not_exist.jpg", "--note", "looks good", "--json"],
        cwd=ep_short,
    )
    assert r_miss.returncode == 2, f"missing inspect_visual target must be rejected at log time: {r_miss.stdout}"
    # (b) same actor_id (LG-08) + boilerplate "looks good" on existing file (LG-07) + missing read_skill (LG-03)
    _log_step(ep_short, r_br, "inspect_visual", target="qa/design/cast_episode_p1_v.jpg", note="looks good")
    _log_complete(ep_short, r_br, "pass", "qa/design/cast_episode_p1_v.jpg", "Done review")

    r_bad = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G5", "--role", "all", "--json"], cwd=ep_short)
    d_bad = json.loads(r_bad.stdout)
    err_blob = "\n".join(d_bad["errors"])
    assert r_bad.returncode == 2, f"expected rc 2 for bad G5 logs: {d_bad}"
    for code in ("LG-03", "LG-07", "LG-08"):
        assert f"[{code}]" in err_blob, f"expected [{code}] in errors:\n{err_blob}"

    print("[PASS] Test 4: Role logs & Log-CI (clean G4 PASS + LG-02 tamper + LG-03 + LG-07 boilerplate/missing + LG-08 separation)")


def test_5_verification_gate_and_cli_api(ep_short: Path) -> None:
    brief_txt = "\n".join([
        "# Episode Brief",
        "## Archetype", "Personal Rule-Trap",
        "## Premise", "Every spoken promise freezes the speaker's shoes to the floor until fulfilled.",
        "## Spine", "Setup -> Stake -> Crisis -> Bind -> Lateral Hack -> Button",
        "## Why it is funny", "Deadpan literal physics colliding with schoolyard bragging.",
        "## Characters", "- Nhim: 10-year-old boy protagonist\n- Binh: rival classmate",
        "## Locations", "- classRoom: classroom\n- schoolYard: yard",
        "## Ending", "Nhim turns the rival's own boast into an unbreakable anchor.",
        "## Not copying", "Original mechanism distinct from elevator secret premise.",
    ]) + "\n"
    (ep_short / "brief.md").write_text(brief_txt, encoding="utf-8")
    (ep_short / "gates" / "G1.review.md").write_text(
        'verdict: pass\napproval: user\nuser_quote: "ok em duyet brief nay nhe"\n',
        encoding="utf-8",
    )

    # Gate check BEFORE logs -> MUST BLOCK and match cli_envelope schema keys
    r_blk = _run([PY, "scripts/sv_cli.py", "gate", "check", "G1", "--json"], cwd=ep_short)
    env_blk = json.loads(r_blk.stdout)
    schema = json.loads((SUITE / "schemas" / "cli_envelope.schema.json").read_text(encoding="utf-8"))
    for req_k in schema["required"]:
        assert req_k in env_blk, f"CLI envelope missing required key '{req_k}'"
    assert r_blk.returncode in (2, 3) and not env_blk["ok"], f"G1 without logs must block: {env_blk}"

    # Write complete valid Executor + Reviewer + Orchestrator logs for G1
    script_skill = str(SUITE / "skills" / "sv-short-script" / "SKILL.md")
    bible_skill = str(SUITE / "skills" / "sv-core-bible" / "SKILL.md")

    r_o1 = _log_init(ep_short, "orchestrator", "coord-1", "G1", "Orchestrate G1 brief")

    r_e1 = _log_init(ep_short, "executor", "exec-brief", "G1", "Author brief.md")
    _log_step(ep_short, r_e1, "read_skill", target=script_skill, note="Read Short script skill for brief structure")
    _log_complete(ep_short, r_e1, "pass", "brief.md", "Completed all 8 required sections of brief.md without placeholders")

    r_r1 = _log_init(ep_short, "reviewer", "rev-brief", "G1", "Audit brief against series bible")
    _log_step(ep_short, r_r1, "read_skill", target=bible_skill, note="Checked 7-point premise test from sv-core-bible")
    _log_complete(ep_short, r_r1, "pass", "brief.md", "Premise passes all 7 bible criteria and scope economy")

    _log_step(ep_short, r_o1, "user_approval", approval="user", user_quote="ok em duyet brief nay nhe", note="User explicitly approved brief.md verbatim")
    _log_complete(ep_short, r_o1, "pass", "gates/G1.review.md", "G1 brief and user approval verified")

    # Gate check now PASSES (exit 0)
    r_chk = _run([PY, "scripts/sv_cli.py", "gate", "check", "G1", "--json"], cwd=ep_short)
    env_chk = json.loads(r_chk.stdout)
    assert r_chk.returncode == 0 and env_chk["ok"], f"G1 gate check should pass: {env_chk}"

    # Executor attempting gate pass -> MUST DENY with exit 5 (ROLE_VIOLATION)
    r_role = _run(
        [PY, "scripts/sv_cli.py", "gate", "pass", "G1", "--actor", "exec-brief", "--json"],
        cwd=ep_short,
        env={"SV_ACTOR_ROLE": "executor"},
    )
    assert r_role.returncode == 5, f"executor gate pass must exit 5, got {r_role.returncode}: {r_role.stdout}"

    # Orchestrator passing G1 -> MUST PASS (exit 0) and write gates/log.jsonl + logs/gates.jsonl
    r_pass = _run([PY, "scripts/sv_cli.py", "gate", "pass", "G1", "--actor", "coord-1", "--json"], cwd=ep_short)
    env_pass = json.loads(r_pass.stdout)
    assert r_pass.returncode == 0 and env_pass["ok"], f"orchestrator G1 pass failed: {env_pass}"
    assert (ep_short / "gates" / "log.jsonl").is_file()
    assert (ep_short / "logs" / "gates.jsonl").is_file()

    print("[PASS] Test 5: 5-Pillar Verification Gate + JSON API envelope + Role Violation exit 5")


def test_6_antigravity_hooks(ep_short: Path, tmp: Path) -> None:
    res_h1 = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep_short),
        "toolCall": {"name": "edit_file", "args": {"Path": str(ep_short / "standards" / "pacing.json")}},
    })
    assert res_h1["decision"] == "deny" and "H1" in res_h1["reason"], f"H1 failed: {res_h1}"

    res_h2 = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep_short),
        "toolCall": {"name": "write_file", "args": {"Path": str(ep_short / "logs" / "executor_exec-design.jsonl")}},
    })
    assert res_h2["decision"] == "deny" and "H2" in res_h2["reason"], f"H2 failed: {res_h2}"

    res_h3 = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep_short),
        "toolCall": {"name": "edit_file", "args": {"Path": str(ep_short / "src" / "episode" / "shotlist.ts")}},
    })
    assert res_h3["decision"] == "deny" and "H3" in res_h3["reason"], f"H3 failed: {res_h3}"

    res_h4 = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep_short),
        "toolCall": {"name": "run_command", "args": {"CommandLine": "Set-Content gates/log.jsonl '{}'"}},
    })
    assert res_h4["decision"] == "deny" and "H4" in res_h4["reason"], f"H4 failed: {res_h4}"

    res_h5 = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep_short),
        "toolCall": {"name": "run_command", "args": {"CommandLine": "node scripts/deliver.mjs"}},
    })
    assert res_h5["decision"] == "deny" and "H5" in res_h5["reason"], f"H5 failed: {res_h5}"

    t_empty = tmp / "transcript_blind.jsonl"
    t_empty.write_text(json.dumps({"tool": "run_command", "args": {"CommandLine": "ls"}}) + "\n", encoding="utf-8")
    res_h6_deny = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep_short),
        "transcriptPath": str(t_empty),
        "toolCall": {"name": "run_command", "args": {"CommandLine": "python scripts/sv_cli.py gate pass G5 --actor coord-1"}},
    })
    assert res_h6_deny["decision"] == "deny" and "H6" in res_h6_deny["reason"], f"H6 blind deny failed: {res_h6_deny}"

    # Real Antigravity transcript.jsonl format: args.Path is JSON-string-encoded with inner quotes & escaped backslashes
    t_seen = tmp / "transcript_seen.jsonl"
    real_agy_path_val = json.dumps(str(ep_short / "qa" / "contact_p1.jpg"))  # produces '"C:\\\\...\\\\contact_p1.jpg"'
    t_seen.write_text(
        json.dumps({
            "step_index": 5,
            "source": "MODEL",
            "type": "PLANNER_RESPONSE",
            "tool_calls": [
                {"name": "update_focus", "args": {"focus": "\"Inspecting contact sheet\""}},
                {"name": "read_file", "args": {"Path": real_agy_path_val}},
            ],
        }) + "\n",
        encoding="utf-8",
    )
    res_h6_allow = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep_short),
        "transcriptPath": str(t_seen),
        "toolCall": {"name": "run_command", "args": {"CommandLine": "python scripts/sv_cli.py gate pass G5 --actor coord-1"}},
    })
    assert res_h6_allow["decision"] == "allow", f"H6 allow after real Antigravity read_file failed: {res_h6_allow}"

    # Mentioning contact_p1.jpg ONLY inside run_command (not read_file) in same turn MUST STILL DENY
    t_spoof = tmp / "transcript_spoof.jsonl"
    t_spoof.write_text(
        json.dumps({
            "step_index": 6,
            "source": "MODEL",
            "type": "PLANNER_RESPONSE",
            "tool_calls": [
                {"name": "read_file", "args": {"Path": json.dumps(str(ep_short / "brief.md"))}},
                {"name": "run_command", "args": {"CommandLine": json.dumps("ls qa/contact_p1.jpg")}},
            ],
        }) + "\n",
        encoding="utf-8",
    )
    res_h6_spoof = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep_short),
        "transcriptPath": str(t_spoof),
        "toolCall": {"name": "run_command", "args": {"CommandLine": "python scripts/sv_cli.py gate pass G5 --actor coord-1"}},
    })
    assert res_h6_spoof["decision"] == "deny" and "H6" in res_h6_spoof["reason"], f"H6 spoof via run_command must deny: {res_h6_spoof}"

    res_self = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(SUITE),
        "toolCall": {"name": "edit_file", "args": {"Path": str(SUITE / "README.md")}},
    })
    assert res_self["decision"] == "allow", f"plugin self-edit should allow: {res_self}"

    print("[PASS] Test 6: Antigravity native hook guard (H1..H6 DENY + H6 inspected ALLOW + plugin ALLOW)")


def test_7_general_physics_and_partial_body_ci(ep_short: Path) -> None:
    words = [
        {"w": "Sáng", "s": 0.0, "e": 0.3, "seg": "s1"},
        {"w": "nay", "s": 0.3, "e": 0.6, "seg": "s1"},
        {"w": "Nhím", "s": 0.6, "e": 1.0, "seg": "s1"},
        {"w": "đi", "s": 1.0, "e": 1.4, "seg": "s1"},
        {"w": "học.", "s": 1.4, "e": 2.4, "seg": "s1"},
    ]
    cues = {"seg_starts": {"s1": 0.0}, "voice_end": 2.6}
    (ep_short / "src" / "data" / "words.json").write_text(json.dumps(words), encoding="utf-8")
    (ep_short / "src" / "data" / "cues.json").write_text(json.dumps(cues), encoding="utf-8")

    (ep_short / "src" / "episode" / "cast.ts").write_text(
        "import {NHIM_LOOK, type Look} from '../chars';\n"
        "export const CAST: Record<string, Look> = { nhim: {...NHIM_LOOK, name: 'nhim'} };\n"
        "export const CAST_ROLES = { nhim: {role: 'principal' as const, vi: 'Nhím học sinh tiểu học'} };\n",
        encoding="utf-8",
    )
    (ep_short / "src" / "episode" / "sets.tsx").write_text(
        "import React from 'react';\n"
        "import {R, S} from '../kit';\n"
        "import type {SetDef} from '../sets/types';\n"
        "export const EPISODE_SETS: Record<string, SetDef> = {\n"
        "  streetWide: {\n"
        "    title: 'Đường phố rộng',\n"
        "    bed: 'street',\n"
        "    bounds: [-200, -200, 1280, 2120],\n"
        "    shotScale: 'establishing',\n"
        "    zones: {bgY: 1100, mgY: [1540, 1760], fgY: 1860},\n"
        "    render: () => ({back: <g><S d={R(-200, -200, 1480, 1740)} f='sky2' /><S d={R(-200, 1540, 1480, 580)} f='asphalt' /></g>, mid: []}),\n"
        "  },\n"
        "};\n",
        encoding="utf-8",
    )
    (ep_short / "src" / "episode" / "subjects.tsx").write_text(
        "import React from 'react';\n"
        "import {R, S} from '../kit';\n"
        "import type {SubjectDef} from '../subjects';\n"
        "export const SUBJECTS: Record<string, SubjectDef> = {\n"
        "  testCart: {\n"
        "    title: 'Xe đẩy thử nghiệm',\n"
        "    kind: 'vehicle',\n"
        "    relToActor: [0.4, 1.2],\n"
        "    poses: ['parked', 'roll', 'turn', 'stop'],\n"
        "    render: (pose) => <g><S d={R(-80, -120, 160, 120)} f={pose === 'stop' ? 'red' : 'blue'} /></g>,\n"
        "  },\n"
        "  testHand: {\n"
        "    title: 'Bàn tay cận cảnh',\n"
        "    kind: 'hero_prop',\n"
        "    partialOf: 'nhim',\n"
        "    relToActor: [0.3, 1.2],\n"
        "    poses: ['open', 'wave', 'point', 'fist'],\n"
        "    render: (pose) => <g><S d={R(-40, -80, 80, 80)} f={pose === 'fist' ? 'skinShade' : 'skin'} /></g>,\n"
        "  },\n"
        "};\n",
        encoding="utf-8",
    )

    (ep_short / "src" / "episode" / "shotlist.ts").write_text(
        "import type {ShotDef} from '../engine';\n"
        "export const SHOTS: ShotDef[] = [\n"
        "  {\n"
        "    name: 'floating_and_detached',\n"
        "    at: 's1',\n"
        "    set: 'streetWide',\n"
        "    cam: [540, 1150, 1.0],\n"
        "    actors: [{id: 'nhim', look: 'nhim', x: 320, y: 1650, s: 1.0}],\n"
        "    extras: [\n"
        "      {k: 'testCart', x: 760, y: 1350, s: 1.0, pose: 'roll'},\n"
        "      {k: 'testHand', x: 540, y: 1580, s: 1.0, pose: 'wave'},\n"
        "    ],\n"
        "  },\n"
        "];\n",
        encoding="utf-8",
    )
    r_bad = _run(["node", "scripts/lint.mjs", "shots"], cwd=ep_short)
    lint_bad = json.loads((ep_short / "qa" / "lint.json").read_text(encoding="utf-8"))
    errs_bad = "\n".join(lint_bad.get("errors", []))
    assert "[GE-21]" in errs_bad, f"expected GE-21 error on floating vehicle:\n{errs_bad}\nstdout:{r_bad.stdout}"
    assert "[PR-10]" in errs_bad, f"expected PR-10 error on partialOf asset:\n{errs_bad}\nstdout:{r_bad.stdout}"

    (ep_short / "src" / "episode" / "shotlist.ts").write_text(
        "import type {ShotDef} from '../engine';\n"
        "export const SHOTS: ShotDef[] = [\n"
        "  {\n"
        "    name: 'grounded_clean',\n"
        "    at: 's1',\n"
        "    set: 'streetWide',\n"
        "    cam: [540, 1150, 1.0],\n"
        "    actors: [{id: 'nhim', look: 'nhim', x: 320, y: 1650, s: 1.0}],\n"
        "    extras: [{k: 'testCart', x: 760, y: 1660, s: 1.0, pose: 'roll'}],\n"
        "  },\n"
        "];\n",
        encoding="utf-8",
    )
    _run(["node", "scripts/lint.mjs", "shots"], cwd=ep_short)
    lint_ok = json.loads((ep_short / "qa" / "lint.json").read_text(encoding="utf-8"))
    errs_ok = "\n".join(lint_ok.get("errors", []))
    assert "[GE-21]" not in errs_ok and "[PR-10]" not in errs_ok, f"grounded clean shot failed:\n{errs_ok}"

    print("[PASS] Test 7: General Physics & Placement CI (GE-21 floating FAIL / grounded PASS + PR-10 FAIL / clean PASS)")


def test_8_blind_pack_continuity(ep_short: Path) -> None:
    shots_json = [
        {"i": 0, "name": "shot_a", "seg": "s1", "set": "streetWide", "t0": 0.0, "t1": 0.9},
        {"i": 1, "name": "shot_b", "seg": "s1", "set": "streetWide", "t0": 0.9, "t1": 1.8},
        {"i": 2, "name": "shot_c", "seg": "s1", "set": "streetWide", "t0": 1.8, "t1": 2.6},
    ]
    (ep_short / "qa" / "shots.json").write_text(json.dumps(shots_json), encoding="utf-8")
    (ep_short / "qa" / "qa_status.json").write_text(
        json.dumps({"hashes": {"0": "aaa111", "1": "bbb222", "2": "ccc333"}}),
        encoding="utf-8",
    )
    r = _run(["node", "scripts/blind_pack.mjs"], cwd=ep_short)
    assert r.returncode == 0, f"blind_pack failed:\n{r.stdout}\n{r.stderr}"

    manifest = json.loads((ep_short / "qa" / "blind_review" / "manifest.json").read_text(encoding="utf-8"))
    slice1 = json.loads((ep_short / "qa" / "blind_review" / "slice_1.json").read_text(encoding="utf-8"))
    rubric = (ep_short / "qa" / "blind_review" / "RUBRIC.md").read_text(encoding="utf-8")

    checks_keys = slice1["review_schema"]["checks_keys"]
    assert len(checks_keys) == 9 and "continuity" in checks_keys, f"expected 9 checks with continuity: {checks_keys}"
    assert "context_window.prev_shot" in rubric

    m_shots = manifest["shots"]
    assert m_shots[0]["context_window"]["prev_shot"] is None
    assert m_shots[0]["context_window"]["next_shot"]["shot"] == 1
    assert m_shots[1]["context_window"]["prev_shot"]["shot"] == 0
    assert m_shots[1]["context_window"]["next_shot"]["shot"] == 2
    assert m_shots[2]["context_window"]["prev_shot"]["shot"] == 1
    assert m_shots[2]["context_window"]["next_shot"] is None

    print("[PASS] Test 8: blind_pack.mjs 3-shot continuity context_window & 9-check rubric verified")


def test_9_long_unit_gate_cli_and_lg10(ep_long: Path) -> None:
    """Verify `sv_cli.py gate check G5.U1` routes to check-unit U1 and scopes LG-10 to U1_contact.jpg."""
    sc = {
        "title": "Test Long Episode",
        "format": "16:9",
        "length": "long_16x9",
        "voice": "Hải Đăng",
        "pause_after": 0.22,
        "units": [
            {"id": "U1", "title": "Chapter 1", "seg_start": "s1", "seg_end": "s2", "scale_mode": "normal"},
            {"id": "U2", "title": "Chapter 2", "seg_start": "s3", "seg_end": "s4", "scale_mode": "normal"},
        ],
        "segments": [
            {"id": "s1", "text": "Câu một chương một."},
            {"id": "s2", "text": "Câu hai chương một."},
            {"id": "s3", "text": "Câu ba chương hai."},
            {"id": "s4", "text": "Câu bốn chương hai."},
        ],
    }
    (ep_long / "script.json").write_text(json.dumps(sc, ensure_ascii=False, indent=2), encoding="utf-8")

    # Direct `sv_cli.py gate check G5.U1` MUST NOT fail with "unknown gate G5.U1"
    r_chk = _run([PY, "scripts/sv_cli.py", "gate", "check", "G5.U1", "--json"], cwd=ep_long)
    env_chk = json.loads(r_chk.stdout)
    assert env_chk["stage"] == "G5.U1" and env_chk["unit"] == "U1", f"expected stage=G5.U1 unit=U1: {env_chk}"
    assert "unknown gate" not in "\n".join(env_chk["errors"]).lower(), f"G5.U1 misrouted to unknown gate: {env_chk}"

    # Verify unit-scoped LG-10 + read_evidence action support on G5.U1
    u1_contact = ep_long / "qa" / "units" / "U1_contact.jpg"
    u1_contact.parent.mkdir(parents=True, exist_ok=True)
    u1_contact.write_bytes(b"\xff\xd8\xff\xe0FAKEU1CONTACT")
    card0 = ep_long / "qa" / "cards" / "00.jpg"
    card0.parent.mkdir(parents=True, exist_ok=True)
    card0.write_bytes(b"\xff\xd8\xff\xe0FAKECARD0")
    (ep_long / "qa" / "blind_review").mkdir(parents=True, exist_ok=True)
    (ep_long / "qa" / "blind_review" / "unit_U1.json").write_text(
        json.dumps({"unit": "U1", "shots": [{"shot": 0, "blind_sha": "12345678"}]}),
        encoding="utf-8",
    )
    (ep_long / "qa" / "review").mkdir(parents=True, exist_ok=True)
    (ep_long / "qa" / "review" / "00.json").write_text(
        json.dumps({"shot": 0, "verdict": "ok", "checks": {"continuity": "ok - matched"}}),
        encoding="utf-8",
    )

    long_prod_skill = str(SUITE / "skills" / "sv-long-production" / "SKILL.md")
    r_eu = _run(
        [PY, "scripts/sv_cli.py", "log", "init", "--role", "executor", "--actor", "exec-u1", "--stage", "G5.U1", "--unit", "U1", "--task", "Build U1", "--json"],
        cwd=ep_long,
    )
    eu_id = json.loads(r_eu.stdout)["metrics"]["run_id"]
    _log_step(ep_long, eu_id, "read_skill", target=long_prod_skill, note="Read Long 16:9 sequential unit production skill")
    _log_step(ep_long, eu_id, "run_tool", target="shots", cmd="sv_cli.py ci shots", exit_code=0, note="Unit U1 shot lint passed cleanly")
    _log_complete(ep_long, eu_id, "pass", "src/episode/shotlist.ts", "Completed unit U1 shots")

    r_ru = _run(
        [PY, "scripts/sv_cli.py", "log", "init", "--role", "reviewer", "--actor", "rev-u1", "--stage", "G5.U1", "--unit", "U1", "--task", "Review U1", "--json"],
        cwd=ep_long,
    )
    ru_id = json.loads(r_ru.stdout)["metrics"]["run_id"]
    _log_step(ep_long, ru_id, "read_skill", target=long_prod_skill, note="Loaded Long 11-check review rubric")
    _log_step(ep_long, ru_id, "read_evidence", target="qa/units/U1_contact.jpg", note="Inspected U1 contact sheet: grounded actors and consistent landmarks")
    _log_step(ep_long, ru_id, "submit_review", target="qa/review/00.json", exit_code=0, note="Submitted U1 blind review batch cleanly")
    _log_complete(ep_long, ru_id, "pass", "qa/units/U1_contact.jpg", "Unit U1 blind review passed")

    r_ou = _run(
        [PY, "scripts/sv_cli.py", "log", "init", "--role", "orchestrator", "--actor", "coord-1", "--stage", "G5.U1", "--unit", "U1", "--task", "Audit U1", "--json"],
        cwd=ep_long,
    )
    ou_id = json.loads(r_ou.stdout)["metrics"]["run_id"]
    _log_step(ep_long, ou_id, "cross_check", target="qa/units/U1_contact.jpg", note="Cross-checked U1 contact sheet: floor contact and framing verified")
    _log_step(ep_long, ou_id, "cross_check", target="qa/cards/00.jpg", note="Spot-checked card 00: clean caption clearance and actor scale")
    _log_complete(ep_long, ou_id, "pass", "qa/units/U1_contact.jpg", "Orchestrator U1 cross-check complete")

    r_log_u1 = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G5.U1", "--role", "all", "--unit", "U1", "--json"], cwd=ep_long)
    d_log_u1 = json.loads(r_log_u1.stdout)
    assert r_log_u1.returncode == 0 and d_log_u1["ok"], f"G5.U1 Log-CI should pass with unit-scoped LG-10 & read_evidence: {d_log_u1}"
    print("[PASS] Test 9: Long G5.U1 CLI routing + unit-scoped LG-10 + read_evidence verified")


def main() -> int:
    t0 = time.perf_counter()
    test_1_validate_skills()
    tmp = Path(tempfile.mkdtemp(prefix="sv_v6_test_"))
    try:
        ep_short, ep_long = test_2_track_scaffolding(tmp)
        test_3_voice_corridor_ci(ep_short)
        test_4_role_logs_and_log_ci(ep_short)
        test_5_verification_gate_and_cli_api(ep_short)
        test_6_antigravity_hooks(ep_short, tmp)
        test_7_general_physics_and_partial_body_ci(ep_short)
        test_8_blind_pack_continuity(ep_short)
        test_9_long_unit_gate_cli_and_lg10(ep_long)
    finally:
        for sub in ("ep-short", "ep-long"):
            nm = tmp / sub / "node_modules"
            if nm.exists():
                if os.name == "nt":
                    subprocess.run(["cmd", "/c", "rmdir", str(nm)], capture_output=True)
                else:
                    nm.unlink(missing_ok=True)
        shutil.rmtree(tmp, ignore_errors=True)

    dt = time.perf_counter() - t0
    print(f"\nALL 9/9 v6.0.0 END-TO-END VERIFICATION TESTS PASSED in {dt:.2f}s!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
