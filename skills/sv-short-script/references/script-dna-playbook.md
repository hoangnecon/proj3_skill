# Script DNA Playbook — 10 Corpus-Proven Storytelling & Breathability Laws (`v6.0.0`)

> Distilled from empirical quantitative & qualitative analysis of **41 folders** in `G:\My Drive\SCRIPT_YOUTUBE\` (`28` pure Vietnamese 9:16 Reference Shorts + `6` 16:9 Long-Form scripts, backed by `standards/script_dna_db.json` `v2.0` and enforced by `script_lint.py` **`SC-38..43`**).

---

## 1. Quantitative Ground Truth (`ref_short_vn`, n=28)

| Metric | Ref Shorts Median [IQR] | Target Band (`v4.0` SSoT) | Why It Matters |
|---|---|---|---|
| **Spoken Words** | **595** [470–684] | **`500–620`** (pass `450–660`) | Prevents cramming 2 storylines into 1 Short |
| **Duration** | **144.2 s** [118.8–155.7 s] | **`110–145 s`** (pass `96–150 s`) | Crisp energetic Short cadence under 2.5 min |
| **Effective WPS** | **4.59** [4.52–4.71] | **`4.42–4.74`** (calibrated `v4.0` Hải Đăng `~4.57 wps`) | Locks right onto YouTube corpus median — never sluggish (`4.02`) or rushed (`>4.80`) |
| **Mean Words / Sent** | **7.83** [7.22–8.66] | **`6.5–8.5`** (warn `>8.8`, err `>9.5`) | Kids & mobile listeners process 1 image per beat |
| **Short Sentences (`≤ 6w`)** | **43.5%** [30.0–52.0%] | **`38–50%`** (warn `<35%`, err `<28%`) | Staccato drops create rhythm, tension & punch |
| **Words / Clause** | **5.61** [5.40–6.07] | **`≤ 5.8`** (warn `>6.0`, err `>6.5`) | ~1.2 s per breath chunk — zero suffocation |
| **Direct Quotes (`“...”`)** | **6.5** [3.8–10.2] | **`4–8`** (`≤ 12w`/line, warn `<3`) | Live dialogue breaks narration wall & carries emotion |
| **Audio Pause Ratio** | **19.6% RMS** [19.4–21.0%] | **`~20% RMS`** (`≥ 3` pauses `≥ 0.38 s`) | Lets twists & emotions land without dragging tempo |
| **Visual Cutting Pace** | **50 shots** · **2.98 s/shot** | **`2.2–3.6 s/shot`** (`16–27 sh/min`) | Includes `2–4` silent visual hold beats (`0.5–1.0 s`) |

---

## 2. The 10 Corpus DNA Laws

1. **Instant 1-Sentence World Rule (`0–6 s`):** `100%` of reference scripts land the single weird world rule in Sentences 1–2 (`S1` median `13.5w`, `S1+S2` `22w`; `78.9%` open with *"Ở thị trấn tôi / Ở thế giới này / Làng tôi..."*), followed by 2–3 concrete daily-life proof gags. **Never** open with a defensive loophole lecture (*"Đừng hòng lách luật..."*).
2. **One Rule, One Spine, One Twist (`≤ 25w`):** Zero stacked magic systems or parallel subplots. The twist is a hidden corollary or redefinition of Rule #1 (`diem-hoi-sinh`, `mot-phut-cho-me`, `Bốn nghìn đôi cánh`, `thanh-kiem-roi-suot-sau-nam`), never a late biography dump.
3. **100% First-Person `"tôi"` & Early Outlier Pivot (`~16.5%` / `~104w`):** Use 1st-person `"tôi"` (`"Nhím"` named at most once, or omitted completely). Pivot from world-demo to personal stakes before `25–28%` via `"Còn tôi..."` / `"Trừ tôi."`.
4. **Ultra-Lean Cast & Scope Discipline (`SC-40`):** Keep Short scripts to **`2–3` core active named characters** (max `4`, zero 1-line cameos outside Act-1 world-demo), **`2–3` core story locations** (each expanding into 3–4 connected front-on spatial sub-scenes in G4!), **`1–3` core plot props**, and **1-sentence factual backstory max** (`12–23w`).
5. **Staccato & Accordion Breathability (`SC-38`):** Mean `7.0–8.5 w/sent`, `35–55%` sentences `≤ 6w`, `≤ 5.8 w/clause`. Pair 10–15w setups with 2–5w drops, and **compress sentence length progressively at climax/twist** (never spike WPS on Hook/Payoff/Turn!).
6. **High-Impact Direct Dialogue & 1-Word Sound Anchors (`SC-39`):** Write `4–8` crisp direct quotes (`≤ 12w`) + standalone 1-word sound punches (`Bụp.`, `Cạch.`, `Phụt.`). Never flatten an emotional peak into indirect summary (*"Bà bảo không nhớ..."*).
7. **Stealth Plant — Ban "Elder Lectures Loophole" (`SC-42`):** Disguise the Act-3 key inside a warm/funny everyday habit or casual line (`sieu-nang-luc-cua-ban`: *"tay dài"* for cookies $\rightarrow$ reaching across the ocean). Never dedicate a scene to an Elder/Authority explaining the loophole.
8. **Show & Withhold — Trust the Viewer (`SC-39`/`SC-42`):** Once the twist clicks (*"Thằng bé ấy là bố"*), **STOP explaining** why earlier clues happened (*"nên tối nào bố cũng đặt bát canh"*). Ban AI melodrama clichés (*"bùng cao rực rỡ"*, *"cuộn trào"*, *"vụt sáng trong đầu"*, *"cắn răng đốt nốt"*); prefer plain verbs and deadpan Nhím warmth.
9. **Mandatory Breath & Silent Visual Holds (`SC-41`):** Reserve `3–5` explicit `0.45–1.0 s` pauses (`pause_after` in `script.json`) or `[Không có]` silent visual hold beats right after the Hook, before suspense failure, after the Hack/Twist, and before the Button.
10. **Humor Wraps Heart or Mystery (`0%` Pure Comedy):** Use absurd opening demos as a Trojan horse to earn a sincere emotional gut-punch (`66.7%`) or uncanny cliffhanger (`27.8%`), closing on a `≤ 12w` callback Button with **zero moralizing**.

---

## 3. Calibration Case Study: Before vs. After (`bo-lac-ho-bang-lua-ky-uc`)

Why the original `bo-lac` (`789w`, `8` chars, `6` locations, `10` props, `9.74 w/sent`, `24.7% ≤6w`, `1` quote, `15.8%` audio pause ratio) felt breathless and rambling — and how applying the 10 DNA Laws fixes it completely:

- **Before (`s21–s24`, 103w, `s24` spiked to `5.88 WPS`):**
  > *Đúng giây ấy, lời Già Làng vụt sáng trong đầu tôi. Lửa không cần kỷ niệm vui. Nó chỉ cần ký ức sâu nhất của người ném! Tôi cúi phắt xuống, giật tung mảnh dây thừng đứt năm ngoái. Rồi ném thẳng vào đống than xám. Phụt! Ngọn lửa xanh-vàng bùng cao rực rỡ. Nỗi sợ chết cóng đêm năm xưa hóa thành hơi ấm cuộn trào, đẩy lùi bão tuyết. Khói bạc tan lên vòm đá, mắt tôi thoáng hoa đi. Sợi dây hóa tro. Tôi nhìn vết sẹo cổ chân mà ngơ ngác, quên sạch nỗi sợ khe băng năm nào.*
- **After (`63w` [-39%], staccato `2–7w` drops + `0.4s` & `0.8s` breath holds, `~3.4 WPS`):**
  > *Tôi nhớ câu bố nói. Lửa chẳng kén chuyện vui hay buồn. Tôi giật đoạn dây thừng đứt bên hông. Ném thẳng vào than.* `[pause 0.4s]` *Phụt! Ngọn lửa xanh bùng lên, ấm sực cả hốc đá. Khói bạc bay tan. Đoạn dây hóa tro.* `[pause 0.8s]` *Tôi nhìn ra khe băng ngoài cửa hang. Lạ thật. Chẳng hiểu sao trước giờ mình lại sợ chỗ này.*

- **Before (`s25–s29`, 150w, `s27–s28` dumped 84w/8 facts at `5.00 WPS` via Elder lecture, 0 quotes):**
  > *...Đêm ấy trước vách băng, Già Làng kể tôi chuyện mười mùa đông trước... Đêm cuối, bà cắn răng đốt nốt chiếc lục lạc xương của con mình. Đứa bé sống sót năm ấy chính là bố Kiên. Bà quên sạch chồng con nên tối nào bố chỉ dám lặng lẽ đặt bát canh ngoài cửa hang...*
- **After (`84w` [-44%], 1 quiet direct quote + `0.7s` & `1.0s` breath holds, zero over-explaining):**
  > *Bão tan. Bố đào tuyết lao vào. Thấy mảnh khăn đỏ còn nguyên trong tay bà Sương, bố khựng lại. Đêm ấy, bố mới kể tôi nghe chuyện mười năm trước. Một trận bão từng nhốt hai mẹ con suốt ba đêm. Để giữ lửa cho thằng bé sốt li bì, bà đã đốt sạch đồ của chồng. Đêm cuối, bà đốt nốt món đồ của con.* `[pause 0.7s]` *“Thằng bé ấy là bố,” bố nói khẽ. “Bà quên sạch rồi. Chỉ còn giữ mỗi chiếc khăn quấn con hôm mới sinh.”* `[pause 1.0s]` *Sáng nay, bà khắc thêm hình thứ ba lên vách băng.*
