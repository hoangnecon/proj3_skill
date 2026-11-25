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
    assert "8 skills, 3 agents" in r.stdout, f"expected 8 skills, 3 agents: {r.stdout}"
    assert "0 errors, 0 warnings" in r.stdout, f"expected 0 errors/warnings: {r.stdout}"
    print("[PASS] Test 1: validate_skills.py -> 8 skills, 3 agents, 0 errors, 0 warnings")


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
    assert (ep_short / "art_direction.json").is_file(), "starter/art_direction.json must be copied on short scaffold"
    assert pa_s["voice"]["overall_wps"] == [4.42, 4.74], f"unexpected short wps: {pa_s['voice']}"
    assert vs_s["rhythm"]["target_ups"] == 5.05 and vs_s["rhythm"]["pitch_ratio"] == 1.0

    r_l = _run([PY, str(SUITE / "tools" / "new_episode.py"), str(ep_long), "--track", "long"], cwd=SUITE)
    assert r_l.returncode == 0, f"long scaffold failed:\n{r_l.stdout}\n{r_l.stderr}"
    meta_l = json.loads((ep_long / ".episode.json").read_text(encoding="utf-8"))
    pa_l = json.loads((ep_long / "standards" / "pacing.json").read_text(encoding="utf-8"))
    sc_l = json.loads((ep_long / "script.json").read_text(encoding="utf-8"))
    assert meta_l["track"] == "long" and meta_l["format"] == "16:9" and meta_l["resolution"] == [1920, 1080]
    assert (ep_long / "art_direction.json").is_file(), "starter/art_direction.json must be copied on long scaffold"
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
    # Keep legacy unit-isolated Tests 4..11 focused on LG-01..12 & v6.0/v6.1 checks;
    # Test 12 scaffolds a fresh v6.2.0 episode exercising the full art_direction.json + LG-13 pipeline.
    ad_legacy = ep_short / "art_direction.json"
    if ad_legacy.exists():
        ad_legacy.unlink()

    img1 = ep_short / "qa" / "design" / "cast_episode_p1_v.jpg"
    img2 = ep_short / "qa" / "design" / "overview_sets.jpg"
    img1.parent.mkdir(parents=True, exist_ok=True)
    img1.write_bytes(b"\xff\xd8\xff\xe0FAKECASTJPEG")
    img2.write_bytes(b"\xff\xd8\xff\xe0FAKESETSJPEG")
    (ep_short / "gates" / "G4.review.md").write_text(
        'verdict: pass\napproval: user\nuser_quote: "bo cuc nhan vat va boi canh on roi em"\n',
        encoding="utf-8",
    )
    design_skill = str(SUITE / "skills" / "sv-design" / "SKILL.md")

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
    script_skill = str(SUITE / "skills" / "sv-write-script" / "SKILL.md")
    bible_skill = str(SUITE / "guides" / "core" / "bible.md")

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
    contact_img = ep_short / "qa" / "contact_p1.jpg"
    real_agy_path_val = json.dumps(str(contact_img))  # produces '"C:\\\\...\\\\contact_p1.jpg"'
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
    # Before contact_p1.jpg exists on disk, H6 MUST DENY (blocks pre-render failed read_file spoofing!)
    if contact_img.exists():
        contact_img.unlink()
    res_h6_missing = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep_short),
        "transcriptPath": str(t_seen),
        "toolCall": {"name": "run_command", "args": {"CommandLine": "python scripts/sv_cli.py gate pass G5 --actor coord-1"}},
    })
    assert res_h6_missing["decision"] == "deny" and "H6" in res_h6_missing["reason"], f"H6 missing-file spoof must deny: {res_h6_missing}"

    # Once contact_p1.jpg actually exists on disk (>0 bytes), H6 ALLOWS
    contact_img.parent.mkdir(parents=True, exist_ok=True)
    contact_img.write_bytes(b"\xff\xd8\xff\xe0REALCONTACTJPEG")
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
    cues = {"seg_starts": {"s1": 0.0}, "total": 2.6, "voice_end": 2.6}
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

    long_prod_skill = str(SUITE / "guides" / "long" / "production.md")
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


