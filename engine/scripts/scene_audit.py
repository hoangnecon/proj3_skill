#!/usr/bin/env python3
"""Scene plan + frame clutter audit (sv-23, gates G4 and G5).

  python3 scripts/scene_audit.py plan     # checks scenes.json against the set registry (G4, before any shot)
  python3 scripts/scene_audit.py shots    # checks qa/shots.json against scenes.json + measures every contact frame (G5)

Writes qa/scene_audit.json and qa/scene_board.png (plan) / qa/clutter_board.png (shots).
Numbers are measured from rendered pixels, so a review cannot claim "clean" for a frame that is not.
Exit code 1 on any error. Waive a rule only in scenes.json: "waive": {"SC-07": "reason ≥ 6 words"}.
"""
import json, os, sys, hashlib
import numpy as np
from PIL import Image, ImageDraw, ImageFont

STD = {
    'max_locations': 6,          # 2–3 min episode: ≤ 6 places, so each is remembered
    'min_shots_per_location': 3,  # a place built for 1–2 shots is decoration, use an insert or an existing place
    'max_share_one_location': 0.35,  # no place carries > 35 % of shots (Nước mắt: gian thờ 36 % → monotony)
    'wall_hue_gap': 28,          # degrees between dominant wall hues of different locations
    'edge_max': 0.075, 'edge_warn': 0.06,  # fraction of strong-gradient pixels above the caption band
    'colours_max': 15, 'colours_warn': 12,  # 3-bit colour bins covering ≥ 1 % of the frame
    'overlays_max': 1,           # text overlays visible at once
    'establish_k_max': 1.15, 'establish_min_s': 1.2,
    'size_jump': 1.25,           # consecutive shots in one scene: zoom ratio or subject must change
}
TRANSITIONS = {'cut', 'match', 'wipe', 'whip', 'tag', 'fade', 'flash'}
ENTRIES = {'establish', 'insert', 'continue'}
errors, warns = [], []
err = lambda r, m: errors.append(f'[{r}] {m}')
warn = lambda r, m: warns.append(f'[{r}] {m}')


def load(f):
    if not os.path.exists(f):
        err('SC-00', f'{f} missing')
        return None
    return json.load(open(f, encoding='utf8'))


def sha(f):
    return hashlib.sha256(open(f, 'rb').read()).hexdigest()[:16]


def hue(rgb):
    r, g, b = [x / 255 for x in rgb]
    mx, mn = max(r, g, b), min(r, g, b)
    if mx == mn:
        return 0.0
    d = mx - mn
    h = ((g - b) / d) % 6 if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4
    return h * 60


def dominant(img):
    a = np.asarray(img.convert('RGB').resize((108, 192)), dtype=np.int32)[:120]
    q = (a >> 4)
    key = q[..., 0] * 256 + q[..., 1] * 16 + q[..., 2]
    k = np.bincount(key.ravel()).argmax()
    return [((k >> 8) & 15) * 16 + 8, ((k >> 4) & 15) * 16 + 8, (k & 15) * 16 + 8]


def clutter(path):
    a = np.asarray(Image.open(path).convert('RGB').resize((540, 960)), dtype=np.int16)[:720]  # caption band excluded
    g = a.mean(2)
    e = ((np.abs(np.diff(g, axis=0))[:, :-1] + np.abs(np.diff(g, axis=1))[:-1]) > 40).mean()
    q = a >> 5
    key = q[..., 0] * 64 + q[..., 1] * 8 + q[..., 2]
    c = np.bincount(key.ravel(), minlength=512) / key.size
    return round(float(e), 4), int((c > 0.01).sum())


