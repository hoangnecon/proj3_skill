#!/usr/bin/env python3
"""Deterministic G2->G4 Asset Blueprint & Parallel Worker Planner (RSI v5.4.0).

Zero-dependency stdlib planner that reads script.json, brief.md (if present), and
beats.md (if present) in < 0.5s and produces:
  - qa/asset_blueprint.json : machine-readable G4/G5 Spatial Location-Pack & parallel worker plan
  - qa/asset_blueprint.md   : crisp human-readable executive blueprint

CLI:
  python3 scripts/plan_assets.py [--out qa/asset_blueprint.json] [--md qa/asset_blueprint.md] [--dir .]
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Constants & production targets (aligned with engine/scripts/lint.mjs)
# ---------------------------------------------------------------------------

VALID_SHOT_SCALES = ("establishing", "medium", "closeup", "insert")
VALID_ANGLES = ("wide", "low", "high", "ots", "reverse", "closeup", "pov")
VALID_CAMERA_DIRS = ("front", "reverse", "left", "right", "top", "low", "detail")

TARGETS_LONG_16X9 = {
    "format": "16:9",
    "length_mode": "long_16x9",
    "min_cast": 10,
    "min_sets": 15,
    "target_sets": 25,
    "min_angles": 5,
    "min_locations_with_subscenes": 4,
    "min_subscenes_per_primary_loc": 3,
    "target_shots_range": [95, 175],
    "target_sla_min": 45,
}

TARGETS_SHORT_9X16 = {
    "format": "9:16",
    "length_mode": "short_9x16",
    "min_cast": 3,
    "min_sets": 4,
    "target_sets": 5,
    "min_angles": 2,
    "min_locations_with_subscenes": 1,
    "min_subscenes_per_primary_loc": 1,
    "target_shots_range": [50, 75],
    "target_sla_min": 15,
}

# Suggested actorScale bands matching geom.mjs / lint.mjs LA-01 conventions
ACTOR_SCALE_16X9 = {
    "establishing": [0.58, 0.78],
    "medium": [0.76, 0.96],
    "closeup": [0.95, 1.25],
    "insert": [0.90, 1.20],
}

ACTOR_SCALE_9X16 = {
    "establishing": [0.78, 0.96],
    "medium": [0.88, 1.08],
    "closeup": [1.05, 1.32],
    "insert": [0.95, 1.20],
}

# Ride / mount / fly verbs (VN + EN) that trigger `seats` mount pins on a subject
RIDE_FLY_RE = re.compile(
    r"(?i)(?:^|[^\w])("
    r"cưỡi|lên\s+lưng|trèo\s+(?:phắt\s+)?lên|ngồi\s+lên|chở(?:\s+cả\s+nhóm|\s+người|\s+bọn)?|"
    r"bay\s+(?:vút|lượn|lên|xuống)|bung\s+(?:đôi\s+)?cánh|xòe\s+cánh|đáp\s+(?:êm|xuống|thẳng)|"
    r"lái\s+(?:xe|tàu|máy)|ngồi\s+vào\s+ghế|"
    r"ride|riding|ridden|mount(?:ed|ing)?|fly(?:ing)?|soar(?:ing)?|carry(?:ing)?|"
    r"cockpit|saddle|pilot(?:ing)?|drive|driving|steer(?:ing)?"
    r")(?:[^\w]|$)",
    re.UNICODE,
)

# Subject / Creature / Vehicle / Hero Machine keyword catalog (VN + EN)
# Order matters: more specific entries come before generic ones.
SUBJECT_CATALOG: list[dict[str, Any]] = [
    {
        "key": "ladybug",
        "default_id": "boCanhCam",
        "default_name": "Bọ Cánh Cam",
        "kind": "creature",
        "patterns": [r"bọ\s+cánh\s+cam", r"cánh\s+cứng", r"\bladybug\b", r"\bladybird\b"],
        "secondary_if_present": [r"\bcon\s+bọ\b", r"\blưng\s+bọ\b", r"\bchú\s+bọ\b"],
        "poses": ["trapped", "walk", "fly", "carry"],
        "exprs": ["calm", "alert", "happy", "tired"],
        "relToActor": [1.1, 2.2],
        "suppresses": ["generic_bug"],
    },
    {
        "key": "cat",
        "default_id": "meo",
        "default_name": "Mèo",
        "kind": "creature",
        "patterns": [r"mèo\s+mướp", r"mèo\s+đen", r"mèo\s+tam\s+thể", r"con\s+mèo", r"chân\s+mèo", r"móng\s+mèo", r"\bmèo\b", r"\bcat\b", r"\bfeline\b"],
        "poses": ["prowl", "pounce", "chase", "lookup"],
        "exprs": ["calm", "alert", "fierce", "curious"],
        "relToActor": [1.4, 2.8],
    },
    {
        "key": "ant",
        "default_id": "kien",
        "default_name": "Kiến",
        "kind": "creature",
        "patterns": [r"kiến\s+lửa", r"kiến\s+đen", r"bầy\s+kiến", r"đàn\s+kiến", r"con\s+kiến", r"hàm\s+kiến", r"quân\s+kiến", r"\bkiến\b", r"\bants?\b"],
        "poses": ["march", "charge", "recoil", "swarm"],
        "exprs": ["alert", "fierce", "confused", "retreat"],
        "relToActor": [0.9, 1.8],
    },
    {
        "key": "shrink_machine",
        "default_id": "mayThuPhong",
        "default_name": "Máy Thu Phóng",
        "kind": "machine",
        "patterns": [r"máy\s+thu\s+phóng", r"máy\s+phóng\s+đại", r"máy\s+thu\s+nhỏ", r"\bshrink\s+machine\b", r"\bshrink\s+ray\b"],
        "secondary_if_present": [r"cỗ\s+máy", r"chiếc\s+máy", r"thân\s+máy", r"sau\s+máy", r"máy\s+khóa", r"máy\s+hỏng", r"máy\s+chắc\s+chắn"],
        "poses": ["idle", "firing", "countdown", "overload"],
        "exprs": ["ready", "active", "warning", "critical"],
        "relToActor": [1.2, 2.6],
        "suppresses": ["generic_machine"],
    },
    {
        "key": "generic_bug",
        "default_id": "bo",
        "default_name": "Bọ",
        "kind": "creature",
        "patterns": [r"con\s+bọ", r"bọ\s+hung", r"bọ\s+ngựa", r"bọ\s+cạp", r"\bbeetle\b", r"\bbug\b", r"\binsect\b"],
        "poses": ["idle", "crawl", "attack", "fly"],
        "exprs": ["calm", "alert", "fierce", "startled"],
        "relToActor": [0.9, 1.9],
    },
    {
        "key": "generic_machine",
        "default_id": "coMay",
        "default_name": "Cỗ Máy",
        "kind": "machine",
        "patterns": [r"cỗ\s+máy", r"chiếc\s+máy\s+kỳ\s+lạ", r"\bmachine\b", r"\bcontraption\b"],
        "poses": ["idle", "active", "warning", "overload"],
        "exprs": ["off", "ready", "warning", "critical"],
        "relToActor": [1.1, 2.4],
    },
    {
        "key": "dog",
        "default_id": "cho",
        "default_name": "Chó",
        "kind": "creature",
        "patterns": [r"con\s+chó", r"chú\s+chó", r"chó\s+mực", r"chó\s+vàng", r"\bchó\b", r"\bdog\b", r"\bhound\b"],
        "poses": ["sit", "run", "bark", "leap"],
        "exprs": ["calm", "alert", "fierce", "happy"],
        "relToActor": [0.7, 1.5],
    },
    {
        "key": "bird",
        "default_id": "chim",
        "default_name": "Chim",
        "kind": "creature",
        "patterns": [r"con\s+chim", r"chú\s+chim", r"đại\s+bàng", r"chim\s+sẻ", r"\bchim\b", r"\bbird\b", r"\beagle\b", r"\bcrow\b"],
        "poses": ["perch", "glide", "dive", "flap"],
        "exprs": ["calm", "alert", "fierce", "curious"],
        "relToActor": [0.6, 1.6],
    },
    {
        "key": "spider",
        "default_id": "nhen",
        "default_name": "Nhện",
        "kind": "creature",
        "patterns": [r"con\s+nhện", r"nhện\s+khổng\s+lồ", r"\bnhện\b", r"\bspider\b"],
        "poses": ["hang", "crawl", "ambush", "recoil"],
        "exprs": ["calm", "alert", "fierce", "startled"],
        "relToActor": [0.9, 2.0],
    },
    {
        "key": "mouse",
        "default_id": "chuot",
        "default_name": "Chuột",
        "kind": "creature",
        "patterns": [r"con\s+chuột", r"chuột\s+cống", r"\bchuột\b", r"\bmouse\b", r"\brat\b"],
        "poses": ["scurry", "sniff", "leap", "cower"],
        "exprs": ["calm", "alert", "scared", "curious"],
        "relToActor": [0.6, 1.4],
    },
    {
        "key": "dragon",
        "default_id": "rong",
        "default_name": "Rồng",
        "kind": "boss",
        "patterns": [r"con\s+rồng", r"rồng\s+lửa", r"\brồng\b", r"\bdragon\b"],
        "poses": ["perch", "soar", "roar", "dive"],
        "exprs": ["calm", "alert", "fierce", "proud"],
        "relToActor": [1.8, 3.2],
    },
    {
        "key": "robot",
        "default_id": "robot",
        "default_name": "Robot",
        "kind": "boss",
        "patterns": [r"\brobot\b", r"rô-?bốt", r"người\s+máy", r"\bmech\b"],
        "poses": ["idle", "march", "scan", "powerup"],
        "exprs": ["neutral", "alert", "hostile", "offline"],
        "relToActor": [1.1, 2.4],
    },
    {
        "key": "car",
        "default_id": "oTo",
        "default_name": "Ô Tô",
        "kind": "vehicle",
        "patterns": [r"ô\s*tô", r"xe\s+hơi", r"xe\s+con", r"\btaxi\b", r"\bcar\b"],
        "poses": ["parked", "drive", "brake", "turn"],
        "exprs": ["lights_off", "lights_on", "hazard", "boost"],
        "relToActor": [1.0, 1.8],
    },
    {
        "key": "bus",
        "default_id": "xeBuyt",
        "default_name": "Xe Buýt",
        "kind": "vehicle",
        "patterns": [r"xe\s+buýt", r"\bbus\b"],
        "poses": ["parked", "drive", "brake", "doors_open"],
        "exprs": ["lights_off", "lights_on", "hazard", "honk"],
        "relToActor": [1.4, 2.4],
    },
    {
        "key": "truck",
        "default_id": "xeTai",
        "default_name": "Xe Tải",
        "kind": "vehicle",
        "patterns": [r"xe\s+tải", r"\btruck\b"],
        "poses": ["parked", "drive", "brake", "unload"],
        "exprs": ["lights_off", "lights_on", "hazard", "honk"],
        "relToActor": [1.4, 2.4],
    },
    {
        "key": "ship_train",
        "default_id": "tau",
        "default_name": "Tàu",
        "kind": "vehicle",
        "patterns": [r"tàu\s+hỏa", r"tàu\s+thủy", r"tàu\s+vũ\s+trụ", r"con\s+tàu", r"\btrain\b", r"\bship\b", r"\bspaceship\b"],
        "poses": ["docked", "cruise", "tilt", "boost"],
        "exprs": ["idle", "active", "warning", "full_power"],
        "relToActor": [1.5, 2.8],
    },
    {
        "key": "aircraft",
        "default_id": "mayBay",
        "default_name": "Máy Bay",
        "kind": "vehicle",
        "patterns": [r"máy\s+bay", r"trực\s+thăng", r"\bairplane\b", r"\bhelicopter\b", r"\bdrone\b"],
        "poses": ["landed", "takeoff", "fly", "bank"],
        "exprs": ["idle", "active", "warning", "turbo"],
        "relToActor": [1.2, 2.4],
    },
    {
        "key": "monster",
        "default_id": "quaiThu",
        "default_name": "Quái Thú",
        "kind": "boss",
        "patterns": [r"quái\s+vật", r"quái\s+thú", r"\bmonster\b", r"\bbeast\b"],
        "poses": ["lurk", "roar", "charge", "stagger"],
        "exprs": ["calm", "alert", "fierce", "dazed"],
        "relToActor": [1.5, 2.8],
    },
]

# Vietnamese stopwords excluded when matching location keywords to segments
VN_STOPWORDS = {
    "cua", "va", "la", "o", "tai", "trong", "ngoai", "tren", "duoi", "voi", "cho",
    "mot", "hai", "ba", "bon", "nam", "sau", "bay", "tam", "chin", "muoi", "cac",
    "nhung", "nay", "kia", "do", "day", "khi", "noi", "co", "duoc", "bi", "thanh",
    "nhu", "cao", "to", "nho", "lon", "dai", "rong", "khong", "the", "bo", "boi",
    "canh", "goc", "khung", "ngang", "nguoi", "that", "san", "phong", "lop", "tang",
    "mat", "chiec", "cai", "con", "tam", "bien", "duong", "mau", "xanh", "do", "vang",
    "trang", "den", "tu", "den", "ra", "vao", "len", "xuong", "ve", "sau", "truoc",
    "giua", "ben", "canh", "phia", "theo", "bang", "lam", "het", "roi", "van", "da",
    "dang", "se", "nhieu", "it", "rat", "qua", "hon", "nhat", "that", "tuoi", "cu",
    "moi", "am", "ap", "lanh", "toi", "sang", "dem", "chieu", "trua", "hom", "nay",
    "riso", "ink", "pass", "1920", "1080", "3cm", "centimet",
}

CREATURE_HINT_RE = re.compile(
    r"(?i)(multi-pose|creature|boss|quái\s+thú|quái\s+vật|bọ\s+cánh\s+cam|mèo|kiến|chó|chim|nhện|chuột|rồng|robot|xe\s+buýt|ô\s*tô|tàu)",
    re.UNICODE,
)

# Physical room / environment landmark catalog (VN + EN) for deterministic spatial continuity anchors
LANDMARK_CATALOG: list[tuple[str, list[str]]] = [
    ("mayThuPhong", [r"máy\s+thu\s+phóng", r"máy\s+phóng\s+đại", r"shrink\s+machine", r"cỗ\s+máy"]),
    ("nutDaoNguoc", [r"nút\s+đảo\s+ngược", r"nút\s+bấm", r"\breverse\s+button\b"]),
    ("dongHoDemNguoc", [r"đồng\s+hồ\s+đếm\s+ngược", r"đồng\s+hồ", r"\bcountdown\s+clock\b", r"\bclock\b"]),
    ("bangNoiQuy", [r"bảng\s+nội\s+quy", r"nội\s+quy", r"\brules?\s+board\b"]),
    ("bangXanh", [r"bảng\s+xanh", r"bảng\s+đen", r"bảng\s+phấn", r"\bchalkboard\b", r"\bblackboard\b"]),
    ("bienBaoLop", [r"tấm\s+biển\s+lớp", r"biển\s+lớp", r"biển\s+phòng", r"\broom\s+sign\b"]),
    ("bienBao", [r"biển\s+báo", r"biển\s+hiệu", r"tấm\s+biển", r"\bsignboard\b", r"\bposter\b"]),
    ("ongNghiem", [r"ống\s+nghiệm", r"giá\s+ống\s+nghiệm", r"\btest\s+tubes?\b", r"\bbeaker\b"]),
    ("matBanGo", [r"mặt\s+bàn\s+gỗ", r"bàn\s+gỗ", r"bàn\s+thí\s+nghiệm", r"mặt\s+bàn", r"\blab\s+table\b", r"\bwooden\s+desk\b"]),
    ("butChiGo", [r"bút\s+chì\s+gỗ", r"chiếc\s+bút\s+chì", r"bút\s+chì", r"\bpencil\b"]),
    ("voOLi", [r"vở\s+ô\s*li", r"quyển\s+vở", r"\bnotebook\b"]),
    ("bangDinh", [r"băng\s+dính", r"dải\s+băng\s+dính", r"\bsticky\s+tape\b", r"\btape\b"]),
    ("rungCo", [r"rừng\s+cỏ", r"bãi\s+cỏ", r"thảm\s+cỏ", r"\bgrass\b", r"\blawn\b"]),
    ("capSach", [r"cặp\s+sách", r"ba\s*lô", r"\bbackpack\b", r"\bschoolbag\b"]),
    ("thuocGo", [r"thước\s+kẻ\s+gỗ", r"thước\s+gỗ", r"thước\s+kẻ", r"\bruler\b"]),
    ("hopBut", [r"hộp\s+bút", r"\bpencil\s+case\b"]),
    ("vachPhanTrang", [r"đường\s+phấn\s+trắng", r"vạch\s+phấn", r"phấn\s+trắng", r"\bchalk\s+line\b"]),
    ("hopPhan", [r"hộp\s+phấn", r"\bchalk\s+box\b"]),
    ("tuongGach", [r"tường\s+gạch", r"gạch\s+lát", r"mảng\s+tường", r"\bbrick\s+wall\b", r"\btiled\s+floor\b"]),
    ("cuaSo", [r"cửa\s+sổ\s+bậu\s+gỗ", r"bậu\s+cửa\s+sổ", r"cửa\s+sổ", r"\bwindow\b"]),
    ("tuCatMay", [r"tủ\s+cất\s+máy", r"tủ\s+thí\s+nghiệm", r"tủ\s+kính", r"tủ\s+gỗ", r"\bcabinet\b", r"\bglass\s+case\b"]),
    ("quatTran", [r"quạt\s+trần", r"quạt\s+gió", r"gió\s+quạt", r"\bceiling\s+fan\b", r"\bfan\b"]),
    ("hanhLang", [r"hành\s+lang", r"cột\s+hành\s+lang", r"\bcorridor\b", r"\bhallway\b"]),
    ("cauThang", [r"cầu\s+thang", r"bậc\s+thang", r"\bstaircase\b", r"\bstairs\b"]),
    ("lanCan", [r"lan\s+can", r"tay\s+vịn", r"\brailing\b", r"\bbalcony\b"]),
    ("ongThoatNuoc", [r"ống\s+thoát\s+nước", r"đường\s+ống", r"\bdrain\s+pipe\b", r"\bpipe\b"]),
    ("banGhe", [r"bàn\s+ghế", r"dãy\s+bàn", r"ghế\s+gỗ", r"\bdesks?\b", r"\bchairs?\b"]),
    ("cuaRaVao", [r"cửa\s+phòng", r"cửa\s+lớp", r"cánh\s+cửa", r"khung\s+cửa", r"\bdoorway\b", r"\bdoor\b"]),
    ("denTran", [r"đèn\s+xanh", r"đèn\s+đỏ", r"đèn\s+trần", r"đèn\s+huỳnh\s+quang", r"nắng\s+chiều", r"\blamp\b", r"\blight\b"]),
    ("keSach", [r"kệ\s+sách", r"giá\s+sách", r"tủ\s+sách", r"\bbookshelf\b", r"\bshelf\b"]),
    ("congTruong", [r"cổng\s+trường", r"sân\s+trường", r"\bschool\s+gate\b", r"\bcourtyard\b"]),
    ("tanCay", [r"cây\s+phượng", r"tán\s+cây", r"gốc\s+cây", r"\btree\b"]),
    ("quayHang", [r"quầy\s+hàng", r"sạp\s+hàng", r"quầy\s+bếp", r"\bcounter\b", r"\bstall\b"]),
    ("cotDen", [r"cột\s+đèn", r"đèn\s+đường", r"\bstreetlight\b"]),
]


# ---------------------------------------------------------------------------
# Text & identifier utilities
# ---------------------------------------------------------------------------

def strip_accents(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    nfd = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")


def to_camel(text: str, fallback: str = "item") -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", " ", strip_accents(text)).strip()
    parts = [p for p in cleaned.split() if p]
    if not parts:
        return fallback
    head = parts[0].lower()
    tail = "".join(p[:1].upper() + p[1:].lower() for p in parts[1:])
    ident = head + tail
    if ident and ident[0].isdigit():
        ident = "x" + ident
    return ident


def to_snake(text: str, fallback: str = "part") -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", strip_accents(text)).strip("_").lower()
    return cleaned or fallback


def extract_md_section(md_text: str, section_names: tuple[str, ...]) -> str:
    if not md_text:
        return ""
    lines = md_text.splitlines()
    collecting = False
    out: list[str] = []
    wanted = {n.lower() for n in section_names}
    for line in lines:
        m = re.match(r"^\s*##\s+(.+?)\s*$", line)
        if m:
            heading = m.group(1).strip().lower()
            if collecting:
                break
            if any(heading == w or heading.startswith(w + " ") for w in wanted):
                collecting = True
                continue
        elif collecting:
            out.append(line)
    return "\n".join(out).strip()


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"[.!?\n]+", text) if s.strip()]


# ---------------------------------------------------------------------------
# Parsing brief.md & beats.md
# ---------------------------------------------------------------------------

def parse_beats_map(beats_text: str) -> dict[str, dict[str, str]]:
    """Parse `## Segment map` markdown table from beats.md."""
    seg_map: dict[str, dict[str, str]] = {}
    if not beats_text:
        return seg_map
    for line in beats_text.splitlines():
        m = re.match(r"^\s*\|\s*(s\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|", line)
        if m:
            sid, beat, visual = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
            seg_map[sid] = {"beat": beat, "visual": visual}
    return seg_map


def parse_characters_from_brief(brief_text: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (human_cast, brief_creatures) extracted from brief.md ## Characters."""
    sec = extract_md_section(brief_text, ("characters", "nhân vật", "cast"))
    if not sec:
        return [], []
    humans: list[dict[str, Any]] = []
    creatures: list[dict[str, Any]] = []
    for raw_line in sec.splitlines():
        line = raw_line.strip()
        if not re.match(r"^([-*]|\d+\.)\s+", line):
            continue
        body = re.sub(r"^([-*]|\d+\.)\s+", "", line).strip()
        # Match **Header**: description  OR  **Header:** description
        m = re.match(r"^\*\*(.+?)\*\*\s*:?\s*(.*)$", body)
        if m:
            header = m.group(1).strip().rstrip(":")
            desc = m.group(2).strip().lstrip(":").strip()
        elif ":" in body:
            header, desc = [x.strip() for x in body.split(":", 1)]
        else:
            header, desc = body, ""

        # Extract optional explicit backtick id e.g. Nhím (`nhim`)
        bt = re.search(r"`([A-Za-z_][A-Za-z0-9_-]*)`", header)
        explicit_id = bt.group(1) if bt else None

        # Extract quoted aliases e.g. ("Cánh Cứng")
        quoted_aliases = re.findall(r'["“]([^"”]{2,30})["”]', header)

        # Clean display name (before first parenthesis)
        name = re.sub(r"\s*\(.*?\)", "", header).strip().strip("`")
        if not name:
            continue
        paren = ""
        pm = re.search(r"\((.*?)\)", header)
        if pm:
            paren = pm.group(1).strip()

        cid = explicit_id or to_camel(name, fallback="char")
        combined = f"{header} {desc}"

        if CREATURE_HINT_RE.search(header) or re.search(r"(?i)multi-pose\s+creature", combined):
            creatures.append({
                "id": cid,
                "name": name,
                "aliases": quoted_aliases,
                "meta": paren,
                "description": desc,
            })
            continue

        # Role classification
        low = combined.lower()
        if any(tok in low for tok in ("principal", "nhân vật chính", "foil", "ngôi thứ nhất", "tôi,")):
            role = "principal"
        elif any(tok in low for tok in ("extra", "quần chúng", "nền")):
            role = "extra"
        else:
            role = "support"

        humans.append({
            "id": cid,
            "name": name,
            "role": role,
            "source": "brief.md",
            "meta": paren,
            "description": desc,
            "aliases": [a for a in quoted_aliases if a.lower() != "tôi"],
        })
    return humans, creatures