def test_10_v61_raster_plate_and_squash_stretch(ep_short: Path) -> None:
    """Verify v6.1.0 opt-in rasterPlate lint, rough/Pixi script syntax, and anim.ts squash-stretch kinematics."""
    # (a) Syntax check all 4 generalized atmospheric-plate scripts
    for script_name in ("rough_helpers.mjs", "pixi_stage.mjs", "pixi_fx.mjs", "rough_pixi_bake.mjs"):
        r_chk = _run(["node", "--check", str(SUITE / "engine" / "scripts" / script_name)], cwd=SUITE)
        assert r_chk.returncode == 0, f"syntax error in {script_name}:\n{r_chk.stderr}"

    # (b) Bundle & execute anim.ts squashStretch / evalSquashLeap / evalPopSquash invariants + compile-check Film.tsx & Sheets.tsx
    probe_js = (
        "import {build} from 'esbuild';\n"
        "import fs from 'node:fs';\n"
        "import path from 'node:path';\n"
        "import {pathToFileURL} from 'node:url';\n"
        "const stub = { name: 'stub', setup(b) {\n"
        "  b.onResolve({filter: /^@remotion\\/google-fonts|^remotion$/}, (a) => ({path: a.path, namespace: 'st'}));\n"
        "  b.onLoad({filter: /.*/, namespace: 'st'}, (a) => ({\n"
        "    contents: a.path.startsWith('@remotion') ? 'export const loadFont = () => ({fontFamily:\"Be Vietnam Pro\"});' : 'export const AbsoluteFill=()=>null;export const Audio=()=>null;export const OffthreadVideo=()=>null;export const Loop=({children})=>children??null;export const staticFile=(s)=>s;export const delayRender=()=>0;export const continueRender=()=>{};export const useCurrentFrame=()=>0;',\n"
        "    loader: 'js',\n"
        "  }));\n"
        "}};\n"
        "const r = await build({\n"
        "  entryPoints: [path.resolve('src/anim.ts')], bundle: true, write: false, platform: 'node', format: 'esm',\n"
        "  external: ['react', 'react-dom', 'react/jsx-runtime'], plugins: [stub], logLevel: 'error',\n"
        "});\n"
        "await build({\n"
        "  entryPoints: [path.resolve('src/Film.tsx'), path.resolve('src/design/Sheets.tsx')], bundle: true, outdir: path.resolve('qa/.sv-tmp'), write: false, platform: 'node', format: 'esm',\n"
        "  jsx: 'automatic', external: ['react', 'react-dom', 'react/jsx-runtime'], plugins: [stub], logLevel: 'error',\n"
        "});\n"
        "fs.mkdirSync(path.resolve('qa'), {recursive: true});\n"
        "const out = path.resolve('qa/.sv-anim-test.mjs');\n"
        "fs.writeFileSync(out, r.outputFiles[0].text);\n"
        "try {\n"
        "  const M = await import(pathToFileURL(out).href);\n"
        "  const s1 = M.squashStretch(1.25);\n"
        "  if (Math.abs(s1.sx * s1.sy - 1) > 1e-6) throw new Error('volume drift');\n"
        "  if (M.squashStretch(0.1).sy !== 0.65 || M.squashStretch(5).sy !== 1.45) throw new Error('clamp failed');\n"
        "  if (M.evalSquashLeap(-0.1).active || M.evalSquashLeap(1.2).active) throw new Error('leap bounds');\n"
        "  const ant = M.evalSquashLeap(0.08, {height: 80, dur: 0.9});\n"
        "  if (!ant.active || ant.dy !== 0 || ant.sy >= 1 || ant.sx <= 1) throw new Error('anticipation failed');\n"
        "  const air = M.evalSquashLeap(0.405, {height: 80, dur: 0.9});\n"
        "  if (!air.active || air.dy >= -50 || air.shadowScale >= 0.8) throw new Error('airborne apex failed');\n"
        "  const land = M.evalSquashLeap(0.71, {height: 80, dur: 0.9});\n"
        "  if (!land.active || land.dy !== 0 || land.sy >= 1 || !land.landingDust) throw new Error('landing squash failed');\n"
        "  for (let i = 0; i <= 20; i++) {\n"
        "    const sm = M.evalSquashLeap((i / 20) * 0.9, {height: 80, dur: 0.9});\n"
        "    if (Math.abs(sm.sx * sm.sy - 1) > 1e-6) throw new Error('leap volume drift');\n"
        "  }\n"
        "  const pop = M.evalPopSquash(0.08, 0.12);\n"
        "  if (!pop.active || Math.abs(pop.sx * pop.sy - 1) > 1e-6) throw new Error('pop volume drift');\n"
        "  if (M.evalPopSquash(0.6, 0.12).active) throw new Error('pop end bound');\n"
        "  console.log('ANIM_OK');\n"
        "} finally { fs.rmSync(out, {force: true}); }\n"
    )
    r_anim = _run(["node", "--input-type=module", "-e", probe_js], cwd=ep_short)
    assert r_anim.returncode == 0 and "ANIM_OK" in r_anim.stdout, f"anim.ts test failed:\n{r_anim.stdout}\n{r_anim.stderr}"

    # (c) rasterPlate & videoPlate design lint: missing <image>, https://, .mp4 inside <image>, tiny icon, or missing videoPlate fail SE-06; valid local PNG & MP4 pass!
    yard_png = ep_short / "public" / "plates" / "yard.png"
    rain_mp4 = ep_short / "public" / "plates" / "rain.mp4"
    yard_png.parent.mkdir(parents=True, exist_ok=True)
    for fp in (yard_png, rain_mp4):
        if fp.exists():
            fp.unlink()
    (ep_short / "src" / "episode" / "sets.tsx").write_text(
        "import React from 'react';\n"
        "import {R, S} from '../kit';\n"
        "import type {SetDef} from '../sets/types';\n"
        "export const EPISODE_SETS: Record<string, SetDef> = {\n"
        "  badNoImg: {\n"
        "    title: 'Nền thiếu thẻ ảnh',\n"
        "    bed: 'outdoor',\n"
        "    rasterPlate: true,\n"
        "    bounds: [-200, -200, 1280, 2120],\n"
        "    zones: {bgY: 1100, mgY: [1540, 1760], fgY: 1860},\n"
        "    render: () => ({back: <g><S d={R(-200, -200, 1480, 2320)} f='sky2' /></g>, mid: []}),\n"
        "  },\n"
        "  badHttpsImg: {\n"
        "    title: 'Nền URL ngoài',\n"
        "    bed: 'outdoor',\n"
        "    rasterPlate: true,\n"
        "    bounds: [-200, -200, 1280, 2120],\n"
        "    zones: {bgY: 1100, mgY: [1540, 1760], fgY: 1860},\n"
        "    render: () => ({back: <g><image href='https://example.com/plate.png' x={-200} y={-200} width={1480} height={2320} /></g>, mid: []}),\n"
        "  },\n"
        "  badMp4InSvgImg: {\n"
        "    title: 'Nhét mp4 vào thẻ image',\n"
        "    bed: 'rain',\n"
        "    rasterPlate: true,\n"
        "    bounds: [-200, -200, 1280, 2120],\n"
        "    zones: {bgY: 1100, mgY: [1540, 1760], fgY: 1860},\n"
        "    render: () => ({back: <g><image href='plates/rain.mp4' x={-200} y={-200} width={1480} height={2320} /></g>, mid: []}),\n"
        "  },\n"
        "  badTinyImg: {\n"
        "    title: 'Nền icon tí hon',\n"
        "    bed: 'outdoor',\n"
        "    rasterPlate: true,\n"
        "    bounds: [-200, -200, 1280, 2120],\n"
        "    zones: {bgY: 1100, mgY: [1540, 1760], fgY: 1860},\n"
        "    render: () => ({back: <g><image href='plates/yard.png' x={0} y={0} width={32} height={32} /></g>, mid: []}),\n"
        "  },\n"
        "  goodPlate: {\n"
        "    title: 'Nền vẽ tay hoàn chỉnh',\n"
        "    bed: 'outdoor',\n"
        "    rasterPlate: true,\n"
        "    bounds: [-200, -200, 1280, 2120],\n"
        "    zones: {bgY: 1100, mgY: [1540, 1760], fgY: 1860},\n"
        "    render: (o) => ({back: <g><image href='plates/yard.png' x={-200} y={-200} width={1480} height={2320} /><circle cx={100} cy={100} r={4 + Math.sin(o.t)} /></g>, mid: []}),\n"
        "  },\n"
        "  goodVideoPlate: {\n"
        "    title: 'Phố mưa động',\n"
        "    bed: 'rain',\n"
        "    videoPlate: {src: 'plates/rain.mp4', x: -200, y: -200, width: 1480, height: 2320, dur: 4.0},\n"
        "    bounds: [-200, -200, 1280, 2120],\n"
        "    zones: {bgY: 1100, mgY: [1540, 1760], fgY: 1860},\n"
        "    render: () => ({back: <g />, mid: []}),\n"
        "  },\n"
        "};\n",
        encoding="utf-8",
    )
    # Missing on-disk public/plates/yard.png & rain.mp4 -> goodPlate & goodVideoPlate MUST FAIL SE-06!
    _run(["node", "scripts/lint.mjs", "design"], cwd=ep_short)
    d_miss = json.loads((ep_short / "qa" / "lint.json").read_text(encoding="utf-8")).get("errors", [])
    assert any("[SE-06]" in e and "goodPlate" in e and "missing on disk" in e for e in d_miss), f"missing public plate must fail SE-06:\n{d_miss}"
    assert any("[SE-06]" in e and "goodVideoPlate" in e and "missing on disk" in e for e in d_miss), f"missing public videoPlate must fail SE-06:\n{d_miss}"

    # Write real >=512B PNG & >=1024B MP4 -> goodPlate & goodVideoPlate pass SE-06..SE-10 (and SE-12 moves), while bad* fail SE-06!
    yard_png.write_bytes(b"\x89PNG\r\n\x1a\n" + b"X" * 1024)
    rain_mp4.write_bytes(b"\x00\x00\x00\x18ftypmp42" + b"V" * 2048)
    _run(["node", "scripts/lint.mjs", "design"], cwd=ep_short)
    d_lint = json.loads((ep_short / "qa" / "lint.json").read_text(encoding="utf-8"))
    d_errs = d_lint.get("errors", [])
    d_warns = d_lint.get("warns", [])
    for bad_id in ("badNoImg", "badHttpsImg", "badMp4InSvgImg", "badTinyImg"):
        assert any("[SE-06]" in e and bad_id in e for e in d_errs), f"{bad_id} must fail SE-06:\n{d_errs}"
    for good_id in ("goodPlate", "goodVideoPlate"):
        assert not any(any(code in e for code in ("[SE-06]", "[SE-07]", "[SE-08]", "[SE-09]", "[SE-10]")) and good_id in e for e in d_errs), (
            f"{good_id} should pass SE-06..SE-10:\n{d_errs}"
        )
    assert not any("[SE-12]" in w and "goodVideoPlate" in w for w in d_warns), f"goodVideoPlate inherently moves and must not warn SE-12:\n{d_warns}"

    # (d) Actor.leap & Actor.pop anchor validation, bounds/restraint CI, MO-08 liveness, and leap QA strip emission
    (ep_short / "src" / "episode" / "shotlist.ts").write_text(
        "import type {ShotDef} from '../engine';\n"
        "export const SHOTS: ShotDef[] = [\n"
        "  {\n"
        "    name: 'bad_leap_and_pop',\n"
        "    at: 's1',\n"
        "    set: 'goodPlate',\n"
        "    cam: [540, 1150, 1.0],\n"
        "    actors: [{\n"
        "      id: 'nhim', look: 'nhim', x: 540, y: 1650, s: 1.0, e: 'sad',\n"
        "      leap: [{at: 's1@khongco', h: 65}, {at: 0.1, h: 400, dur: 0.8}, {at: 0.2, h: 60, dur: 0.8}, {at: 9.0, h: 60}],\n"
        "      pop: [{at: 0.2, amp: 0.55}],\n"
        "    }],\n"
        "  },\n"
        "];\n",
        encoding="utf-8",
    )
    _run(["node", "scripts/lint.mjs", "shots"], cwd=ep_short)
    s_bad = json.loads((ep_short / "qa" / "lint.json").read_text(encoding="utf-8"))
    sb_errs = "\n".join(s_bad.get("errors", []))
    sb_warns = "\n".join(s_bad.get("warns", []))
    assert "[AN-01]" in sb_errs and ".leap" in sb_errs, f"bad leap anchor must fail AN-01:\n{sb_errs}"
    assert "[MO-17]" in sb_errs, f"out-of-bounds/overlapping leap must fail MO-17:\n{sb_errs}"
    assert "[MO-15]" in sb_errs, f"excessive pop amp must fail MO-15:\n{sb_errs}"
    assert "[KY-01]" in sb_errs, f"late leap outside shot must fail KY-01:\n{sb_errs}"
    assert "[MO-15]" in sb_warns, f"leap/pop on sad expression should warn MO-15:\n{sb_warns}"

    # Out-of-order non-overlapping leaps (e.g. [1.6, 0.2]) must sort cleanly without false MO-17 overlap error!
    (ep_short / "src" / "episode" / "shotlist.ts").write_text(
        "import type {ShotDef} from '../engine';\n"
        "export const SHOTS: ShotDef[] = [\n"
        "  {\n"
        "    name: 'good_leap_pop',\n"
        "    at: 's1',\n"
        "    set: 'goodPlate',\n"
        "    cam: [540, 1150, 1.0],\n"
        "    actors: [{id: 'nhim', look: 'nhim', x: 540, y: 1650, s: 1.0, e: 'joy', leap: [{at: 1.6, h: 65, dur: 0.7}, {at: 's1@Nhím', h: 65, dur: 0.7}], pop: [{at: 's1@học', amp: 0.11}]}],\n"
        "  },\n"
        "];\n",
        encoding="utf-8",
    )
    _run(["node", "scripts/lint.mjs", "shots"], cwd=ep_short)
    s_ok = json.loads((ep_short / "qa" / "lint.json").read_text(encoding="utf-8"))
    assert not any(any(c in e for c in ("[AN-01]", "[MO-15]", "[MO-17]", "[KY-01]")) for e in s_ok.get("errors", [])), f"valid leap/pop failed:\n{s_ok}"
    assert not any("[MO-08]" in w for w in s_ok.get("warns", [])), f"valid leap/pop should count as live motion:\n{s_ok}"
    strips_needed = json.loads((ep_short / "qa" / "strips_needed.json").read_text(encoding="utf-8"))
    assert any(st.get("why") == "leap" for st in strips_needed), f"expected leap strip in strips_needed.json: {strips_needed}"

    print("[PASS] Test 10: v6.1.0 rasterPlate on-disk/bounds CI + rough/Pixi syntax + anim.ts squash-stretch & leap/pop restraint verified")


