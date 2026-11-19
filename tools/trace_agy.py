#!/usr/bin/env python3
"""Forensic trace analyzer for Antigravity swarm worker transcripts.

Discovers swarm workers by --prefix / --main <conv-id> / --ids and reports
per-worker, per-gate, and per-category wall time, active time, sleep time,
tokens (input, cache_read, output, total), turns, media reads, and review writes.

Usage:
  python3 tools/trace_agy.py --main <coord-conv-id> --prefix hh,hh2 [--gates-log <path>] [--detail] [--json <out.json>]
  python3 tools/trace_agy.py --prefix hh
  python3 tools/trace_agy.py --ids da11aac4:script,e8b8b2e7:design
"""
from __future__ import annotations

import argparse
import collections
import datetime
import glob
import json
import os
import re
import sys
from pathlib import Path

BRAIN_DIR = Path("/Users/hoangnguyen142/.gemini/antigravity/brain")

CMD_CATS = [
    ("carry.py", "carry"),
    ("crops.py", "crops"),
    ("voice.py", "voice"),
    ("audio_qa.py", "audio_qa"),
    ("mix.py", "mix"),
    ("deliver.mjs", "render_final"),
    ("design.mjs", "render_design"),
    ("qa.mjs", "render_qa"),
    ("lint.mjs", "lint"),
    ("script_lint.py", "script_lint"),
    ("tsc", "tsc"),
    ("sv_gate.py", "gate"),
    ("times.mjs", "times"),
    ("ffmpeg", "media_probe"),
    ("ffprobe", "media_probe"),
]


def parse_ts(s: str) -> float:
    return datetime.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()


def unquote(val) -> str:
    if not isinstance(val, str):
        return str(val)
    if len(val) >= 2 and val[0] == '"' and val[-1] == '"':
        try:
            return json.loads(val)
        except Exception:
            return val[1:-1]
    return val


def categorize_tool(tc: dict) -> tuple[str, dict]:
    """Return (category, flags) for a single tool_call object."""
    n = tc.get("name", "unknown")
    args = tc.get("args") or {}
    a = json.dumps(args, ensure_ascii=False)
    flags = {"media_read": 0, "review_write": 0}

    if n in ("read_file", "view_file"):
        path_str = unquote(args.get("Path") or args.get("AbsolutePath") or a)
        if re.search(r"\.(jpg|jpeg|png|webp|gif)\b", path_str, re.I):
            flags["media_read"] = 1
            return "look_img", flags
        if re.search(r"\.(mp3|wav|m4a|ogg)\b", path_str, re.I):
            flags["media_read"] = 1
            return "listen_audio", flags
        if "story-video-skills" in path_str or "SKILL.md" in path_str or "/references/" in path_str:
            return "read_skill", flags
        return "read_file", flags

    if n in ("edit_file", "write_file", "write_to_file", "replace_file_content", "multi_replace_file_content"):
        path_str = unquote(args.get("Path") or args.get("TargetFile") or a)
        if "qa/review" in path_str or "review.md" in path_str:
            flags["review_write"] = 1
            return "write_review", flags
        return "edit", flags

    if n == "run_command":
        cmd = unquote(args.get("CommandLine") or a)
        for pat, label in CMD_CATS:
            if pat in cmd:
                return label, flags
        return "shell", flags

    if n in ("read_board", "swarm_wait", "post_message", "swarm", "manage_task", "schedule"):
        return "coord", flags

    return n, flags


def infer_gate(name: str) -> str:
    n = name.lower()
    if "script" in n:
        return "G1/G2"
    if "voice" in n:
        return "G3"
    if any(k in n for k in ("cast", "prop", "set", "g4", "design")):
        return "G4"
    if any(k in n for k in ("shot", "rev-", "cart", "g5")):
        return "G5"
    if "audio" in n and "deliver" in n:
        return "G6+G7"
    if "audio" in n:
        return "G6"
    if "deliver" in n:
        return "G7"
    return "other"


def infer_run(name: str) -> str:
    if "-" in name:
        return name.split("-", 1)[0]
    return "default"


