"""Antigravity native lifecycle hook guard for story-video-skills v6.0.0.

Enforces hard PreToolUse anti-bypass invariants inside episode workspaces:
  H1: Block writes/edits to read-only suite files copied into an episode.
  H2: Block direct writes/edits to immutable role logs, gate logs, and CI reports.
  H3: Block out-of-order phase edits (upstream gate dependency lock).
  H4: Block shell commands that overwrite or delete logs/*.jsonl or gates/log.jsonl.
  H5: Block deliver.mjs unless G1..G6 have all passed in gates/log.jsonl.
  H6: Verify transcriptPath proves read_file/view_file opened visual JPEG evidence
      before allowing review submission or visual gate passes (G4, G5, G5.U*, G7).

Safe pass-through outside episode workspaces (never blocks editing the plugin itself).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

for _st in (sys.stdin, sys.stdout, sys.stderr):
    if hasattr(_st, "reconfigure"):
        try:
            _st.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

READONLY_DIRS = ("standards/", "scripts/", "src/exemplar/")
READONLY_FILES = {
    ".episode.json",
    ".suite.json",
    "src/engine.ts",
    "src/kit.tsx",
    "src/chars.tsx",
    "src/side.tsx",
    "src/threeq.tsx",
    "src/back.tsx",
    "src/overlays.tsx",
    "src/props.tsx",
    "src/Film.tsx",
    "src/Root.tsx",
    "src/subjects.ts",
    "src/sets/index.ts",
    "src/sets/types.ts",
}
IMMUTABLE_CI_FILES = {
    "gates/log.jsonl",
    "qa/state.json",
    "qa/lint.json",
    "qa/script_lint.json",
    "qa/voice_report.json",
    "qa/mix_report.json",
    "qa/deliver_report.json",
    "qa/video_audio.json",
}


def _emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _allow() -> None:
    _emit({"decision": "allow"})


def _deny(reason: str) -> None:
    _emit({"decision": "deny", "reason": reason})


def _find_episode_root(start: Path | None) -> Path | None:
    if start is None:
        return None
    cur = start.resolve() if start.exists() else start
    if cur.is_file() or (not cur.exists() and cur.suffix):
        cur = cur.parent
    for cand in [cur, *cur.parents]:
        # Never treat the plugin repository itself as an episode workspace
        if (cand / "plugin.json").exists():
            return None
        if (cand / ".episode.json").exists() or (cand / ".suite.json").exists():
            return cand
    return None


def _rel_posix(ep_root: Path, target: Path) -> str | None:
    try:
        return target.resolve().relative_to(ep_root.resolve()).as_posix()
    except Exception:
        try:
            t_norm = str(target).replace("\\", "/")
            r_norm = str(ep_root).replace("\\", "/").rstrip("/") + "/"
            if t_norm.lower().startswith(r_norm.lower()):
                return t_norm[len(r_norm):]
        except Exception:
            pass
    return None


def _passed_gates(ep_root: Path) -> set[str]:
    log_p = ep_root / "gates" / "log.jsonl"
    if not log_p.is_file():
        return set()
    passed: set[str] = set()
    for raw in log_p.read_text(encoding="utf-8", errors="ignore").splitlines():
        raw = raw.strip()
        if not raw:
            continue
        try:
            rec = json.loads(raw)
        except Exception:
            continue
        if isinstance(rec, dict) and rec.get("gate") and rec.get("status", "pass") == "pass":
            passed.add(str(rec["gate"]))
    return passed


def _walk_strings(obj) -> list[str]:
    out: list[str] = []
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            out.extend(_walk_strings(v))
    elif isinstance(obj, list):
        for v in obj:
            out.extend(_walk_strings(v))
    return out


def _extract_read_targets_from_obj(obj) -> list[str]:
    """Extract candidate strings strictly from read_file / view_file tool call args."""
    if isinstance(obj, dict):
        tcs = obj.get("tool_calls")
        if isinstance(tcs, list):
            scoped: list[str] = []
            for tc in tcs:
                if isinstance(tc, dict) and str(tc.get("name") or tc.get("tool") or "").lower() in ("read_file", "view_file"):
                    scoped.extend(_walk_strings(tc.get("args") if "args" in tc else tc))
            return scoped
        tname = str(obj.get("tool") or obj.get("name") or ((obj.get("toolCall") or {}).get("name") if isinstance(obj.get("toolCall"), dict) else "") or "").lower()
        if tname in ("read_file", "view_file"):
            return _walk_strings(obj.get("args") if "args" in obj else obj)
    return _walk_strings(obj)


def _transcript_read_patterns(transcript_path: str | None) -> list[str]:
    """Return normalized lowercase paths passed to read_file / view_file in transcript."""
    if not transcript_path:
        return []
    tp = Path(transcript_path)
    if not tp.is_file():
        return []
    paths: list[str] = []
    img_end_re = re.compile(r'\.(?:jpg|jpeg|png)$', re.I)
    img_any_re = re.compile(r'([^\s"\'<>|*?,;]+?\.(?:jpg|jpeg|png))', re.I)

    sources = [tp]
    full_tp = tp.with_name("transcript_full.jsonl")
    if tp.name == "transcript.jsonl" and full_tp.is_file():
        sources.append(full_tp)

    for src in sources:
        text = src.read_text(encoding="utf-8", errors="ignore")
        for line in text.splitlines():
            if not line.strip():
                continue
            low = line.lower()
            if "read_file" not in low and "view_file" not in low:
                continue
            try:
                obj = json.loads(line)
                for s in _extract_read_targets_from_obj(obj):
                    unquoted = s.replace('\\"', '"').replace("\\\\", "/").strip().strip('"\'').strip()
                    norm = re.sub(r"[\\/]+", "/", unquoted).lower()
                    if img_end_re.search(norm):
                        paths.append(norm)
                    else:
                        for m in img_any_re.finditer(norm):
                            paths.append(m.group(1))
            except Exception:
                for m in img_any_re.finditer(line.replace('\\"', '"').replace("\\\\", "/")):
                    paths.append(re.sub(r"[\\/]+", "/", m.group(1)).lower())
    return paths


def _check_write_or_edit(payload: dict) -> None:
    args = (payload.get("toolCall") or {}).get("args") or {}
    raw_path = args.get("Path") or args.get("TargetFile") or args.get("path") or ""
    if not raw_path:
        _allow()
        return
    target = Path(str(raw_path))
    if not target.is_absolute() and payload.get("cwd"):
        target = Path(str(payload["cwd"])) / target

    ep_root = _find_episode_root(target)
    if ep_root is None:
        _allow()
        return

    rel = _rel_posix(ep_root, target)
    if not rel:
        _allow()
        return

    # H1: Read-only suite copies
    if rel in READONLY_FILES or any(rel.startswith(d) for d in READONLY_DIRS):
        _deny(
            f"[SV-GUARD H1] '{rel}' is a read-only suite file inside an episode workspace. "
            f"Edit episode files under src/episode/, brief.md, beats.md, script.json, or audio.json instead."
        )
        return

    # H2: Immutable logs & CI reports
    if rel.startswith("logs/") or rel in IMMUTABLE_CI_FILES:
        _deny(
            f"[SV-GUARD H2] Direct edits to '{rel}' are forbidden. "
            f"Role logs must be written via 'python scripts/sv_cli.py log ...' and gate/CI records via CLI commands."
        )
        return

    # H3: Upstream gate dependency lock
    passed = _passed_gates(ep_root)
    if rel in ("script.json", "beats.md") and "G1" not in passed:
        _deny(
            f"[SV-GUARD H3] Cannot edit '{rel}' before Gate G1 (brief) passes. "
            f"Complete brief.md, get user approval, and pass G1 via sv_cli.py gate pass G1 first."
        )
        return
    if rel in ("src/episode/cast.ts", "src/episode/sets.tsx", "src/episode/subjects.tsx", "src/episode/geo.ts") and "G1" not in passed:
        _deny(
            f"[SV-GUARD H3] Cannot edit design file '{rel}' before Gate G1 (brief) passes."
        )
        return
    if (rel == "src/episode/shotlist.ts" or rel.startswith("src/episode/shots/")) and not ({"G3", "G4"} <= passed):
        missing = sorted({"G3", "G4"} - passed)
        _deny(
            f"[SV-GUARD H3] Cannot edit '{rel}' before upstream gate(s) {missing} pass in gates/log.jsonl."
        )
        return
    if rel == "audio.json" and "G3" not in passed:
        _deny(
            f"[SV-GUARD H3] Cannot edit 'audio.json' before Gate G3 (voice) passes in gates/log.jsonl."
        )
        return

    _allow()


def _extract_cmd_episode_root(payload: dict, cmd: str) -> Path | None:
    # Check explicit cd / Set-Location in command first
    for m in re.finditer(r'(?:Set-Location|cd)\s+["\']?([^"\';&\r\n]+)', cmd, re.I):
        cand = Path(m.group(1).strip())
        ep = _find_episode_root(cand)
        if ep:
            return ep
    cwd = payload.get("cwd")
    if cwd:
        ep = _find_episode_root(Path(str(cwd)))
        if ep:
            return ep
    for ws in payload.get("workspacePaths") or []:
        ep = _find_episode_root(Path(str(ws)))
        if ep:
            return ep
    return None


def _check_run_command(payload: dict) -> None:
    args = (payload.get("toolCall") or {}).get("args") or {}
    cmd = str(args.get("CommandLine") or args.get("command") or "")
    if not cmd.strip():
        _allow()
        return

    ep_root = _extract_cmd_episode_root(payload, cmd)
    if ep_root is None:
        _allow()
        return

    # H4: Shell log / gate tampering guard
    tamper_re = re.compile(
        r'(?:>>?|\bSet-Content\b|\bOut-File\b|\bAdd-Content\b|\bRemove-Item\b|\brm\s|\bdel\s|\bsed\s+-i|\btruncate\b)'
        r'[^\r\n;&|]*(?:gates[\\/]log\.jsonl|logs[\\/][^\s"\']+\.jsonl)',
        re.I,
    )
    if tamper_re.search(cmd):
        _deny(
            "[SV-GUARD H4] Direct shell modification/deletion of logs/*.jsonl or gates/log.jsonl is forbidden. "
            "Use scripts/sv_cli.py log|gate commands only."
        )
        return

    passed = _passed_gates(ep_root)

    # H5: deliver.mjs requires G1..G6 PASS
    if re.search(r'\bdeliver\.mjs\b', cmd):
        req = {"G1", "G2", "G3", "G4", "G5", "G6"}
        missing = sorted(req - passed)
        if missing:
            _deny(
                f"[SV-GUARD H5] Cannot run deliver.mjs while upstream gate(s) {missing} are not PASS in gates/log.jsonl."
            )
            return

    # H6: Visual inspection proof via transcriptPath before review submit or visual gate pass
    tp = payload.get("transcriptPath")
    has_transcript = bool(tp and Path(str(tp)).is_file())
    if has_transcript:
        is_review_submit = bool(
            re.search(r'\bqa\.mjs\s+review\b', cmd)
            or re.search(r'\bsv_cli\.py\s+review\s+submit\b', cmd)
        )
        m_gate = re.search(
            r'\b(?:sv_gate\.py\s+(pass-unit|pass)\s+([A-Za-z0-9._-]+)|sv_cli\.py\s+gate\s+pass\s+([A-Za-z0-9._-]+))',
            cmd,
        )
        visual_req: tuple[str, tuple[str, ...]] | None = None
        if is_review_submit:
            visual_req = (
                "shot review submission",
                ("qa/contact_p", "_contact.jpg", "qa/cards/", "qa/crops/", "qa/shots/", "qa/strips/"),
            )
        elif m_gate:
            subcmd = (m_gate.group(1) or "").lower()
            gate_arg = (m_gate.group(2) or m_gate.group(3) or "").upper()
            if gate_arg == "G4":
                visual_req = ("Gate G4 pass", ("qa/design/",))
            elif subcmd == "pass-unit" or gate_arg == "G5" or gate_arg.startswith("G5."):
                visual_req = (
                    f"Gate {gate_arg} pass",
                    ("qa/contact_p", "_contact.jpg", "qa/cards/", "qa/units/"),
                )
            elif gate_arg == "G7":
                visual_req = ("Gate G7 pass", ("qa/final_check.jpg",))

        if visual_req is not None:
            label, needles = visual_req
            seen_reads = _transcript_read_patterns(str(tp))
            if not any(any(n in p for n in needles) for p in seen_reads):
                _deny(
                    f"[SV-GUARD H6] Blocked {label}: transcript has zero read_file calls on required visual evidence "
                    f"({', '.join(needles)}). Open the rendered JPEG evidence with read_file first — blind passing is forbidden."
                )
                return

    _allow()


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        _allow()
        return 0

    event = str(payload.get("hookEventName") or "")
    if event == "PostToolUse":
        _emit({})
        return 0

    tool_name = str((payload.get("toolCall") or {}).get("name") or "").lower()
    if tool_name in ("write_file", "edit_file"):
        _check_write_or_edit(payload)
    elif tool_name == "run_command":
        _check_run_command(payload)
    else:
        _allow()
    return 0


if __name__ == "__main__":
    sys.exit(main())