def test_11_anti_bypass_hardening(ep_short: Path, tmp: Path) -> None:
    """Verify v6.1.0 anti-bypass hardening across sv_guard.py (H1/H2/H4/H6), sv_log_lint.py (LG-05/09/11), and sv_gate.py."""
    # 1. H1 blocks editing src/anim.ts and src/math.ts
    for ro_rel in ("src/anim.ts", "src/math.ts", "src/design/Sheets.tsx", "package.json"):
        res = _invoke_hook({
            "hookEventName": "PreToolUse",
            "cwd": str(ep_short),
            "toolCall": {"name": "edit_file", "args": {"Path": str(ep_short / ro_rel)}},
        })
        assert res["decision"] == "deny" and "H1" in res["reason"], f"H1 should deny {ro_rel}: {res}"

    # 2. H2 blocks direct write_file to qa/review/00.json & qa/design/plate_stats.json, while allowing qa/blind_review/rev_1.jsonl
    for imm_rel in ("qa/review/00.json", "qa/design/plate_stats.json", "qa/blind_review/manifest.json"):
        res = _invoke_hook({
            "hookEventName": "PreToolUse",
            "cwd": str(ep_short),
            "toolCall": {"name": "write_file", "args": {"Path": str(ep_short / imm_rel)}},
        })
        assert res["decision"] == "deny" and "H2" in res["reason"], f"H2 should deny {imm_rel}: {res}"

    res_batch_ok = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep_short),
        "toolCall": {"name": "write_file", "args": {"Path": str(ep_short / "qa" / "blind_review" / "rev_1.jsonl")}},
    })
    assert res_batch_ok["decision"] == "allow", f"Reviewer batch input rev_1.jsonl must stay writable: {res_batch_ok}"

    # 3. H4 allows read-only python -c / node -e diagnostics, while blocking mutating inline scripts & shell redirects
    for ok_read_cmd in (
        'python -c "import json; print(len(json.load(open(\'qa/lint.json\'))[\'errors\']))"',
        'node -e "console.log(require(\'fs\').readFileSync(\'standards/pacing.json\', \'utf8\').length)"',
    ):
        res = _invoke_hook({
            "hookEventName": "PreToolUse",
            "cwd": str(ep_short),
            "toolCall": {"name": "run_command", "args": {"CommandLine": ok_read_cmd}},
        })
        assert res["decision"] == "allow", f"H4 must allow read-only diagnostic `{ok_read_cmd}`: {res}"

    for bad_cmd in (
        'python -c "open(\'standards/pacing.json\', \'w\').write(\'{}\')"',
        'python -c "from pathlib import Path; Path(\'qa/lint.json\').write_text(\'{}\')"',
        'node -e "require(\'fs\').writeFileSync(\'qa/review/00.json\', \'{}\')"',
        'Copy-Item fake.json qa/design/plate_stats.json',
    ):
        res = _invoke_hook({
            "hookEventName": "PreToolUse",
            "cwd": str(ep_short),
            "toolCall": {"name": "run_command", "args": {"CommandLine": bad_cmd}},
        })
        assert res["decision"] == "deny" and "H4" in res["reason"], f"H4 should deny `{bad_cmd}`: {res}"

    # 4. H6 G4 requires reading BOTH cast sheet AND set sheet when both exist on disk
    t_cast_only = tmp / "transcript_g4_cast_only.jsonl"
    t_cast_only.write_text(
        json.dumps({
            "source": "MODEL",
            "type": "PLANNER_RESPONSE",
            "tool_calls": [{"name": "read_file", "args": {"Path": json.dumps(str(ep_short / "qa" / "design" / "cast_episode_p1_v.jpg"))}}],
        }) + "\n",
        encoding="utf-8",
    )
    res_g4_partial = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep_short),
        "transcriptPath": str(t_cast_only),
        "toolCall": {"name": "run_command", "args": {"CommandLine": "python scripts/sv_cli.py gate pass G4 --actor coord-1"}},
    })
    assert res_g4_partial["decision"] == "deny" and "H6" in res_g4_partial["reason"], f"H6 G4 cast-only must deny: {res_g4_partial}"

    t_both = tmp / "transcript_g4_both.jsonl"
    t_both.write_text(
        json.dumps({
            "source": "MODEL",
            "type": "PLANNER_RESPONSE",
            "tool_calls": [
                {"name": "read_file", "args": {"Path": json.dumps(str(ep_short / "qa" / "design" / "cast_episode_p1_v.jpg"))}},
                {"name": "read_file", "args": {"Path": json.dumps(str(ep_short / "qa" / "design" / "overview_sets.jpg"))}},
            ],
        }) + "\n",
        encoding="utf-8",
    )
    res_g4_both = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep_short),
        "transcriptPath": str(t_both),
        "toolCall": {"name": "run_command", "args": {"CommandLine": "python scripts/sv_cli.py gate pass G4 --actor coord-1"}},
    })
    assert res_g4_both["decision"] == "allow", f"H6 G4 with both cast & set sheets should allow: {res_g4_both}"

    # 5. Direct `python scripts/sv_gate.py pass G1` without sv_cli.py is blocked in v6 episodes
    r_direct = _run([PY, "scripts/sv_gate.py", "pass", "G1"], cwd=ep_short)
    assert r_direct.returncode != 0 and "BYPASS_BLOCKED" in (r_direct.stdout + r_direct.stderr), (
        f"direct sv_gate.py pass must be blocked: {r_direct.stdout} {r_direct.stderr}"
    )

    # 6. LG-05 phase-aware cross-check:
    # (a) same-phase design errors in qa/lint.json -> MUST FAIL G4 executor Log-CI
    (ep_short / "qa" / "lint.json").write_text(json.dumps({"phase": "design", "errors": ["[SE-06] unresolved error"], "warns": []}), encoding="utf-8")
    r_lg05 = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G4", "--role", "executor", "--json"], cwd=ep_short)
    d_lg05 = json.loads(r_lg05.stdout)
    assert r_lg05.returncode == 2 and any("[LG-05]" in e for e in d_lg05["errors"]), f"LG-05 must catch same-phase design lint errors: {d_lg05}"

    # (b) cross-phase loophole: leftover phase='design', errors=[] MUST NOT satisfy a fake G5 ('shots') executor run without ci_lint pass
    (ep_short / "qa" / "lint.json").write_text(json.dumps({"phase": "design", "errors": [], "warns": []}), encoding="utf-8")
    sh_skill = str(SUITE / "skills" / "sv-produce" / "SKILL.md")
    r_fake_g5 = _log_init(ep_short, "executor", "exec-fake-g5", "G5", "Fake shots CI")
    _log_step(ep_short, r_fake_g5, "read_skill", target=sh_skill, note="Read Short production skill before shots")
    _log_step(ep_short, r_fake_g5, "run_tool", target="shots", cmd="sv_cli.py ci shots", exit_code=0, note="Claimed shots CI passed without running it")
    _log_complete(ep_short, r_fake_g5, "pass", "src/episode/shotlist.ts", "Completed shotlist")
    r_lg05_mm = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G5", "--role", "executor", "--actor", "exec-fake-g5", "--json"], cwd=ep_short)
    d_lg05_mm = json.loads(r_lg05_mm.stdout)
    assert r_lg05_mm.returncode == 2 and any("[LG-05]" in e and "phase" in e for e in d_lg05_mm["errors"]), (
        f"LG-05 must reject leftover phase='design' qa/lint.json for G5 shots: {d_lg05_mm}"
    )

    # (c) cross-phase non-regression: once ci_lint.jsonl has a genuine passing 'design' record, later G5 phase='shots' errors in qa/lint.json MUST NOT break G4 Log-CI
    d_skill = str(SUITE / "skills" / "sv-design" / "SKILL.md")
    r_g4_cur = _log_init(ep_short, "executor", "exec-design-v61", "G4", "Re-log G4 on current sets.tsx")
    _log_step(ep_short, r_g4_cur, "read_skill", target=d_skill, note="Read Short design skill for G4 verification")
    _log_step(ep_short, r_g4_cur, "run_tool", target="design", cmd="sv_cli.py ci design", exit_code=0, note="Design CI passed cleanly on current sets")
    _log_complete(ep_short, r_g4_cur, "pass", "src/episode/sets.tsx", "Locked current sets.tsx SHA")
    ci_lint_p = ep_short / "logs" / "ci_lint.jsonl"
    _run(
        [PY, "-c", "import sys; sys.path.insert(0, 'scripts'); import sv_log as L; from pathlib import Path; L.log_ci_event(Path('.'), stage='G4', domain='design', actor_id='sv-ci', command='lint design', exit_code=0, metrics={}, note='design CI PASS')"],
        cwd=ep_short,
    )
    assert ci_lint_p.is_file()
    (ep_short / "qa" / "lint.json").write_text(json.dumps({"phase": "shots", "errors": ["[SH-02] later G5 shot error"], "warns": []}), encoding="utf-8")
    r_lg05_g4_ok = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G4", "--role", "executor", "--actor", "exec-design-v61", "--json"], cwd=ep_short)
    d_lg05_g4_ok = json.loads(r_lg05_g4_ok.stdout)
    assert r_lg05_g4_ok.returncode == 0 and d_lg05_g4_ok["ok"], (
        f"G4 executor Log-CI should stay green when ci_lint recorded design PASS even after G5 overwrote qa/lint.json: {d_lg05_g4_ok}"
    )
    (ep_short / "qa" / "lint.json").write_text(json.dumps({"phase": "all", "errors": [], "warns": []}), encoding="utf-8")

    g4_rev = ep_short / "gates" / "G4.review.md"
    saved_g4 = g4_rev.read_text(encoding="utf-8")
    g4_rev.unlink()
    r_lg11 = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G4", "--role", "orchestrator", "--json"], cwd=ep_short)
    d_lg11 = json.loads(r_lg11.stdout)
    assert r_lg11.returncode == 2 and any("[LG-11]" in e for e in d_lg11["errors"]), f"LG-11 must fail when G4.review.md is missing: {d_lg11}"
    g4_rev.write_text(saved_g4, encoding="utf-8")

    print("[PASS] Test 11: Anti-bypass hardening (H1/H2/H4/H6 + direct sv_gate block + LG-05/LG-11 disk cross-checks) verified")