def plan_check(sc, waive):
    locs = sc.get('locations', {})
    scenes = sc.get('scenes', [])
    if not locs:
        err('SC-01', 'scenes.json has no locations')
    if len(locs) > STD['max_locations'] and 'SC-02' not in waive:
        err('SC-02', f'{len(locs)} locations > {STD["max_locations"]}: merge places or make one an insert')
    for lid, L in locs.items():
        for f in ('set', 'purpose', 'layout', 'hero', 'wall'):
            if not L.get(f):
                err('SC-03', f'location {lid}: field "{f}" empty')
        lay = L.get('layout', {})
        for f in ('horizon_y', 'floor', 'subject_zone', 'empty_zone', 'back', 'mid', 'front'):
            if f not in lay:
                err('SC-04', f'location {lid}: layout.{f} missing (three planes, horizon, where people stand, where nothing stands)')
        if len(lay.get('mid', [])) > 4:
            err('SC-05', f'location {lid}: {len(lay["mid"])} mid-plane props > 4 — clutter starts in the mid plane')
        if len(lay.get('back', [])) > 5:
            err('SC-05', f'location {lid}: {len(lay["back"])} back-plane props > 5')
        if len(L.get('purpose', '').split()) < 6:
            err('SC-03', f'location {lid}: purpose must say what story job this place does (≥ 6 words)')
    sid = set()
    for i, s in enumerate(scenes):
        tag = f'scene {s.get("id", i)}'
        if s.get('id') in sid:
            err('SC-06', f'{tag}: duplicate id')
        sid.add(s.get('id'))
        if s.get('location') not in locs and s.get('entry') != 'insert':
            err('SC-06', f'{tag}: location {s.get("location")} not declared')
        if s.get('entry') not in ENTRIES:
            err('SC-07', f'{tag}: entry must be one of {sorted(ENTRIES)}')
        if s.get('transition_in') not in TRANSITIONS:
            err('SC-08', f'{tag}: transition_in must be one of {sorted(TRANSITIONS)}')
        if not s.get('beats'):
            err('SC-09', f'{tag}: beats (segment ids from beats.md) empty')
        if len(s.get('why', '').split()) < 5:
            err('SC-09', f'{tag}: "why" must say why this is a new scene (≥ 5 words)')
        if i:
            prev = scenes[i - 1]
            moved = prev.get('location') != s.get('location')
            jump = s.get('time') != prev.get('time')
            tr = s.get('transition_in')
            if moved and tr == 'cut' and s.get('entry') != 'insert':
                err('SC-10', f'{tag}: place changes ({prev.get("location")} → {s.get("location")}) on a plain cut — use match/wipe/whip, or tag if time also jumps')
            if jump and tr not in ('tag', 'fade', 'flash'):
                err('SC-11', f'{tag}: time jumps ({prev.get("time")} → {s.get("time")}) without a tag/fade/flash')
            if not moved and not jump and s.get('entry') != 'insert':
                warn('SC-12', f'{tag}: same place and time as previous scene — is it really a new scene?')
        if s.get('entry') == 'establish' and i and any(p.get('location') == s.get('location') for p in scenes[:i]):
            warn('SC-13', f'{tag}: re-establishing a known place — a medium re-entry is usually enough')
    used = {s.get('location') for s in scenes}
    for lid in locs:
        if lid not in used:
            err('SC-14', f'location {lid} declared but no scene uses it')


def wall_check(sc, waive):
    locs = sc.get('locations', {})
    hues = {}
    for lid, L in locs.items():
        f = f'qa/design/set_{L.get("set")}.png'
        if os.path.exists(f):
            hues[lid] = hue(dominant(Image.open(f)))
        else:
            err('SC-15', f'{f} missing — render the plate (node scripts/design.mjs --only set:{L.get("set")})')
    ids = list(hues)
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            d = abs(hues[ids[i]] - hues[ids[j]])
            d = min(d, 360 - d)
            if d < STD['wall_hue_gap'] and 'SC-16' not in waive:
                err('SC-16', f'{ids[i]} and {ids[j]} walls only {d:.0f}° apart — the viewer cannot tell the places apart')
    return hues