def parse_locations_from_brief(brief_text: str) -> list[dict[str, Any]]:
    """Extract primary locations from brief.md ## Locations."""
    sec = extract_md_section(brief_text, ("locations", "bối cảnh", "sets"))
    if not sec:
        return []
    locs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw_line in sec.splitlines():
        line = raw_line.strip()
        if not re.match(r"^([-*]|\d+\.)\s+", line):
            continue
        body = re.sub(r"^([-*]|\d+\.)\s+", "", line).strip()
        # Case 1: `phongThiNghiem`: description
        m1 = re.match(r"^`([A-Za-z_][A-Za-z0-9_-]*)`\s*[:\-–—]\s*(.*)$", body)
        # Case 2: **Xưởng đèn ông Sáu (`xuongDen`)**: description
        m2 = re.match(r"^\*\*(.+?)\*\*\s*:?\s*(.*)$", body)
        if m1:
            loc_id = m1.group(1).strip()
            desc = m1.group(2).strip()
            title = desc.split(",")[0].split("(")[0].strip() or loc_id
        elif m2:
            header = m2.group(1).strip().rstrip(":")
            desc = m2.group(2).strip().lstrip(":").strip()
            bt = re.search(r"`([A-Za-z_][A-Za-z0-9_-]*)`", header)
            title = re.sub(r"\s*\(.*?\)", "", header).strip().strip("`")
            loc_id = bt.group(1) if bt else to_camel(title, fallback=f"loc{len(locs)+1}")
        elif ":" in body:
            title, desc = [x.strip() for x in body.split(":", 1)]
            loc_id = to_camel(title, fallback=f"loc{len(locs)+1}")
        else:
            continue

        if loc_id in seen:
            continue
        seen.add(loc_id)
        locs.append({
            "id": loc_id,
            "title": title[:80],
            "description": desc,
            "source": "brief.md",
        })
    return locs


