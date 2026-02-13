from __future__ import annotations

import json
import os
import sys
import signal
import subprocess
import tempfile
import threading
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple

import tkinter as tk
from tkinter import filedialog, font as tkfont, messagebox, ttk

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from algorithms.vector_eval import profile_strategy
from games.river_holdem import RiverHoldemConfig, RiverHoldemGame

RANKS = "23456789TJQKA"
SUITS = "shdc"
HAND_ORDER = [f"{r}{s}" for r in RANKS for s in SUITS]
HAND_INDEX = {card: idx for idx, card in enumerate(HAND_ORDER)}
HAND_COMBOS = [f"{HAND_ORDER[i]}{HAND_ORDER[j]}" for i in range(len(HAND_ORDER)) for j in range(i + 1, len(HAND_ORDER))]
RANK_GRID = list("AKQJT98765432")
RANK_INDEX = {rank: idx for idx, rank in enumerate(RANK_GRID)}


@dataclass
class RangeData:
    cells: Dict[str, float] = field(default_factory=dict)
    combos: Dict[str, float] = field(default_factory=dict)


@dataclass
class SubgameConfig:
    board: List[str]
    pot: int
    stack: int
    bet_sizes: List[float]
    oop_first_bets: List[float]
    ip_first_bets: List[float]
    oop_first_raises: List[float]
    ip_first_raises: List[float]
    oop_next_raises: List[float]
    ip_next_raises: List[float]
    include_all_in: bool
    max_raises: int
    p0_range: RangeData
    p1_range: RangeData


def normalize_card(card: str) -> str:
    if len(card) != 2:
        raise ValueError(f"Invalid card: {card}")
    rank = card[0].upper()
    suit = card[1].lower()
    if rank not in RANKS or suit not in SUITS:
        raise ValueError(f"Invalid card: {card}")
    return f"{rank}{suit}"


def canonical_hand(hand: str) -> str:
    hand = hand.strip()
    if len(hand) != 4:
        raise ValueError(f"Invalid hand: {hand}")
    c1 = normalize_card(hand[:2])
    c2 = normalize_card(hand[2:])
    if c1 == c2:
        raise ValueError(f"Duplicate cards in hand: {hand}")
    if HAND_INDEX[c1] <= HAND_INDEX[c2]:
        return f"{c1}{c2}"
    return f"{c2}{c1}"


def normalize_class_label(label: str) -> str:
    label = label.strip()
    if not label:
        raise ValueError("Empty range label")
    if len(label) == 2:
        r1, r2 = label[0].upper(), label[1].upper()
        if r1 != r2 or r1 not in RANKS:
            raise ValueError(f"Invalid pair label: {label}")
        return f"{r1}{r2}"
    if len(label) == 3:
        r1, r2, suited = label[0].upper(), label[1].upper(), label[2].lower()
        if r1 not in RANKS or r2 not in RANKS or suited not in ("s", "o"):
            raise ValueError(f"Invalid hand class: {label}")
        if r1 == r2:
            raise ValueError(f"Invalid hand class (pair with suffix): {label}")
        if RANK_INDEX[r1] > RANK_INDEX[r2]:
            r1, r2 = r2, r1
        return f"{r1}{r2}{suited}"
    raise ValueError(f"Invalid range label: {label}")


def hand_class(hand: str) -> str:
    if len(hand) != 4:
        raise ValueError(f"Invalid hand: {hand}")
    r1, s1, r2, s2 = hand[0].upper(), hand[1].lower(), hand[2].upper(), hand[3].lower()
    if r1 == r2:
        return f"{r1}{r2}"
    high, low = (r1, r2) if RANK_INDEX[r1] <= RANK_INDEX[r2] else (r2, r1)
    suited = "s" if s1 == s2 else "o"
    return f"{high}{low}{suited}"


def combos_for_class(label: str) -> List[str]:
    label = normalize_class_label(label)
    suits = list(SUITS)
    combos = []
    if len(label) == 2:
        rank = label[0]
        for i in range(len(suits)):
            for j in range(i + 1, len(suits)):
                combo = canonical_hand(f"{rank}{suits[i]}{rank}{suits[j]}")
                combos.append(combo)
        return combos
    r1, r2, suited = label[0], label[1], label[2]
    if suited == "s":
        for suit in suits:
            combos.append(canonical_hand(f"{r1}{suit}{r2}{suit}"))
    else:
        for s1 in suits:
            for s2 in suits:
                if s1 == s2:
                    continue
                combos.append(canonical_hand(f"{r1}{s1}{r2}{s2}"))
    return combos


def parse_board(text: str) -> List[str]:
    cleaned = text.replace(",", " ").strip()
    if not cleaned:
        raise ValueError("Board is required")
    parts = cleaned.split()
    if len(parts) == 1 and len(parts[0]) % 2 == 0:
        raw = parts[0]
        parts = [raw[i : i + 2] for i in range(0, len(raw), 2)]
    if len(parts) != 5:
        raise ValueError("Board must contain 5 cards")
    cards = [normalize_card(card) for card in parts]
    if len(set(cards)) != 5:
        raise ValueError("Board has duplicate cards")
    return cards


def parse_bet_sizes(text: str) -> List[float]:
    cleaned = text.replace(" ", "")
    if not cleaned:
        return []
    sizes = []
    for token in cleaned.split(","):
        if not token:
            continue
        value = float(token)
        if value <= 0:
            raise ValueError("Bet sizes must be > 0")
        sizes.append(value)
    return sizes


def parse_range_text(text: str) -> RangeData:
    data = RangeData()
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        hand = ""
        weight = 1.0
        if ":" in line:
            hand_part, weight_part = line.split(":", 1)
            hand = hand_part.strip()
            weight = float(weight_part.strip())
        else:
            parts = line.replace(",", " ").split()
            if not parts:
                continue
            hand = parts[0]
            if len(parts) > 1:
                weight = float(parts[1])
        hand = hand.strip()
        if len(hand) == 4:
            canon = canonical_hand(hand)
            data.combos[canon] = data.combos.get(canon, 0.0) + weight
        else:
            label = normalize_class_label(hand)
            data.cells[label] = data.cells.get(label, 0.0) + weight
    return data


class RangeModel:
    def __init__(self) -> None:
        self.cells: Dict[str, float] = {}
        self.combos: Dict[str, float] = {}

    def set_cell(self, label: str, weight: float | None) -> None:
        if weight is None or weight <= 0:
            self.cells.pop(label, None)
            return
        self.cells[label] = weight

    def set_combo(self, combo: str, weight: float | None) -> None:
        if weight is None or weight <= 0:
            self.combos.pop(combo, None)
            return
        self.combos[combo] = weight

    def clear(self) -> None:
        self.cells.clear()
        self.combos.clear()

    def has_any_weight(self) -> bool:
        return bool(self.cells) or bool(self.combos)

    def has_override_for_cell(self, label: str) -> bool:
        for combo in combos_for_class(label):
            if combo in self.combos:
                return True
        return False

    def weight_for_hand(self, hand: str) -> float:
        combo_weight = self.combos.get(hand)
        if combo_weight is not None:
            return combo_weight
        label = hand_class(hand)
        return float(self.cells.get(label, 0.0))

    def to_data(self) -> RangeData:
        return RangeData(cells=dict(self.cells), combos=dict(self.combos))

    @classmethod
    def from_data(cls, data: RangeData) -> "RangeModel":
        model = cls()
        model.cells = dict(data.cells or {})
        model.combos = dict(data.combos or {})
        return model


def build_weighted_hands(board: List[str], model: RangeModel) -> Tuple[List[str], List[float]]:
    board_set = {normalize_card(card) for card in board}
    use_uniform = not model.has_any_weight()
    hands: List[str] = []
    weights: List[float] = []
    for hand in HAND_COMBOS:
        c1 = hand[:2]
        c2 = hand[2:]
        if c1 in board_set or c2 in board_set:
            continue
        weight = 1.0 if use_uniform else model.weight_for_hand(hand)
        if weight <= 0:
            continue
        hands.append(hand)
        weights.append(float(weight))
    if not hands:
        raise ValueError("Range has no valid hands after removing board blockers")
    return hands, weights


def serialize_subgame_config(config: SubgameConfig, models: Dict[int, RangeModel]) -> dict:
    data = asdict(config)
    hands0, weights0 = build_weighted_hands(config.board, models[0])
    hands1, weights1 = build_weighted_hands(config.board, models[1])
    data["players"] = [
        {"hands": hands0, "weights": weights0},
        {"hands": hands1, "weights": weights1},
    ]
    return data