def test_12_v62_art_direction_gate_and_scored_rubric(tmp: Path) -> None:
    """Verify v6.2.0 Pre-G4 Art Direction gate, H3 lock, AD-01..08, H2 protection, design score & LG-13."""
    ep = tmp / "ep-v62"
    r_sc = _run([PY, str(SUITE / "tools" / "new_episode.py"), str(ep), "--track", "short"], cwd=SUITE)
    assert r_sc.returncode == 0, f"v6.2 short scaffold failed:\n{r_sc.stdout}\n{r_sc.stderr}"
    assert (ep / "art_direction.json").is_file(), "starter art_direction.json must exist in fresh episode"

    # Prepare brief.md with 2 core locations & pass G1 so H3 isolates the art_direction.json lock
    brief_txt = "\n".join([
        "# Episode Brief",
        "## Archetype", "Slice-of-Life Mystery",
        "## Premise", "A missing sketchbook leaves subtle chalk clues across a neighborhood cafe and alley.",
        "## Spine", "Setup -> Clue -> Detour -> Reveal -> Resolution -> Button",
        "## Why it is funny", "Deadpan detective seriousness over a lost doodle.",
        "## Characters", "- Nhim: curious ten-year-old protagonist\n- Lan: cafe owner",
        "## Locations", "- cornerCafe: neighborhood corner cafe\n- backAlley: narrow tiled alley behind the cafe",
        "## Ending", "Nhim finds the sketchbook tucked neatly beside the cafe menu board.",
        "## Not copying", "Original neighborhood clue structure.",
    ]) + "\n"
    (ep / "brief.md").write_text(brief_txt, encoding="utf-8")
    (ep / "gates" / "G1.review.md").write_text(
        'verdict: pass\napproval: user\nuser_quote: "duyet brief tap v62 nay nhe"\n',
        encoding="utf-8",
    )
    script_skill = str(SUITE / "skills" / "sv-write-script" / "SKILL.md")
    bible_skill = str(SUITE / "guides" / "core" / "bible.md")
    r_o1 = _log_init(ep, "orchestrator", "coord-1", "G1", "Orchestrate G1 for v6.2 test")
    r_e1 = _log_init(ep, "executor", "exec-brief", "G1", "Author brief.md")
    _log_step(ep, r_e1, "read_skill", target=script_skill, note="Read Short script skill for brief structure")
    _log_complete(ep, r_e1, "pass", "brief.md", "Completed brief.md with two core locations")
    r_r1 = _log_init(ep, "reviewer", "rev-brief", "G1", "Review brief.md")
    _log_step(ep, r_r1, "read_skill", target=bible_skill, note="Verified brief against series bible rules")
    _log_complete(ep, r_r1, "pass", "brief.md", "Brief meets all seven premise checks")
    _log_step(ep, r_o1, "user_approval", approval="user", user_quote="duyet brief tap v62 nay nhe", note="Recorded user approval for G1 brief")
    _log_complete(ep, r_o1, "pass", "gates/G1.review.md", "G1 verified and ready to pass")
    r_g1 = _run([PY, "scripts/sv_cli.py", "gate", "pass", "G1", "--actor", "coord-1", "--json"], cwd=ep)
    assert r_g1.returncode == 0, f"G1 pass failed in Test 12: {r_g1.stdout}\n{r_g1.stderr}"

    # (a) H3 DENIES editing src/episode/sets.tsx & plates/foo.mjs while starter art_direction.json has TODOs / unlinted
    for locked_rel in ("src/episode/sets.tsx", "plates/foo.mjs"):
        res_deny = _invoke_hook({
            "hookEventName": "PreToolUse",
            "cwd": str(ep),
            "toolCall": {"name": "edit_file", "args": {"Path": str(ep / locked_rel)}},
        })
        assert res_deny["decision"] == "deny" and "H3" in res_deny["reason"], (
            f"H3 must deny editing {locked_rel} before ci art-direction passes: {res_deny}"
        )

    # (b) sv_cli.py ci art-direction catches AD-01 on starter TODOs, then AD-02..06 on malformed plan, then exits 0 on valid plan
    r_todo = _run([PY, "scripts/sv_cli.py", "ci", "art-direction", "--json"], cwd=ep)
    d_todo = json.loads(r_todo.stdout)
    assert r_todo.returncode == 1 and any("[AD-01]" in e for e in d_todo["errors"]), (
        f"starter art_direction.json TODOs must fail AD-01: {d_todo}"
    )

    bad_ad = {
        "schema_version": "6.2",
        "episode_slug": "ep-v62",
        "project_style_lock": {
            "style_family": "flat 2D Risograph ink",
            "flat_2d_riso_characters": False,
            "pal_tokens_only": True,
            "nhim_canonical_ch11": True,
        },
        "story_world_elements": {
            "lighting_moods": [],
            "recurring_motifs": ["tiled floor"],
            "material_and_organic_rules": ["vary silhouettes"],
        },
        "layer_architecture": {
            "far": "too short",
            "mid": "Primary architectural stage and walkable zones matching floor lane",
            "light_emissive": "Warm morning window bounce across counter and doorway",
            "fg_staging": "Clean foreground framing edges clear of walking lane",
            "anti_shortcut_rules": ["Zero identical clone-stamped clouds or foliage silhouettes anywhere"],
        },
        "location_matrix": [
            {
                "id": "cafeFront",
                "location": "cornerCafe",
                "shotScale": "establishing",
                "camera_angle": "front",
                "horizon_and_perspective": "short horizon",
                "terrain_and_edge_transitions": "short edge",
                "lighting_mood": "warm morning",
                "weather_fx_mode": "none",
                "mandatory_objects": ["awning", "door", "sign"],
                "landmarks": ["awning"],
                "anti_spoiler_guards": [],
            }
        ],
        "reviewer_rubric": {
            "min_total": 70,
            "min_dim": 5,
            "axes": {
                "style_cohesion": "Consistent Risograph ink weight and PAL harmony throughout",
            },
        },
    }
    (ep / "art_direction.json").write_text(json.dumps(bad_ad, indent=2), encoding="utf-8")
    r_bad_ad = _run([PY, "scripts/sv_cli.py", "ci", "art-direction", "--json"], cwd=ep)
    d_bad_ad = json.loads(r_bad_ad.stdout)
    bad_blob = "\n".join(d_bad_ad["errors"])
    assert r_bad_ad.returncode == 1, f"invalid art_direction.json must fail ci art-direction: {d_bad_ad}"
    for code in ("AD-02", "AD-03", "AD-04", "AD-05", "AD-06"):
        assert f"[{code}]" in bad_blob, f"expected [{code}] in art_direction errors:\n{bad_blob}"

    def _sub(sid: str, loc: str, scale: str, angle: str, n_objs: int) -> dict:
        return {
            "id": sid,
            "location": loc,
            "shotScale": scale,
            "camera_angle": angle,
            "horizon_and_perspective": "Eye-level horizon locked at sixty percent height separating sidewalk curb from interior floor plane",
            "terrain_and_edge_transitions": "Weathered stone pavers curve naturally into the asphalt curb with subtle grit and doorway mat seam",
            "lighting_mood": "warm morning key",
            "weather_fx_mode": "none",
            "mandatory_objects": [f"{sid}_detail_{i}" for i in range(1, n_objs + 1)],
            "landmarks": [f"{loc}_arch", f"{loc}_sign"],
            "anti_spoiler_guards": ["none: no early concealment required"],
        }

    axes_8 = [
        "style_cohesion",
        "depth_and_lighting",
        "perspective_and_scale",
        "composition_and_integration",
        "detail_density_and_variety",
        "staging_readability",
        "spatial_continuity",
        "story_and_spoiler_fidelity",
    ]
    valid_ad = {
        "schema_version": "6.2",
        "episode_slug": "ep-v62",
        "project_style_lock": {
            "style_family": "flat 2D Risograph ink with warm paper tooth",
            "flat_2d_riso_characters": True,
            "pal_tokens_only": True,
            "nhim_canonical_ch11": True,
        },
        "story_world_elements": {
            "lighting_moods": ["warm morning key", "cool shaded alley"],
            "recurring_motifs": ["scuffed tiled thresholds", "hand-painted enamel signs"],
            "material_and_organic_rules": [
                "Vary foliage, clutter, and surface wear silhouettes organically across every plate",
                "Soften structural edges and terrain boundaries where distinct materials meet",
            ],
        },
        "layer_architecture": {
            "far": "Atmospheric backdrop plane with restrained contrast so foreground Risograph keylines stay crisp",
            "mid": "Primary architectural stage, shared landmarks, and walkable floor lanes matching zones.mgY",
            "light_emissive": "Story-motivated morning sunlight and warm interior lamp bounce without muddying silhouettes",
            "fg_staging": "Subtle foreground framing anchors kept clear of actor walking lanes and captions",
            "anti_shortcut_rules": [
                "Zero identical clone-stamped clouds, tiles, plants, or props repeated across plates",
                "Zero ruler-straight unintegrated horizon cuts or floating pasted foreground decals",
            ],
        },
        "location_matrix": [
            _sub("cafeFront", "cornerCafe", "establishing", "front", 12),
            _sub("cafeCounter", "cornerCafe", "medium", "front", 12),
            _sub("cafeMenuInsert", "cornerCafe", "insert", "detail", 8),
            _sub("alleyWide", "backAlley", "establishing", "front", 12),
            _sub("alleyDoor", "backAlley", "medium", "side", 12),
            _sub("alleyChalk", "backAlley", "closeup", "macro_low", 8),
        ],
        "reviewer_rubric": {
            "min_total": 82,
            "min_dim": 7,
            "axes": {
                ax: f"Concrete grading rubric verifying {ax.replace('_', ' ')} across every rendered design plate"
                for ax in axes_8
            },
        },
    }
    (ep / "art_direction.json").write_text(json.dumps(valid_ad, indent=2), encoding="utf-8")
    r_ok_ad = _run([PY, "scripts/sv_cli.py", "ci", "art-direction", "--json"], cwd=ep)
    d_ok_ad = json.loads(r_ok_ad.stdout)
    assert r_ok_ad.returncode == 0 and d_ok_ad["ok"], f"valid art_direction.json must pass ci art-direction: {d_ok_ad}"

    # (c) H3 ALLOWS editing src/episode/sets.tsx once ci art-direction passes, and DENIES again if mutated!
    res_allow = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep),
        "toolCall": {"name": "edit_file", "args": {"Path": str(ep / "src" / "episode" / "sets.tsx")}},
    })
    assert res_allow["decision"] == "allow", f"H3 must allow sets.tsx after passing ci art-direction: {res_allow}"

    mutated_ad = dict(valid_ad, episode_slug="ep-v62-mutated")
    (ep / "art_direction.json").write_text(json.dumps(mutated_ad, indent=2), encoding="utf-8")
    res_relock = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep),
        "toolCall": {"name": "edit_file", "args": {"Path": str(ep / "src" / "episode" / "sets.tsx")}},
    })
    assert res_relock["decision"] == "deny" and "H3" in res_relock["reason"], (
        f"H3 must re-lock sets.tsx when art_direction.json is mutated without re-running ci art-direction: {res_relock}"
    )
    # Restore & re-run ci art-direction so SHA matches disk cleanly
    (ep / "art_direction.json").write_text(json.dumps(valid_ad, indent=2), encoding="utf-8")
    r_reok = _run([PY, "scripts/sv_cli.py", "ci", "art-direction", "--json"], cwd=ep)
    assert r_reok.returncode == 0, f"re-running ci art-direction failed: {r_reok.stdout}"

    # (d) lint.mjs design fails AD-08 when a sub-scene declared in art_direction.json is missing from EPISODE_SETS
    (ep / "src" / "episode" / "cast.ts").write_text(
        "import {NHIM_LOOK, type Look} from '../chars';\n"
        "export const CAST: Record<string, Look> = { nhim: {...NHIM_LOOK, name: 'nhim'} };\n"
        "export const CAST_ROLES = { nhim: {role: 'principal' as const, vi: 'Nhím học sinh tiểu học'} };\n",
        encoding="utf-8",
    )
    (ep / "src" / "episode" / "sets.tsx").write_text(
        "import React from 'react';\n"
        "import {R, S} from '../kit';\n"
        "import type {SetDef} from '../sets/types';\n"
        "export const EPISODE_SETS: Record<string, SetDef> = {\n"
        "  cafeFront: {\n"
        "    title: 'Mặt tiền quán cà phê',\n"
        "    bed: 'street',\n"
        "    location: 'cornerCafe',\n"
        "    landmarks: ['cornerCafe_arch', 'cornerCafe_sign'],\n"
        "    bounds: [-200, -200, 1280, 2120],\n"
        "    shotScale: 'establishing',\n"
        "    zones: {bgY: 1100, mgY: [1540, 1760], fgY: 1860},\n"
        "    render: () => ({back: <g><S d={R(-200, -200, 1480, 1740)} f='sky2' /><S d={R(-200, 1540, 1480, 580)} f='asphalt' /></g>, mid: []}),\n"
        "  },\n"
        "};\n",
        encoding="utf-8",
    )
    _run(["node", "scripts/lint.mjs", "design"], cwd=ep)
    d_ad08 = json.loads((ep / "qa" / "lint.json").read_text(encoding="utf-8"))
    assert any("[AD-08]" in e for e in d_ad08.get("errors", [])), (
        f"lint.mjs design must fail AD-08 when art_direction sub-scenes are missing from EPISODE_SETS: {d_ad08}"
    )

    # (e) H2 DENIES direct writes to qa/art_direction_lint.json and qa/design/g4_scores.json (draft remains writable)
    for prot_rel in ("qa/art_direction_lint.json", "qa/design/g4_scores.json"):
        res_h2 = _invoke_hook({
            "hookEventName": "PreToolUse",
            "cwd": str(ep),
            "toolCall": {"name": "write_file", "args": {"Path": str(ep / prot_rel)}},
        })
        assert res_h2["decision"] == "deny" and "H2" in res_h2["reason"], (
            f"H2 must deny direct write to {prot_rel}: {res_h2}"
        )
    res_draft_ok = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep),
        "toolCall": {"name": "write_file", "args": {"Path": str(ep / "qa" / "design" / "scores_draft.json")}},
    })
    assert res_draft_ok["decision"] == "allow", f"Reviewer draft scores_draft.json must stay writable: {res_draft_ok}"

    # Prepare G4 design sheets & reviewer run for (f) and (g)
    cast_img = ep / "qa" / "design" / "cast_episode_p1_v.jpg"
    sets_img = ep / "qa" / "design" / "overview_sets.jpg"
    cast_img.parent.mkdir(parents=True, exist_ok=True)
    cast_img.write_bytes(b"\xff\xd8\xff\xe0FAKECASTV62")
    sets_img.write_bytes(b"\xff\xd8\xff\xe0FAKESETSV62")
    design_skill = str(SUITE / "skills" / "sv-design" / "SKILL.md")

    def _make_draft(override_set: str | None = None, override_axis: str | None = None, override_val: int = 9) -> dict:
        sets_map = {}
        for item in valid_ad["location_matrix"]:
            sid = item["id"]
            ax_map = {}
            for ax in axes_8:
                val = override_val if (sid == override_set and ax == override_axis) else 9
                ax_map[ax] = {
                    "score": val,
                    "reason": f"Audited rendered plate {sid} for {ax.replace('_', ' ')} with grounded horizon and clean contrast",
                }
            sets_map[sid] = {"axes": ax_map}
        return {"sets": sets_map}

    # (f) sv_cli.py design score rejects (verdict: "fix") when any single axis < 7 (perspective_and_scale: 5),
    #     and ci log --stage G4 --role reviewer fails LG-13!
    r_rev_fix = _log_init(ep, "reviewer", "rev-design-v62", "G4", "Score G4 design plates (failing axis test)")
    _log_step(ep, r_rev_fix, "read_skill", target=design_skill, note="Loaded Short 9:16 art direction and rubric rules")
    _log_step(ep, r_rev_fix, "inspect_visual", target="qa/design/cast_episode_p1_v.jpg", note="Checked cast sheet p1 silhouettes and canonical Nhim red cap")
    _log_step(ep, r_rev_fix, "inspect_visual", target="qa/design/overview_sets.jpg", note="Checked overview sets sheet and spotted perspective tilt on cafeFront")

    draft_p = ep / "qa" / "design" / "scores_draft.json"
    draft_p.write_text(json.dumps(_make_draft("cafeFront", "perspective_and_scale", 5), indent=2), encoding="utf-8")
    r_sc_fix = _run(
        [PY, "scripts/sv_cli.py", "design", "score", "--input", "qa/design/scores_draft.json", "--actor", "rev-design-v62", "--run", r_rev_fix, "--json"],
        cwd=ep,
    )
    assert r_sc_fix.returncode == 0, f"valid draft submission should exit 0 even with verdict=fix: {r_sc_fix.stdout}\n{r_sc_fix.stderr}"
    g4_fix = json.loads((ep / "qa" / "design" / "g4_scores.json").read_text(encoding="utf-8"))
    assert g4_fix["verdict"] == "fix" and "cafeFront" in g4_fix["failed_sets"], f"expected verdict=fix for perspective_and_scale=5: {g4_fix}"
    _log_complete(ep, r_rev_fix, "pass", "qa/design/g4_scores.json", "Submitted 8-axis scores with one failing perspective axis")

    r_lg13_fail = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G4", "--role", "reviewer", "--actor", "rev-design-v62", "--json"], cwd=ep)
    d_lg13_fail = json.loads(r_lg13_fail.stdout)
    assert r_lg13_fail.returncode == 2 and any("[LG-13]" in e for e in d_lg13_fail["errors"]), (
        f"ci log G4 reviewer must fail LG-13 when g4_scores verdict is fix: {d_lg13_fail}"
    )

    # (g) When all sets score >= 82 and every axis >= 7, design score writes verdict: "pass" and LG-13 PASSES!
    r_rev_pass = _log_init(ep, "reviewer", "rev-design-v62", "G4", "Re-score fixed G4 design plates")
    _log_step(ep, r_rev_pass, "read_skill", target=design_skill, note="Loaded Short 9:16 art direction and rubric rules for re-audit")
    _log_step(ep, r_rev_pass, "inspect_visual", target="qa/design/cast_episode_p1_v.jpg", note="Re-verified cast sheet p1 silhouettes and canonical Nhim proportions")
    _log_step(ep, r_rev_pass, "inspect_visual", target="qa/design/overview_sets.jpg", note="Re-verified fixed cafeFront perspective horizon and all six sets cleanly grounded")

    draft_p.write_text(json.dumps(_make_draft(), indent=2), encoding="utf-8")
    r_sc_pass = _run(
        [PY, "scripts/sv_cli.py", "design", "score", "--input", "qa/design/scores_draft.json", "--actor", "rev-design-v62", "--run", r_rev_pass, "--json"],
        cwd=ep,
    )
    assert r_sc_pass.returncode == 0, f"passing design score failed: {r_sc_pass.stdout}\n{r_sc_pass.stderr}"
    g4_pass = json.loads((ep / "qa" / "design" / "g4_scores.json").read_text(encoding="utf-8"))
    assert g4_pass["verdict"] == "pass" and g4_pass["failed_sets"] == [], f"expected verdict=pass with 0 failed_sets: {g4_pass}"
    _log_complete(ep, r_rev_pass, "pass", "qa/design/g4_scores.json", "All six sets passed 8-axis rubric above minimum thresholds")

    r_lg13_ok = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G4", "--role", "reviewer", "--actor", "rev-design-v62", "--json"], cwd=ep)
    d_lg13_ok = json.loads(r_lg13_ok.stdout)
    assert r_lg13_ok.returncode == 0 and d_lg13_ok["ok"], f"LG-13 should PASS when all sets >= 82 and every axis >= 7: {d_lg13_ok}"

    print("[PASS] Test 12: v6.2.0 Pre-G4 Art Direction gate (H3 lock/relock, AD-01..08, H2 protection, 8-axis design score & LG-13) verified")