# ---------------------------------------------------------------------------
# Character enrichment from script.json
# ---------------------------------------------------------------------------

def enrich_characters(
    brief_cast: list[dict[str, Any]],
    segments: list[dict[str, Any]],
    targets: dict[str, Any],
    brief_text: str,
) -> dict[str, Any]:
    by_id: dict[str, dict[str, Any]] = {}
    ordered_ids: list[str] = []

    for c in brief_cast:
        entry = dict(c)
        entry["segments"] = []
        entry["segment_count"] = 0
        by_id[entry["id"]] = entry
        ordered_ids.append(entry["id"])

    # Speakers explicitly declared on segments
    for seg in segments:
        sid = seg.get("id", "")
        spk = seg.get("speaker")
        if isinstance(spk, str) and spk.strip():
            spk_clean = spk.strip()
            if spk_clean.lower() not in ("narrator", "vo", "voiceover", "kể", "người kể"):
                cid = to_camel(spk_clean)
                if cid not in by_id:
                    by_id[cid] = {
                        "id": cid,
                        "name": spk_clean,
                        "role": "support",
                        "source": "script.json:speaker",
                        "meta": "",
                        "description": "",
                        "aliases": [],
                        "segments": [],
                        "segment_count": 0,
                    }
                    ordered_ids.append(cid)
                if sid and sid not in by_id[cid]["segments"]:
                    by_id[cid]["segments"].append(sid)

    # Fallback honorific character detection when brief.md has no characters
    if not ordered_ids:
        hon_counts: dict[str, list[str]] = {}
        hon_pat = re.compile(r"\b((?:Thầy|Cô|Ông|Bà|Chú|Bác|Bé|Anh|Chị)\s+[A-ZĐÀ-Ỹ][a-zà-ỹ]+)\b", re.UNICODE)
        for seg in segments:
            sid = seg.get("id", "")
            text = seg.get("text", "")
            for m in hon_pat.finditer(text):
                nm = m.group(1)
                hon_counts.setdefault(nm, [])
                if sid not in hon_counts[nm]:
                    hon_counts[nm].append(sid)
        for nm, sids in sorted(hon_counts.items(), key=lambda kv: -len(kv[1])):
            if len(sids) >= 2:
                cid = to_camel(nm)
                if cid not in by_id:
                    by_id[cid] = {
                        "id": cid,
                        "name": nm,
                        "role": "principal" if len(sids) >= 5 else "support",
                        "source": "script.json:mention",
                        "meta": "",
                        "description": "",
                        "aliases": [],
                        "segments": list(sids),
                        "segment_count": len(sids),
                    }
                    ordered_ids.append(cid)

    # Count text mentions for every known character
    for cid in ordered_ids:
        c = by_id[cid]
        terms = [c["name"]] + list(c.get("aliases") or [])
        meta_desc_low = f"{c.get('meta', '')} {c.get('description', '')}".lower()
        if re.search(r'(?:^|[\s(,„"“])tôi(?:[\s),."”]|$)|ngôi\s+thứ\s+nhất', meta_desc_low, re.UNICODE):
            terms.append("tôi")
        pats = [re.compile(r"(?i)(?:^|[^\w])" + re.escape(t) + r"(?:[^\w]|$)", re.UNICODE) for t in terms if len(t) >= 2]
        for seg in segments:
            sid = seg.get("id", "")
            txt = seg.get("text", "")
            if any(p.search(txt) for p in pats):
                if sid not in c["segments"]:
                    c["segments"].append(sid)
        c["segment_count"] = len(c["segments"])

    extracted_cast = [by_id[cid] for cid in ordered_ids]

    # Suggest additional extra cast slots if below min_cast target
    min_cast = targets["min_cast"]
    gap = max(0, min_cast - len(extracted_cast))
    is_school = bool(re.search(r"(?i)(lớp|trường|học sinh|thầy|cô giáo|sân trường)", brief_text + " " + " ".join(s.get("text", "") for s in segments[:15])))
    suggested_extras: list[dict[str, Any]] = []
    extra_traits = [
        ("glasses + backpack", "bạn học đeo kính vuông, tóc ngắn"),
        ("cap + stripes", "bạn học đội mũ lưỡi trai, áo kẻ sọc"),
        ("pigtails + cardigan", "bạn nữ buộc tóc hai bên, áo khoác mỏng"),
        ("tall + sports vest", "bạn nam cao gầy, áo thể dục có sọc"),
        ("curly hair + scarf", "bạn học tóc xoăn, khăn quàng chỉnh tề"),
        ("apron + bun", "nhân viên/phụ huynh tóc búi, tạp dề"),
        ("hat + mustache", "bác bảo vệ/người qua đường đội mũ, ria mép"),
        ("vest + satchel", "bạn học đeo cặp chéo, áo gile"),
    ]
    for idx in range(gap):
        trait_en, trait_vn = extra_traits[idx % len(extra_traits)]
        if is_school and idx < 6:
            eid = f"banLop{idx + 1}"
            ename = f"Bạn lớp 5A #{idx + 1}"
            desc = f"Học sinh nền ({trait_vn}; {trait_en}) — giữ tỷ lệ đa dạng quần chúng"
        else:
            eid = f"quanChung{idx + 1}"
            ename = f"Quần chúng #{idx + 1}"
            desc = f"Nhân vật nền ({trait_vn}; {trait_en}) — tạo chiều sâu khung hình"
        suggested_extras.append({
            "id": eid,
            "name": ename,
            "role": "extra",
            "source": "auto_gap_fill",
            "meta": trait_en,
            "description": desc,
            "aliases": [],
            "segments": [],
            "segment_count": 0,
        })

    return {
        "target_min_cast": min_cast,
        "extracted_count": len(extracted_cast),
        "suggested_extra_count": len(suggested_extras),
        "planned_total": len(extracted_cast) + len(suggested_extras),
        "extracted": extracted_cast,
        "suggested_extras": suggested_extras,
    }


