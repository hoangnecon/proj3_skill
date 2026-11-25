# Generalized Pre-G4 Art Direction & 8-Axis Rubric (`v6.2.0`)

Every episode with `art_direction.json` (copied automatically by `tools/new_episode.py`) MUST pass the **Pre-G4 Art Direction Gate** (`python scripts/sv_cli.py ci art-direction --json`) **before** any Executor can edit `src/episode/{cast,sets,subjects,geo}.ts(x)` or `plates/*`. `hooks/sv_guard.py H3` hard-blocks design and plate edits until `qa/art_direction_lint.json` records `ok: true` with a SHA-256 matching the current `art_direction.json` on disk.

This specification is **100% genre-agnostic**: it works identically for urban comedy, slice-of-life classrooms, sci-fi workshops, cozy cafes, coastal villages, mountain journeys, or fantasy interiors without hardcoding any single biome or motif.

---

## 1. Mandatory `art_direction.json` Blueprint (`AD-01..AD-06`)

Formal schema: `<suite>/schemas/art_direction.schema.json`. Required top-level structure:

```json
{
  "schema_version": "6.2",
  "episode_slug": "my-episode",
  "project_style_lock": {
    "style_family": "flat 2D Risograph ink with warm paper tooth",
    "flat_2d_riso_characters": true,
    "pal_tokens_only": true,
    "nhim_canonical_ch11": true
  },
  "story_world_elements": {
    "lighting_moods": ["warm morning key", "cool overcast alley", "amber tungsten interior"],
    "recurring_motifs": ["scuffed tiled thresholds", "hand-painted signage", "weathered timber"],
    "material_and_organic_rules": [
      "Vary foliage, clutter, and surface wear silhouettes — zero clone-stamped geometry",
      "Soften structural edges and transitions organically where materials meet"
    ]
  },
  "layer_architecture": {
    "far": "Atmospheric backdrop plane with restrained contrast and optional KawaseBlurFilter (0.8..1.4) so foreground Risograph keylines stay crisp",
    "mid": "Primary architectural/environmental stage, landmarks, and walkable zones matching zones.mgY",
    "light_emissive": "Story-motivated key light, window/sky glow, or practical lamps without muddying character silhouettes",
    "fg_staging": "Clean framing edges and foreground depth anchors that never obstruct zones.mgY or captions",
    "anti_shortcut_rules": [
      "Zero identical stamped clouds, tiles, trees, or props across plates",
      "Zero ruler-straight unintegrated horizon or ground-cut seams"
    ]
  },
  "location_matrix": [
    {
      "id": "cafeFront",
      "location": "cornerCafe",
      "shotScale": "establishing",
      "camera_angle": "front",
      "horizon_and_perspective": "Eye-level street horizon at 62% frame height; sidewalk curb and doorway threshold clearly separated at human scale",
      "terrain_and_edge_transitions": "Weathered stone pavers curve naturally into the asphalt curb with subtle kerb grit and organic doorway mat transition",
      "lighting_mood": "warm morning key",
      "weather_fx_mode": "none",
      "mandatory_objects": [
        "striped canvas awning", "hand-lettered menu chalkboard", "brass door handle",
        "tiled threshold step", "potted fern pair", "stacked wooden crates",
        "sidewalk curb drain", "hanging enamel sign", "window reflection streaks",
        "bicycle rack", "brick corner pilasters", "warm interior pendant glow"
      ],
      "landmarks": ["striped_awning", "menu_chalkboard"],
      "anti_spoiler_guards": ["none: no early concealment required"]
    }
  ],
  "reviewer_rubric": {
    "min_total": 82,
    "min_dim": 7,
    "axes": {
      "style_cohesion": "Consistent Risograph ink weight, PAL harmony, and untouched crisp 2D characters",
      "depth_and_lighting": "Clear 4-layer tonal separation (far/mid/light/fg) and coherent light direction",
      "perspective_and_scale": "Locked horizon, believable human/tabletop/floor scale, zero tilted-plane conflicts",
      "composition_and_integration": "Organic edge/terrain transitions, zero pasted stickers or ruler-straight ground cuts",
      "detail_density_and_variety": "Meets mandatory_objects density with varied organic silhouettes and zero clone-stamping",
      "staging_readability": "Uncluttered zones.mgY walking lane and high contrast behind cast and captions",
      "spatial_continuity": "Shared landmarks, materials, and lighting carry cleanly across every sub-scene in a location",
      "story_and_spoiler_fidelity": "Matches brief mood and obeys every anti_spoiler_guards concealment rule"
    }
  }
}
```