def test_13_v621_zero_flicker_transition_qa_and_pr11(tmp: Path) -> None:
    """Verify v6.2.1 zero-flicker <RasterPlate> + keyed <LayerG>, PR-11 anti-treadmill CI, and 30fps transition_qa.py (DL-01/DL-02)."""
    # (a) Engine zero-flicker structural locks in Film.tsx, kit.tsx, and deliver.mjs
    film_txt = (SUITE / "engine" / "src" / "Film.tsx").read_text(encoding="utf-8")
    for needle in ("key={`far-${shot.set}`}", "key={`back-${shot.set}`}", "key={`fg-${shot.set}`}"):
        assert needle in film_txt, f"Film.tsx must key set LayerG by shot.set ({needle})"
    kit_txt = (SUITE / "engine" / "src" / "kit.tsx").read_text(encoding="utf-8")
    for needle in ("DECODED_PLATES", "export const RasterPlate", "delayRender", "continueRender", "img.decode", "requestAnimationFrame", "onLoad"):
        assert needle in kit_txt, f"kit.tsx RasterPlate missing required zero-flicker mechanism: {needle}"
    deliv_txt = (SUITE / "engine" / "scripts" / "deliver.mjs").read_text(encoding="utf-8")
    assert "process.env.SV_PY" in deliv_txt and "scripts/transition_qa.py" in deliv_txt, (
        "deliver.mjs must fall back to SV_PY and run scripts/transition_qa.py"
    )

    # (b) Scaffold fresh episode: verify <RasterPlate> passes SE-06 cleanly with 0 bare-<image> warning,
    #     and PR-11 catches clock-only & un-gated treadmill subjects while passing distance-locked + stop-settled subjects!
    ep = tmp / "ep-v621"
    r_sc = _run([PY, str(SUITE / "tools" / "new_episode.py"), str(ep), "--track", "short"], cwd=SUITE)
    assert r_sc.returncode == 0, f"v6.2.1 scaffold failed:\n{r_sc.stdout}\n{r_sc.stderr}"

    bg_png = ep / "public" / "plates" / "bg.png"
    bg_png.parent.mkdir(parents=True, exist_ok=True)
    bg_png.write_bytes(b"\x89PNG\r\n\x1a\n" + b"P" * 1024)

    (ep / "src" / "episode" / "cast.ts").write_text(
        "import {NHIM_LOOK, type Look} from '../chars';\n"
        "export const CAST: Record<string, Look> = { nhim: {...NHIM_LOOK, name: 'nhim'} };\n"
        "export const CAST_ROLES = { nhim: {role: 'principal' as const, vi: 'Nhím nhân vật chính'} };\n",
        encoding="utf-8",
    )
    (ep / "src" / "episode" / "sets.tsx").write_text(
        "import React from 'react';\n"
        "import {staticFile} from 'remotion';\n"
        "import {RasterPlate} from '../kit';\n"
        "import type {SetDef} from '../sets/types';\n"
        "export const EPISODE_SETS: Record<string, SetDef> = {\n"
        "  yardPlate: {\n"
        "    title: 'Sân vườn nền raster',\n"
        "    bed: 'outdoor',\n"
        "    rasterPlate: true,\n"
        "    bounds: [-200, -200, 1280, 2120],\n"
        "    zones: {bgY: 1100, mgY: [1540, 1760], fgY: 1860},\n"
        "    render: (o) => ({\n"
        "      back: <g key='yardPlate'><RasterPlate src={staticFile('plates/bg.png')} x={-200} y={-200} width={1480} height={2320} /><circle cx={200} cy={200} r={5 + Math.sin(o.t)} /></g>,\n"
        "      mid: [],\n"
        "    }),\n"
        "  },\n"
        "};\n",
        encoding="utf-8",
    )
    (ep / "src" / "episode" / "subjects.tsx").write_text(
        "import React from 'react';\n"
        "import {E, R, S} from '../kit';\n"
        "import type {SubjectDef} from '../subjects';\n"
        "export const SUBJECTS: Record<string, SubjectDef> = {\n"
        "  badClockDog: {\n"
        "    title: 'Chó chạy theo đồng hồ',\n"
        "    kind: 'creature',\n"
        "    relToActor: [0.35, 0.7],\n"
        "    poses: ['idle', 'walk', 'sit', 'bark'],\n"
        "    render: (pose, o) => {\n"
        "      const leg = pose === 'walk' ? Math.sin(o.t * 8.0) * 18 : 0;\n"
        "      const dy = pose === 'sit' ? 14 : pose === 'bark' ? -8 : 0;\n"
        "      return <g><S d={R(-60, -100 + dy, 120, 60)} f='wood' /><S d={E(-30 + leg, -20, 12, 20)} f='woodDark' /><S d={E(30 - leg, -20, 12, 20)} f='woodDark' /></g>;\n"
        "    },\n"
        "  },\n"
        "  badTreadmillDog: {\n"
        "    title: 'Chó đi tại chỗ khi dừng',\n"
        "    kind: 'creature',\n"
        "    relToActor: [0.35, 0.7],\n"
        "    poses: ['idle', 'walk', 'sit', 'bark'],\n"
        "    render: (pose, o) => {\n"
        "      const ph = (o.phase ?? 0) * Math.PI * 2 + o.t * 7.2;\n"
        "      const leg = pose === 'walk' ? Math.sin(ph) * 18 : 0;\n"
        "      const dy = pose === 'sit' ? 14 : pose === 'bark' ? -8 : 0;\n"
        "      return <g><S d={R(-60, -100 + dy, 120, 60)} f='gold' /><S d={E(-30 + leg, -20, 12, 20)} f='goldDark' /><S d={E(30 - leg, -20, 12, 20)} f='goldDark' /></g>;\n"
        "    },\n"
        "  },\n"
        "  goodDog: {\n"
        "    title: 'Chó khóa quãng đường chuẩn',\n"
        "    kind: 'creature',\n"
        "    relToActor: [0.35, 0.7],\n"
        "    poses: ['idle', 'walk', 'sit', 'bark'],\n"
        "    render: (pose, o) => {\n"
        "      const moveAmt = o.moving ? Math.min(1, Math.max(0.25, o.speed ?? 1)) : 0;\n"
        "      const leg = pose === 'walk' ? moveAmt * Math.sin((o.phase ?? 0) * Math.PI * 2) * 18 : 0;\n"
        "      const breath = Math.sin(o.t * 2.2) * 1.8;\n"
        "      const dy = pose === 'sit' ? 14 : pose === 'bark' ? -8 : 0;\n"
        "      return <g><S d={R(-60, -100 + dy + breath, 120, 60)} f='orange' /><S d={E(-30 + leg, -20, 12, 20)} f='woodDark' /><S d={E(30 - leg, -20, 12, 20)} f='woodDark' /></g>;\n"
        "    },\n"
        "  },\n"
        "};\n",
        encoding="utf-8",
    )

    _run(["node", "scripts/lint.mjs", "design"], cwd=ep)
    d_lint = json.loads((ep / "qa" / "lint.json").read_text(encoding="utf-8"))
    errs = d_lint.get("errors", [])
    warns = d_lint.get("warns", [])
    assert not any("[SE-06]" in e and "yardPlate" in e for e in errs), f"<RasterPlate> must pass SE-06:\n{errs}"
    assert not any("[SE-06]" in w and "yardPlate" in w for w in warns), f"<RasterPlate> must not trigger bare <image> warning:\n{warns}"
    assert any("[PR-11]" in e and "badClockDog" in e for e in errs), f"clock-only dog must fail PR-11:\n{errs}"
    assert any("[PR-11]" in e and "badTreadmillDog" in e for e in errs), f"un-gated treadmill dog must fail PR-11:\n{errs}"
    assert not any(("[PR-11]" in e or "[PR-08]" in e) and "goodDog" in e for e in errs), (
        f"distance-locked + stop-settled goodDog with idle breathing must pass PR-08 & PR-11:\n{errs}"
    )

    # (c) H2 protects qa/transition_qa.json from direct edits
    res_h2_tq = _invoke_hook({
        "hookEventName": "PreToolUse",
        "cwd": str(ep),
        "toolCall": {"name": "write_file", "args": {"Path": str(ep / "qa" / "transition_qa.json")}},
    })
    assert res_h2_tq["decision"] == "deny" and "H2" in res_h2_tq["reason"], (
        f"H2 must deny direct edits to qa/transition_qa.json: {res_h2_tq}"
    )

    # (d) Real ffmpeg 30fps synthesis verifying transition_qa.py catches DL-01 stale-bg, DL-02 blank-flash, and passes clean cut!
    py_qa = os.environ.get("SV_PY")
    if not (py_qa and Path(py_qa).is_file()):
        py_qa = PY
    shots_p = ep / "qa" / "shots.json"
    shots_p.parent.mkdir(parents=True, exist_ok=True)
    shots_p.write_text(json.dumps([
        {"i": 0, "name": "sA", "set": "setA", "tr": "cut", "t0": 0.0, "t1": 1.5},
        {"i": 1, "name": "sB", "set": "setB", "tr": "cut", "t0": 1.5, "t1": 3.0},
    ]), encoding="utf-8")

    out_dir = ep / "out"
    out_dir.mkdir(parents=True, exist_ok=True)
    clip_clean = out_dir / "clean.mp4"
    clip_stale = out_dir / "stale.mp4"
    clip_blank = out_dir / "blank.mp4"

    # Pattern A (high-contrast testsrc2) vs Pattern B (distinct smptebars) @ 180x320 30fps
    r_clean = _run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", "testsrc2=size=180x320:rate=30:duration=1.5",
        "-f", "lavfi", "-i", "smptebars=size=180x320:rate=30:duration=1.5",
        "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]",
        "-map", "[v]", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "18", str(clip_clean),
    ], cwd=ep)
    assert r_clean.returncode == 0, f"ffmpeg clean clip synthesis failed: {r_clean.stderr}"

    # Stale backdrop: setA bleeds 0.20s (6 frames) past the 1.50s cut into setB
    r_stale = _run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", "testsrc2=size=180x320:rate=30:duration=1.7",
        "-f", "lavfi", "-i", "smptebars=size=180x320:rate=30:duration=1.3",
        "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]",
        "-map", "[v]", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "18", str(clip_stale),
    ], cwd=ep)
    assert r_stale.returncode == 0, f"ffmpeg stale clip synthesis failed: {r_stale.stderr}"

    # Blank flash: 3 solid black frames right after the 1.50s cut
    r_blank = _run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", "testsrc2=size=180x320:rate=30:duration=1.5",
        "-f", "lavfi", "-i", "color=c=black:s=180x320:r=30:d=0.1",
        "-f", "lavfi", "-i", "smptebars=size=180x320:rate=30:duration=1.4",
        "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]",
        "-map", "[v]", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "18", str(clip_blank),
    ], cwd=ep)
    assert r_blank.returncode == 0, f"ffmpeg blank clip synthesis failed: {r_blank.stderr}"

    # 1) Clean clip -> exit 0, 0 stale, 0 blank
    tq_clean = ep / "qa" / "tq_clean.json"
    rc1 = _run([py_qa, "scripts/transition_qa.py", "--video", str(clip_clean), "--shots", str(shots_p), "--out", str(tq_clean)], cwd=ep)
    assert rc1.returncode == 0, f"clean clip must pass transition_qa.py: {rc1.stdout}\n{rc1.stderr}"
    d1 = json.loads(tq_clean.read_text(encoding="utf-8"))
    assert d1["ok"] is True and d1["stale_bg_frames"] == 0 and d1["blank_flash_frames"] == 0 and d1["set_transitions"] == 1, f"unexpected clean result: {d1}"

    # 2) Stale-bg clip -> exit 2, DL-01 error, stale_bg_frames >= 4
    tq_stale = ep / "qa" / "tq_stale.json"
    rc2 = _run([py_qa, "scripts/transition_qa.py", "--video", str(clip_stale), "--shots", str(shots_p), "--out", str(tq_stale)], cwd=ep)
    assert rc2.returncode == 2, f"stale-bg clip must fail transition_qa.py with rc=2 (got {rc2.returncode}): {rc2.stdout}\n{rc2.stderr}"
    d2 = json.loads(tq_stale.read_text(encoding="utf-8"))
    assert d2["ok"] is False and d2["stale_bg_frames"] >= 4 and any("[DL-01]" in e for e in d2["errors"]), f"expected DL-01 failure: {d2}"

    # 3) Blank-flash clip -> exit 2, DL-02 error, blank_flash_frames >= 2
    tq_blank = ep / "qa" / "tq_blank.json"
    rc3 = _run([py_qa, "scripts/transition_qa.py", "--video", str(clip_blank), "--shots", str(shots_p), "--out", str(tq_blank)], cwd=ep)
    assert rc3.returncode == 2, f"blank-flash clip must fail transition_qa.py with rc=2 (got {rc3.returncode}): {rc3.stdout}\n{rc3.stderr}"
    d3 = json.loads(tq_blank.read_text(encoding="utf-8"))
    assert d3["ok"] is False and d3["blank_flash_frames"] >= 2 and any("[DL-02]" in e for e in d3["errors"]), f"expected DL-02 failure: {d3}"

    print("[PASS] Test 13: v6.2.1 zero-flicker <RasterPlate>/keyed <LayerG>, PR-11 anti-treadmill CI, H2 lock & 30fps transition_qa (DL-01/DL-02) verified")