# ---------------------------------------------------------------------------
# Hero Subjects / Creatures / Vehicles detection
# ---------------------------------------------------------------------------

def detect_subjects(
    segments: list[dict[str, Any]],
    brief_creatures: list[dict[str, Any]],
    brief_text: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Scan all script.json segments for recurring creatures/vehicles/machines.

    Any subject appearing in >= 3 segments is promoted to required_subjects.
    Returns (required_subjects, minor_subjects).
    """
    full_corpus = brief_text + "\n" + "\n".join(s.get("text", "") for s in segments)

    # First pass: check which catalog entries have primary hits so we know suppressions
    primary_hits: dict[str, set[str]] = {}
    compiled_primary: dict[str, list[re.Pattern[str]]] = {}
    compiled_secondary: dict[str, list[re.Pattern[str]]] = {}

    # Enrich catalog patterns/names using brief_creatures when they match
    enriched_entries: list[dict[str, Any]] = []
    matched_brief_indices: set[int] = set()

    for item in SUBJECT_CATALOG:
        entry = dict(item)
        entry["patterns"] = list(item["patterns"])
        entry["secondary_if_present"] = list(item.get("secondary_if_present") or [])
        entry["brief_desc"] = ""
        entry["brief_aliases"] = []

        for idx, bc in enumerate(brief_creatures):
            if idx in matched_brief_indices:
                continue
            # Match ONLY name + aliases (never description, so similes like "to bằng xe buýt" don't hijack other catalog entries)
            bc_header = f"{bc['name']} {' '.join(bc.get('aliases') or [])}"
            if any(re.search(p, bc_header, re.IGNORECASE | re.UNICODE) for p in entry["patterns"]):
                matched_brief_indices.add(idx)
                entry["default_id"] = bc["id"]
                entry["default_name"] = bc["name"]
                entry["brief_desc"] = bc.get("description", "")
                for al in bc.get("aliases") or []:
                    entry["brief_aliases"].append(al)
                    al_pat = re.escape(al)
                    if al_pat not in entry["patterns"]:
                        entry["patterns"].append(al_pat)
                break

        # Also refine canonical name from brief.md (e.g., "Mèo Mướp", "Mèo Đen", "Máy Thu Phóng")
        if entry["key"] == "cat" and not entry["brief_desc"]:
            if re.search(r"(?i)mèo\s+mướp", full_corpus):
                entry["default_id"] = "meoMuop"
                entry["default_name"] = "Mèo Mướp"
            elif re.search(r"(?i)mèo\s+đen", full_corpus):
                entry["default_id"] = "meoDen"
                entry["default_name"] = "Mèo Đen"
        if entry["key"] == "shrink_machine":
            if re.search(r"(?i)máy\s+thu\s+phóng", full_corpus):
                entry["default_id"] = "mayThuPhong"
                entry["default_name"] = "Máy Thu Phóng"
            elif re.search(r"(?i)máy\s+phóng\s+đại", full_corpus):
                entry["default_id"] = "mayPhongDai"
                entry["default_name"] = "Máy Phóng Đại"

        compiled_primary[entry["key"]] = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in entry["patterns"]]
        compiled_secondary[entry["key"]] = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in entry["secondary_if_present"]]
        enriched_entries.append(entry)

    # Any unmatched brief_creature becomes a custom catalog entry
    for idx, bc in enumerate(brief_creatures):
        if idx in matched_brief_indices:
            continue
        pats = [re.escape(bc["name"])] + [re.escape(a) for a in (bc.get("aliases") or [])]
        key = f"brief_{bc['id']}"
        entry = {
            "key": key,
            "default_id": bc["id"],
            "default_name": bc["name"],
            "kind": "creature",
            "patterns": pats,
            "secondary_if_present": [],
            "poses": ["idle", "move", "action", "react"],
            "exprs": ["calm", "alert", "fierce", "curious"],
            "relToActor": [1.0, 2.0],
            "brief_desc": bc.get("description", ""),
            "brief_aliases": list(bc.get("aliases") or []),
        }
        compiled_primary[key] = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in pats]
        compiled_secondary[key] = []
        enriched_entries.append(entry)

    # Pass 1: primary matches across segments + brief
    suppressed: set[str] = set()
    for entry in enriched_entries:
        key = entry["key"]
        hits: set[str] = set()
        for seg in segments:
            txt = seg.get("text", "")
            if any(p.search(txt) for p in compiled_primary[key]):
                hits.add(seg.get("id", ""))
        primary_hits[key] = hits
        has_brief_hit = any(p.search(brief_text) for p in compiled_primary[key]) if brief_text else False
        if hits or has_brief_hit:
            for sup in entry.get("suppresses") or []:
                suppressed.add(sup)

    # Pass 2: collect full segment hits (including secondary aliases when primary is active) + local ride/fly co-occurrence
    required: list[dict[str, Any]] = []
    minor: list[dict[str, Any]] = []

    for entry in enriched_entries:
        key = entry["key"]
        if key in suppressed:
            continue
        active_pats = list(compiled_primary[key])
        if primary_hits[key] or (brief_text and any(p.search(brief_text) for p in compiled_primary[key])):
            active_pats.extend(compiled_secondary[key])

        seg_ids: list[str] = []
        ride_evidence: list[str] = []
        seen_ride_segs: set[str] = set()

        for seg in segments:
            sid = seg.get("id", "")
            txt = seg.get("text", "")
            matched_here = False
            for sent in split_sentences(txt):
                for pat in active_pats:
                    for m in pat.finditer(sent):
                        matched_here = True
                        # Tight local proximity window ([-28, +40] chars inside same sentence) for ride/fly verbs
                        lo = max(0, m.start() - 28)
                        hi = min(len(sent), m.end() + 40)
                        window = sent[lo:hi]
                        rm = RIDE_FLY_RE.search(window)
                        if rm and sid not in seen_ride_segs:
                            seen_ride_segs.add(sid)
                            ride_evidence.append(f"{sid}:{rm.group(1).strip()}")
            if matched_here and sid not in seg_ids:
                seg_ids.append(sid)

        if not seg_ids:
            continue

        # Check brief description for explicit mount/ride cues as well
        if entry.get("brief_desc") and RIDE_FLY_RE.search(entry["brief_desc"]):
            if not any(r.startswith("brief:") for r in ride_evidence):
                rm = RIDE_FLY_RE.search(entry["brief_desc"])
                if rm:
                    ride_evidence.append(f"brief:{rm.group(1).strip()}")

        # Only promote seats for rideable/flyable creatures or vehicles (not stationary machines unless explicitly ridden)
        requires_seats = bool(ride_evidence) and entry["kind"] in ("creature", "boss", "vehicle")

        subj_obj: dict[str, Any] = {
            "id": entry["default_id"],
            "name": entry["default_name"],
            "kind": entry["kind"],
            "segment_count": len(seg_ids),
            "segments": seg_ids,
            "target_file": "src/episode/subjects.tsx",
            "min_poses": 4,
            "suggested_poses": list(entry["poses"]),
            "suggested_exprs": list(entry["exprs"]),
            "relToActor": list(entry["relToActor"]),
            "requires_seats": requires_seats,
            "ride_fly_evidence": ride_evidence,
        }
        if requires_seats:
            subj_obj["suggested_seats"] = {
                entry["poses"][-1]: [
                    {"id": "rider1", "dx": -36, "dy": -120},
                    {"id": "rider2", "dx": 36, "dy": -120},
                ],
                entry["poses"][-2]: [
                    {"id": "rider1", "dx": 0, "dy": -115},
                ],
            }
        subj_obj["lint_requirements"] = [
            "PR-06: >= 4 distinct poses + relToActor [minR, maxR] + title",
            "CH-10: add // lint-ok: CH-10 comment and verify next to cast_episode_p1 in gates/G4.review.md",
        ]

        if len(seg_ids) >= 3:
            required.append(subj_obj)
        else:
            minor.append(subj_obj)

    required.sort(key=lambda x: (-x["segment_count"], x["id"]))
    minor.sort(key=lambda x: (-x["segment_count"], x["id"]))
    return required, minor


# ---------------------------------------------------------------------------
# Location mapping & Sub-Scene Matrix Expansion
# ---------------------------------------------------------------------------

def extract_locations(
    script_data: dict[str, Any],
    brief_text: str,
    beats_map: dict[str, dict[str, str]],
    is_long_16x9: bool,
) -> list[dict[str, Any]]:
    locs = parse_locations_from_brief(brief_text)
    seen = {loc["id"] for loc in locs}

    # Also collect explicit locations / chapters from script.json if present
    for ch in script_data.get("chapters") or []:
        if isinstance(ch, dict):
            loc_raw = ch.get("location") or ch.get("set") or ch.get("title")
            if isinstance(loc_raw, str) and loc_raw.strip():
                lid = to_camel(loc_raw)
                if lid not in seen:
                    seen.add(lid)
                    locs.append({
                        "id": lid,
                        "title": loc_raw.strip(),
                        "description": ch.get("summary", ""),
                        "source": "script.json:chapters",
                    })

    for seg in script_data.get("segments") or []:
        loc_raw = seg.get("location") or seg.get("set")
        if isinstance(loc_raw, str) and loc_raw.strip():
            lid = loc_raw.strip() if re.match(r"^[A-Za-z_][A-Za-z0-9_-]*$", loc_raw.strip()) else to_camel(loc_raw)
            if lid not in seen:
                seen.add(lid)
                locs.append({
                    "id": lid,
                    "title": loc_raw.strip(),
                    "description": "",
                    "source": "script.json:segments",
                })

    # Fallback if neither brief.md nor script.json declared locations
    if not locs:
        count = 5 if is_long_16x9 else 3
        for i in range(count):
            locs.append({
                "id": f"location{i + 1}",
                "title": f"Location {i + 1}",
                "description": "Auto-generated location placeholder (no brief.md ## Locations found)",
                "source": "auto_fallback",
            })

    # Build keyword tokens per location to map segments to locations
    segments = script_data.get("segments") or []
    loc_keywords: dict[str, set[str]] = {}
    for loc in locs:
        # Split camelCase id into words too
        camel_words = re.sub(r"([a-z])([A-Z])", r"\1 \2", loc["id"])
        raw = f"{camel_words} {loc['title']} {loc['description']}"
        folded = strip_accents(raw).lower()
        tokens = [t for t in re.findall(r"[a-z0-9]{2,}", folded) if t not in VN_STOPWORDS]
        # Build bigrams for stronger precision (e.g. "hem nui", "cap sach", "hanh lang", "mat ban", "san truong")
        bigrams = {f"{tokens[i]} {tokens[i + 1]}" for i in range(len(tokens) - 1)}
        loc_keywords[loc["id"]] = set(tokens) | bigrams

    seg_loc_assign: list[str] = []
    last_loc = locs[0]["id"]
    for idx, seg in enumerate(segments):
        sid = seg.get("id", f"s{idx + 1}")
        explicit = seg.get("location") or seg.get("set")
        if isinstance(explicit, str) and explicit.strip() in seen:
            chosen = explicit.strip()
            seg_loc_assign.append(chosen)
            last_loc = chosen
            continue

        visual = beats_map.get(sid, {}).get("visual", "")
        combined_raw = f"{seg.get('text', '')} {visual}"
        # Direct backtick ID hit in beats.md visual column has highest priority
        direct = None
        for loc in locs:
            if f"`{loc['id']}`" in visual or loc["id"] in visual:
                direct = loc["id"]
                break
        if direct:
            seg_loc_assign.append(direct)
            last_loc = direct
            continue

        folded = strip_accents(combined_raw).lower()
        best_loc = None
        best_score = 0
        for loc in locs:
            score = 0
            for kw in loc_keywords[loc["id"]]:
                if " " in kw:
                    if kw in folded:
                        score += 4
                elif re.search(r"\b" + re.escape(kw) + r"\b", folded):
                    score += 1
            if score > best_score:
                best_score = score
                best_loc = loc["id"]

        chosen = best_loc if (best_loc and best_score >= 2) else last_loc
        seg_loc_assign.append(chosen)
        last_loc = chosen

    # Attach segment counts, segment IDs & shared spatial landmarks to each location
    for loc in locs:
        loc["segments"] = [
            segments[i].get("id", f"s{i + 1}")
            for i, lid in enumerate(seg_loc_assign)
            if lid == loc["id"]
        ]
        loc["segment_count"] = len(loc["segments"])
        loc["shared_landmarks"] = extract_location_landmarks(loc, segments, beats_map)

    return locs


def extract_location_landmarks(
    loc: dict[str, Any],
    segments: list[dict[str, Any]],
    beats_map: dict[str, dict[str, str]],
) -> list[str]:
    """Deterministically extract 4-6 physical room/environment anchor IDs for spatial continuity.

    Always returns at least 3 sensible fallback anchors when brief text is sparse.
    """
    loc_id = str(loc.get("id") or "loc")
    loc_id_low = loc_id.lower()
    title_desc = f"{loc.get('title', '')}. {loc.get('description', '')}"

    # Gather segment + visual notes text belonging to this location
    seg_by_id = {str(s.get("id", "")): s for s in segments}
    seg_texts: list[str] = []
    for sid in loc.get("segments") or []:
        seg = seg_by_id.get(sid)
        if seg:
            seg_texts.append(str(seg.get("text", "")))
        vis = beats_map.get(sid, {}).get("visual", "")
        if vis:
            seg_texts.append(vis)
    seg_corpus = "\n".join(seg_texts)

    landmarks: list[str] = []
    seen_low: set[str] = {loc_id_low}

    def add_lm(candidate: str) -> None:
        cand = candidate.strip()
        if not cand or len(cand) < 3 or len(cand) > 32:
            return
        low = cand.lower()
        if low in seen_low:
            return
        if low == "bienbao" and "bienbaolop" in seen_low:
            return
        seen_low.add(low)
        landmarks.append(cand)

    # Pass 1: Physical fixture / architectural catalog matches in location title+description (highest specificity)
    for anchor_id, pats in LANDMARK_CATALOG:
        if any(re.search(p, title_desc, re.IGNORECASE | re.UNICODE) for p in pats):
            add_lm(anchor_id)
            if len(landmarks) >= 6:
                return landmarks[:6]

    # Pass 2: Bolded fixtures/props in location description (e.g. **Máy Thu Phóng**, **ĐẢO NGƯỢC**)
    for bm in re.finditer(r"\*\*([^*]{2,36})\*\*", str(loc.get("description", ""))):
        phrase = bm.group(1).strip()
        words = [w for w in re.split(r"\s+", phrase) if w]
        if 1 <= len(words) <= 4:
            cid = to_camel(phrase, fallback="")
            if cid and not any(cid.lower() in existing.lower() or existing.lower() in cid.lower() for existing in landmarks):
                add_lm(cid)
                if len(landmarks) >= 6:
                    return landmarks[:6]

    # Pass 3: Physical fixture catalog matches in this location's segments & beats visual notes
    if len(landmarks) < 5 and seg_corpus:
        for anchor_id, pats in LANDMARK_CATALOG:
            if any(re.search(p, seg_corpus, re.IGNORECASE | re.UNICODE) for p in pats):
                add_lm(anchor_id)
                if len(landmarks) >= 6:
                    return landmarks[:6]

    # Pass 4: Concise physical noun phrases from comma-separated clauses in description
    if len(landmarks) < 4 and loc.get("description"):
        desc_clean = re.sub(r"\([^)]*\)|`[^`]*`|\*\"[^\"]*\"\*|\"[^\"]*\"", " ", str(loc["description"]))
        clauses = re.split(r"[,;]+|\bvà\b", desc_clean)
        for cl in clauses:
            folded = strip_accents(cl).lower()
            words = [w for w in re.findall(r"[a-z]{2,}", folded) if w not in VN_STOPWORDS]
            if 2 <= len(words) <= 3:
                cid = to_camel(" ".join(words), fallback="")
                if cid and len(cid) >= 5:
                    add_lm(cid)
                    if len(landmarks) >= 4:
                        break

    # Pass 5: Deterministic fallbacks (always >= 3 anchors even on sparse briefs)
    fallbacks = [
        f"{loc_id}MainFixture",
        f"{loc_id}WallSign",
        f"{loc_id}LightSource",
        f"{loc_id}FloorAnchor",
    ]
    for fb in fallbacks:
        if len(landmarks) >= 3:
            break
        add_lm(fb)

    return landmarks[:6]


def _select_plate_landmarks(
    shared_landmarks: list[str],
    camera_dir: str,
    plate_idx: int = 0,
) -> list[str]:
    """Pick 2-4 shared room landmarks for a sub-scene plate, always overlapping the primary anchor."""
    if not shared_landmarks:
        return []
    n = len(shared_landmarks)
    if n <= 2:
        return list(shared_landmarks)

    if camera_dir == "front":
        picked = shared_landmarks[:4]
    elif camera_dir == "reverse":
        picked = [shared_landmarks[0]] + shared_landmarks[1:3]
        if n >= 4:
            picked.append(shared_landmarks[-1])
    elif camera_dir in ("left", "right"):
        picked = [shared_landmarks[0], shared_landmarks[1]]
        if n >= 3:
            picked.append(shared_landmarks[2 if camera_dir == "left" else min(n - 1, 3)])
    elif camera_dir in ("low", "top"):
        picked = [shared_landmarks[0]] + shared_landmarks[1:min(n, 4)]
    else:  # detail
        picked = shared_landmarks[:2]
        if n >= 4 and plate_idx % 2 == 1:
            picked.append(shared_landmarks[2])

    # Deduplicate preserving order, guarantee 2..4 items
    out: list[str] = []
    for lm in picked:
        if lm not in out:
            out.append(lm)
    for lm in shared_landmarks:
        if len(out) >= 2:
            break
        if lm not in out:
            out.append(lm)
    return out[:4]


def expand_subscene_matrix(
    locations: list[dict[str, Any]],
    targets: dict[str, Any],
) -> list[dict[str, Any]]:
    """Expand primary locations into a Spatial Location-Pack Sub-Scene Matrix (RSI v5.4.0)."""
    is_16x9 = targets["format"] == "16:9"
    scale_map = ACTOR_SCALE_16X9 if is_16x9 else ACTOR_SCALE_9X16
    min_sets = targets["min_sets"]
    target_sets = targets.get("target_sets", min_sets)
    min_angles = targets["min_angles"]
    min_multi_locs = targets["min_locations_with_subscenes"]

    matrix: list[dict[str, Any]] = []
    used_ids: set[str] = set()
    loc_scales: dict[str, set[str]] = {loc["id"]: set() for loc in locations}
    loc_combos: dict[str, set[tuple[str, str, str]]] = {loc["id"]: set() for loc in locations}
    loc_plate_counts: dict[str, int] = {loc["id"]: 0 for loc in locations}
    used_angles: set[str] = set()
    loc_order = {loc["id"]: idx for idx, loc in enumerate(locations)}

    def add_plate(
        loc: dict[str, Any],
        suffix: str,
        shot_scale: str,
        angle: str,
        camera_dir: str,
        purpose: str,
    ) -> None:
        if camera_dir not in VALID_CAMERA_DIRS:
            raise ValueError(f"Invalid cameraDir: {camera_dir}")
        base = loc["id"]
        set_id = base if not suffix else f"{base}{suffix}"
        n = 2
        while set_id in used_ids:
            set_id = f"{base}{suffix}{n}"
            n += 1
        used_ids.add(set_id)
        loc_scales[base].add(shot_scale)
        loc_combos[base].add((angle, shot_scale, camera_dir))
        p_idx = loc_plate_counts[base]
        loc_plate_counts[base] = p_idx + 1
        used_angles.add(angle)
        shared_lm = list(loc.get("shared_landmarks") or [])
        matrix.append({
            "id": set_id,
            "location": base,
            "location_title": loc["title"],
            "shotScale": shot_scale,
            "angle": angle,
            "cameraDir": camera_dir,
            "landmarks": _select_plate_landmarks(shared_lm, camera_dir, p_idx),
            "actorScale": list(scale_map[shot_scale]),
            "purpose": purpose,
            "segment_count": loc["segment_count"],
            "_order": (loc_order.get(base, 999), p_idx),
        })

    # Priority order for extra plates: highest segment count first, preserving original order on ties
    priority_locs = sorted(
        enumerate(locations),
        key=lambda iv: (-iv[1]["segment_count"], iv[0]),
    )
    ordered_priority = [loc for _, loc in priority_locs]

    if is_16x9:
        # Spatial Location Pack (v5.4.0): 5 core redrawn plates for EVERY primary location
        # (Wide front + 180deg Reverse + Diagonal OTS left/right + Vertical Low or 3/4 High + Dedicated Closeup/POV)
        detail_specs = [
            ("Closeup", "closeup", "closeup", "detail", "Tight drawn close-up plate — hero reaction, hand-prop & landmark detail (SH-20, CA-07)"),
            ("Pov", "closeup", "pov", "detail", "First-person POV / hero-interaction insert plate (SH-20, CA-07)"),
        ]
        for idx, loc in enumerate(locations):
            # Plate 1: Master establishing front view
            add_plate(
                loc,
                suffix="Wide",
                shot_scale="establishing",
                angle="wide",
                camera_dir="front",
                purpose="Master establishing plate (front) — room geography, sightlines & main landmarks",
            )
            # Plate 2: 180-degree counter-angle redrawn looking back across the space
            add_plate(
                loc,
                suffix="Reverse",
                shot_scale="medium",
                angle="reverse",
                camera_dir="reverse",
                purpose="180-deg reverse counter-angle — redrawn opposite wall & dialogue/reaction sightline",
            )
            # Plate 3: Diagonal over-the-shoulder / side staging plate
            ots_dir = "left" if idx % 2 == 0 else "right"
            add_plate(
                loc,
                suffix="Ots",
                shot_scale="medium",
                angle="ots",
                camera_dir=ots_dir,
                purpose=f"Diagonal OTS / side staging plate ({ots_dir}) — two-shot foreground depth & landmarks",
            )
            # Plate 4: Vertical contrast — Low worm-eye or 3/4 elevated High overview (never flat 90deg 'top' per SE-18)
            if idx % 2 == 0:
                add_plate(
                    loc,
                    suffix="Low",
                    shot_scale="medium",
                    angle="low",
                    camera_dir="low",
                    purpose="Low worm-eye vertical contrast — redrawn from floor plane looking up at fixtures/threats",
                )
            else:
                high_dir = "front" if (idx // 2) % 2 == 0 else "right"
                add_plate(
                    loc,
                    suffix="High",
                    shot_scale="establishing",
                    angle="high",
                    camera_dir=high_dir,
                    purpose=f"3/4 elevated bird's-eye overview ({high_dir}) — 35-45 deg horizon perspective with visible wall/fixture height (SE-18)",
                )
            # Plate 5: Dedicated Closeup or POV plate in EVERY Location Pack (actorScale [0.95, 1.25] for SH-20 & CA-07)
            suf, sc, ang, cdir, purp = detail_specs[idx % len(detail_specs)]
            add_plate(loc, suffix=suf, shot_scale=sc, angle=ang, camera_dir=cdir, purpose=purp)

        # Safety fill for episodes with <= 4 primary locations so planned_sets always reaches target_sets (25)
        fill_specs = [
            ("PovDetail", "closeup", "pov", "detail", "Complementary POV hero-interaction insert plate (SH-20, CA-07)"),
            ("CloseupAlt", "closeup", "closeup", "detail", "Complementary tight reaction/prop close-up plate (SH-20, CA-07)"),
            ("HighAlt", "establishing", "high", "right", "Complementary 3/4 elevated bird's-eye overview (SE-18)"),
            ("LowAlt", "medium", "low", "low", "Complementary low worm-eye threat/scale plate"),
            ("OtsOpposite", "medium", "ots", "right", "Opposite diagonal side staging plate"),
            ("OtsLeft", "medium", "ots", "left", "Alternate left diagonal side staging plate"),
            ("HighFront", "establishing", "high", "front", "Complementary 3/4 elevated front bird's-eye overview (SE-18)"),
        ]
        f_idx = 0
        while len(matrix) < target_sets or len(used_angles) < min_angles:
            loc = ordered_priority[f_idx % len(ordered_priority)]
            existing = loc_combos[loc["id"]]
            chosen_spec = next(
                (sp for sp in fill_specs if (sp[2], sp[1], sp[3]) not in existing),
                fill_specs[f_idx % len(fill_specs)],
            )
            suf, sc, ang, cdir, purp = chosen_spec
            add_plate(loc, suffix=suf, shot_scale=sc, angle=ang, camera_dir=cdir, purpose=purp)
            f_idx += 1

        # Sort so all redrawn angles of each Location Pack appear adjacent
        matrix.sort(key=lambda item: item["_order"])
        for item in matrix:
            item.pop("_order", None)
        return matrix

    # Lean 9:16 Short matrix (4-5 plates, backward-compatible with cameraDir + landmarks attached)
    for loc in locations:
        add_plate(
            loc,
            suffix="",
            shot_scale="establishing",
            angle="wide",
            camera_dir="front",
            purpose="Master establishing plate — geography, sightlines & depth zones",
        )

    med_specs = [
        ("Ots", "medium", "ots", "left", "Two-shot / over-the-shoulder staging plate"),
        ("Reverse", "medium", "reverse", "reverse", "Reverse-angle dialogue / action reaction plate"),
        ("Medium", "medium", "low", "low", "Low-angle midground heroic/threat scale plate"),
        ("MediumWide", "medium", "wide", "front", "Lateral tracking / running midground plate"),
    ]
    med_idx = 0
    for loc in ordered_priority:
        multi_locs = sum(1 for sc in loc_scales.values() if len(sc) >= 2)
        if len(matrix) >= min_sets and len(used_angles) >= min_angles and multi_locs >= min_multi_locs:
            break
        suf, sc, ang, cdir, purp = med_specs[med_idx % len(med_specs)]
        add_plate(loc, suffix=suf, shot_scale=sc, angle=ang, camera_dir=cdir, purpose=purp)
        med_idx += 1

    cu_specs = [
        ("Closeup", "closeup", "closeup", "detail", "Dedicated drawn close-up plate for dialogue/reaction/prop"),
        ("Low", "closeup", "low", "low", "Worm-eye / giant-scale contrast close-up plate"),
        ("Pov", "closeup", "pov", "detail", "First-person POV / hero-prop interaction plate"),
    ]
    cu_idx = 0
    for loc in ordered_priority:
        multi_locs = sum(1 for sc in loc_scales.values() if len(sc) >= 2)
        if len(matrix) >= min_sets and len(used_angles) >= min_angles and multi_locs >= min_multi_locs:
            break
        suf, sc, ang, cdir, purp = cu_specs[cu_idx % len(cu_specs)]
        add_plate(loc, suffix=suf, shot_scale=sc, angle=ang, camera_dir=cdir, purpose=purp)
        cu_idx += 1

    extra_specs = [
        ("ReverseDetail", "medium", "reverse", "reverse", "Secondary reverse-angle action plate"),
        ("OtsAlt", "medium", "ots", "right", "Alternate over-the-shoulder staging plate"),
        ("PovDetail", "closeup", "pov", "detail", "Dedicated detail/POV plate for climax beat"),
        ("HighWide", "establishing", "high", "right", "3/4 elevated overview angle for spatial staging (SE-18)"),
    ]
    ex_idx = 0
    while len(matrix) < min_sets or len(used_angles) < min_angles:
        loc = ordered_priority[ex_idx % len(ordered_priority)]
        suf, sc, ang, cdir, purp = extra_specs[ex_idx % len(extra_specs)]
        add_plate(loc, suffix=suf, shot_scale=sc, angle=ang, camera_dir=cdir, purpose=purp)
        ex_idx += 1

    for item in matrix:
        item.pop("_order", None)
    return matrix


def build_location_packs(
    locations: list[dict[str, Any]],
    sets_matrix: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Summarize each primary location's multi-angle Spatial Location Pack."""
    by_loc: dict[str, list[dict[str, Any]]] = {}
    for s in sets_matrix:
        by_loc.setdefault(s["location"], []).append(s)

    packs: list[dict[str, Any]] = []
    for loc in locations:
        plates = by_loc.get(loc["id"], [])
        packs.append({
            "location": loc["id"],
            "title": loc["title"],
            "plate_count": len(plates),
            "angles": list(dict.fromkeys(p["angle"] for p in plates)),
            "camera_dirs": list(dict.fromkeys(p["cameraDir"] for p in plates)),
            "shot_scales": list(dict.fromkeys(p["shotScale"] for p in plates)),
            "shared_landmarks": list(loc.get("shared_landmarks") or []),
            "set_ids": [p["id"] for p in plates],
        })
    return packs


# ---------------------------------------------------------------------------
# Parallel Worker Splitters (G4 & G5)
# ---------------------------------------------------------------------------

def plan_g4_workers(
    cast_plan: dict[str, Any],
    required_subjects: list[dict[str, Any]],
    locations: list[dict[str, Any]],
    sets_matrix: list[dict[str, Any]],
    is_long_16x9: bool,
) -> list[dict[str, Any]]:
    """Build non-overlapping G4 parallel worker assignments (whole Location Packs per worker)."""
    workers: list[dict[str, Any]] = []

    # Worker 1: Cast, Subjects, Props & Geometry
    workers.append({
        "worker_id": "g4-worker-1",
        "role": "Cast, Hero Subjects, Props & Geometry",
        "owned_files": [
            "src/episode/cast.ts",
            "src/episode/subjects.tsx",
            "src/episode/props.tsx",
            "src/episode/geo.ts",
        ],
        "cast_ids": [c["id"] for c in cast_plan["extracted"]] + [c["id"] for c in cast_plan["suggested_extras"]],
        "subject_ids": [s["id"] for s in required_subjects],
        "locations": [],
        "set_ids": [],
        "notes": (
            f"Build >= {cast_plan['target_min_cast']} cast looks, "
            f"{len(required_subjects)} multi-pose hero subject(s) (>=4 poses + relToActor), "
            f"episode WORLD_PROPS/HAND_PROPS, and geo.ts BOUNDS/PLATE_CAM."
        ),
    })

    # Partition locations across up to 4 parallel set workers for long_16x9 (2 for Short),
    # keeping EVERY whole Location Pack intact inside 1 worker so one artist redraws all 4-5 angles consistently.
    n_set_workers = min(4, max(1, len(locations))) if is_long_16x9 else min(2, max(1, len(locations)))

    # Group sets by location
    sets_by_loc: dict[str, list[dict[str, Any]]] = {}
    for s in sets_matrix:
        sets_by_loc.setdefault(s["location"], []).append(s)

    # Greedy load-balanced bin packing by plate count so every location stays whole inside 1 worker
    bins: list[dict[str, Any]] = [{"locs": [], "sets": []} for _ in range(n_set_workers)]
    locs_sorted = sorted(locations, key=lambda l: (-len(sets_by_loc.get(l["id"], [])), -l["segment_count"]))
    for loc in locs_sorted:
        target_bin = min(bins, key=lambda b: (len(b["sets"]), len(b["locs"])))
        target_bin["locs"].append(loc["id"])
        target_bin["sets"].extend(sets_by_loc.get(loc["id"], []))

    for idx, b in enumerate(bins, start=2):
        loc_slug = "_".join(to_snake(x)[:10] for x in b["locs"][:2]) or f"part{idx - 1}"
        set_file = f"src/episode/sets_w{idx}_{loc_slug}.tsx"
        workers.append({
            "worker_id": f"g4-worker-{idx}",
            "role": f"Spatial Location Pack(s) Group {idx - 1} ({', '.join(b['locs'])})",
            "owned_files": [set_file],
            "cast_ids": [],
            "subject_ids": [],
            "locations": b["locs"],
            "set_ids": [s["id"] for s in b["sets"]],
            "plate_count": len(b["sets"]),
            "notes": (
                f"Author complete Location Pack(s) ({len(b['sets'])} redrawn plates across [{', '.join(b['locs'])}]) "
                f"in {set_file} with shared landmarks & cameraDir continuity; coordinator re-exports into src/episode/sets.tsx."
            ),
        })

    return workers


def plan_g5_workers(
    segments: list[dict[str, Any]],
    locations: list[dict[str, Any]],
    sets_matrix: list[dict[str, Any]],
    required_subjects: list[dict[str, Any]],
    is_long_16x9: bool,
) -> list[dict[str, Any]]:
    """Partition script.json into 3-4 balanced G5 shotlist chapter workers with starter `qa.mjs place` commands."""
    n_segs = len(segments)
    n_workers = 4 if (is_long_16x9 or n_segs >= 40) else 3
    n_workers = min(n_workers, max(1, n_segs))

    # Map seg_id -> location
    seg_to_loc: dict[str, str] = {}
    for loc in locations:
        for sid in loc.get("segments") or []:
            seg_to_loc[sid] = loc["id"]

    # Map seg_id -> subjects appearing in it
    seg_to_subjs: dict[str, list[dict[str, Any]]] = {}
    for subj in required_subjects:
        for sid in subj.get("segments") or []:
            seg_to_subjs.setdefault(sid, []).append(subj)

    # Map location -> its sets
    sets_by_loc: dict[str, list[dict[str, Any]]] = {}
    for s in sets_matrix:
        sets_by_loc.setdefault(s["location"], []).append(s)

    choreography_note = (
        "Target ~95-175 crisp multi-scale cinematic shots (2.8-6.2 s avg); alternate establishing/medium action shots (3.8-6.0 s) "
        "with drawn closeup/pov/ots reaction & insert cuts (1.8-3.2 s) every 2-3 wide shots (SH-20); >=2 choreography events per shot >5s (MO-16) and zero frozen attacks or >3.4s static actor holds (MO-18)."
        if is_long_16x9
        else "Target ~50-75 punchy shots; match angle & shotScale to dramatic beat and actor pacing."
    )

    workers: list[dict[str, Any]] = []
    base_size = n_segs // n_workers
    rem = n_segs % n_workers
    cursor = 0

    for w in range(1, n_workers + 1):
        size = base_size + (1 if w <= rem else 0)
        chunk = segments[cursor: cursor + size]
        cursor += size
        if not chunk:
            continue

        chunk_ids = [s.get("id", "") for s in chunk]
        # Distinct locations in order of appearance within this slice
        slice_locs: list[str] = []
        for sid in chunk_ids:
            lid = seg_to_loc.get(sid)
            if lid and lid not in slice_locs:
                slice_locs.append(lid)
        if not slice_locs and locations:
            slice_locs = [locations[(w - 1) % len(locations)]["id"]]

        slice_sets: list[dict[str, Any]] = []
        for lid in slice_locs:
            slice_sets.extend(sets_by_loc.get(lid, []))

        # Subjects active in this slice
        slice_subj_map: dict[str, dict[str, Any]] = {}
        for sid in chunk_ids:
            for subj in seg_to_subjs.get(sid, []):
                slice_subj_map[subj["id"]] = subj
        slice_subjs = list(slice_subj_map.values())

        # Build ready-to-run starter `node scripts/qa.mjs place` commands
        place_cmds: list[str] = []
        for s_idx, sdef in enumerate(slice_sets[:6]):
            actors_n = 3 if sdef["shotScale"] == "establishing" else (2 if sdef["shotScale"] == "medium" else 1)
            cmd = f"node scripts/qa.mjs place {sdef['id']} --actors {actors_n}"
            if sdef["angle"] == "ots":
                cmd += " --ots"
            if slice_subjs and (s_idx < len(slice_subjs) or sdef["shotScale"] in ("medium", "closeup")):
                subj = slice_subjs[s_idx % len(slice_subjs)]
                pose = subj["suggested_poses"][0] if subj.get("suggested_poses") else "idle"
                cmd += f" --subject {subj['id']}:{pose}"
            place_cmds.append(cmd)

        est_shots = max(18, round(size * 1.25)) if is_long_16x9 else max(size, round(size * 1.4))
        workers.append({
            "worker_id": f"g5-worker-{w}",
            "chapter": w,
            "owned_file": f"src/episode/shotlist_ch{w}.ts",
            "segment_range": {
                "start": chunk_ids[0],
                "end": chunk_ids[-1],
                "count": len(chunk_ids),
            },
            "estimated_shots": est_shots,
            "choreography_note": choreography_note,
            "locations": slice_locs,
            "set_ids": [s["id"] for s in slice_sets],
            "subjects": [s["id"] for s in slice_subjs],
            "starter_place_commands": place_cmds,
        })

    return workers


# ---------------------------------------------------------------------------
# Markdown renderer
# ---------------------------------------------------------------------------

def render_markdown(bp: dict[str, Any]) -> str:
    t = bp["targets"]
    m = bp["metrics"]
    shot_lo, shot_hi = t["target_shots_range"]
    lines: list[str] = []
    lines.append(f"# Asset Blueprint — {bp['title']}")
    lines.append("")
    lines.append(
        f"> Schema: `v{bp['schema_version']}` · Format: `{t['format']}` (`{t['length_mode']}`) · "
        f"Segments: `{bp['segment_count']}` · "
        f"Target Shots: `{shot_lo}–{shot_hi}` (est. `~{m['estimated_shots']}`) · "
        f"Target SLA: `{t['target_sla_min']} min` · "
        f"Planned in `{bp['elapsed_ms']} ms`"
    )
    lines.append("")
    lines.append("## 1. Production Targets & Coverage")
    lines.append("")
    lines.append("| Metric | Target | Planned | Status |")
    lines.append("|--------|--------|---------|--------|")
    lines.append(f"| Cast (`cast.ts`) | >= {t['min_cast']} | {m['planned_cast']} ({m['extracted_cast']} extracted + {m['suggested_extras']} extras) | {'OK' if m['planned_cast'] >= t['min_cast'] else 'GAP'} |")
    lines.append(f"| Set Plates (`sets.tsx`) | target {t['target_sets']} (floor >= {t['min_sets']}) | {m['planned_sets']} / {t['target_sets']} | {'OK' if m['planned_sets'] >= t['target_sets'] else ('FLOOR' if m['planned_sets'] >= t['min_sets'] else 'GAP')} |")
    lines.append(f"| Distinct Set Angles | >= {t['min_angles']} | {m['distinct_angles']} ({', '.join(m['angles'])}) | {'OK' if m['distinct_angles'] >= t['min_angles'] else 'GAP'} |")
    lines.append(f"| Locations w/ >=3 Redrawn Angles | >= {t['min_locations_with_subscenes']} (long) | {m['locations_with_3plus_angles']} / {m['primary_locations']} | {'OK' if (m['locations_with_3plus_angles'] >= t['min_locations_with_subscenes'] or t['length_mode'] != 'long_16x9') else 'GAP'} |")
    lines.append(f"| Locations w/ >=2 Shot Scales | >= {t['min_locations_with_subscenes']} | {m['locations_with_subscenes']} / {m['primary_locations']} | {'OK' if m['locations_with_subscenes'] >= t['min_locations_with_subscenes'] else 'GAP'} |")
    lines.append(f"| Shot Count Range | {shot_lo}–{shot_hi} multi-scale shots | ~{m['estimated_shots']} | {'OK' if shot_lo <= m['estimated_shots'] <= shot_hi else 'INFO'} |")
    lines.append(f"| Required Hero Subjects (`>=3` segs) | auto | {len(bp['required_subjects'])} | OK |")
    lines.append("")

    lines.append("## 2. Cast Blueprint (`src/episode/cast.ts`)")
    lines.append("")
    lines.append("| ID | Name | Role | Segs | Source | Notes |")
    lines.append("|----|------|------|------|--------|-------|")
    for c in bp["cast"]["extracted"] + bp["cast"]["suggested_extras"]:
        note = (c.get("description") or c.get("meta") or "-")[:70].replace("|", "/")
        lines.append(f"| `{c['id']}` | {c['name']} | `{c['role']}` | {c['segment_count']} | {c['source']} | {note} |")
    lines.append("")

    lines.append("## 3. Required Hero Subjects (`src/episode/subjects.tsx`, `>= 3` segments)")
    lines.append("")
    if bp["required_subjects"]:
        lines.append("| ID | Name | Kind | Segs | Poses (>=4) | Exprs | relToActor | Seats |")
        lines.append("|----|------|------|------|-------------|-------|------------|-------|")
        for s in bp["required_subjects"]:
            seats_str = "YES (" + ", ".join(s["ride_fly_evidence"][:3]) + ")" if s["requires_seats"] else "no"
            lines.append(
                f"| `{s['id']}` | {s['name']} | `{s['kind']}` | {s['segment_count']} | "
                f"`{', '.join(s['suggested_poses'])}` | `{', '.join(s['suggested_exprs'])}` | "
                f"`{s['relToActor']}` | {seats_str} |"
            )
    else:
        lines.append("_No recurring creatures/vehicles/machines (>= 3 segments) detected._")
    lines.append("")

    lines.append("## 4. Spatial Location Packs (Multi-Angle Room Continuity)")
    lines.append("")
    lines.append("| Location | Plates | Redrawn Angles | cameraDirs | Shared Landmarks |")
    lines.append("|----------|-------:|----------------|------------|------------------|")
    for lp in bp.get("location_packs") or []:
        lines.append(
            f"| `{lp['location']}` ({lp['title'][:34]}) | {lp['plate_count']} | "
            f"`{', '.join(lp['angles'])}` | `{', '.join(lp['camera_dirs'])}` | "
            f"`{', '.join(lp['shared_landmarks'])}` |"
        )
    lines.append("")

    lines.append("## 5. Set Sub-Scene Matrix (`src/episode/sets*.tsx`)")
    lines.append("")
    lines.append("| Set ID | Location | shotScale | angle | cameraDir | actorScale | Landmarks | Segs | Purpose |")
    lines.append("|--------|----------|-----------|-------|-----------|------------|-----------|------|---------|")
    for s in bp["sets_matrix"]:
        lm_str = ", ".join(s.get("landmarks") or [])
        lines.append(
            f"| `{s['id']}` | `{s['location']}` | `{s['shotScale']}` | `{s['angle']}` | `{s['cameraDir']}` | "
            f"`{s['actorScale']}` | `{lm_str}` | {s['segment_count']} | {s['purpose']} |"
        )
    lines.append("")

    lines.append("## 6. G4 Parallel Workers (Zero File Overlap — Whole Location Packs)")
    lines.append("")
    for w in bp["g4_workers"]:
        lines.append(f"### `{w['worker_id']}` — {w['role']}")
        lines.append(f"- **Owned files:** {', '.join(f'`{f}`' for f in w['owned_files'])}")
        if w["locations"]:
            lines.append(f"- **Locations:** {', '.join(f'`{l}`' for l in w['locations'])}")
            lines.append(f"- **Set IDs ({len(w['set_ids'])}):** {', '.join(f'`{s}`' for s in w['set_ids'])}")
        if w["cast_ids"]:
            lines.append(f"- **Cast IDs ({len(w['cast_ids'])}):** {', '.join(f'`{c}`' for c in w['cast_ids'])}")
        if w["subject_ids"]:
            lines.append(f"- **Subject IDs ({len(w['subject_ids'])}):** {', '.join(f'`{s}`' for s in w['subject_ids'])}")
        lines.append(f"- **Notes:** {w['notes']}")
        lines.append("")

    lines.append("## 7. G5 Chapter Workers & Starter `qa.mjs place` Commands")
    lines.append("")
    for w in bp["g5_workers"]:
        sr = w["segment_range"]
        lines.append(f"### `{w['worker_id']}` — Chapter {w['chapter']} (`{sr['start']}–{sr['end']}`, {sr['count']} segs, ~{w['estimated_shots']} shots)")
        lines.append(f"- **Owned file:** `{w['owned_file']}`")
        lines.append(f"- **Choreography:** {w['choreography_note']}")
        lines.append(f"- **Locations:** {', '.join(f'`{l}`' for l in w['locations'])}")
        if w["subjects"]:
            lines.append(f"- **Active subjects:** {', '.join(f'`{s}`' for s in w['subjects'])}")
        lines.append("- **Starter layout commands:**")
        lines.append("```bash")
        for cmd in w["starter_place_commands"]:
            lines.append(cmd)
        lines.append("```")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def build_blueprint(root: Path) -> dict[str, Any]:
    t0 = time.perf_counter()
    script_path = root / "script.json"
    if not script_path.exists():
        raise FileNotFoundError(f"script.json not found in {root}")

    script_data = json.loads(script_path.read_text(encoding="utf-8"))
    brief_path = root / "brief.md"
    beats_path = root / "beats.md"
    brief_text = brief_path.read_text(encoding="utf-8") if brief_path.exists() else ""
    beats_text = beats_path.read_text(encoding="utf-8") if beats_path.exists() else ""

    segments: list[dict[str, Any]] = script_data.get("segments") or []
    is_long_16x9 = (
        script_data.get("format") == "16:9"
        or script_data.get("length") == "long_16x9"
        or bool(re.search(r"(?i)\blong_16x9\b|1920\s*[x×]\s*1080", brief_text))
        or len(segments) >= 60
    )
    targets = dict(TARGETS_LONG_16X9 if is_long_16x9 else TARGETS_SHORT_9X16)

    beats_map = parse_beats_map(beats_text)
    brief_cast, brief_creatures = parse_characters_from_brief(brief_text)
    cast_plan = enrich_characters(brief_cast, segments, targets, brief_text)
    required_subjects, minor_subjects = detect_subjects(segments, brief_creatures, brief_text)
    locations = extract_locations(script_data, brief_text, beats_map, is_long_16x9)
    sets_matrix = expand_subscene_matrix(locations, targets)
    location_packs = build_location_packs(locations, sets_matrix)
    g4_workers = plan_g4_workers(cast_plan, required_subjects, locations, sets_matrix, is_long_16x9)
    g5_workers = plan_g5_workers(segments, locations, sets_matrix, required_subjects, is_long_16x9)

    # Verify zero file overlap across G4 workers
    seen_g4_files: set[str] = set()
    for w in g4_workers:
        for f in w["owned_files"]:
            if f in seen_g4_files:
                raise RuntimeError(f"G4 worker file conflict detected on {f}")
            seen_g4_files.add(f)

    # Metrics summary
    angles = sorted({s["angle"] for s in sets_matrix})
    camera_dirs = sorted({s["cameraDir"] for s in sets_matrix})
    scales_by_loc: dict[str, set[str]] = {}
    for s in sets_matrix:
        scales_by_loc.setdefault(s["location"], set()).add(s["shotScale"])
    locs_with_subscenes = sum(1 for sc in scales_by_loc.values() if len(sc) >= 2)
    locs_with_3plus_angles = sum(1 for lp in location_packs if len(lp["angles"]) >= 3)
    estimated_shots = sum(w["estimated_shots"] for w in g5_workers)
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

    return {
        "schema_version": "5.4.0",
        "title": script_data.get("title") or root.name,
        "episode_dir": str(root.resolve()),
        "inputs": {
            "script_json": True,
            "brief_md": brief_path.exists(),
            "beats_md": beats_path.exists(),
        },
        "segment_count": len(segments),
        "targets": targets,
        "metrics": {
            "extracted_cast": cast_plan["extracted_count"],
            "suggested_extras": cast_plan["suggested_extra_count"],
            "planned_cast": cast_plan["planned_total"],
            "primary_locations": len(locations),
            "planned_sets": len(sets_matrix),
            "target_sets": targets["target_sets"],
            "distinct_angles": len(angles),
            "angles": angles,
            "distinct_camera_dirs": len(camera_dirs),
            "camera_dirs": camera_dirs,
            "locations_with_subscenes": locs_with_subscenes,
            "locations_with_3plus_angles": locs_with_3plus_angles,
            "estimated_shots": estimated_shots,
            "target_shots_range": list(targets["target_shots_range"]),
            "required_subjects": len(required_subjects),
            "g4_worker_count": len(g4_workers),
            "g5_worker_count": len(g5_workers),
        },
        "cast": cast_plan,
        "required_subjects": required_subjects,
        "minor_subjects": minor_subjects,
        "locations": locations,
        "location_packs": location_packs,
        "sets_matrix": sets_matrix,
        "g4_workers": g4_workers,
        "g5_workers": g5_workers,
        "elapsed_ms": elapsed_ms,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Deterministic G2->G4 Asset Blueprint & Parallel Worker Planner")
    ap.add_argument("--dir", default=".", help="Episode root directory containing script.json (default: .)")
    ap.add_argument("--out", default="qa/asset_blueprint.json", help="Output JSON path (default: qa/asset_blueprint.json)")
    ap.add_argument("--md", default="qa/asset_blueprint.md", help="Output Markdown path (default: qa/asset_blueprint.md)")
    args = ap.parse_args(argv)

    root = Path(args.dir).resolve()
    bp = build_blueprint(root)

    out_json = Path(args.out) if Path(args.out).is_absolute() else (root / args.out)
    out_md = Path(args.md) if Path(args.md).is_absolute() else (root / args.md)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_md.parent.mkdir(parents=True, exist_ok=True)

    out_json.write_text(json.dumps(bp, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    out_md.write_text(render_markdown(bp), encoding="utf-8")

    # Compact executive summary to stdout
    t = bp["targets"]
    m = bp["metrics"]
    shot_lo, shot_hi = t["target_shots_range"]
    subjs = ", ".join(
        f"{s['id']}({s['segment_count']}s{'+seats' if s['requires_seats'] else ''})"
        for s in bp["required_subjects"]
    ) or "none"
    print(
        f"plan_assets: {bp['title']} [{t['format']} {t['length_mode']} · v{bp['schema_version']} · SLA {t['target_sla_min']}m] · "
        f"{bp['segment_count']} segs · {bp['elapsed_ms']} ms"
    )
    print(
        f"  cast: {m['planned_cast']}/{t['min_cast']} ({m['extracted_cast']} extracted + {m['suggested_extras']} extras) · "
        f"sets: {m['planned_sets']}/{t['target_sets']} (floor {t['min_sets']}; {m['primary_locations']} locs, "
        f"{m['locations_with_3plus_angles']} locs>=3angles, {m['locations_with_subscenes']} multi-scale, "
        f"{m['distinct_angles']} angles [{','.join(m['angles'])}])"
    )
    print(
        f"  shots: ~{m['estimated_shots']} (target {shot_lo}-{shot_hi} multi-scale shots) · "
        f"required_subjects ({len(bp['required_subjects'])}): {subjs}"
    )
    print(
        f"  workers: {m['g4_worker_count']} G4 ({', '.join(w['worker_id'] for w in bp['g4_workers'])}) · "
        f"{m['g5_worker_count']} G5 ({', '.join(w['worker_id'] + ':' + w['segment_range']['start'] + '-' + w['segment_range']['end'] + '(~' + str(w['estimated_shots']) + 'sh)' for w in bp['g5_workers'])})"
    )
    print(f"  wrote: {out_json} & {out_md}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