### Art Direction Lint Rules (`AD-01..AD-08`)
| Rule | Enforced In | Invariant |
|---|---|---|
| `AD-01` | `scripts/art_direction_lint.py` | `art_direction.json` exists, valid JSON, zero `TODO` / placeholder tokens, all required top-level keys present |
| `AD-02` | `scripts/art_direction_lint.py` | `project_style_lock` keeps `flat_2d_riso_characters: true`, `pal_tokens_only: true`, `nhim_canonical_ch11: true`, and non-empty `style_family` |
| `AD-03` | `scripts/art_direction_lint.py` | Location expansion coverage: every distinct `location` in `location_matrix` has `>= 3` connected sub-scenes covering `brief.md` core locations |
| `AD-04` | `scripts/art_direction_lint.py` | Per-sub-scene contract: concrete `horizon_and_perspective` (`>= 8` words), `terrain_and_edge_transitions` (`>= 8` words), single `weather_fx_mode` (`none \| dust_motes \| rain \| fireflies \| petals`), `mandatory_objects` (`>= 12` wide/medium, `>= 8` closeup/insert), `landmarks` (`>= 2`), and `anti_spoiler_guards` (`>= 1`) |
| `AD-05` | `scripts/art_direction_lint.py` | World & layer architecture: non-empty `story_world_elements` (`lighting_moods`, `recurring_motifs`, `material_and_organic_rules`) and concrete `layer_architecture` (`far`, `mid`, `light_emissive`, `fg_staging`, `anti_shortcut_rules`, `>= 6` words each) |
| `AD-06` | `scripts/art_direction_lint.py` | `reviewer_rubric` locks all 8 mandatory scoring axes with concrete criteria, `min_total >= 82`, and `min_dim >= 7` |
| `AD-07` | `scripts/lint.mjs` (`plate_check.py`) | Cross-plate visual richness & anti-copy-paste CI (`color_clusters` richness and `cross_set_max_sim` anti-duplicate ceiling from `qa/design/plate_stats.json`) |
| `AD-08` | `scripts/lint.mjs` | Strict 1-to-1 sync between `art_direction.json` `location_matrix` IDs and `EPISODE_SETS` keys in `src/episode/sets.tsx` |

Run Pre-G4 Art Direction CI before starting any set/plate code:
```bash
python scripts/sv_cli.py ci art-direction --json
```
Any subsequent edit to `art_direction.json` invalidates `qa/art_direction_lint.json` (SHA mismatch), immediately re-locking `H3` until `ci art-direction` passes again.

---

## 2. Universal 4-Layer Depth & Grounding Locks

1. **4-Layer Separation (`layer_architecture`):**
   - **Far (`far`):** Distant walls, skylines, backdrops, or deep room planes with lower ink contrast (and optional `KawaseBlurFilter` `0.8..1.4` on `rasterPlate` backgrounds) so foreground 2D Risograph characters pop cleanly.
   - **Mid (`mid`):** Primary playable architecture, floor/ground lanes (`zones.mgY`), landmarks, and interactive fixtures.
   - **Light / Emissive (`light_emissive`):** Directional light shafts, window bounce, or practical fixtures serving the scene's `lighting_mood` — never muddy or over-bloomed.
   - **Foreground Staging (`fg_staging`):** Subtle framing elements (`zones.fgY`) that add parallax without blocking actor faces, `zones.mgY`, or bottom captions.
2. **Horizon & Perspective Lock (`horizon_and_perspective`):**
   - Explicitly lock camera height, horizon line, and foreground-vs-background scale separation (e.g., tabletop surface vs floor plane, macro close-up vs human-height standing lane) so actors and props never look pasted onto an incompatible perspective.
3. **Seamless Edge & Terrain Integration (`terrain_and_edge_transitions`):**
   - Specify how every ground/floor/wall boundary meets its neighbors organically (curved verges, skirting boards, curbs, thresholds, shadows, surface grain) — banning ruler-straight horizontal cut lines and floating cut-out props.

---

## 3. Anti-Cramming Worker Split Rule (`<= 5–6` Plates / Worker)

When an episode plans **`>= 6` `rasterPlate` or `videoPlate` backdrops** (or `>= 12` total sub-scenes):
- **NEVER cram all plates into one monolithic builder script or one single Executor turn.** Cramming causes repetitive copy-paste geometry, flat color clusters (`AD-07`), and rushed edge transitions.
- **Split plate authoring into modular packs (`plates/pack_<group>.mjs`)** with **`<= 5–6` plates per worker**, grouped by parent `location` or lighting mood.
- Each worker receives the locked `art_direction.json`, owns only its assigned `plates/pack_<group>.mjs` + `public/plates/<id>.png` outputs, and verifies every plate against its `location_matrix` `mandatory_objects` and `anti_spoiler_guards`.

---

## 4. Mandatory 8-Axis Reviewer Scoring Gate (`sv_cli.py design score` & `LG-13`)

Before Gate `G4` can pass, the Independent Reviewer (`reviewer_id != executor_id`) MUST inspect all rendered design sheets via `read_file` (`hooks/sv_guard.py H6`), score **every** set declared in `art_direction.json` across all **8 mandatory axes** (`0..10` each, with a `>= 6`-word concrete justification per axis), and submit via:

```bash
python scripts/sv_cli.py design score --input qa/design/scores_draft.json --actor <reviewer_id> --run <rev_run_id> --json
```

### The 8 Mandatory Axes (Exact JSON Keys)
1. `style_cohesion`
2. `depth_and_lighting`
3. `perspective_and_scale`
4. `composition_and_integration`
5. `detail_density_and_variety`
6. `staging_readability`
7. `spatial_continuity`
8. `story_and_spoiler_fidelity`

### Hard Rejection Formula & `LG-13` Enforcement
- For each set: `total = round(sum(8 axis scores) / 80 * 100, 1)` and `min_axis = min(8 axis scores)`.
- A set **PASSES** if and only if **`total >= 82`** (`min_total`) **AND** **`min_axis >= 7`** (`min_dim`).
- If **any** set scores `total < 82` **OR** **any single axis `< 7`**, `sv_cli.py design score` writes `verdict: "fix"` into `qa/design/g4_scores.json` (protected from direct edits by `H2`/`H4`).
- `sv_log_lint.py` **`LG-13`** and `sv_gate.py check G4` **hard-block** Gate `G4` whenever `qa/design/g4_scores.json` is missing, stale, incomplete, or has `verdict != "pass"`. Fix every failing set, re-render design sheets, and re-score before presenting to the user.