def resolve_transcript(conv_id_or_path: str) -> Path | None:
    p = Path(conv_id_or_path)
    if p.is_file():
        return p
    direct = BRAIN_DIR / conv_id_or_path / ".system_generated/logs/transcript.jsonl"
    if direct.is_file():
        return direct
    matches = sorted(BRAIN_DIR.glob(f"{conv_id_or_path}*/.system_generated/logs/transcript.jsonl"))
    return matches[0] if matches else None


def scan_all_workers() -> list[dict]:
    """Scan all brain transcripts and extract (cid, name, start_ts, path)."""
    found = []
    for p in BRAIN_DIR.glob("*/.system_generated/logs/transcript.jsonl"):
        cid = p.parents[2].name
        try:
            with p.open() as fh:
                head = []
                for idx, line in enumerate(fh):
                    if idx >= 12:
                        break
                    head.append(json.loads(line))
        except Exception:
            continue
        if not head:
            continue
        txt = "\n".join(str(x.get("content", "")) for x in head)
        m = re.search(r"recorded on the board as #\d+ for @([a-z0-9-]+)", txt)
        if not m:
            m = re.search(r"You are ([a-z0-9-]+), one agent in a swarm", txt)
        name = m.group(1) if m else None
        start_ts = parse_ts(head[0]["created_at"]) if head[0].get("created_at") else 0.0
        found.append({"cid": cid, "name": name, "start_ts": start_ts, "path": p})
    return found


def discover_from_main(main_path: Path, prefixes: list[str]) -> list[dict]:
    """Discover swarm workers spawned by --main transcript, filtered by prefixes."""
    spawns: list[tuple[str, float, str | None]] = []
    with main_path.open() as fh:
        for line in fh:
            d = json.loads(line)
            ts = parse_ts(d["created_at"]) if d.get("created_at") else 0.0
            for tc in d.get("tool_calls", []):
                if tc.get("name") == "swarm":
                    args = tc.get("args") or {}
                    act = unquote(args.get("action") or "")
                    nm = unquote(args.get("name") or "")
                    mdl = unquote(args.get("model") or "") if args.get("model") else None
                    if act == "add" and nm:
                        spawns.append((nm, ts, mdl))

    all_workers = scan_all_workers()
    by_name: dict[str, list[dict]] = collections.defaultdict(list)
    for w in all_workers:
        if w["name"]:
            by_name[w["name"]].append(w)

    selected = []
    seen_cids = set()
    for wname, spawn_ts, model in spawns:
        if prefixes and not any(wname.startswith(px) for px in prefixes):
            continue
        cands = by_name.get(wname, [])
        if not cands:
            continue
        # Match transcript whose start_ts is closest to spawn_ts (within [-120, +600]s preferred)
        best = min(cands, key=lambda c: abs(c["start_ts"] - spawn_ts))
        if best["cid"] in seen_cids:
            continue
        seen_cids.add(best["cid"])
        selected.append({
            "cid": best["cid"],
            "name": wname,
            "path": best["path"],
            "model": model,
            "spawn_ts": spawn_ts,
        })
    return selected


def discover_by_prefix(prefixes: list[str]) -> list[dict]:
    all_workers = scan_all_workers()
    selected = []
    for w in sorted(all_workers, key=lambda x: x["start_ts"]):
        if w["name"] and any(w["name"].startswith(px) for px in prefixes):
            selected.append({"cid": w["cid"], "name": w["name"], "path": w["path"]})
    return selected


def parse_ids_arg(ids_arg: str) -> list[dict]:
    out = []
    for tok in ids_arg.split(","):
        tok = tok.strip()
        if not tok:
            continue
        if ":" in tok:
            cid, name = tok.split(":", 1)
        else:
            cid, name = tok, tok[:8]
        p = resolve_transcript(cid)
        if p:
            out.append({"cid": cid, "name": name, "path": p})
        else:
            print(f"WARN: transcript not found for {cid}", file=sys.stderr)
    return out