def test_14_v63_intent_skills_native_agents_and_manifests(tmp: Path) -> None:
    """Verify v6.3.0 8 intent-first slash skills, progressive guides/, native agents/, multi-provider manifests & LG-03 track isolation."""
    # (a) Exact 8 user-invocable skills, 3 native agents, logo.svg, and 3 manifests at matching version
    expected_skills = {
        "sv-create-short", "sv-create-long", "sv-write-script", "sv-design",
        "sv-produce", "sv-voice-audio", "sv-audit", "sv-fix",
    }
    actual_skills = {p.name for p in (SUITE / "skills").iterdir() if p.is_dir()}
    assert actual_skills == expected_skills, f"expected 8 intent-first skills, got {sorted(actual_skills)}"

    for ag in ("sv-orchestrator", "sv-executor", "sv-reviewer"):
        ag_txt = (SUITE / "agents" / f"{ag}.md").read_text(encoding="utf-8")
        assert f"name: {ag}" in ag_txt and "subagent: true" in ag_txt and "mainAgent: false" in ag_txt and "tools:" in ag_txt, (
            f"agents/{ag}.md missing required Antigravity frontmatter fields"
        )

    pj_agy = json.loads((SUITE / "plugin.json").read_text(encoding="utf-8"))
    pj_cl = json.loads((SUITE / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"))
    pj_gm = json.loads((SUITE / "gemini-extension.json").read_text(encoding="utf-8"))
    assert pj_agy["version"] == pj_cl["version"] == pj_gm["version"] == "6.3.0", "manifest version mismatch"
    assert (SUITE / pj_agy["logo"]).is_file(), f"plugin logo missing: {pj_agy['logo']}"
    assert pj_cl.get("agents") == "./agents" and pj_cl.get("skills") == "./skills", f"Claude manifest paths invalid: {pj_cl}"
    assert pj_gm.get("contextFileName") == "rules/AGENTS.md", f"Gemini extension contextFileName invalid: {pj_gm}"

    # (b) LG-03 accepts v6.3 action skill (sv-fix) & matching track guide (guides/short/design.md),
    #     and REJECTS cross-track guide (guides/long/design.md) and wrong-stage skill (sv-voice-audio) on Short G4!
    ep = tmp / "ep-v63"
    r_sc = _run([PY, str(SUITE / "tools" / "new_episode.py"), str(ep), "--track", "short"], cwd=SUITE)
    assert r_sc.returncode == 0, f"v6.3 scaffold failed: {r_sc.stderr}"
    (ep / "art_direction.json").unlink(missing_ok=True)
    # Seed passing design CI event in logs/ci_lint.jsonl so LG-05 stays green while isolating LG-03
    _run(
        [PY, "-c", "import sys; sys.path.insert(0, 'scripts'); import sv_log as L; from pathlib import Path; L.log_ci_event(Path('.'), stage='G4', domain='design', actor_id='sv-ci', command='lint design', exit_code=0, metrics={}, note='design CI PASS')"],
        cwd=ep,
    )

    # 1) Wrong-track guide guides/long/design.md on Short G4 -> MUST FAIL LG-03
    r_wtrack = _log_init(ep, "executor", "exec-wrong-track", "G4", "Attempt wrong track guide")
    _log_step(ep, r_wtrack, "read_skill", target=str(SUITE / "guides" / "long" / "design.md"), note="Read Long design guide on a Short episode")
    _log_step(ep, r_wtrack, "run_tool", target="design", cmd="sv_cli.py ci design", exit_code=0, note="Design CI passed cleanly")
    _log_complete(ep, r_wtrack, "pass", "src/episode/sets.tsx", "Built sets")
    res_wt = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G4", "--role", "executor", "--actor", "exec-wrong-track", "--json"], cwd=ep)
    d_wt = json.loads(res_wt.stdout)
    assert res_wt.returncode == 2 and any("[LG-03]" in e for e in d_wt["errors"]), f"cross-track guide must fail LG-03: {d_wt}"

    # 2) Wrong-stage skill sv-voice-audio on G4 -> MUST FAIL LG-03
    r_wstage = _log_init(ep, "executor", "exec-wrong-stage", "G4", "Attempt wrong stage skill")
    _log_step(ep, r_wstage, "read_skill", target=str(SUITE / "skills" / "sv-voice-audio" / "SKILL.md"), note="Read voice/audio skill during design stage")
    _log_step(ep, r_wstage, "run_tool", target="design", cmd="sv_cli.py ci design", exit_code=0, note="Design CI passed cleanly")
    _log_complete(ep, r_wstage, "pass", "src/episode/sets.tsx", "Built sets")
    res_ws = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G4", "--role", "executor", "--actor", "exec-wrong-stage", "--json"], cwd=ep)
    d_ws = json.loads(res_ws.stdout)
    assert res_ws.returncode == 2 and any("[LG-03]" in e for e in d_ws["errors"]), f"wrong-stage skill must fail LG-03: {d_ws}"

    # 3) Valid v6.3 action skill sv-fix on G4 -> MUST PASS LG-03
    r_ok_fix = _log_init(ep, "executor", "exec-fix-g4", "G4", "Fix design plate via sv-fix")
    _log_step(ep, r_ok_fix, "read_skill", target=str(SUITE / "skills" / "sv-fix" / "SKILL.md"), note="Read sv-fix root-cause fix skill before patching design")
    _log_step(ep, r_ok_fix, "run_tool", target="design", cmd="sv_cli.py ci design", exit_code=0, note="Design CI passed cleanly after fix")
    _log_complete(ep, r_ok_fix, "pass", "src/episode/sets.tsx", "Patched design plate via sv-fix")
    res_ok1 = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G4", "--role", "executor", "--actor", "exec-fix-g4", "--json"], cwd=ep)
    d_ok1 = json.loads(res_ok1.stdout)
    assert res_ok1.returncode == 0 and d_ok1["ok"], f"sv-fix must pass LG-03 on G4: {d_ok1}"

    # 4) Valid track guide guides/short/design.md on Short G4 -> MUST PASS LG-03 (including Windows backslash paths!)
    r_ok_gd = _log_init(ep, "executor", "exec-guide-g4", "G4", "Build design via guides/short/design.md")
    _log_step(ep, r_ok_gd, "read_skill", target=str(SUITE / "guides" / "short" / "design.md"), note="Read Short design guide before authoring sets")
    _log_step(ep, r_ok_gd, "run_tool", target="design", cmd="sv_cli.py ci design", exit_code=0, note="Design CI passed cleanly")
    _log_complete(ep, r_ok_gd, "pass", "src/episode/sets.tsx", "Built design sets per Short guide")
    res_ok2 = _run([PY, "scripts/sv_cli.py", "ci", "log", "--stage", "G4", "--role", "executor", "--actor", "exec-guide-g4", "--json"], cwd=ep)
    d_ok2 = json.loads(res_ok2.stdout)
    assert res_ok2.returncode == 0 and d_ok2["ok"], f"guides/short/design.md must pass LG-03 on Short G4: {d_ok2}"

    print("[PASS] Test 14: v6.3.0 8 intent-first skills, native agents/, 3-provider manifests & LG-03 track isolation verified")


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
        test_10_v61_raster_plate_and_squash_stretch(ep_short)
        test_11_anti_bypass_hardening(ep_short, tmp)
        test_12_v62_art_direction_gate_and_scored_rubric(tmp)
        test_13_v621_zero_flicker_transition_qa_and_pr11(tmp)
        test_14_v63_intent_skills_native_agents_and_manifests(tmp)
    finally:
        for sub in ("ep-short", "ep-long", "ep-v62", "ep-v621", "ep-v63"):
            nm = tmp / sub / "node_modules"
            if nm.exists():
                if os.name == "nt":
                    subprocess.run(["cmd", "/c", "rmdir", str(nm)], capture_output=True)
                else:
                    nm.unlink(missing_ok=True)
        shutil.rmtree(tmp, ignore_errors=True)

    dt = time.perf_counter() - t0
    print(f"\nALL 14/14 v6.3.0 END-TO-END VERIFICATION TESTS PASSED in {dt:.2f}s!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