def board(sc, out):
    locs = list(sc.get('locations', {}).items())
    if not locs:
        return
    W, cols = 300, 4
    rows = (len(locs) + cols - 1) // cols
    img = Image.new('RGB', (cols * (W + 20) + 20, rows * (W * 16 // 9 + 130) + 80), (255, 246, 223))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
        small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 16)
    except OSError:
        font = small = ImageFont.load_default()
    d.text((20, 20), 'SCENE PLAN · locations', fill=(31, 47, 110), font=font)
    for k, (lid, L) in enumerate(locs):
        x, y = 20 + (k % cols) * (W + 20), 70 + (k // cols) * (W * 16 // 9 + 130)
        f = f'qa/design/set_{L.get("set")}.png'
        if os.path.exists(f):
            p = Image.open(f).convert('RGB').resize((W, W * 16 // 9))
            img.paste(p, (x, y))
        n = sum(1 for s in sc.get('scenes', []) if s.get('location') == lid)
        d.text((x, y + W * 16 // 9 + 6), f'{lid} · {n} scene', fill=(31, 47, 110), font=font)
        d.text((x, y + W * 16 // 9 + 36), (L.get('purpose') or '')[:44], fill=(80, 90, 130), font=small)
        d.text((x, y + W * 16 // 9 + 58), ('hero: ' + (L.get('hero') or ''))[:44], fill=(80, 90, 130), font=small)
    img.save(out)


def shots_check(sc, waive):
    rows = load('qa/shots.json') or []
    scenes = sc.get('scenes', [])
    locs = sc.get('locations', {})
    by_shot = {}
    for s in scenes:
        a, b = s.get('shots', [None, None])
        if a is None:
            err('SC-20', f'scene {s.get("id")}: "shots": [first, last] missing (fill it at G5)')
            continue
        for i in range(a, b + 1):
            if i in by_shot:
                err('SC-20', f'shot #{i} in two scenes ({by_shot[i]["id"]}, {s.get("id")})')
            by_shot[i] = s
    sets_of = {lid: L.get('set') for lid, L in locs.items()}
    counts = {}
    report = []
    for r in rows:
        i = r['i']
        s = by_shot.get(i)
        if not s:
            err('SC-21', f'shot #{i} belongs to no scene')
            continue
        counts[s.get('location')] = counts.get(s.get('location'), 0) + 1
        allowed = {sets_of.get(s.get('location'))} | set(s.get('inserts', []))
        if r['set'] not in allowed:
            err('SC-22', f'shot #{i}: set {r["set"]} not the scene\'s place ({s.get("location")}) nor a declared insert {s.get("inserts", [])}')
        first = s['shots'][0] == i
        k = r['cam'][2]
        if first and s.get('entry') == 'establish':
            if k > STD['establish_k_max']:
                err('SC-23', f'shot #{i}: opens scene {s.get("id")} at zoom {k} > {STD["establish_k_max"]} — first shot in a place is a wide')
            if r['t1'] - r['t0'] < STD['establish_min_s']:
                err('SC-23', f'shot #{i}: establishing wide only {r["t1"] - r["t0"]:.2f}s < {STD["establish_min_s"]}s')
        if first and i and r.get('tr', 'cut') == 'cut' and s.get('transition_in') != 'cut':
            err('SC-24', f'shot #{i}: scene {s.get("id")} declares transition {s.get("transition_in")} but the shot cuts')
        if not first and i:
            p = rows[i - 1]
            ratio = max(k, p['cam'][2]) / max(0.01, min(k, p['cam'][2]))
            same_people = {a['look'] for a in r['actors']} == {a['look'] for a in p['actors']}
            if p['set'] == r['set'] and ratio < STD['size_jump'] and same_people and abs(r['cam'][0] - p['cam'][0]) < 120:
                err('SC-25', f'shot #{i}: jump cut — same set, same people, zoom ratio {ratio:.2f} < {STD["size_jump"]}')
        # overlays visible at the shot's midpoint
        mid = (r['t0'] + r['t1']) / 2
        live = [o for o in r.get('over', []) if o['k'] in ('label', 'tag', 'bubble', 'title', 'card') and o.get('t', r['t0']) <= mid]
        if len(live) > STD['overlays_max']:
            err('SC-26', f'shot #{i}: {len(live)} text overlays on screen at once > {STD["overlays_max"]}')
        # pixels
        m = []
        for u in ('0.25', '0.75'):
            f = f'qa/_f/c{i}_{u}.jpg'
            if not os.path.exists(f):
                err('SC-27', f'{f} missing — run node scripts/qa.mjs contact first')
                continue
            e, c = clutter(f)
            m.append((e, c))
            if os.path.getmtime(f) < os.path.getmtime('qa/shots.json'):
                err('SC-27', f'{f} older than qa/shots.json — re-render contact sheets')
        if m:
            e, c = max(x[0] for x in m), max(x[1] for x in m)
            report.append({'i': i, 'set': r['set'], 'scene': s.get('id'), 'edge': e, 'colours': c})
            wv = f'#{i}' in waive.get('SC-28', '')
            if e > STD['edge_max'] and not wv:
                err('SC-28', f'shot #{i} ({r["set"]}): edge density {e:.3f} > {STD["edge_max"]} — too busy; remove mid-plane props or push in')
            elif e > STD['edge_warn']:
                warn('SC-28', f'shot #{i} ({r["set"]}): edge density {e:.3f} (warn > {STD["edge_warn"]})')
            if c > STD['colours_max'] and not wv:
                err('SC-29', f'shot #{i} ({r["set"]}): {c} colour masses > {STD["colours_max"]} — too many colours in frame')
            elif c > STD['colours_warn']:
                warn('SC-29', f'shot #{i} ({r["set"]}): {c} colour masses (warn > {STD["colours_warn"]})')
    n = max(1, len(rows))
    for lid, c in counts.items():
        if c / n > STD['max_share_one_location'] and 'SC-30' not in waive:
            err('SC-30', f'location {lid} carries {c}/{n} shots ({c / n:.0%}) > {STD["max_share_one_location"]:.0%} — the film feels stuck in one room')
        if c < STD['min_shots_per_location'] and 'SC-31' not in waive:
            err('SC-31', f'location {lid} has only {c} shots — make it an insert of another scene or cut it')
    return report


def clutter_board(report, out):
    if not report:
        return
    report = sorted(report, key=lambda x: -x['edge'])[:12]
    W = 240
    img = Image.new('RGB', (6 * (W + 12) + 12, 2 * (W * 16 // 9 + 60) + 70), (255, 246, 223))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 18)
    except OSError:
        font = ImageFont.load_default()
    d.text((12, 16), f'BUSIEST 12 FRAMES · edge max {STD["edge_max"]} · colours max {STD["colours_max"]}', fill=(31, 47, 110), font=font)
    for k, r in enumerate(report):
        x, y = 12 + (k % 6) * (W + 12), 56 + (k // 6) * (W * 16 // 9 + 60)
        img.paste(Image.open(f'qa/_f/c{r["i"]}_0.25.jpg').convert('RGB').resize((W, W * 16 // 9)), (x, y))
        bad = r['edge'] > STD['edge_max'] or r['colours'] > STD['colours_max']
        d.text((x, y + W * 16 // 9 + 6), f'#{r["i"]} e{r["edge"]:.3f} c{r["colours"]}', fill=(220, 40, 70) if bad else (31, 47, 110), font=font)
    img.save(out)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'plan'
    sc = load('scenes.json') or {}
    waive = {k: v for k, v in sc.get('waive', {}).items() if len(str(v).split()) >= 6}
    for k, v in sc.get('waive', {}).items():
        if k not in waive:
            err('SC-99', f'waiver {k} needs a reason of ≥ 6 words')
    os.makedirs('qa', exist_ok=True)
    out = {'mode': mode, 'std': STD}
    if os.path.exists('scenes.json'):
        out['scenes_sha'] = sha('scenes.json')
    plan_check(sc, waive)
    out['wall_hues'] = wall_check(sc, waive)
    board(sc, 'qa/scene_board.png')
    if mode == 'shots':
        out['frames'] = shots_check(sc, waive)
        clutter_board(out['frames'], 'qa/clutter_board.png')
        if os.path.exists('qa/shots.json'):
            out['shots_sha'] = sha('qa/shots.json')
    out['errors'], out['warnings'] = errors, warns
    json.dump(out, open('qa/scene_audit.json', 'w'), ensure_ascii=False, indent=1)
    for m in errors:
        print('ERROR', m)
    for m in warns:
        print('WARN ', m)
    print(f'{len(errors)} errors, {len(warns)} warnings → qa/scene_audit.json')
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