def analyze_worker(entry: dict) -> dict:
    L = [json.loads(l) for l in entry["path"].open()]
    if not L:
        return {}

    t0 = parse_ts(L[0]["created_at"])
    t1 = parse_ts(L[-1]["created_at"])
    wall_s = max(0.0, t1 - t0)

    # Compute sleep intervals caused by swarm_wait / schedule
    sleep_intervals: list[tuple[float, float]] = []
    i = 0
    while i < len(L):
        d = L[i]
        if d.get("type") == "PLANNER_RESPONSE":
            tcs = [tc.get("name") for tc in d.get("tool_calls", [])]
            if "swarm_wait" in tcs or "schedule" in tcs:
                # Advance past all immediate GENERIC tool responses for this turn
                j = i + 1
                last_ack_ts = parse_ts(d["created_at"])
                while j < len(L) and L[j].get("type") == "GENERIC":
                    last_ack_ts = parse_ts(L[j]["created_at"])
                    j += 1
                if j < len(L):
                    wake_ts = parse_ts(L[j]["created_at"])
                    if wake_ts > last_ack_ts:
                        sleep_intervals.append((last_ack_ts, wake_ts))
        i += 1

    def interval_sleep(a: float, b: float) -> float:
        s = 0.0
        for s0, s1 in sleep_intervals:
            ov = min(b, s1) - max(a, s0)
            if ov > 0:
                s += ov
        return s

    sleep_s = sum(s1 - s0 for s0, s1 in sleep_intervals)
    active_s = max(0.0, wall_s - sleep_s)

    planner_indices = [idx for idx, d in enumerate(L) if d.get("type") == "PLANNER_RESPONSE"]
    cats = collections.defaultdict(lambda: [0, 0.0, 0])  # calls, active_s, tokens
    in_tok = cache_tok = out_tok = 0
    media_reads = review_writes = 0
    last_bg_cmd_cat: str | None = None

    for k, idx in enumerate(planner_indices):
        d = L[idx]
        cur_ts = parse_ts(d["created_at"])
        nxt_idx = planner_indices[k + 1] if k + 1 < len(planner_indices) else len(L) - 1
        nxt_ts = parse_ts(L[nxt_idx]["created_at"])
        span_dt = max(0.0, nxt_ts - cur_ts)
        span_sleep = interval_sleep(cur_ts, nxt_ts)
        turn_active = min(max(0.0, span_dt - span_sleep), 1800.0)

        ti = d.get("input_tokens", 0)
        tc_tok = d.get("cache_read_tokens", 0)
        to = d.get("output_tokens", 0)
        in_tok += ti
        cache_tok += tc_tok
        out_tok += to
        turn_tok = ti + tc_tok + to

        tcs = d.get("tool_calls", [])
        if not tcs:
            # If waiting on a background run_command launched earlier, attribute wall wait to that command
            nxt_is_bg_done = any(
                L[m].get("type") == "SYSTEM_MESSAGE" and "background" in str(L[m].get("content", "")).lower()
                for m in range(idx + 1, nxt_idx)
            )
            label = last_bg_cmd_cat if (last_bg_cmd_cat and (nxt_is_bg_done or turn_active > 45.0)) else "think"
            cats[label][0] += 1
            cats[label][1] += turn_active
            cats[label][2] += turn_tok
            if nxt_is_bg_done:
                last_bg_cmd_cat = None
        else:
            share_dt = turn_active / len(tcs)
            share_tok = turn_tok / len(tcs)
            for tc in tcs:
                cat_name, flags = categorize_tool(tc)
                cats[cat_name][0] += 1
                cats[cat_name][1] += share_dt
                cats[cat_name][2] += share_tok
                media_reads += flags["media_read"]
                review_writes += flags["review_write"]
                if tc.get("name") == "run_command":
                    # Check if this turn launched a background task
                    if any("Tool is running as a background task" in str(L[m].get("content", "")) for m in range(idx + 1, nxt_idx)):
                        last_bg_cmd_cat = cat_name

    return {
        "name": entry["name"],
        "cid": entry["cid"],
        "run": infer_run(entry["name"]),
        "gate": infer_gate(entry["name"]),
        "start_iso": L[0]["created_at"],
        "end_iso": L[-1]["created_at"],
        "wall_s": wall_s,
        "active_s": active_s,
        "sleep_s": sleep_s,
        "turns": len(planner_indices),
        "input_tokens": in_tok,
        "cache_read_tokens": cache_tok,
        "output_tokens": out_tok,
        "total_tokens": in_tok + cache_tok + out_tok,
        "media_reads": media_reads,
        "review_writes": review_writes,
        "cats": {k: [v[0], round(v[1], 2), int(round(v[2]))] for k, v in cats.items()},
    }