def default_solver_path() -> str:
    root = Path(__file__).resolve().parents[3]
    candidates = [
        root / "cpp" / "build" / "river_solver_optimized",
        root / "cpp" / "build" / "river_solver_optimized.exe",
        root / "cpp" / "river_solver_optimized",
        root / "cpp" / "river_solver_optimized.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return ""


class SubgameGUI:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("River Subgame Builder")
        self.root.update_idletasks()
        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        width = min(1080, int(screen_w * 0.9))
        height = min(760, int(screen_h * 0.88))
        self.window_width = width
        self.window_height = height
        self.root.geometry(f"{width}x{height}")
        self.root.minsize(800, 600)

        self.solver_path = tk.StringVar(value=default_solver_path())
        self.board = tk.StringVar(value="Ks Th 7s 4d 2s")
        self.pot = tk.StringVar(value="1000")
        self.stack = tk.StringVar(value="9500")
        self.bet_sizes = tk.StringVar(value="0.5,1.0")
        self.oop_first_bets = tk.StringVar(value="")
        self.ip_first_bets = tk.StringVar(value="")
        self.oop_first_raises = tk.StringVar(value="")
        self.ip_first_raises = tk.StringVar(value="")
        self.oop_next_raises = tk.StringVar(value="")
        self.ip_next_raises = tk.StringVar(value="")
        self.advanced_bets_open = tk.BooleanVar(value=False)
        self.include_all_in = tk.BooleanVar(value=True)
        self.algorithm = tk.StringVar(value="CFR+")
        self.algorithm_label_to_value = {
            "CFR": "cfr",
            "Linear CFR": "lcfr",
            "CFR+": "cfr+",
            "Discounted CFR": "dcfr",
            "Monte Carlo CFR": "mccfr",
        }
        self.algorithm_value_to_label = {value: label for label, value in self.algorithm_label_to_value.items()}
        self.algorithm_buttons: Dict[str, tk.Button] = {}
        self.iterations = tk.StringVar(value="500")
        self.target_expl = tk.StringVar(value="")

        self.range_models = {0: RangeModel(), 1: RangeModel()}
        self.range_cells: Dict[int, Dict[Tuple[int, int], tk.Widget]] = {0: {}, 1: {}}
        self.range_selected: Dict[int, Tuple[int, int] | None] = {0: None, 1: None}
        self.range_vars: Dict[int, Dict[str, tk.StringVar]] = {}
        self.cell_lookup: Dict[tk.Widget, Tuple[int, int, int]] = {}
        self.dragging = False
        self.drag_player: int | None = None
        self.last_drag_cell: Tuple[int, int, int] | None = None
        self.drag_motion_bind_id: str | None = None
        self.drag_release_bind_id: str | None = None
        self.solution_profiles: List[Dict[str, Tuple[List[str], List[List[float]]]]] = [{}, {}]
        self.solution_hands: List[List[str]] = [[], []]
        self.solution_weights: List[List[float]] = [[], []]
        self.solution_game: RiverHoldemGame | None = None
        self.solution_states: Dict[str, RiverState] = {}
        self.solution_nodes: List[str] = []
        self.solution_node_var = tk.StringVar(value="")
        self.solution_node_selector: ttk.Combobox | None = None
        self.solution_player_label: tk.Label | None = None
        self.solution_reach: Dict[int, Dict[str, List[float]]] = {0: {}, 1: {}}
        self.solution_base_weights: Dict[int, List[float]] = {0: [], 1: []}
        self.solution_class_map: Dict[int, Dict[str, List[int]]] = {0: {}, 1: {}}
        self.solution_cells: Dict[Tuple[int, int], tk.Canvas] = {}
        self.solution_cell_text: Dict[Tuple[int, int], int] = {}
        self.solution_detail: tk.Text | None = None
        self.solution_current_player: int | None = None
        self.solution_current_actions: List[Action] = []
        self.solution_current_strategy: List[List[float]] = []
        self.solution_current_reach: List[float] = []
        self.solution_cell_width = 34
        self.solution_cell_height = 26
        self.output: tk.Text | None = None
        self.solve_button: ttk.Button | None = None
        self.solve_running = False
        self.solve_stop_event = threading.Event()
        self.solve_process: subprocess.Popen[str] | None = None
        self._configure_theme()
        self._build_layout()

    def _configure_theme(self) -> None:
        self.colors = {
            "bg": "#f6f4ef",
            "card": "#ffffff",
            "ink": "#1f2623",
            "muted": "#6a756f",
            "header": "#16231d",
            "header_sub": "#cfd8d1",
            "accent": "#1f6f52",
            "accent_dark": "#16543e",
            "accent_fill": "#9bd3b0",
            "grid_base": "#ece7df",
            "solution_raise": "#d1495b",
            "solution_call": "#5aa469",
            "solution_fold": "#4d79ff",
            "solution_empty": "#2f2f2f",
            "solution_border": "#d0cbc2",
        }
        self.root.configure(bg=self.colors["bg"])
        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass

        font_family = self._pick_font_family()
        self.font_body = tkfont.Font(family=font_family, size=11)
        self.font_label = tkfont.Font(family=font_family, size=11, weight="bold")
        self.font_heading = tkfont.Font(family=font_family, size=18, weight="bold")
        self.font_subhead = tkfont.Font(family=font_family, size=12)
        self.font_cell = tkfont.Font(family=font_family, size=8, weight="bold")
        mono_family = self._pick_mono_family()
        self.font_mono = tkfont.Font(family=mono_family, size=10)
        self.font_mono_bold = tkfont.Font(family=mono_family, size=10, weight="bold")

        style.configure("App.TFrame", background=self.colors["bg"])
        style.configure("Header.TFrame", background=self.colors["header"])
        style.configure("Header.TLabel", background=self.colors["header"], foreground="#fefcf9", font=self.font_heading)
        style.configure("HeaderSub.TLabel", background=self.colors["header"], foreground=self.colors["header_sub"], font=self.font_subhead)

        style.configure("TLabel", background=self.colors["bg"], foreground=self.colors["ink"], font=self.font_body)
        style.configure("TEntry", font=self.font_body, fieldbackground=self.colors["card"], foreground=self.colors["ink"])
        style.configure("TCheckbutton", background=self.colors["bg"], foreground=self.colors["ink"], font=self.font_body)
        style.configure("TCombobox", font=self.font_body)

        style.configure("Card.TCheckbutton", background=self.colors["card"], foreground=self.colors["ink"], font=self.font_body)
        style.configure("Card.TRadiobutton", background=self.colors["card"], foreground=self.colors["ink"], font=self.font_body)
        style.configure("Card.TFrame", background=self.colors["card"])

        style.configure("Accent.TButton", background=self.colors["accent"], foreground="#ffffff", font=self.font_label, padding=6)
        style.map("Accent.TButton", background=[("active", self.colors["accent_dark"])])

        style.configure("TNotebook", background=self.colors["card"], borderwidth=0)
        style.configure("TNotebook.Tab", padding=(12, 6), font=self.font_body)
        style.map(
            "TNotebook.Tab",
            background=[("selected", self.colors["card"]), ("active", "#ece7df")],
            foreground=[("selected", self.colors["ink"])],
        )

    def _pick_font_family(self) -> str:
        candidates = ["SF Pro Text", "Avenir Next", "Helvetica Neue", "Segoe UI", "Arial"]
        available = set(tkfont.families(self.root))
        for name in candidates:
            if name in available:
                return name
        return "TkDefaultFont"

    def _pick_mono_family(self) -> str:
        candidates = ["SF Mono", "Menlo", "Monaco", "Consolas", "Courier New"]
        available = set(tkfont.families(self.root))
        for name in candidates:
            if name in available:
                return name
        return "TkFixedFont"

    def _build_layout(self) -> None:
        main = ttk.Frame(self.root, padding=10, style="App.TFrame")
        main.grid(row=0, column=0, sticky="nsew")
        self.root.rowconfigure(0, weight=1)
        self.root.columnconfigure(0, weight=1)

        header = ttk.Frame(main, style="Header.TFrame")
        header.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        header.columnconfigure(0, weight=1)
        ttk.Label(header, text="River Subgame Builder", style="Header.TLabel").grid(
            row=0, column=0, sticky="w", padx=12
        )
        ttk.Label(
            header,
            text="Define ranges, betting trees, and solve to an exploitability target.",
            style="HeaderSub.TLabel",
        ).grid(row=1, column=0, sticky="w", padx=12, pady=(0, 6))

        content = ttk.Frame(main, style="App.TFrame")
        content.grid(row=1, column=0, sticky="nsew")
        main.rowconfigure(1, weight=1)
        content.columnconfigure(0, weight=1, minsize=260)
        content.columnconfigure(1, weight=3, minsize=560)
        content.rowconfigure(0, weight=1)

        left = ttk.Frame(content, style="App.TFrame")
        left.columnconfigure(0, weight=1)

        right = ttk.Frame(content, style="App.TFrame")
        right.columnconfigure(0, weight=1)
        right.rowconfigure(0, weight=2)
        right.rowconfigure(1, weight=1)

        use_two_columns = self.window_width >= 980
        if use_two_columns:
            left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
            right.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        else:
            content.columnconfigure(1, weight=0)
            content.rowconfigure(1, weight=1)
            left.grid(row=0, column=0, sticky="nsew", padx=(0, 0), pady=(0, 10))
            right.grid(row=1, column=0, sticky="nsew")

        self._build_game_frame(left)
        self._build_tree_frame(left)
        self._build_solver_frame(left)
        self._build_range_frame(right)
        self._build_output_frame(right)
        self._build_actions(main)

    def _card(self, parent: ttk.Frame | tk.Frame, title: str) -> Tuple[tk.Frame, tk.Frame]:
        outer = tk.Frame(
            parent,
            bg=self.colors["card"],
            highlightbackground="#ded9d1",
            highlightthickness=1,
            bd=0,
        )
        outer.columnconfigure(0, weight=1)
        title_label = tk.Label(outer, text=title, bg=self.colors["card"], fg=self.colors["ink"], font=self.font_label)
        title_label.grid(row=0, column=0, sticky="w", padx=10, pady=(10, 6))
        body = tk.Frame(outer, bg=self.colors["card"])
        body.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        return outer, body

    def _build_game_frame(self, parent: ttk.Frame) -> None:
        card, frame = self._card(parent, "Game Setup")
        card.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        frame.columnconfigure(0, weight=1)

        tk.Label(frame, text="Solver path", bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=0, column=0, sticky="w"
        )
        ttk.Entry(frame, textvariable=self.solver_path, width=36).grid(row=1, column=0, sticky="ew", pady=(4, 8))
        ttk.Button(frame, text="…", width=3, command=self._browse_solver).grid(
            row=1, column=1, padx=(6, 0), pady=(4, 8)
        )

        tk.Label(frame, text="Board (5 cards)", bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=2, column=0, sticky="w"
        )
        ttk.Entry(frame, textvariable=self.board).grid(row=3, column=0, sticky="ew", pady=(4, 8))

        tk.Label(frame, text="Pot size", bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=4, column=0, sticky="w"
        )
        ttk.Entry(frame, textvariable=self.pot).grid(row=5, column=0, sticky="ew", pady=(4, 8))

        tk.Label(frame, text="Stack size", bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=6, column=0, sticky="w"
        )
        ttk.Entry(frame, textvariable=self.stack).grid(row=7, column=0, sticky="ew", pady=(4, 2))

    def _build_tree_frame(self, parent: ttk.Frame) -> None:
        card, frame = self._card(parent, "Betting Tree")
        card.grid(row=1, column=0, sticky="ew", pady=(0, 10))
        frame.columnconfigure(0, weight=1)

        tk.Label(frame, text="Bet sizes (pot fractions)", bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=0, column=0, sticky="w"
        )
        ttk.Entry(frame, textvariable=self.bet_sizes).grid(row=1, column=0, sticky="ew", pady=(4, 8))

        adv_header = tk.Frame(frame, bg=self.colors["card"])
        adv_header.grid(row=2, column=0, sticky="ew", pady=(2, 6))
        adv_header.columnconfigure(0, weight=1)
        self.advanced_bets_button = tk.Button(
            adv_header,
            text="▸ Advanced bet sizing",
            bg=self.colors["card"],
            fg=self.colors["ink"],
            activebackground=self.colors["card"],
            activeforeground=self.colors["ink"],
            relief="flat",
            borderwidth=0,
            font=self.font_body,
            pady=2,
            command=self._toggle_advanced_bets,
        )
        self.advanced_bets_button.grid(row=0, column=0, sticky="w")

        self.advanced_bets_frame = tk.Frame(frame, bg=self.colors["card"])
        self.advanced_bets_frame.columnconfigure(1, weight=1)
        adv_labels = [
            ("OOP first bet", self.oop_first_bets),
            ("IP first bet (vs check)", self.ip_first_bets),
            ("OOP first raise", self.oop_first_raises),
            ("IP first raise", self.ip_first_raises),
            ("OOP next raise", self.oop_next_raises),
            ("IP next raise", self.ip_next_raises),
        ]
        for idx, (label, var) in enumerate(adv_labels):
            tk.Label(
                self.advanced_bets_frame,
                text=label,
                bg=self.colors["card"],
                fg=self.colors["muted"],
                font=self.font_body,
            ).grid(row=idx, column=0, sticky="w", pady=2)
            ttk.Entry(self.advanced_bets_frame, textvariable=var, width=18).grid(
                row=idx, column=1, sticky="ew", pady=2
            )

        ttk.Checkbutton(frame, text="Include all-in", variable=self.include_all_in, style="Card.TCheckbutton").grid(
            row=4, column=0, sticky="w", pady=(0, 8)
        )

    def _toggle_advanced_bets(self) -> None:
        is_open = self.advanced_bets_open.get()
        self.advanced_bets_open.set(not is_open)
        if self.advanced_bets_open.get():
            self.advanced_bets_frame.grid(row=3, column=0, sticky="ew", pady=(0, 8))
            self.advanced_bets_button.configure(text="▾ Advanced bet sizing")
            self.advanced_bets_frame.tkraise()
            return
        self.advanced_bets_frame.grid_forget()
        self.advanced_bets_button.configure(text="▸ Advanced bet sizing")

    def _set_algorithm_label(self, label: str) -> None:
        if label not in self.algorithm_label_to_value:
            label = "CFR+"
        self.algorithm.set(label)
        self._refresh_algorithm_buttons()

    def _refresh_algorithm_buttons(self) -> None:
        active = self.algorithm.get()
        for label, btn in self.algorithm_buttons.items():
            is_active = label == active
            bg = self.colors["accent_fill"] if is_active else self.colors["grid_base"]
            fg = self.colors["ink"]
            border = self.colors["accent_dark"] if is_active else "#ded9d1"
            btn.configure(
                bg=bg,
                fg=fg,
                activebackground=self.colors["accent_fill"],
                activeforeground=fg,
                highlightbackground=border,
            )


    def _build_range_frame(self, parent: ttk.Frame) -> None:
        card, frame = self._card(parent, "Ranges & Solution")
        card.grid(row=0, column=0, sticky="nsew")
        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(0, weight=1)

        main_tabs = ttk.Notebook(frame)
        main_tabs.grid(row=0, column=0, sticky="nsew")

        ranges_tab = ttk.Frame(main_tabs, style="Card.TFrame")
        solution_tab = ttk.Frame(main_tabs, style="Card.TFrame")
        main_tabs.add(ranges_tab, text="Ranges")
        main_tabs.add(solution_tab, text="Solution")

        ranges_tab.columnconfigure(0, weight=1)
        ranges_tab.rowconfigure(0, weight=1)
        range_notebook = ttk.Notebook(ranges_tab)
        range_notebook.grid(row=0, column=0, sticky="nsew")
        for player in (0, 1):
            tab = ttk.Frame(range_notebook, style="Card.TFrame")
            range_notebook.add(tab, text=f"Player {player}")
            self._build_range_tab(tab, player)

        solution_tab.columnconfigure(0, weight=1)
        solution_tab.rowconfigure(0, weight=1)
        self._build_solution_tab(solution_tab)

        self._refresh_matrix(0)
        self._refresh_matrix(1)

    def _build_range_tab(self, parent: ttk.Frame, player: int) -> None:
        parent.columnconfigure(0, weight=6, minsize=520)
        parent.columnconfigure(1, weight=1, minsize=180)
        parent.rowconfigure(1, weight=1)

        controls = tk.Frame(parent, bg=self.colors["card"])
        controls.grid(row=0, column=0, columnspan=2, sticky="ew", padx=6, pady=(6, 4))
        controls.columnconfigure(0, weight=1)
        tk.Label(
            controls,
            text="Click to toggle. Drag to paint. Double-click for combos. * = combo overrides.",
            bg=self.colors["card"],
            fg=self.colors["muted"],
            font=self.font_body,
        ).grid(row=0, column=0, sticky="w")
        ttk.Button(controls, text="Reset to uniform", command=lambda p=player: self._reset_range(p)).grid(
            row=0, column=1, padx=(6, 0)
        )

        grid_container = tk.Frame(
            parent,
            bg=self.colors["card"],
            highlightbackground="#ded9d1",
            highlightthickness=1,
            bd=0,
        )
        grid_container.grid(row=1, column=0, sticky="nsew", padx=(6, 3), pady=(0, 6))
        grid_container.rowconfigure(0, weight=1)
        grid_container.columnconfigure(0, weight=1)
        grid_frame = tk.Frame(grid_container, bg=self.colors["card"])
        grid_frame.grid(row=0, column=0, sticky="nsew", padx=4, pady=4)
        grid_frame.bind("<ButtonRelease-1>", self._end_drag)

        detail_card = tk.Frame(
            parent,
            bg=self.colors["card"],
            highlightbackground="#ded9d1",
            highlightthickness=1,
            bd=0,
        )
        detail_card.grid(row=1, column=1, sticky="nsew", padx=(3, 6), pady=(0, 6))
        detail_card.columnconfigure(0, weight=1)
        tk.Label(detail_card, text="Selection", bg=self.colors["card"], fg=self.colors["ink"], font=self.font_label).grid(
            row=0, column=0, sticky="w", padx=8, pady=(8, 4)
        )
        detail = tk.Frame(detail_card, bg=self.colors["card"])
        detail.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 10))
        detail.columnconfigure(0, weight=1)

        vars_for_player = {
            "label": tk.StringVar(value="Select a cell"),
            "weight": tk.StringVar(value=""),
            "overrides": tk.StringVar(value="Overrides: 0 combos"),
            "brush": tk.StringVar(value="1.0"),
        }
        self.range_vars[player] = vars_for_player

        tk.Label(detail, text="Hand class", bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=0, column=0, sticky="w"
        )
        tk.Label(detail, textvariable=vars_for_player["label"], bg=self.colors["card"], fg=self.colors["ink"], font=self.font_label).grid(
            row=1, column=0, sticky="w", pady=(0, 8)
        )
        tk.Label(detail, text="Weight", bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=2, column=0, sticky="w", pady=(6, 2)
        )
        weight_entry = ttk.Entry(detail, textvariable=vars_for_player["weight"])
        weight_entry.grid(row=3, column=0, sticky="ew")
        weight_entry.bind("<Return>", lambda event, p=player: self._apply_cell_weight(p))

        btn_row = ttk.Frame(detail, style="Card.TFrame")
        btn_row.grid(row=4, column=0, sticky="ew", pady=(10, 2))
        btn_row.columnconfigure(0, weight=1)
        btn_row.columnconfigure(1, weight=1)
        btn_row.columnconfigure(2, weight=1)
        ttk.Button(btn_row, text="Apply", command=lambda p=player: self._apply_cell_weight(p)).grid(
            row=0, column=0, sticky="ew", padx=(0, 4)
        )
        ttk.Button(btn_row, text="Clear cell", command=lambda p=player: self._clear_cell_weight(p)).grid(
            row=0, column=1, sticky="ew", padx=4
        )
        ttk.Button(btn_row, text="Edit combos", command=lambda p=player: self._edit_selected_combos(p)).grid(
            row=0, column=2, sticky="ew", padx=(4, 0)
        )

        tk.Label(detail, textvariable=vars_for_player["overrides"], bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=5, column=0, sticky="w", pady=(6, 0)
        )
        tk.Label(detail, text="Leave weight blank to clear this cell.", bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=6, column=0, sticky="w", pady=(2, 6)
        )

        ttk.Separator(detail, orient="horizontal").grid(row=7, column=0, sticky="ew", pady=(6, 6))
        tk.Label(detail, text="Brush weight", bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=8, column=0, sticky="w", pady=(0, 2)
        )
        brush_entry = ttk.Entry(detail, textvariable=vars_for_player["brush"])
        brush_entry.grid(row=9, column=0, sticky="ew")
        brush_entry.bind("<Return>", lambda event, p=player: self._apply_brush_preview(p))

        quick = ttk.Frame(detail, style="Card.TFrame")
        quick.grid(row=10, column=0, sticky="ew", pady=(6, 0))
        weight_swatches = {
            0.25: ("#d9efe4", self.colors["ink"]),
            0.5: ("#bfe4cf", self.colors["ink"]),
            1.0: ("#86cca9", "#0f2c20"),
            2.0: ("#3f9f73", "#000000"),
        }
        for idx, value in enumerate([0.25, 0.5, 1.0, 2.0]):
            bg, fg = weight_swatches[value]
            tk.Button(
                quick,
                text=str(value).rstrip("0").rstrip("."),
                bg=bg,
                fg=fg,
                activebackground=bg,
                activeforeground=fg,
                relief="flat",
                borderwidth=0,
                font=self.font_cell,
                height=2,
                pady=2,
                command=lambda v=value, p=player: self._set_brush_weight(p, v),
            ).grid(row=0, column=idx, padx=(0 if idx == 0 else 4), sticky="ew")

        tk.Label(
            detail,
            text="Drag across the grid to paint quickly.",
            bg=self.colors["card"],
            fg=self.colors["muted"],
            font=self.font_body,
        ).grid(row=11, column=0, sticky="w", pady=(6, 6))

        header_bg = self.colors["card"]
        header_fg = self.colors["ink"]
        for idx, rank in enumerate(RANK_GRID):
            tk.Label(grid_frame, text=rank, bg=header_bg, fg=header_fg, font=self.font_cell).grid(
                row=0, column=idx + 1, padx=1, pady=1
            )
            tk.Label(grid_frame, text=rank, bg=header_bg, fg=header_fg, font=self.font_cell).grid(
                row=idx + 1, column=0, padx=1, pady=1
            )

        self.range_cells[player] = {}
        for row_idx in range(len(RANK_GRID)):
            for col_idx in range(len(RANK_GRID)):
                label = self._cell_label(row_idx, col_idx)
                btn = tk.Label(
                    grid_frame,
                    text=label,
                    width=4,
                    height=2,
                    font=self.font_cell,
                    relief="flat",
                    borderwidth=0,
                    highlightthickness=2,
                    highlightbackground="#dcd7cf",
                    cursor="hand2",
                    takefocus=0,
                )
                btn.grid(row=row_idx + 1, column=col_idx + 1, padx=0, pady=0)
                btn.bind(
                    "<ButtonPress-1>",
                    lambda event, r=row_idx, c=col_idx, p=player: self._start_drag(p, r, c),
                )
                btn.bind(
                    "<Double-Button-1>",
                    lambda event, r=row_idx, c=col_idx, p=player: self._open_combo_editor(p, r, c),
                )
                btn.bind(
                    "<Button-3>",
                    lambda event, r=row_idx, c=col_idx, p=player: self._clear_cell_weight(p, r, c),
                )
                btn.bind(
                    "<Control-Button-1>",
                    lambda event, r=row_idx, c=col_idx, p=player: self._clear_cell_weight(p, r, c),
                )
                self.range_cells[player][(row_idx, col_idx)] = btn
                self.cell_lookup[btn] = (player, row_idx, col_idx)

    def _build_solution_tab(self, parent: ttk.Frame) -> None:
        parent.columnconfigure(0, weight=6, minsize=520)
        parent.columnconfigure(1, weight=1, minsize=180)
        parent.rowconfigure(1, weight=1)

        controls = tk.Frame(parent, bg=self.colors["card"])
        controls.grid(row=0, column=0, columnspan=2, sticky="ew", padx=6, pady=(6, 4))
        controls.columnconfigure(1, weight=1)
        tk.Label(controls, text="Node", bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=0, column=0, sticky="w"
        )
        selector = ttk.Combobox(controls, textvariable=self.solution_node_var, state="readonly", width=32)
        selector.grid(row=0, column=1, sticky="ew", padx=(6, 0))
        selector.bind("<<ComboboxSelected>>", lambda event: self._update_solution_grid())
        self.solution_node_selector = selector
        player_label = tk.Label(
            controls,
            text="Player to act: —",
            bg=self.colors["card"],
            fg=self.colors["muted"],
            font=self.font_body,
        )
        player_label.grid(row=0, column=2, sticky="e", padx=(10, 0))
        self.solution_player_label = player_label
        tk.Label(
            controls,
            text="Fold (blue) • Check/Call (green) • Bet/Raise (red) • Height = reach",
            bg=self.colors["card"],
            fg=self.colors["muted"],
            font=self.font_body,
        ).grid(row=1, column=0, columnspan=3, sticky="w", pady=(4, 0))

        grid_container = tk.Frame(
            parent,
            bg=self.colors["card"],
            highlightbackground="#ded9d1",
            highlightthickness=1,
            bd=0,
        )
        grid_container.grid(row=1, column=0, sticky="nsew", padx=(6, 3), pady=(0, 6))
        grid_container.rowconfigure(0, weight=1)
        grid_container.columnconfigure(0, weight=1)
        grid_frame = tk.Frame(grid_container, bg=self.colors["card"])
        grid_frame.grid(row=0, column=0, sticky="nsew", padx=4, pady=4)

        detail_card = tk.Frame(
            parent,
            bg=self.colors["card"],
            highlightbackground="#ded9d1",
            highlightthickness=1,
            bd=0,
        )
        detail_card.grid(row=1, column=1, sticky="nsew", padx=(3, 6), pady=(0, 6))
        detail_card.columnconfigure(0, weight=1)
        tk.Label(detail_card, text="Details", bg=self.colors["card"], fg=self.colors["ink"], font=self.font_label).grid(
            row=0, column=0, sticky="w", padx=8, pady=(8, 4)
        )
        detail_container = tk.Frame(detail_card, bg=self.colors["card"])
        detail_container.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 10))
        detail_container.columnconfigure(0, weight=1)
        detail_container.rowconfigure(0, weight=1)
        detail_text = tk.Text(
            detail_container,
            height=12,
            wrap="none",
            bg=self.colors["card"],
            fg=self.colors["ink"],
            bd=0,
            highlightthickness=0,
            font=self.font_body,
        )
        detail_scroll = ttk.Scrollbar(detail_container, orient="vertical", command=detail_text.yview)
        detail_text.configure(yscrollcommand=detail_scroll.set)
        detail_text.grid(row=0, column=0, sticky="nsew")
        detail_scroll.grid(row=0, column=1, sticky="ns")
        detail_text.tag_configure("detail_title", font=self.font_label, foreground=self.colors["ink"])
        detail_text.tag_configure("detail_sub", font=self.font_body, foreground=self.colors["muted"])
        detail_text.tag_configure("detail_note", font=self.font_body, foreground=self.colors["muted"])
        detail_text.tag_configure("detail_head", font=self.font_mono_bold, foreground=self.colors["ink"])
        detail_text.tag_configure("detail_mono", font=self.font_mono, foreground=self.colors["ink"])
        detail_text.tag_configure("detail_raise", font=self.font_mono, foreground=self.colors["solution_raise"])
        detail_text.tag_configure("detail_call", font=self.font_mono, foreground=self.colors["solution_call"])
        detail_text.tag_configure("detail_fold", font=self.font_mono, foreground=self.colors["solution_fold"])
        detail_text.configure(state="disabled")
        self.solution_detail = detail_text

        header_bg = self.colors["card"]
        header_fg = self.colors["ink"]
        for idx, rank in enumerate(RANK_GRID):
            tk.Label(grid_frame, text=rank, bg=header_bg, fg=header_fg, font=self.font_cell).grid(
                row=0, column=idx + 1, padx=1, pady=1
            )
            tk.Label(grid_frame, text=rank, bg=header_bg, fg=header_fg, font=self.font_cell).grid(
                row=idx + 1, column=0, padx=1, pady=1
            )

        self.solution_cells = {}
        self.solution_cell_text = {}
        for row_idx in range(len(RANK_GRID)):
            for col_idx in range(len(RANK_GRID)):
                label = self._cell_label(row_idx, col_idx)
                canvas = tk.Canvas(
                    grid_frame,
                    width=self.solution_cell_width,
                    height=self.solution_cell_height,
                    bg=self.colors["grid_base"],
                    highlightthickness=1,
                    highlightbackground=self.colors["solution_border"],
                    bd=0,
                    cursor="hand2",
                )
                canvas.grid(row=row_idx + 1, column=col_idx + 1, padx=0, pady=0)
                text_id = canvas.create_text(
                    self.solution_cell_width / 2,
                    self.solution_cell_height / 2,
                    text=label,
                    fill="#f8f5f0",
                    font=self.font_cell,
                )
                canvas.bind(
                    "<Enter>",
                    lambda event, r=row_idx, c=col_idx: self._solution_hover(r, c),
                )
                canvas.bind(
                    "<Button-1>",
                    lambda event, r=row_idx, c=col_idx: self._solution_hover(r, c),
                )
                self.solution_cells[(row_idx, col_idx)] = canvas
                self.solution_cell_text[(row_idx, col_idx)] = text_id
        self._set_solution_detail("Run a solve to view strategy output.")

    def _build_solver_frame(self, parent: ttk.Frame) -> None:
        card, frame = self._card(parent, "Solver")
        card.grid(row=2, column=0, sticky="ew")
        frame.columnconfigure(0, weight=1)

        tk.Label(frame, text="Algorithm", bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=0, column=0, sticky="w"
        )
        algo_frame = tk.Frame(frame, bg=self.colors["card"])
        algo_frame.grid(row=1, column=0, sticky="ew", pady=(4, 8))
        algo_frame.columnconfigure(0, weight=1)
        algo_frame.columnconfigure(1, weight=1)
        algo_frame.columnconfigure(2, weight=1)
        self.algorithm_buttons.clear()
        labels = list(self.algorithm_label_to_value.keys())
        for idx, label in enumerate(labels):
            btn = tk.Button(
                algo_frame,
                text=label,
                command=lambda l=label: self._set_algorithm_label(l),
                bg=self.colors["grid_base"],
                fg=self.colors["ink"],
                activebackground=self.colors["accent_fill"],
                activeforeground=self.colors["ink"],
                relief="solid",
                borderwidth=1,
                highlightthickness=1,
                highlightbackground="#ded9d1",
                font=self.font_body,
                padx=6,
                pady=6,
            )
            row = idx // 3
            col = idx % 3
            btn.grid(row=row, column=col, sticky="ew", padx=3, pady=3)
            self.algorithm_buttons[label] = btn
        self._set_algorithm_label(self.algorithm.get())

        tk.Label(frame, text="Iterations", bg=self.colors["card"], fg=self.colors["muted"], font=self.font_body).grid(
            row=2, column=0, sticky="w"
        )
        ttk.Entry(frame, textvariable=self.iterations).grid(row=3, column=0, sticky="ew", pady=(4, 8))

        tk.Label(
            frame,
            text="Target exploitability (% pot)",
            bg=self.colors["card"],
            fg=self.colors["muted"],
            font=self.font_body,
        ).grid(row=4, column=0, sticky="w")
        ttk.Entry(frame, textvariable=self.target_expl).grid(row=5, column=0, sticky="ew", pady=(4, 2))

    def _build_output_frame(self, parent: ttk.Frame) -> None:
        card, frame = self._card(parent, "Output")
        card.grid(row=1, column=0, sticky="nsew", pady=(10, 0))
        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(0, weight=1)

        self.output = tk.Text(frame, height=10, state="disabled", wrap="word")
        self._style_text(self.output)
        scrollbar = ttk.Scrollbar(frame, orient="vertical", command=self.output.yview)
        self.output.configure(yscrollcommand=scrollbar.set)
        self.output.grid(row=0, column=0, sticky="nsew", padx=(0, 6))
        scrollbar.grid(row=0, column=1, sticky="ns")

    def _build_actions(self, parent: ttk.Frame) -> None:
        frame = ttk.Frame(parent, style="App.TFrame")
        frame.grid(row=2, column=0, sticky="ew", pady=(12, 0))
        frame.columnconfigure(0, weight=1)
        frame.columnconfigure(5, weight=1)

        ttk.Button(frame, text="Load Config", command=self._load_config).grid(row=0, column=1, padx=6)
        ttk.Button(frame, text="Save Config", command=self._save_config).grid(row=0, column=2, padx=6)
        self.solve_button = ttk.Button(frame, text="Solve", style="Accent.TButton", command=self._toggle_solve)
        self.solve_button.grid(row=0, column=3, padx=6)

    def _style_text(self, widget: tk.Text) -> None:
        widget.configure(
            font=self.font_body,
            background=self.colors["card"],
            foreground=self.colors["ink"],
            insertbackground=self.colors["ink"],
            relief="solid",
            borderwidth=1,
            highlightthickness=1,
            highlightbackground="#dcd7cf",
            padx=6,
            pady=6,
        )

    def _cell_label(self, row_idx: int, col_idx: int) -> str:
        if row_idx == col_idx:
            rank = RANK_GRID[row_idx]
            return f"{rank}{rank}"
        if row_idx < col_idx:
            return f"{RANK_GRID[row_idx]}{RANK_GRID[col_idx]}s"
        return f"{RANK_GRID[col_idx]}{RANK_GRID[row_idx]}o"

    def _cell_effective_weight(self, model: RangeModel, label: str) -> float:
        if label in model.cells:
            return float(model.cells[label])
        overrides = [model.combos[combo] for combo in combos_for_class(label) if combo in model.combos]
        if overrides:
            return float(sum(overrides)) / len(overrides)
        return 0.0

    def _clear_overrides(self, model: RangeModel, label: str) -> None:
        for combo in combos_for_class(label):
            model.set_combo(combo, None)

    def _max_weight(self, model: RangeModel) -> float:
        values = list(model.cells.values()) + list(model.combos.values())
        return max(values) if values else 1.0

    def _hand_reach_scale(self, player: int) -> float | None:
        base_weights = self.solution_base_weights.get(player, [])
        if not base_weights:
            return None
        max_weight = max(base_weights)
        if max_weight <= 0.0:
            return None
        return max_weight

    def _blend_color(self, base: str, accent: str, t: float) -> str:
        base = base.lstrip("#")
        accent = accent.lstrip("#")
        br, bg, bb = (int(base[i : i + 2], 16) for i in range(0, 6, 2))
        ar, ag, ab = (int(accent[i : i + 2], 16) for i in range(0, 6, 2))
        rr = int(br + (ar - br) * t)
        rg = int(bg + (ag - bg) * t)
        rb = int(bb + (ab - bb) * t)
        return f"#{rr:02x}{rg:02x}{rb:02x}"

    def _weight_colors(self, weight: float, max_weight: float) -> Tuple[str, str]:
        if weight <= 0 or max_weight <= 0:
            return self.colors["grid_base"], self.colors["muted"]
        t = min(weight / max_weight, 1.0)
        t = 0.2 + 0.6 * (t**0.6)
        bg = self._blend_color(self.colors["grid_base"], self.colors["accent_fill"], t)
        return bg, self.colors["ink"]

    def _refresh_matrix(self, player: int) -> None:
        model = self.range_models[player]
        max_weight = self._max_weight(model)
        selected = self.range_selected[player]
        for (row_idx, col_idx), btn in self.range_cells[player].items():
            label = self._cell_label(row_idx, col_idx)
            weight = self._cell_effective_weight(model, label)
            bg, fg = self._weight_colors(weight, max_weight)
            text = f"{label}*" if model.has_override_for_cell(label) else label
            relief = "flat"
            if selected == (row_idx, col_idx):
                active_border = self.colors["accent_dark"]
            elif weight > 0:
                active_border = self.colors["accent"]
            else:
                active_border = "#dcd7cf"
            btn.configure(
                text=text,
                bg=bg,
                fg=fg,
                relief=relief,
                highlightbackground=active_border,
                highlightcolor=active_border,
                highlightthickness=2,
            )

    def _update_selection_detail(self, player: int) -> None:
        vars_for_player = self.range_vars.get(player)
        if not vars_for_player:
            return
        selection = self.range_selected[player]
        model = self.range_models[player]
        if selection is None:
            vars_for_player["label"].set("Select a cell")
            vars_for_player["weight"].set("")
            vars_for_player["overrides"].set("Overrides: 0 combos")
            return
        label = self._cell_label(*selection)
        vars_for_player["label"].set(label)
        weight = model.cells.get(label)
        vars_for_player["weight"].set("" if weight is None else f"{weight:g}")
        overrides = sum(1 for combo in combos_for_class(label) if combo in model.combos)
        vars_for_player["overrides"].set(f"Overrides: {overrides} combos")

    def _select_cell(self, player: int, row_idx: int, col_idx: int) -> None:
        self.range_selected[player] = (row_idx, col_idx)
        self._update_selection_detail(player)
        self._refresh_matrix(player)

    def _reset_range(self, player: int) -> None:
        self.range_models[player].clear()
        self.range_selected[player] = None
        self._update_selection_detail(player)
        self._refresh_matrix(player)

    def _apply_cell_weight(self, player: int) -> None:
        selection = self.range_selected[player]
        if selection is None:
            messagebox.showerror("No selection", "Select a hand class in the matrix first.")
            return
        label = self._cell_label(*selection)
        raw = self.range_vars[player]["weight"].get().strip()
        if not raw:
            self.range_models[player].set_cell(label, None)
            self._clear_overrides(self.range_models[player], label)
        else:
            try:
                weight = float(raw)
            except ValueError:
                messagebox.showerror("Invalid weight", "Weight must be a number.")
                return
            if weight <= 0:
                self.range_models[player].set_cell(label, None)
                self._clear_overrides(self.range_models[player], label)
            else:
                self.range_models[player].set_cell(label, weight)
        self._update_selection_detail(player)
        self._refresh_matrix(player)

    def _set_brush_weight(self, player: int, value: float) -> None:
        self.range_vars[player]["brush"].set(f"{value:g}")

    def _apply_brush_preview(self, player: int) -> None:
        raw = self.range_vars[player]["brush"].get().strip()
        if not raw:
            self.range_vars[player]["brush"].set("1.0")
            return
        try:
            weight = float(raw)
        except ValueError:
            messagebox.showerror("Invalid weight", "Brush weight must be a number.")
            self.range_vars[player]["brush"].set("1.0")
            return
        if weight <= 0:
            messagebox.showerror("Invalid weight", "Brush weight must be > 0.")
            self.range_vars[player]["brush"].set("1.0")

    def _get_brush_weight(self, player: int) -> float:
        raw = self.range_vars[player]["brush"].get().strip()
        if not raw:
            return 1.0
        try:
            weight = float(raw)
        except ValueError:
            return 1.0
        return weight if weight > 0 else 1.0

    def _start_drag(self, player: int, row_idx: int, col_idx: int) -> None:
        self.dragging = True
        self.drag_player = player
        self.last_drag_cell = (player, row_idx, col_idx)
        self._bind_drag_events()
        self._apply_brush(player, row_idx, col_idx, drag=False)

    def _end_drag(self, event: tk.Event | None = None) -> None:
        self.dragging = False
        self.drag_player = None
        self.last_drag_cell = None
        self._unbind_drag_events()

    def _bind_drag_events(self) -> None:
        if self.drag_motion_bind_id is None:
            self.drag_motion_bind_id = self.root.bind("<B1-Motion>", self._global_drag, add=True)
        if self.drag_release_bind_id is None:
            self.drag_release_bind_id = self.root.bind("<ButtonRelease-1>", self._end_drag, add=True)

    def _unbind_drag_events(self) -> None:
        if self.drag_motion_bind_id is not None:
            self.root.unbind("<B1-Motion>", self.drag_motion_bind_id)
            self.drag_motion_bind_id = None
        if self.drag_release_bind_id is not None:
            self.root.unbind("<ButtonRelease-1>", self.drag_release_bind_id)
            self.drag_release_bind_id = None

    def _global_drag(self, event: tk.Event) -> None:
        if not self.dragging:
            return
        widget = self.root.winfo_containing(event.x_root, event.y_root)
        if widget is None:
            return
        info = self.cell_lookup.get(widget)
        if info is None:
            return
        player, row_idx, col_idx = info
        if self.drag_player != player:
            return
        if self.last_drag_cell == (player, row_idx, col_idx):
            return
        self.last_drag_cell = (player, row_idx, col_idx)
        self._apply_brush(player, row_idx, col_idx, drag=True)

    def _apply_brush(self, player: int, row_idx: int, col_idx: int, drag: bool = False) -> None:
        self.range_selected[player] = (row_idx, col_idx)
        label = self._cell_label(row_idx, col_idx)
        model = self.range_models[player]
        weight = self._get_brush_weight(player)
        effective = self._cell_effective_weight(model, label)
        if not drag and effective > 0:
            model.set_cell(label, None)
            self._clear_overrides(model, label)
            self.range_vars[player]["weight"].set("")
        else:
            model.set_cell(label, weight)
            self.range_vars[player]["weight"].set(f"{weight:g}")
        self._update_selection_detail(player)
        self._refresh_matrix(player)

    def _clear_cell_weight(self, player: int, row_idx: int | None = None, col_idx: int | None = None) -> None:
        if row_idx is None or col_idx is None:
            selection = self.range_selected[player]
            if selection is None:
                messagebox.showerror("No selection", "Select a hand class in the matrix first.")
                return
            row_idx, col_idx = selection
        self.range_selected[player] = (row_idx, col_idx)
        label = self._cell_label(row_idx, col_idx)
        self.range_models[player].set_cell(label, None)
        self._clear_overrides(self.range_models[player], label)
        self._update_selection_detail(player)
        self._refresh_matrix(player)

    def _edit_selected_combos(self, player: int) -> None:
        selection = self.range_selected[player]
        if selection is None:
            messagebox.showerror("No selection", "Select a hand class in the matrix first.")
            return
        self._open_combo_editor(player, selection[0], selection[1])

    def _open_combo_editor(self, player: int, row_idx: int, col_idx: int) -> None:
        self.range_selected[player] = (row_idx, col_idx)
        label = self._cell_label(row_idx, col_idx)
        model = self.range_models[player]
        self._update_selection_detail(player)

        top = tk.Toplevel(self.root)
        top.title(f"Combo Overrides - Player {player} {label}")
        top.configure(bg=self.colors["bg"])
        top.transient(self.root)

        ttk.Label(top, text=f"Overrides for {label}", font=self.font_label).grid(
            row=0, column=0, columnspan=6, sticky="w", padx=12, pady=(12, 4)
        )
        ttk.Label(top, text="Leave a weight blank to inherit the class weight.").grid(
            row=1, column=0, columnspan=6, sticky="w", padx=12, pady=(0, 8)
        )

        combos = combos_for_class(label)
        columns = 2 if len(combos) <= 6 else 3
        entries: Dict[str, tk.StringVar] = {}
        grid = ttk.Frame(top, style="App.TFrame")
        grid.grid(row=2, column=0, columnspan=6, sticky="nsew", padx=12)
        for idx, combo in enumerate(combos):
            var = tk.StringVar()
            existing = model.combos.get(combo)
            if existing is not None:
                var.set(f"{existing:g}")
            entries[combo] = var
            row = idx // columns
            col = idx % columns
            ttk.Label(grid, text=combo).grid(row=row, column=col * 2, sticky="e", padx=(0, 4), pady=3)
            ttk.Entry(grid, textvariable=var, width=8).grid(row=row, column=col * 2 + 1, padx=(0, 12), pady=3)

        def apply_changes() -> None:
            try:
                for combo, var in entries.items():
                    text = var.get().strip()
                    if not text:
                        model.set_combo(combo, None)
                        continue
                    weight = float(text)
                    if weight <= 0:
                        model.set_combo(combo, None)
                    else:
                        model.set_combo(combo, weight)
            except ValueError:
                messagebox.showerror("Invalid weight", "Weights must be numbers.", parent=top)
                return
            self._update_selection_detail(player)
            self._refresh_matrix(player)

        def clear_overrides() -> None:
            for combo in combos:
                model.set_combo(combo, None)
                entries[combo].set("")
            self._update_selection_detail(player)
            self._refresh_matrix(player)

        def fill_from_cell() -> None:
            cell_weight = model.cells.get(label)
            value = f"{cell_weight:g}" if cell_weight is not None else "1.0"
            for combo in combos:
                entries[combo].set(value)

        btns = ttk.Frame(top, style="App.TFrame")
        btns.grid(row=3, column=0, columnspan=6, sticky="ew", padx=12, pady=12)
        btns.columnconfigure(0, weight=1)
        ttk.Button(btns, text="Apply", command=apply_changes).grid(row=0, column=0, sticky="ew", padx=(0, 6))
        ttk.Button(btns, text="Clear overrides", command=clear_overrides).grid(
            row=0, column=1, sticky="ew", padx=(0, 6)
        )
        ttk.Button(btns, text="Fill from cell", command=fill_from_cell).grid(row=0, column=2, sticky="ew", padx=(0, 6))
        ttk.Button(btns, text="Close", command=top.destroy).grid(row=0, column=3, sticky="ew")

    def _browse_solver(self) -> None:
        path = filedialog.askopenfilename(title="Select solver binary")
        if path:
            self.solver_path.set(path)

    def _log(self, text: str) -> None:
        if self.output is None:
            return
        self.output.configure(state="normal")
        self.output.insert("end", text + "\n")
        self.output.see("end")
        self.output.configure(state="disabled")

    def _collect_config(self) -> SubgameConfig:
        board = parse_board(self.board.get())
        pot = int(self.pot.get())
        if pot <= 0:
            raise ValueError("Pot must be > 0")
        stack = int(self.stack.get())
        if stack <= 0:
            raise ValueError("Stack must be > 0")
        bet_sizes = parse_bet_sizes(self.bet_sizes.get())
        if not bet_sizes:
            raise ValueError("Bet sizes are required")
        oop_first_bets = parse_bet_sizes(self.oop_first_bets.get()) if self.oop_first_bets.get().strip() else []
        ip_first_bets = parse_bet_sizes(self.ip_first_bets.get()) if self.ip_first_bets.get().strip() else []
        oop_first_raises = parse_bet_sizes(self.oop_first_raises.get()) if self.oop_first_raises.get().strip() else []
        ip_first_raises = parse_bet_sizes(self.ip_first_raises.get()) if self.ip_first_raises.get().strip() else []
        oop_next_raises = parse_bet_sizes(self.oop_next_raises.get()) if self.oop_next_raises.get().strip() else []
        ip_next_raises = parse_bet_sizes(self.ip_next_raises.get()) if self.ip_next_raises.get().strip() else []
        include_all_in = bool(self.include_all_in.get())
        max_raises = 1000
        config = SubgameConfig(
            board=board,
            pot=pot,
            stack=stack,
            bet_sizes=bet_sizes,
            oop_first_bets=oop_first_bets,
            ip_first_bets=ip_first_bets,
            oop_first_raises=oop_first_raises,
            ip_first_raises=ip_first_raises,
            oop_next_raises=oop_next_raises,
            ip_next_raises=ip_next_raises,
            include_all_in=include_all_in,
            max_raises=max_raises,
            p0_range=self.range_models[0].to_data(),
            p1_range=self.range_models[1].to_data(),
        )
        return config

    def _save_config(self) -> None:
        try:
            config = self._collect_config()
        except ValueError as exc:
            messagebox.showerror("Invalid config", str(exc))
            return
        path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON", "*.json")])
        if not path:
            return
        with open(path, "w", encoding="utf-8") as f:
            json.dump(serialize_subgame_config(config, self.range_models), f, indent=2)
        self._log(f"Saved config to {path}")

    def _load_config(self) -> None:
        path = filedialog.askopenfilename(filetypes=[("JSON", "*.json")])
        if not path:
            return
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.board.set(" ".join(data.get("board", [])))
        self.pot.set(str(data.get("pot", "")))
        self.stack.set(str(data.get("stack", "")))
        self.bet_sizes.set(",".join(str(x) for x in data.get("bet_sizes", [])))
        self.oop_first_bets.set(",".join(str(x) for x in data.get("oop_first_bets", [])))
        self.ip_first_bets.set(",".join(str(x) for x in data.get("ip_first_bets", [])))
        self.oop_first_raises.set(",".join(str(x) for x in data.get("oop_first_raises", [])))
        self.ip_first_raises.set(",".join(str(x) for x in data.get("ip_first_raises", [])))
        self.oop_next_raises.set(",".join(str(x) for x in data.get("oop_next_raises", [])))
        self.ip_next_raises.set(",".join(str(x) for x in data.get("ip_next_raises", [])))
        self.include_all_in.set(bool(data.get("include_all_in", True)))
        algo_value = data.get("algorithm")
        if isinstance(algo_value, str):
            label = self.algorithm_value_to_label.get(algo_value, "CFR+")
            self._set_algorithm_label(label)
        p0_data = self._range_data_from_config(data, "p0_range", "p0_range_text")
        p1_data = self._range_data_from_config(data, "p1_range", "p1_range_text")
        self.range_models[0] = RangeModel.from_data(p0_data)
        self.range_models[1] = RangeModel.from_data(p1_data)
        self.range_selected[0] = None
        self.range_selected[1] = None
        self._update_selection_detail(0)
        self._update_selection_detail(1)
        self._refresh_matrix(0)
        self._refresh_matrix(1)
        self._log(f"Loaded config from {path}")

    def _range_data_from_config(self, data: dict, key: str, legacy_key: str) -> RangeData:
        raw = data.get(key)
        if isinstance(raw, RangeData):
            return raw
        if isinstance(raw, dict):
            cells = {str(label): float(weight) for label, weight in raw.get("cells", {}).items()}
            combos = {str(label): float(weight) for label, weight in raw.get("combos", {}).items()}
            return RangeData(cells=cells, combos=combos)
        legacy_text = data.get(legacy_key, "")
        if isinstance(legacy_text, str) and legacy_text.strip():
            return parse_range_text(legacy_text)
        return RangeData()

    def _toggle_solve(self) -> None:
        if self.solve_running:
            self._request_stop()
            return
        self.solve_stop_event.clear()
        self.solve_running = True
        self._update_solve_button()
        thread = threading.Thread(target=self._solve_thread, daemon=True)
        thread.start()

    def _update_solve_button(self) -> None:
        def update() -> None:
            if self.solve_button is None:
                return
            self.solve_button.configure(text="Stop" if self.solve_running else "Solve")

        self.root.after(0, update)

    def _request_stop(self) -> None:
        self.solve_stop_event.set()
        proc = self.solve_process
        if proc is None or proc.poll() is not None:
            return
        try:
            proc.send_signal(signal.SIGINT)
        except Exception:
            proc.terminate()

    def _solve_thread(self) -> None:
        temp_path: Path | None = None
        strategy_path: Path | None = None
        try:
            try:
                config = self._collect_config()
            except ValueError as exc:
                self._show_error("Invalid config", str(exc))
                return
            solver = self.solver_path.get().strip()
            if not solver or not os.path.exists(solver):
                self._show_error("Solver not found", "Build cpp or set solver path.")
                return

            try:
                payload = serialize_subgame_config(config, self.range_models)
            except ValueError as exc:
                self._show_error("Invalid range", str(exc))
                return
            with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as temp:
                temp_path = Path(temp.name)
                json.dump(payload, temp, indent=2)
            with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as temp_json:
                strategy_path = Path(temp_json.name)

            try:
                checkpoints = self._build_checkpoints()
            except ValueError as exc:
                self._show_error("Invalid solver settings", str(exc))
                return
            algo_value = self.algorithm_label_to_value.get(self.algorithm.get(), "cfr+")
            cmd = [
                solver,
                "--config",
                str(temp_path),
                "--algo",
                algo_value,
            ]
            if strategy_path is not None:
                cmd.extend(["--dump-strategy", str(strategy_path)])
            if checkpoints:
                cmd.extend(["--checkpoints", ",".join(str(x) for x in checkpoints)])
            target_pct = self._parse_target_pct()
            if target_pct is not None:
                target_exp = config.pot * (target_pct / 100.0)
                cmd.extend(["--target-exp", f"{target_exp:.6f}"])
            self._log("Running solver...")
            cwd = Path(__file__).resolve().parents[3]
            self.solve_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=cwd,
            )
            stdout, stderr = self.solve_process.communicate()
            returncode = self.solve_process.returncode
            self.solve_process = None
            if self.solve_stop_event.is_set():
                if stdout:
                    self._log(stdout.strip())
                self._log("Solve stopped.")
                return
            if returncode != 0:
                if stdout:
                    self._log(stdout.strip())
                self._show_error("Solver error", stderr.strip() or "Solver exited with error.")
                return
            if stdout:
                self._log(stdout.strip())
            if strategy_path is not None and strategy_path.exists():
                try:
                    with open(strategy_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    bundle = self._prepare_solution_bundle(data, config)
                    if bundle is not None:
                        self.root.after(0, lambda b=bundle: self._apply_solution_bundle(b))
                except Exception as exc:
                    self._log(f"Failed to load strategy: {exc}")
            self._report_target(stdout or "", checkpoints, config.pot)
        finally:
            self.solve_process = None
            self.solve_running = False
            self._update_solve_button()
            if temp_path is not None and temp_path.exists():
                temp_path.unlink()
            if strategy_path is not None and strategy_path.exists():
                strategy_path.unlink()

    def _build_checkpoints(self) -> List[int]:
        iters = self._parse_iterations()
        target_pct = self._parse_target_pct()
        if iters is None and target_pct is None:
            raise ValueError("Set iterations or target exploitability.")
        if target_pct is None:
            return [iters]
        if iters is None:
            return []
        if iters <= 5:
            return [iters]
        checkpoints = [5]
        value = 10
        while value < iters:
            checkpoints.append(value)
            value *= 2
        if checkpoints[-1] != iters:
            checkpoints.append(iters)
        return checkpoints

    def _report_target(self, output: str, checkpoints: List[int], pot: int) -> None:
        target_pct = self._parse_target_pct()
        if target_pct is None:
            return
        threshold = pot * (target_pct / 100.0)
        values = self._parse_values(output)
        if not values:
            return
        steps = checkpoints if checkpoints else self._pow2_steps(len(values))
        for step, exp in zip(steps, values):
            if exp <= threshold:
                self._log(f"Target met at iter={step} (exp={exp:.6f}, threshold={threshold:.6f})")
                return
        last = values[-1]
        self._log(f"Target not met (last exp={last:.6f}, threshold={threshold:.6f})")

    def _pow2_steps(self, count: int) -> List[int]:
        steps = []
        if count <= 0:
            return steps
        steps.append(5)
        value = 10
        while len(steps) < count:
            steps.append(value)
            value *= 2
        return steps

    def _parse_iterations(self) -> int | None:
        raw = self.iterations.get().strip()
        if not raw:
            return None
        try:
            iters = int(raw)
        except ValueError as exc:
            raise ValueError("Iterations must be an integer.") from exc
        if iters <= 0:
            raise ValueError("Iterations must be > 0")
        return iters

    def _parse_target_pct(self) -> float | None:
        raw = self.target_expl.get().strip()
        if not raw:
            return None
        try:
            target_pct = float(raw)
        except ValueError as exc:
            raise ValueError("Target exploitability must be a number.") from exc
        if target_pct <= 0:
            raise ValueError("Target exploitability must be > 0")
        return target_pct

    def _parse_values(self, output: str) -> List[float]:
        label = f"{self.algorithm.get()}:"
        for line in output.splitlines():
            stripped = line.strip()
            if stripped.startswith(label):
                values_part = stripped[len(label) :].strip()
                if "Exploitability (chips):" in values_part:
                    values_part = values_part.split("Exploitability (chips):", 1)[1].strip()
                    if "Exploitability (% of pot):" in values_part:
                        values_part = values_part.split("Exploitability (% of pot):", 1)[0].strip()
                    if "|" in values_part:
                        values_part = values_part.split("|", 1)[0].strip()
                elif "exp_chips=" in values_part:
                    values_part = values_part.split("exp_chips=", 1)[1].strip()
                    if "exp_pot=" in values_part:
                        values_part = values_part.split("exp_pot=", 1)[0].strip()
                elif "exp=" in values_part:
                    values_part = values_part.split("exp=", 1)[1].strip()
                if "(time_sec=" in values_part:
                    values_part = values_part.split("(time_sec=")[0].strip()
                if not values_part:
                    return []
                return [float(value) for value in values_part.split()]
        return []

    def _set_solution_detail(self, text: str) -> None:
        widget = self.solution_detail
        if widget is None:
            return
        widget.configure(state="normal")
        widget.delete("1.0", tk.END)
        widget.insert("1.0", text, ("detail_sub",))
        widget.configure(state="disabled")

    def _render_solution_detail(
        self,
        title: str,
        reach_pct: float,
        mix: Tuple[float, float, float],
        combo_rows: List[Tuple[str, float, List[Tuple[str, float, str]]]],
        action_width: int = 0,
    ) -> None:
        widget = self.solution_detail
        if widget is None:
            return
        widget.configure(state="normal")
        widget.delete("1.0", tk.END)
        widget.insert("end", title + "\n", ("detail_title",))
        widget.insert("end", f"Reach (class): {reach_pct:.2f}%\n", ("detail_sub",))
        widget.insert(
            "end",
            "Mix: fold {:.1f}% • check/call {:.1f}% • bet/raise {:.1f}%\n".format(mix[0], mix[1], mix[2]),
            ("detail_sub",),
        )
        widget.insert("end", "\n", ("detail_sub",))
        widget.insert("end", f"{'Hand':<6} {'Reach':>7}  Actions\n", ("detail_head",))
        for hand, reach, actions in combo_rows:
            widget.insert("end", f"{hand:<6} {reach:>6.1f}%  ", ("detail_mono",))
            for token, prob, tag in actions:
                label = token if action_width <= 0 else f"{token:<{action_width}}"
                widget.insert("end", f"{label} {prob:>5.1f}% ", ("detail_mono", tag))
            widget.insert("end", "\n", ("detail_mono",))
        widget.configure(state="disabled")

    def _action_tokens(self, actions: List[Action]) -> List[str]:
        tokens = []
        for action in actions:
            if action.label in ("c", "f"):
                tokens.append(action.label)
            else:
                tokens.append(f"{action.label}{action.amount}")
        return tokens

    def _compute_solution_reach(
        self, game: RiverHoldemGame, profiles: List[Dict[str, Tuple[List[str], List[List[float]]]]]
    ) -> Dict[int, Dict[str, List[float]]]:
        num0 = len(game.hands[0])
        num1 = len(game.hands[1])
        reach_by_key: Dict[int, Dict[str, List[float]]] = {0: {}, 1: {}}

        def traverse(state: RiverState, reach0: List[float], reach1: List[float]) -> None:
            key = game.infoset_key(state, 0)
            if key not in reach_by_key[0]:
                reach_by_key[0][key] = reach0
                reach_by_key[1][key] = reach1
            if game.is_terminal(state):
                return
            player = game.current_player(state)
            actions = game.legal_actions(state)
            if player == 0:
                strat0 = profile_strategy(game, profiles[0], state, 0, num0)
                for a_idx, action in enumerate(actions):
                    next_reach0 = [reach0[h] * strat0[h][a_idx] for h in range(num0)]
                    traverse(game.next_state(state, action), next_reach0, reach1)
                return
            strat1 = profile_strategy(game, profiles[1], state, 1, num1)
            for a_idx, action in enumerate(actions):
                next_reach1 = [reach1[h] * strat1[h][a_idx] for h in range(num1)]
                traverse(game.next_state(state, action), reach0, next_reach1)

        traverse(game.initial_state(), list(game.hand_weights[0]), list(game.hand_weights[1]))
        return reach_by_key

    def _build_solution_nodes(self, game: RiverHoldemGame) -> Tuple[Dict[str, RiverState], List[str]]:
        states: Dict[str, RiverState] = {}
        nodes_all: List[Tuple[int, str]] = []
        seen: set[str] = set()

        def traverse(state: RiverState, depth: int) -> None:
            key = game.infoset_key(state, 0)
            if key not in states:
                states[key] = state
            if game.is_terminal(state):
                return
            if key not in seen:
                nodes_all.append((depth, key))
                seen.add(key)
            for action in game.legal_actions(state):
                traverse(game.next_state(state, action), depth + 1)

        traverse(game.initial_state(), 0)
        nodes_all.sort(key=lambda item: (item[0], item[1]))
        ordered_nodes = [key for _, key in nodes_all]
        return states, ordered_nodes

    def _build_solution_class_map(self, hands: List[str]) -> Dict[str, List[int]]:
        class_map: Dict[str, List[int]] = {}
        for idx, hand in enumerate(hands):
            label = hand_class(hand)
            class_map.setdefault(label, []).append(idx)
        return class_map

    def _prepare_solution_bundle(self, data: dict, config: SubgameConfig) -> dict | None:
        players = data.get("players")
        if not isinstance(players, list) or len(players) < 2:
            self._log("Strategy dump missing player data.")
            return None
        profiles: List[Dict[str, Tuple[List[str], List[List[float]]]]] = []
        hands: List[List[str]] = []
        weights: List[List[float]] = []
        for p_idx in (0, 1):
            entry = players[p_idx] if p_idx < len(players) else {}
            raw_hands = entry.get("hands", [])
            raw_weights = entry.get("weights", [])
            raw_profile = entry.get("profile", {})
            if not isinstance(raw_hands, list) or not isinstance(raw_weights, list):
                self._log("Strategy dump missing hands or weights.")
                return None
            hand_list = [canonical_hand(str(hand)) for hand in raw_hands]
            weight_list = [float(w) for w in raw_weights]
            profile_map: Dict[str, Tuple[List[str], List[List[float]]]] = {}
            if isinstance(raw_profile, dict):
                for key, value in raw_profile.items():
                    if not isinstance(value, dict):
                        continue
                    actions = [str(token) for token in value.get("actions", [])]
                    matrix = [[float(v) for v in row] for row in value.get("strategy", [])]
                    profile_map[str(key)] = (actions, matrix)
            profiles.append(profile_map)
            hands.append(hand_list)
            weights.append(weight_list)

        game_config = RiverHoldemConfig(
            board=config.board,
            pot=config.pot,
            stacks=(config.stack, config.stack),
            bet_sizes=config.bet_sizes,
            oop_first_bets=config.oop_first_bets or None,
            ip_first_bets=config.ip_first_bets or None,
            oop_first_raises=config.oop_first_raises or None,
            ip_first_raises=config.ip_first_raises or None,
            oop_next_raises=config.oop_next_raises or None,
            ip_next_raises=config.ip_next_raises or None,
            include_all_in=config.include_all_in,
            max_raises=config.max_raises,
            ranges=(hands[0], hands[1]),
            range_weights=(weights[0], weights[1]),
        )
        game = RiverHoldemGame(game_config)
        states, nodes = self._build_solution_nodes(game)
        reach = self._compute_solution_reach(game, profiles)
        class_map = {0: self._build_solution_class_map(hands[0]), 1: self._build_solution_class_map(hands[1])}
        bundle = {
            "game": game,
            "profiles": profiles,
            "hands": hands,
            "weights": weights,
            "states": states,
            "nodes": nodes,
            "reach": reach,
            "class_map": class_map,
        }
        return bundle

    def _apply_solution_bundle(self, bundle: dict) -> None:
        self.solution_game = bundle["game"]
        self.solution_profiles = bundle["profiles"]
        self.solution_hands = bundle["hands"]
        self.solution_weights = bundle["weights"]
        self.solution_states = bundle["states"]
        self.solution_nodes = bundle["nodes"]
        self.solution_reach = bundle["reach"]
        self.solution_class_map = bundle["class_map"]
        self.solution_base_weights = {
            0: list(self.solution_game.hand_weights[0]),
            1: list(self.solution_game.hand_weights[1]),
        }
        selector = self.solution_node_selector
        nodes = self.solution_nodes
        if selector is not None:
            selector.configure(values=nodes)
        if nodes:
            self.solution_node_var.set(nodes[0])
            self._update_solution_grid()
        else:
            self._set_solution_detail("No nodes available for this game.")
            if self.solution_player_label is not None:
                self.solution_player_label.configure(text="Player to act: —")

    def _draw_solution_cell(
        self,
        canvas: tk.Canvas,
        label: str,
        reach_ratio: float,
        fold_prob: float,
        call_prob: float,
        raise_prob: float,
    ) -> None:
        canvas.delete("all")
        width = self.solution_cell_width
        height = self.solution_cell_height
        base_color = self.colors["solution_empty"]
        canvas.create_rectangle(0, 0, width, height, fill=base_color, outline=self.colors["solution_border"])
        reach_ratio = max(0.0, min(1.0, reach_ratio))
        colored_height = int(round(height * reach_ratio))
        if colored_height > 0:
            y0 = height - colored_height
            segments = [
                (fold_prob, self.colors["solution_fold"]),
                (call_prob, self.colors["solution_call"]),
                (raise_prob, self.colors["solution_raise"]),
            ]
            x = 0.0
            for idx, (prob, color) in enumerate(segments):
                if prob <= 0:
                    continue
                if idx == len(segments) - 1:
                    x1 = width
                else:
                    x1 = min(width, int(round(x + width * prob)))
                if x1 > x:
                    canvas.create_rectangle(x, y0, x1, height, fill=color, width=0)
                x = x1
        canvas.create_text(
            width / 2,
            height / 2,
            text=label,
            fill="#f8f5f0",
            font=self.font_cell,
        )

    def _update_solution_grid(self) -> None:
        game = self.solution_game
        if game is None:
            self._set_solution_detail("Run a solve to view strategy output.")
            return
        key = self.solution_node_var.get()
        if not key:
            self._set_solution_detail("Select a node to view strategy.")
            return
        state = self.solution_states.get(key)
        if state is None:
            self._set_solution_detail("Unknown node.")
            return
        if state.player is None:
            self._set_solution_detail("Selected node is terminal.")
            return
        player = state.player
        self.solution_current_player = player
        if self.solution_player_label is not None:
            self.solution_player_label.configure(text=f"Player to act: P{player}")
        actions = game.legal_actions(state)
        num_hands = len(game.hands[player])
        matrix = profile_strategy(game, self.solution_profiles[player], state, player, num_hands)
        reach_vec = self.solution_reach[player].get(key, [0.0 for _ in range(num_hands)])
        base_weights = self.solution_base_weights.get(player, [0.0 for _ in range(num_hands)])
        self.solution_current_actions = actions
        self.solution_current_strategy = matrix
        self.solution_current_reach = reach_vec

        action_categories: List[Tuple[float, float, float]] = []
        for row in matrix:
            call_prob = 0.0
            fold_prob = 0.0
            raise_prob = 0.0
            for a_idx, action in enumerate(actions):
                if action.label == "f":
                    fold_prob += row[a_idx]
                elif action.label == "c":
                    call_prob += row[a_idx]
                else:
                    raise_prob += row[a_idx]
            action_categories.append((fold_prob, call_prob, raise_prob))

        hand_reach_scale = self._hand_reach_scale(player)

        for row_idx in range(len(RANK_GRID)):
            for col_idx in range(len(RANK_GRID)):
                label = self._cell_label(row_idx, col_idx)
                indices = self.solution_class_map.get(player, {}).get(label, [])
                canvas = self.solution_cells.get((row_idx, col_idx))
                if canvas is None:
                    continue
                if not indices:
                    self._draw_solution_cell(canvas, label, 0.0, 0.0, 0.0, 0.0)
                    continue
                class_weight = sum(base_weights[idx] for idx in indices)
                class_reach = sum(reach_vec[idx] for idx in indices)
                if class_weight <= 0.0 or class_reach <= 0.0:
                    self._draw_solution_cell(canvas, label, 0.0, 0.0, 0.0, 0.0)
                    continue
                if hand_reach_scale is None:
                    reach_ratio = class_reach / class_weight
                else:
                    class_avg_reach = class_reach / len(indices)
                    reach_ratio = class_avg_reach / hand_reach_scale
                fold_sum = sum(reach_vec[idx] * action_categories[idx][0] for idx in indices)
                call_sum = sum(reach_vec[idx] * action_categories[idx][1] for idx in indices)
                raise_sum = sum(reach_vec[idx] * action_categories[idx][2] for idx in indices)
                total = class_reach
                fold_prob = fold_sum / total
                call_prob = call_sum / total
                raise_prob = raise_sum / total
                self._draw_solution_cell(canvas, label, reach_ratio, fold_prob, call_prob, raise_prob)
        self._set_solution_detail(f"Hover a hand class to see details for {key}.")

    def _solution_hover(self, row: int, col: int) -> None:
        game = self.solution_game
        if game is None:
            return
        player = self.solution_current_player
        if player is None:
            return
        key = self.solution_node_var.get()
        if not key:
            return
        state = self.solution_states.get(key)
        if state is None:
            return
        if state.player is None:
            return
        player = state.player
        label = self._cell_label(row, col)
        indices = self.solution_class_map.get(player, {}).get(label, [])
        if not indices:
            self._set_solution_detail(f"{label}: no hands in range.")
            return
        actions = self.solution_current_actions
        matrix = self.solution_current_strategy
        reach_vec = self.solution_current_reach
        if not actions or not matrix or not reach_vec:
            self._set_solution_detail("Strategy not available for this node.")
            return
        tokens = self._action_tokens(actions)
        to_call = max(state.contrib) - state.contrib[player]
        action_index = {token: idx for idx, token in enumerate(tokens)}
        display_tokens: List[Tuple[str, str]] = []
        for token in tokens:
            if token == "f":
                display_tokens.append((token, "Fold"))
        for token in tokens:
            if token == "c":
                display_tokens.append((token, "Check" if to_call == 0 else "Call"))
        for token in tokens:
            if token.startswith("b"):
                display_tokens.append((token, f"Bet {token[1:]}"))
        for token in tokens:
            if token.startswith("r"):
                display_tokens.append((token, f"Raise {token[1:]}"))
        action_width = 0
        for _, label_text in display_tokens:
            action_width = max(action_width, len(label_text))
        base_weights = self.solution_base_weights.get(player, [])
        class_weight = sum(base_weights[idx] for idx in indices)
        class_reach = sum(reach_vec[idx] for idx in indices)
        hand_reach_scale = self._hand_reach_scale(player)
        if hand_reach_scale is None:
            reach_ratio = class_reach / class_weight if class_weight > 0.0 else 0.0
        else:
            class_avg_reach = class_reach / len(indices)
            reach_ratio = class_avg_reach / hand_reach_scale
        call_sum = 0.0
        fold_sum = 0.0
        raise_sum = 0.0
        for idx in indices:
            row_probs = matrix[idx]
            for a_idx, action in enumerate(actions):
                if action.label == "f":
                    fold_sum += reach_vec[idx] * row_probs[a_idx]
                elif action.label == "c":
                    call_sum += reach_vec[idx] * row_probs[a_idx]
                else:
                    raise_sum += reach_vec[idx] * row_probs[a_idx]
        total = class_reach if class_reach > 0.0 else 1.0
        mix = ((fold_sum / total) * 100.0, (call_sum / total) * 100.0, (raise_sum / total) * 100.0)
        combo_rows: List[Tuple[str, float, List[Tuple[str, float, str]]]] = []
        for idx in indices:
            if idx >= len(matrix):
                continue
            hand = self.solution_hands[player][idx]
            base_weight = base_weights[idx] if idx < len(base_weights) else 0.0
            if hand_reach_scale is None:
                reach_cond = reach_vec[idx] / base_weight if base_weight > 0.0 else 0.0
            else:
                reach_cond = reach_vec[idx] / hand_reach_scale
            row_probs = matrix[idx]
            action_parts = []
            for token, label_text in display_tokens:
                idx_token = action_index.get(token)
                if idx_token is None or idx_token >= len(row_probs):
                    continue
                prob = row_probs[idx_token] * 100.0
                if token.startswith(("b", "r")):
                    tag = "detail_raise"
                elif token == "c":
                    tag = "detail_call"
                else:
                    tag = "detail_fold"
                action_parts.append((label_text, prob, tag))
            combo_rows.append((hand, reach_cond * 100.0, action_parts))
        title = f"{label} @ {key}"
        self._render_solution_detail(title, reach_ratio * 100.0, mix, combo_rows, action_width)

    def _show_error(self, title: str, message: str) -> None:
        self.root.after(0, lambda: messagebox.showerror(title, message))


def main() -> None:
    root = tk.Tk()
    gui = SubgameGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
