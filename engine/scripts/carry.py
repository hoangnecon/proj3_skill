#!/usr/bin/env python3
"""Carry a shot review across a change that did not change the picture (v3.7, gate G5).

A shot's hash changes when anything it draws MAY have changed (scripts/deps.mjs). Often the picture is the same:
a helper it reaches was edited for another shot, or the voice was re-made and its words moved by 0.05 s.
Before v3.7 every such shot was reviewed again from scratch. Now:

  node scripts/qa.mjs cards changed      # renders the new cards; snapshots every card it renders (qa/snap/)
  python3 scripts/carry.py               # compares each stale-reviewed shot with the frames that WERE reviewed

A review is carried (its hash moved to the current one, the original reviewer and checks kept, a `carried`
record added) when the old review was ok, both card snapshots exist, the same words are spoken over the shot,
and ONE of these holds — else the shot goes on the re-review list (qa/carry.json):
  pixel  : the picture is the same — on the 3 card frames AND on probe frames every ~0.2 s across the shot
           (quarter size, never shown; <= 12 pixels each — two renders of the same shot differ by <= 7).
           Each of the 3 card frames has <= 20 pixels that differ by more than 24/255
           (two renders of the same shot differ by at most 16/255, on 198 frames measured). A real edit, even a
           small transparent puff, changes hundreds of pixels and is NOT carried.
  retime : only the timing moved (re-made voice): the shot's static hash — engine, the shape and strings of its
           definition (word anchors included), the code it reaches — is the same, numbers in the definition that
           are derived from timing moved by <= max(12, 3 %) and only if shotlist.ts / geo.ts are unchanged
           (an edited shot list with moved numbers is a fix, never a retime), it starts within 0.3 s of where it did, its length moved by
           <= max(0.15 s, 10 %), and lint does not mark it HOT (reach / key / geometry). Frames cannot be compared
           here (each lands on another moment of the motion), so the guarantee comes from the unchanged definition
           and the machine lints instead. A HOT shot with a reach / key is carried only when the full-size
           frames at those moments (qa.mjs crops) are the same picture before and after; a geometry-only HOT
           shot (overlap, head cut, size jump) only when the geometry lint flags the same things as before.
sv_gate.py G5 recomputes the same comparison from the snapshots; it never trusts the `carried` record alone.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SNAP = ROOT / "qa/snap"
PX_DIFF, PX_MAX, PX_MAX_PROBE = 24, 20, 12
RETIME_T0, RETIME_DUR_S, RETIME_DUR_FRAC = 0.3, 0.15, 0.10
RETIME_NUM_ABS, RETIME_NUM_FRAC = 12, 0.03   # px / fraction a timing-derived number may move


def gray(p):
    return np.asarray(Image.open(p).convert("L"), dtype=np.float64)


def probe_px(old_hash, new_hash, ma, mb):
    """quarter-size probe frames every ~0.2 s (qa.mjs cards): pixels changed per probe, or None if not comparable"""
    n = ma.get("probes")
    if not n or n != mb.get("probes"):
        return None
    out = []
    for k in range(n):
        fa, fb = SNAP / f"{old_hash}_p{k}.jpg", SNAP / f"{new_hash}_p{k}.jpg"
        if not fa.exists() or not fb.exists():
            return None
        x, y = gray(fa), gray(fb)
        out.append(int((np.abs(x - y) > PX_DIFF).sum()) if x.shape == y.shape else 10 ** 9)
    return out


def hot_shots():
    p = ROOT / "qa/hot.json"
    return {int(k) for k, v in (json.loads(p.read_text()) if p.exists() else {}).items() if v}


def event_frames_same(old_hash, new_hash):
    """HOT shot after a retime: the full-size frames at its reach / key moments (qa.mjs crops) must be the same
    picture — the hand still meets the cup, the key still lands. -> (ok, detail)"""
    a, b = SNAP / f"{old_hash}_m.json", SNAP / f"{new_hash}_m.json"
    if not a.exists():
        return False, "no crops snapshot of the reviewed version — re-check the timing by eye"
    if not b.exists():
        return False, "run node scripts/qa.mjs crops <i> for the current version, then carry.py again"
    ea, eb = json.loads(a.read_text())["events"], json.loads(b.read_text())["events"]
    if len(ea) != len(eb) or not ea:
        return False, "reach / key moments differ in number — re-check by eye"
    px = []
    for n in range(len(ea)):
        x, y = gray(SNAP / f"{old_hash}_m{n}.jpg"), gray(SNAP / f"{new_hash}_m{n}.jpg")
        px.append(int((np.abs(x - y) > PX_DIFF).sum()) if x.shape == y.shape else 10 ** 9)
    # full-size frames: allow the same share of pixels as the card rule (20 px at 540x960 -> x4 at full size)
    ok = all(p <= PX_MAX * 4 for p in px)
    return ok, (px if ok else f"frame at a reach / key moment changed ({px} px) — re-check by eye")


def compare(old_hash, new_hash):
    """-> (ok, detail). detail.kind is "pixel" or "retime"; detail.why says what failed."""
    a, b = SNAP / f"{old_hash}.json", SNAP / f"{new_hash}.json"
    if not a.exists() or not b.exists():
        return False, {"why": "no snapshot of the reviewed card" if not a.exists() else "current card not rendered (qa.mjs cards changed)"}
    ma, mb = json.loads(a.read_text()), json.loads(b.read_text())
    if ma.get("words") != mb.get("words"):
        return False, {"why": "different words over the shot — beat must be re-checked", "before": ma.get("words"), "after": mb.get("words")}
    frames = []
    for n in range(3):
        fa, fb = SNAP / f"{old_hash}_{n}.jpg", SNAP / f"{new_hash}_{n}.jpg"
        if not fa.exists() or not fb.exists():
            return False, {"why": f"frame {n} snapshot missing"}
        x, y = gray(fa), gray(fb)
        if x.shape != y.shape:
            return False, {"why": "frame size changed"}
        frames.append({"px": int((np.abs(x - y) > PX_DIFF).sum())})
    if ma.get("legacy"):
        # reviewed under v3.6 (qa.mjs adopt): the reviewer saw exactly these 3 card frames and nothing else
        if all(f["px"] <= PX_MAX for f in frames):
            return True, {"kind": "adopt", "frames": frames}
        return False, {"why": "picture changed since the v3.6 review", "frames": frames}
    probes = probe_px(old_hash, new_hash, ma, mb)
    if all(f["px"] <= PX_MAX for f in frames) and probes is not None and all(p <= PX_MAX_PROBE for p in probes):
        return True, {"kind": "pixel", "frames": frames, "probes": max(probes or [0])}
    da, db = ma["t1"] - ma["t0"], mb["t1"] - mb["t0"]
    if ma.get("static") and ma.get("static") == mb.get("static"):
        if abs(mb["t0"] - ma["t0"]) > RETIME_T0:
            return False, {"why": f"retimed: starts {mb['t0'] - ma['t0']:+.2f} s away", "frames": frames}
        if abs(db - da) > max(RETIME_DUR_S, RETIME_DUR_FRAC * da):
            return False, {"why": f"retimed: length {da:.2f} -> {db:.2f} s", "frames": frames}
        na, nb = ma.get("nums") or [], mb.get("nums") or []
        drift = [abs(a - b) for a, b in zip(na, nb) if abs(a - b) > max(RETIME_NUM_ABS, RETIME_NUM_FRAC * abs(a))]
        moved = any(a != b for a, b in zip(na, nb))
        if moved and ma.get("list") != mb.get("list"):
            return False, {"why": "shot list edited and this shot's numbers changed — a fix, not a retime", "frames": frames}
        if len(na) != len(nb) or drift:
            return False, {"why": f"retimed: definition numbers moved more than a timing nudge ({len(drift)} values)", "frames": frames}
        if mb.get("shot") in hot_shots():
            ea = SNAP / f"{old_hash}_m.json"
            has_events = ea.exists() and json.loads(ea.read_text()).get("events")
            if not has_events and ma.get("hot") is not None:
                # geometry-only HOT (overlap / head cut / size jump, no reach or key): positions did not move
                # (checked above) and the geometry lint, re-run on the new timing, flags the same things
                if sorted(ma.get("hot") or []) == sorted(mb.get("hot") or []):
                    return True, {"kind": "retime-hot", "flags": mb.get("hot"), "dt0": round(mb["t0"] - ma["t0"], 3)}
                return False, {"why": f"retimed HOT shot: geometry flags {ma.get('hot')} -> {mb.get('hot')}", "frames": frames}
            ok_ev, ev = event_frames_same(old_hash, new_hash)
            if not ok_ev:
                return False, {"why": f"retimed HOT shot: {ev}", "frames": frames}
            return True, {"kind": "retime-hot", "events": ev, "dt0": round(mb["t0"] - ma["t0"], 3)}
        return True, {"kind": "retime", "dt0": round(mb["t0"] - ma["t0"], 3), "dur": [round(da, 3), round(db, 3)]}
    return False, {"why": "picture changed", "frames": frames}


def chain_ok(review, cur_hash):
    """sv_gate: a carried review is valid if every link from the reviewed hash to the current one still compares ok"""
    links = review.get("carried") or []
    if not links or links[-1].get("to") != cur_hash or review.get("hash") != cur_hash:
        return False
    if links[0].get("from") != review.get("reviewed_hash"):
        return False
    return all(compare(l["from"], l["to"])[0] for l in links)


def main():
    # current hashes: never trust a qa_status.json written before the last edit (it was the cause of "0 to review"
    # right after `cards changed` when sv_gate had not run in between)
    import subprocess
    subprocess.run(["node", "scripts/qa.mjs", "status"], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    st = json.loads((ROOT / "qa/qa_status.json").read_text())
    hashes = {int(k): v for k, v in st.get("hashes", {}).items()}
    carried, review, kept = [], [], 0
    for i, h in sorted(hashes.items()):
        p = ROOT / f"qa/review/{i:02d}.json"
        if not p.exists():
            review.append({"shot": i, "why": "never reviewed"})
            continue
        r = json.loads(p.read_text())
        if r.get("hash") == h:
            kept += 1
            continue
        if r.get("verdict") != "ok":
            review.append({"shot": i, "why": "last review was not ok"})
            continue
        ok, det = compare(r["hash"], h)
        if not ok:
            review.append({"shot": i, **det})
            continue
        r.setdefault("reviewed_hash", r["hash"])
        r.setdefault("carried", []).append({"from": r["hash"], "to": h, **det})
        r["hash"] = h
        p.write_text(json.dumps(r, ensure_ascii=False, indent=1))
        carried.append(i)
    (ROOT / "qa/carry.json").write_text(json.dumps({"carried": carried, "review": review, "unchanged": kept}, ensure_ascii=False, indent=1))
    kinds = {}
    for i in carried:
        k = json.loads((ROOT / f"qa/review/{i:02d}.json").read_text())["carried"][-1]["kind"]
        kinds[k] = kinds.get(k, 0) + 1
    print(f"carry: {kept} unchanged · {len(carried)} carried {kinds} · {len(review)} to review: "
          f"{[x['shot'] for x in review][:30]}")
    for x in review[:12]:
        print(f"  #{x['shot']}: {x.get('why')}")


if __name__ == "__main__":
    sys.exit(main())