def fmt_min(sec: float) -> str:
    return f"{sec / 60.0:6.2f}m"


def fmt_tok(tok: float) -> str:
    if tok >= 1_000_000:
        return f"{tok / 1e6:5.2f}M"
    return f"{tok / 1e3:5.0f}K"


def main() -> int:
    ap = argparse.ArgumentParser(description="Trace Antigravity swarm worker transcripts")
    ap.add_argument("--main", help="Coordinator conversation ID or transcript.jsonl path")
    ap.add_argument("--prefix", help="Comma-separated worker name prefixes (e.g. hh,hh2)")
    ap.add_argument("--ids", help="Comma-separated conv_id[:name] list")
    ap.add_argument("--gates-log", help="Optional path to gates/log.jsonl")
    ap.add_argument("--detail", action="store_true", help="Print per-worker category breakdown")
    ap.add_argument("--json", help="Write full structured trace JSON to path")
    args = ap.parse_args()

    prefixes = [p.strip() for p in args.prefix.split(",") if p.strip()] if args.prefix else []

    if args.ids:
        entries = parse_ids_arg(args.ids)
    elif args.main:
        mp = resolve_transcript(args.main)
        if not mp:
            print(f"ERROR: main transcript not found: {args.main}", file=sys.stderr)
            return 1
        entries = discover_from_main(mp, prefixes)
    elif prefixes:
        entries = discover_by_prefix(prefixes)
    else:
        print("Provide --main, --prefix, or --ids", file=sys.stderr)
        return 1

    workers = [analyze_worker(e) for e in entries]
    workers = [w for w in workers if w]

    if not workers:
        print("No matching workers found.", file=sys.stderr)
        return 1

    # Print per-worker table
    print(f"=== WORKERS ({len(workers)}) ===")
    hdr = f"{'Worker':20s} {'Run':5s} {'Gate':6s} {'Wall':>7s} {'Active':>7s} {'Sleep':>7s} {'Turns':>5s} {'Tok':>7s} {'OutTok':>7s} {'Media':>5s} {'RevWr':>5s}"
    print(hdr)
    print("-" * len(hdr))
    for w in workers:
        print(
            f"{w['name']:20s} {w['run']:5s} {w['gate']:6s} "
            f"{fmt_min(w['wall_s'])} {fmt_min(w['active_s'])} {fmt_min(w['sleep_s'])} "
            f"{w['turns']:5d} {fmt_tok(w['total_tokens'])} {fmt_tok(w['output_tokens'])} "
            f"{w['media_reads']:5d} {w['review_writes']:5d}"
        )

    # Per-run & per-gate aggregation
    by_run_gate = collections.defaultdict(lambda: {"workers": 0, "wall_s": 0.0, "active_s": 0.0, "sleep_s": 0.0, "turns": 0, "tok": 0, "out": 0, "media": 0, "rev": 0})
    for w in workers:
        key = (w["run"], w["gate"])
        g = by_run_gate[key]
        g["workers"] += 1
        g["wall_s"] += w["wall_s"]
        g["active_s"] += w["active_s"]
        g["sleep_s"] += w["sleep_s"]
        g["turns"] += w["turns"]
        g["tok"] += w["total_tokens"]
        g["out"] += w["output_tokens"]
        g["media"] += w["media_reads"]
        g["rev"] += w["review_writes"]

    print("\n=== PER-RUN & PER-GATE (sum of worker times) ===")
    ghdr = f"{'Run':5s} {'Gate':6s} {'N':>3s} {'Wall':>7s} {'Active':>7s} {'Sleep':>7s} {'Turns':>5s} {'Tok':>7s} {'OutTok':>7s} {'Media':>5s} {'RevWr':>5s}"
    print(ghdr)
    print("-" * len(ghdr))
    for (run, gate), g in sorted(by_run_gate.items()):
        print(
            f"{run:5s} {gate:6s} {g['workers']:3d} "
            f"{fmt_min(g['wall_s'])} {fmt_min(g['active_s'])} {fmt_min(g['sleep_s'])} "
            f"{g['turns']:5d} {fmt_tok(g['tok'])} {fmt_tok(g['out'])} "
            f"{g['media']:5d} {g['rev']:5d}"
        )

    # Totals per run
    by_run = collections.defaultdict(lambda: {"workers": 0, "wall_s": 0.0, "active_s": 0.0, "sleep_s": 0.0, "turns": 0, "tok": 0, "out": 0, "media": 0, "rev": 0, "t0": None, "t1": None})
    for w in workers:
        r = by_run[w["run"]]
        r["workers"] += 1
        r["wall_s"] += w["wall_s"]
        r["active_s"] += w["active_s"]
        r["sleep_s"] += w["sleep_s"]
        r["turns"] += w["turns"]
        r["tok"] += w["total_tokens"]
        r["out"] += w["output_tokens"]
        r["media"] += w["media_reads"]
        r["rev"] += w["review_writes"]
        s0, s1 = parse_ts(w["start_iso"]), parse_ts(w["end_iso"])
        r["t0"] = s0 if r["t0"] is None else min(r["t0"], s0)
        r["t1"] = s1 if r["t1"] is None else max(r["t1"], s1)

    print("\n=== PER-RUN TOTALS (plus calendar span first->last worker) ===")
    for run, r in sorted(by_run.items()):
        span = (r["t1"] - r["t0"]) if (r["t0"] and r["t1"]) else 0.0
        print(
            f"{run:5s}: {r['workers']:2d} workers · span {span/60:.1f}m · "
            f"sum_wall {r['wall_s']/60:.1f}m · sum_active {r['active_s']/60:.1f}m · "
            f"turns {r['turns']} · tok {r['tok']/1e6:.2f}M (out {r['out']/1e3:.0f}K) · "
            f"media {r['media']} · rev_writes {r['rev']}"
        )

    # Category totals across all workers
    tot_cats = collections.defaultdict(lambda: [0, 0.0, 0])
    for w in workers:
        for c, (cnt, dt, tok) in w["cats"].items():
            tot_cats[c][0] += cnt
            tot_cats[c][1] += dt
            tot_cats[c][2] += tok

    tot_active = sum(v[1] for v in tot_cats.values()) or 1.0
    tot_tok = sum(v[2] for v in tot_cats.values()) or 1.0
    print("\n=== PER-CATEGORY (ALL WORKERS) ===")
    chdr = f"{'Category':15s} {'Calls':>6s} {'Active':>8s} {'Act%':>6s} {'Tokens':>8s} {'Tok%':>6s}"
    print(chdr)
    print("-" * len(chdr))
    for c, (cnt, dt, tok) in sorted(tot_cats.items(), key=lambda kv: -kv[1][1]):
        print(f"{c:15s} {cnt:6d} {fmt_min(dt):>8s} {100*dt/tot_active:5.1f}% {fmt_tok(tok):>8s} {100*tok/tot_tok:5.1f}%")

    if args.detail:
        for w in workers:
            print(f"\n-- {w['name']} ({w['cid'][:8]}): active {w['active_s']/60:.1f}m, tok {w['total_tokens']/1e6:.2f}M --")
            for c, (cnt, dt, tok) in sorted(w["cats"].items(), key=lambda kv: -kv[1][1]):
                print(f"  {c:15s} calls {cnt:4d}  active {dt/60:6.2f}m  tok {fmt_tok(tok)}")

    gates_log = []
    if args.gates_log and Path(args.gates_log).is_file():
        gates_log = [json.loads(l) for l in Path(args.gates_log).open()]
        print(f"\n=== GATES LOG ({len(gates_log)} entries) ===")
        for idx, g in enumerate(gates_log):
            dt_prev = (g["t"] - gates_log[idx - 1]["t"]) / 60.0 if idx > 0 else 0.0
            print(f"  #{idx+1:2d} {g['gate']:3s} at {g['at']}  (+{dt_prev:6.1f}m)  ev={len(g.get('evidence', {}))}")

    if args.json:
        out_obj = {
            "workers": workers,
            "by_run": {k: {**v, "span_s": (v["t1"] - v["t0"]) if (v["t0"] and v["t1"]) else 0.0} for k, v in by_run.items()},
            "categories": {k: {"calls": v[0], "active_s": round(v[1], 2), "tokens": v[2]} for k, v in tot_cats.items()},
            "gates_log": gates_log,
        }
        Path(args.json).write_text(json.dumps(out_obj, indent=2))
        print(f"\nWrote JSON trace to {args.json}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
