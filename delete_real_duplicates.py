from __future__ import annotations

import datetime as _dt
import hashlib
import os
import threading
import csv
import json
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
except ImportError as exc:  # pragma: no cover - tkinter is standard but allow clearer error.
    raise SystemExit("tkinter is required to run this tool.") from exc


FileEntry = Tuple[Path, int, float]  # path, size, modified timestamp
SETTINGS_PATH = Path.cwd() / ".duplicate_cleaner_settings.json"


def default_downloads_folder() -> Path:
    """Resolve a sensible default downloads folder."""
    # Prefer the user's standard Downloads directory.
    home = Path.home()
    downloads = home / "Downloads"
    if downloads.exists():
        return downloads

    # Fallback to a repo-local downloads folder (useful for testing).
    repo_downloads = Path.cwd() / "downloads"
    return repo_downloads if repo_downloads.exists() else Path.cwd()


def human_size(num_bytes: int) -> str:
    """Return a human friendly size string."""
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(num_bytes)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{num_bytes} B"


def gather_recent_files(
    folder: Path,
    days_back: int,
    *,
    name_prefix: str | None = None,
    include_subfolders: bool = True,
) -> Tuple[List[FileEntry], int]:
    """Collect files modified within the last `days_back` days (0 = all), returning entries and a skipped-error count."""
    cutoff = None if days_back <= 0 else _dt.datetime.now().timestamp() - days_back * 24 * 3600
    prefix = name_prefix.casefold() if name_prefix else None
    iterator = folder.rglob("*") if include_subfolders else folder.glob("*")
    entries: List[FileEntry] = []
    skipped = 0
    for path in iterator:
        try:
            if not path.is_file():
                continue
            if prefix and not path.name.casefold().startswith(prefix):
                continue
            stat = path.stat()
        except OSError:
            skipped += 1
            continue
        if cutoff is None or stat.st_mtime >= cutoff:
            entries.append((path, stat.st_size, stat.st_mtime))
    return entries, skipped


def _sha256(path: Path, chunk_size: int = 1024 * 1024) -> str:
    """Return the SHA-256 hex digest for a file (streamed to handle large files)."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            h.update(chunk)
    return h.hexdigest()


def _normalize_name(name: str) -> str:
    """Normalize file name for comparison (case-insensitive on Windows)."""
    return name.casefold() if os.name == "nt" else name


def _describe_key(key: Tuple[Tuple[str, object], ...]) -> str:
    """Format a human-readable description of the chosen duplicate criteria."""
    parts: List[str] = []
    for name, value in key:
        if name == "hash":
            parts.append(f"sha256 {str(value)[:8]}...")
        elif name == "size":
            parts.append(f"size {human_size(int(value))}")
        elif name == "name":
            parts.append(f"name {value}")
        elif name == "mtime":
            ts = _dt.datetime.fromtimestamp(int(value)).strftime("%Y-%m-%d %H:%M:%S")
            parts.append(f"mtime {ts}")
    return " | ".join(parts)


def find_duplicate_groups(
    entries: Iterable[FileEntry],
    *,
    use_hash: bool = True,
    use_size: bool = True,
    use_name: bool = False,
    use_mtime: bool = False,
    hash_max_bytes: int | None = None,
) -> Tuple[Dict[Tuple[Tuple[str, object], ...], List[FileEntry]], int]:
    """
    Group files by selected criteria; return only groups with real duplicates.

    You can toggle content hash, size, name, and modified time checks. At least one
    criterion should be enabled. Hashing is only done when `use_hash` is True.
    """
    if not any([use_hash, use_size, use_name, use_mtime]):
        return {}, 0

    groups: Dict[Tuple[Tuple[str, object], ...], List[FileEntry]] = {}
    hash_skipped = 0

    # Bucket by size first to reduce hashing work when hashing is enabled.
    size_buckets: Dict[int, List[FileEntry]] = {}
    if use_hash:
        for path, size, mtime in entries:
            size_buckets.setdefault(size, []).append((path, size, mtime))
    else:
        size_buckets = {None: list(entries)}  # type: ignore[arg-type]

    for _, files in size_buckets.items():
        # If hashing is active and this size has only one file, no need to hash.
        do_hash_here = use_hash and len(files) > 1

        for path, size, mtime in files:
            components: List[Tuple[str, object]] = []

            if do_hash_here:
                if hash_max_bytes is not None and size > hash_max_bytes:
                    hash_skipped += 1
                else:
                    try:
                        digest = _sha256(path)
                    except OSError:
                        continue
                    components.append(("hash", digest))
            if use_size:
                components.append(("size", size))
            if use_name:
                components.append(("name", _normalize_name(path.name)))
            if use_mtime:
                components.append(("mtime", mtime))

            if not components:
                continue

            key = tuple(components)
            groups.setdefault(key, []).append((path, size, mtime))

    return {k: v for k, v in groups.items() if len(v) > 1}, hash_skipped


def delete_files(paths: Iterable[Path], *, on_error=None) -> None:
    """Delete files; prefer Recycle Bin/Trash if send2trash is available."""
    try:
        from send2trash import send2trash  # type: ignore
    except Exception:
        send2trash = None

    for path in paths:
        try:
            if send2trash:
                send2trash(str(path))
            else:
                path.unlink(missing_ok=True)
        except Exception as exc:
            if on_error:
                on_error("Delete failed", f"Could not delete {path}:\n{exc}")


class DuplicateCleanerUI:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        root.title("Delete Real Duplicates")

        self.style = ttk.Style(root)
        if self.style.theme_use() in {"vista", "xpnative", "winnative"}:
            self.style.theme_use("clam")
        self.style.configure(
            "Primary.TButton",
            padding=(12, 8),
            font=("Segoe UI", 10, "bold"),
            background="#d8f0d8",
            foreground="#1f5f1f",
        )
        self.style.map(
            "Primary.TButton",
            background=[("active", "#cce8cc"), ("disabled", "#edf7ed")],
            foreground=[("disabled", "#8a8a8a")],
        )
        self.style.configure(
            "Danger.TButton",
            padding=(12, 8),
            font=("Segoe UI", 10, "bold"),
            background="#f6d6d6",
            foreground="#7a1f1f",
        )
        self.style.map(
            "Danger.TButton",
            background=[("active", "#f0c7c7"), ("disabled", "#f9eded")],
            foreground=[("disabled", "#8a8a8a")],
        )
        # Table styling: subtle borders on headings/cells to clarify column boundaries.
        self.style.configure(
            "ColumnLines.Treeview",
            bordercolor="#d0d0d0",
            darkcolor="#d0d0d0",
            lightcolor="#d0d0d0",
            rowheight=22,
        )
        self.style.configure("ColumnLines.Treeview.Heading", bordercolor="#d0d0d0", relief="solid")

        self.folder_var = tk.StringVar(value=str(default_downloads_folder()))
        self.days_var = tk.IntVar(value=2)
        self.use_hash = tk.BooleanVar(value=True)
        self.use_size = tk.BooleanVar(value=True)
        self.use_name = tk.BooleanVar(value=False)
        self.use_mtime = tk.BooleanVar(value=False)
        self.hash_limit_enabled = tk.BooleanVar(value=True)
        self.hash_max_mb = tk.IntVar(value=500)
        self.skip_same_folder_prompt = tk.BooleanVar(value=False)
        self.rename_kept_enabled = tk.BooleanVar(value=False)
        self.show_keep_full_paths = tk.BooleanVar(value=False)
        self.include_subfolders = tk.BooleanVar(value=True)
        self.prefix_var = tk.StringVar(value="")
        self.filter_var = tk.StringVar(value="")
        self.selection_var = tk.StringVar(value="0 files selected / 0 groups affected")
        self.folder_history: List[str] = []
        self._scanning = False
        self._last_hash_skipped = 0
        self._last_scan_skipped = 0
        self._last_folder: Path | None = None
        self._last_days: int = 0
        self._last_scan_seconds: float | None = None
        self.duplicates: Dict[Tuple[Tuple[str, object], ...], List[FileEntry]] = {}
        self._item_meta: Dict[str, Dict[str, object]] = {}
        self._sort_directions: Dict[str, bool] = {}
        self._last_sort_column: str | None = None
        self._last_sort_direction: bool = True  # True = ascending
        self._spinner_job: str | None = None
        self._actions_enabled = False
        self._selection_updating = False

        self._build_menu()
        self._build_layout()
        self._load_settings()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_menu(self) -> None:
        menubar = tk.Menu(self.root)
        help_menu = tk.Menu(menubar, tearoff=False)
        help_menu.add_command(label="How to use", command=self._show_help)
        help_menu.add_command(label="Optional checks", command=self._show_optional_checks)
        menubar.add_cascade(label="Help", menu=help_menu)
        self.root.config(menu=menubar)

    def _build_layout(self) -> None:
        frm = ttk.Frame(self.root, padding=12)
        frm.grid(row=0, column=0, sticky="nsew")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

        # Folder chooser.
        ttk.Label(frm, text="Folder to scan:").grid(row=0, column=0, sticky="w")
        self.folder_combo = ttk.Combobox(frm, textvariable=self.folder_var, width=60, values=self.folder_history)
        self.folder_combo.grid(row=0, column=1, sticky="ew", padx=(4, 4))
        self.folder_combo.bind("<Button-1>", self._open_folder_dropdown)
        self.folder_combo.bind("<Down>", self._open_folder_dropdown)
        self.folder_combo.bind("<<ComboboxSelected>>", self._on_folder_selected)
        self.folder_combo.bind("<Escape>", self._close_folder_dropdown)
        browse_btn = ttk.Button(frm, text="Browse...", command=self._browse_folder)
        browse_btn.grid(row=0, column=2, sticky="e")
        clear_btn = ttk.Button(frm, text="Clear history", command=self._clear_folder_history, width=12)
        clear_btn.grid(row=0, column=3, sticky="e")
        frm.columnconfigure(1, weight=1)

        # Days back.
        ttk.Label(frm, text="Days back:").grid(row=1, column=0, sticky="w", pady=(6, 0))
        days_spin = ttk.Spinbox(frm, from_=0, to=365, textvariable=self.days_var, width=6)
        days_spin.grid(row=1, column=1, sticky="w", pady=(6, 0))
        quick_days = ttk.Frame(frm)
        quick_days.grid(row=1, column=2, sticky="w", pady=(6, 0))
        ttk.Label(quick_days, text="Quick:").grid(row=0, column=0, sticky="w", padx=(0, 4))
        quick_presets = [("all", 0), ("week", 7), ("month", 30)]
        for idx, (label, val) in enumerate(quick_presets, start=1):
            ttk.Button(quick_days, text=label, width=6, command=lambda v=val: self._set_days(v)).grid(
                row=0, column=idx, padx=(0, 2)
            )

        # Subfolder toggle.
        ttk.Checkbutton(frm, text="Include subfolders", variable=self.include_subfolders).grid(
            row=2, column=0, columnspan=3, sticky="w", pady=(6, 0)
        )

        # Optional name prefix filter.
        ttk.Label(frm, text="Only scan file names starting with (optional):").grid(
            row=3, column=0, sticky="w", pady=(6, 0)
        )
        ttk.Entry(frm, textvariable=self.prefix_var, width=40).grid(
            row=3, column=1, sticky="w", padx=(4, 0), pady=(6, 0)
        )
        ttk.Label(frm, text="Leave blank to scan all files.").grid(row=3, column=2, sticky="w", pady=(6, 0))

        # Duplicate criteria toggles.
        criteria = ttk.LabelFrame(frm, text="Duplicate checks", padding=(8, 6))
        criteria.grid(row=4, column=0, columnspan=3, sticky="ew", pady=(10, 4))
        ttk.Checkbutton(criteria, text="Content hash (SHA-256)", variable=self.use_hash).grid(
            row=0, column=0, sticky="w", padx=(0, 10)
        )
        ttk.Checkbutton(criteria, text="Size", variable=self.use_size).grid(
            row=0, column=1, sticky="w", padx=(0, 10)
        )
        ttk.Checkbutton(criteria, text="File name", variable=self.use_name).grid(
            row=0, column=2, sticky="w", padx=(0, 10)
        )
        ttk.Checkbutton(criteria, text="Modified time", variable=self.use_mtime).grid(
            row=0, column=3, sticky="w"
        )
        hash_limit = ttk.Frame(criteria)
        hash_limit.grid(row=1, column=0, columnspan=4, sticky="w", pady=(6, 0))
        ttk.Checkbutton(hash_limit, text="Limit hashing to files up to", variable=self.hash_limit_enabled).grid(
            row=0, column=0, sticky="w"
        )
        ttk.Spinbox(hash_limit, from_=10, to=10_000, textvariable=self.hash_max_mb, width=6).grid(
            row=0, column=1, sticky="w", padx=(6, 4)
        )
        ttk.Label(hash_limit, text="MB (hashing skipped for larger files; other checks still apply)").grid(
            row=0, column=2, sticky="w"
        )

        # Deletion behavior.
        ttk.Checkbutton(
            frm,
            text="Skip keep-choice dialog when duplicates are in the same folder (auto keep newest)",
            variable=self.skip_same_folder_prompt,
        ).grid(row=5, column=0, columnspan=3, sticky="w", pady=(6, 0))
        ttk.Checkbutton(
            frm,
            text="Rename kept files after delete (pattern: name_YYYY-MM-DD_HH-MM-SS_###.ext)",
            variable=self.rename_kept_enabled,
        ).grid(row=6, column=0, columnspan=3, sticky="w", pady=(2, 6))

        # Buttons.
        btn_frame = ttk.Frame(frm)
        btn_frame.grid(row=7, column=0, columnspan=3, sticky="w", pady=(6, 4))
        self.scan_btn = ttk.Button(btn_frame, text="Scan 🔍", command=self._scan, style="Primary.TButton", width=14)
        self.scan_btn.grid(row=0, column=0, padx=(0, 10))
        self.delete_btn = ttk.Button(
            btn_frame, text="Delete duplicates", command=self._delete, state="disabled", style="Danger.TButton", width=18
        )
        self.delete_btn.grid(row=0, column=1, padx=(0, 4))

        # Notices and summary.
        self.notice_var = tk.StringVar(value="")
        ttk.Label(frm, textvariable=self.notice_var, foreground="#b36200").grid(
            row=8, column=0, columnspan=3, sticky="w", pady=(4, 0)
        )

        summary_frame = ttk.Frame(frm)
        summary_frame.grid(row=9, column=0, columnspan=3, sticky="ew", pady=(2, 2))
        summary_frame.columnconfigure(0, weight=1)
        self.summary_var = tk.StringVar(value="Scan results will appear here.")
        ttk.Label(summary_frame, textvariable=self.summary_var, wraplength=900, justify="left").grid(
            row=0, column=0, sticky="w"
        )
        actions = ttk.Frame(summary_frame)
        actions.grid(row=0, column=1, sticky="e")
        self.delete_selected_btn = ttk.Button(
            actions,
            text="Delete selected",
            command=self._delete_selected,
            state="disabled",
            style="Danger.TButton",
            width=14,
        )
        self.delete_selected_btn.grid(row=0, column=0, padx=(0, 4))
        self.copy_btn = ttk.Button(actions, text="Copy report", command=self._copy_report, state="disabled")
        self.copy_btn.grid(row=0, column=1, padx=(0, 4))
        self.export_btn = ttk.Button(actions, text="Export CSV", command=self._export_csv, state="disabled")
        self.export_btn.grid(row=0, column=2, padx=(0, 4))
        self.collapse_btn = ttk.Button(actions, text="Collapse all", command=self._collapse_all, state="disabled")
        self.collapse_btn.grid(row=0, column=3, padx=(0, 4))
        self.expand_btn = ttk.Button(actions, text="Expand all", command=self._expand_all, state="disabled")
        self.expand_btn.grid(row=0, column=4)
        ttk.Label(actions, textvariable=self.selection_var).grid(row=1, column=0, columnspan=5, sticky="e", pady=(4, 0))

        # Filter.
        filter_frame = ttk.Frame(frm)
        filter_frame.grid(row=10, column=0, columnspan=3, sticky="ew", pady=(0, 4))
        ttk.Label(filter_frame, text="Filter (name or folder contains):").grid(row=0, column=0, sticky="w")
        self.filter_entry = ttk.Entry(filter_frame, textvariable=self.filter_var, width=40, state="disabled")
        self.filter_entry.grid(row=0, column=1, sticky="w", padx=(4, 0))
        self.filter_var.trace_add("write", lambda *_: self._apply_filter())

        tree_frame = ttk.Frame(frm)
        tree_frame.grid(row=11, column=0, columnspan=3, sticky="nsew", pady=(0, 6))
        frm.rowconfigure(11, weight=1)
        tree_frame.rowconfigure(0, weight=1)
        tree_frame.columnconfigure(0, weight=1)

        columns = ("location", "modified", "size")
        self.results_tree = ttk.Treeview(
            tree_frame, columns=columns, show="tree headings", selectmode="extended", style="ColumnLines.Treeview"
        )
        self.results_tree.heading("#0", text="File / Group", anchor="w")
        self.results_tree.heading("location", text="Folder / Criteria", anchor="w")
        self.results_tree.heading("modified", text="Modified", anchor="w")
        self.results_tree.heading("size", text="Size", anchor="e")
        self.results_tree.column("#0", width=280, anchor="w", stretch=True)
        self.results_tree.column("location", width=320, anchor="w", stretch=True)
        self.results_tree.column("modified", width=150, anchor="w", stretch=False)
        self.results_tree.column("size", width=90, anchor="e", stretch=False)
        self.results_tree.grid(row=0, column=0, sticky="nsew")
        for col in ("#0",) + columns:
            self.results_tree.heading(col, command=lambda c=col: self._sort_tree(c))

        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=self.results_tree.yview)
        hsb = ttk.Scrollbar(tree_frame, orient="horizontal", command=self.results_tree.xview)
        self.results_tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")
        self.results_tree.bind("<Double-1>", self._on_tree_double_click)
        self.results_tree.bind("<Button-3>", self._on_tree_right_click)
        self.results_tree.bind("<<TreeviewSelect>>", self._on_tree_selection_change)

    def _load_settings(self) -> None:
        """Load saved settings from disk if present."""
        try:
            if SETTINGS_PATH.exists():
                data = SETTINGS_PATH.read_text(encoding="utf-8")
                opts = dict(json.loads(data))
                self.folder_var.set(opts.get("folder", self.folder_var.get()))
                self.days_var.set(int(opts.get("days", self.days_var.get())))
                self.use_hash.set(bool(opts.get("use_hash", self.use_hash.get())))
                self.use_size.set(bool(opts.get("use_size", self.use_size.get())))
                self.use_name.set(bool(opts.get("use_name", self.use_name.get())))
                self.use_mtime.set(bool(opts.get("use_mtime", self.use_mtime.get())))
                self.hash_limit_enabled.set(bool(opts.get("hash_limit_enabled", self.hash_limit_enabled.get())))
                self.hash_max_mb.set(int(opts.get("hash_max_mb", self.hash_max_mb.get())))
                self.skip_same_folder_prompt.set(bool(opts.get("skip_same_folder_prompt", self.skip_same_folder_prompt.get())))
                self.rename_kept_enabled.set(bool(opts.get("rename_kept_enabled", self.rename_kept_enabled.get())))
                self.show_keep_full_paths.set(bool(opts.get("show_keep_full_paths", self.show_keep_full_paths.get())))
                self.include_subfolders.set(bool(opts.get("include_subfolders", self.include_subfolders.get())))
                self.prefix_var.set(str(opts.get("name_prefix", self.prefix_var.get()) or "").strip())
                recents = opts.get("recent_folders", [])
                if isinstance(recents, list):
                    seen: set[str] = set()
                    self.folder_history = []
                    for item in recents:
                        p = str(item).strip()
                        if p and p.casefold() not in seen:
                            seen.add(p.casefold())
                            self.folder_history.append(p)
                    self.folder_combo.configure(values=self.folder_history)
        except Exception:
            # Ignore corrupt settings; fall back to defaults.
            pass

    def _save_settings(self) -> None:
        opts = {
            "folder": self.folder_var.get(),
            "days": int(self.days_var.get()),
            "use_hash": bool(self.use_hash.get()),
            "use_size": bool(self.use_size.get()),
            "use_name": bool(self.use_name.get()),
            "use_mtime": bool(self.use_mtime.get()),
            "hash_limit_enabled": bool(self.hash_limit_enabled.get()),
            "hash_max_mb": int(self.hash_max_mb.get()),
            "skip_same_folder_prompt": bool(self.skip_same_folder_prompt.get()),
            "rename_kept_enabled": bool(self.rename_kept_enabled.get()),
            "show_keep_full_paths": bool(self.show_keep_full_paths.get()),
            "name_prefix": self.prefix_var.get().strip(),
            "include_subfolders": bool(self.include_subfolders.get()),
            "recent_folders": list(self.folder_history),
        }
        try:
            SETTINGS_PATH.write_text(json.dumps(opts, indent=2), encoding="utf-8")
        except Exception:
            pass

    def _on_close(self) -> None:
        self._save_settings()
        self.root.destroy()

    def _start_scan_spinner(self) -> None:
        dots = [".", "..", "...", ""]
        self._spinner_idx = 0

        def tick() -> None:
            self.scan_btn.configure(text=f"Scanning 🔍{dots[self._spinner_idx]}")
            self._spinner_idx = (self._spinner_idx + 1) % len(dots)
            self._spinner_job = self.root.after(200, tick)

        tick()

    def _stop_scan_spinner(self) -> None:
        if self._spinner_job:
            try:
                self.root.after_cancel(self._spinner_job)
            except Exception:
                pass
            self._spinner_job = None
        self.scan_btn.configure(text="Scan 🔍")
        self._spinner_idx = 0

    def _remember_folder(self, folder: Path) -> None:
        """Track recently used folders for quick selection."""
        folder_str = str(folder)
        self.folder_history = [p for p in self.folder_history if p and p.casefold() != folder_str.casefold()]
        self.folder_history.insert(0, folder_str)
        self.folder_history = self.folder_history[:20]
        self.folder_combo.configure(values=self.folder_history)

    def _open_folder_dropdown(self, *_args) -> None:
        """Show recent folders dropdown when the box is clicked."""
        if not self.folder_history:
            return
        self.folder_combo.configure(values=self.folder_history)
        # Post after idle so Tk can process the click first; fallback to key if Post is unavailable.
        def _post() -> None:
            try:
                self.folder_combo.tk.call("ttk::combobox::Post", str(self.folder_combo))
            except Exception:
                self.folder_combo.event_generate("<Down>")

        self.folder_combo.after_idle(_post)

    def _on_folder_selected(self, *_args) -> None:
        """Close dropdown and keep focus usable after a selection."""
        self._close_folder_dropdown()

    def _close_folder_dropdown(self, *_args) -> None:
        """Close the dropdown when a choice is made or focus leaves."""
        try:
            self.folder_combo.tk.call("ttk::combobox::Unpost", str(self.folder_combo))
        except Exception:
            self.folder_combo.event_generate("<Escape>")

    def _clear_folder_history(self) -> None:
        """Clear saved folder suggestions."""
        self.folder_history = []
        self.folder_combo.configure(values=[])

    def _rename_conflicting_kept_files(self, kept: List[Path], deleting: List[Path]) -> List[Tuple[Path, Path]]:
        """
        Auto-rename kept files using the configured pattern. Always resolves same-name conflicts;
        when enabled, also renames all kept files to the pattern so names are unique and time-stamped.
        Pattern: base_YYYY-MM-DD_HH-MM-SS_###.ext
        """
        timestamp = _dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        rename_actions: List[Tuple[Path, Path]] = []
        errors: List[str] = []

        # Group kept files by base name.
        groups: Dict[str, List[Path]] = {}
        for path in kept:
            groups.setdefault(path.name, []).append(path)

        # Track occupied targets to avoid collisions (include deleting targets too).
        occupied: set[Path] = set(p.resolve() for p in kept + deleting if p.exists())

        for name, paths in groups.items():
            sorted_paths = sorted(paths)
            stem = Path(name).stem
            suffix = Path(name).suffix
            counter = 1
            # If renaming is enabled, rename all kept files; otherwise rename only conflicts (beyond the first).
            rename_list = sorted_paths if self.rename_kept_enabled.get() else sorted_paths[1:]
            for path in rename_list:
                while True:
                    candidate = path.with_name(f"{stem}_{timestamp}_{counter:03d}{suffix}")
                    counter += 1
                    if candidate.resolve() not in occupied:
                        break
                try:
                    path.rename(candidate)
                    occupied.add(candidate.resolve())
                    rename_actions.append((path, candidate))
                except Exception as exc:
                    errors.append(f"{path} -> {candidate} ({exc})")

        if errors:
            self._error("Rename issues", "Some files could not be renamed:\n" + "\n".join(errors))
        return rename_actions
    def _browse_folder(self) -> None:
        folder = filedialog.askdirectory(initialdir=self.folder_var.get() or str(Path.cwd()))
        if folder:
            self.folder_var.set(folder)
            self._remember_folder(Path(folder))

    def _set_days(self, days: int) -> None:
        self.days_var.set(max(0, min(days, 365)))

    def _scan(self) -> None:
        if self._scanning:
            return

        folder = Path(self.folder_var.get()).expanduser()
        days = max(self.days_var.get(), 0)

        if not folder.exists() or not folder.is_dir():
            self._error("Invalid folder", f"{folder} is not a valid directory.")
            return

        if not any([self.use_hash.get(), self.use_size.get(), self.use_name.get(), self.use_mtime.get()]):
            self._error("No criteria selected", "Select at least one duplicate check.")
            return

        self._scanning = True
        self.scan_btn.configure(state="disabled")
        self.delete_btn.configure(state="disabled")
        for item in self.results_tree.get_children():
            self.results_tree.delete(item)
        self._item_meta.clear()
        self._update_selection_status()
        self.summary_var.set("Scanning...")
        self.notice_var.set("")
        self._last_scan_seconds = None
        self._last_scan_skipped = 0

        thread = threading.Thread(
            target=self._run_scan_thread,
            args=(folder, days),
            daemon=True,
        )
        thread.start()
        self._start_scan_spinner()
        self._set_actions_enabled(False)
        self._set_filter_enabled(False)

    def _run_scan_thread(self, folder: Path, days: int) -> None:
        try:
            start = _dt.datetime.now()
            prefix = self.prefix_var.get().strip()
            entries, scan_skipped = gather_recent_files(
                folder,
                days,
                name_prefix=prefix or None,
                include_subfolders=self.include_subfolders.get(),
            )
            hash_limit = (
                self.hash_max_mb.get() * 1024 * 1024 if self.use_hash.get() and self.hash_limit_enabled.get() else None
            )
            duplicates, hash_skipped = find_duplicate_groups(
                entries,
                use_hash=self.use_hash.get(),
                use_size=self.use_size.get(),
                use_name=self.use_name.get(),
                use_mtime=self.use_mtime.get(),
                hash_max_bytes=hash_limit,
            )
        except Exception as exc:  # pragma: no cover - UI/IO bound
            self.root.after(0, lambda: self._error("Scan failed", str(exc)))
            self.root.after(0, self._finish_scan)
            return

        elapsed = (_dt.datetime.now() - start).total_seconds()
        self.root.after(0, lambda: self._on_scan_complete(folder, days, duplicates, hash_skipped, scan_skipped, elapsed))

    def _on_scan_complete(
        self,
        folder: Path,
        days: int,
        duplicates: Dict[Tuple[Tuple[str, object], ...], List[FileEntry]],
        hash_skipped: int,
        scan_skipped: int,
        elapsed_seconds: float,
    ) -> None:
        self.duplicates = duplicates
        self._last_hash_skipped = hash_skipped
        self._last_scan_skipped = scan_skipped
        self._last_scan_seconds = elapsed_seconds
        self._last_folder = folder
        self._last_days = days
        self._remember_folder(folder)
        self._close_folder_dropdown()
        self._render_results(folder, days)
        if self.duplicates:
            self.delete_btn.configure(state="normal")
        self._finish_scan()

    def _finish_scan(self) -> None:
        self._scanning = False
        self.scan_btn.configure(state="normal")
        self._stop_scan_spinner()

    def _render_results(self, folder: Path, days: int) -> None:
        for item in self.results_tree.get_children():
            self.results_tree.delete(item)
        self._item_meta.clear()

        if not self.duplicates:
            summary = f"No duplicates found in {folder} (last {days} day(s))."
            if self._last_scan_skipped:
                summary += f" Skipped {self._last_scan_skipped} file(s) due to scan errors."
                self.notice_var.set("Some files could not be scanned; see summary.")
            else:
                self.notice_var.set("")
            self.summary_var.set(summary)
            self.delete_btn.configure(state="disabled")
            self._set_actions_enabled(False)
            self._set_filter_enabled(False)
            self._update_selection_status()
            return

        total_dupes = sum(len(v) - 1 for v in self.duplicates.values())
        summary = (
            f"Found {len(self.duplicates)} duplicate group(s) covering {total_dupes} "
            f"deletable file(s) in {folder} ({'all time' if days <= 0 else f'last {days} day(s)'})."
        )
        prefix_text = self.prefix_var.get().strip()
        if prefix_text:
            summary += f" Name prefix filter: '{prefix_text}'."
        if not self.include_subfolders.get():
            summary += " Subfolders: off."
        if self._last_scan_seconds is not None:
            if self._last_scan_seconds < 1:
                summary += f" Scan time: {self._last_scan_seconds:.2f} s."
            elif self._last_scan_seconds < 60:
                summary += f" Scan time: {self._last_scan_seconds:.1f} s."
            else:
                summary += f" Scan time: {self._last_scan_seconds/60:.1f} min."
        notice_parts: List[str] = []
        if self._last_hash_skipped:
            fallback_checks = any([self.use_size.get(), self.use_name.get(), self.use_mtime.get()])
            if fallback_checks:
                summary += (
                    f" Note: skipped hashing {self._last_hash_skipped} large file(s) due to the hash size limit;"
                    " compared them using other selected checks."
                )
                notice_parts.append("Hashing skipped for some large files; other checks were used.")
            else:
                summary += (
                    f" Note: skipped hashing {self._last_hash_skipped} large file(s) due to the hash size limit;"
                    " no other checks were enabled for them."
                )
                notice_parts.append("Hashing skipped for some large files; no other checks enabled.")
        if self._last_scan_skipped:
            summary += f" Note: skipped {self._last_scan_skipped} file(s) due to scan errors."
            notice_parts.append("Some files could not be scanned; see summary.")
        self.notice_var.set(" ".join(notice_parts))
        self.summary_var.set(summary)
        self._set_actions_enabled(True)
        self._set_filter_enabled(True)

        filter_text = self.filter_var.get().casefold().strip()

        def _filtered_items():
            for key, files in sorted(self.duplicates.items()):
                sorted_files_local = sorted(files, key=lambda item: item[2], reverse=True)
                if not filter_text:
                    yield key, sorted_files_local
                else:
                    if any(self._matches_filter(p, filter_text) for p, _, _ in sorted_files_local):
                        yield key, sorted_files_local

        for key, sorted_files in _filtered_items():
            group_mtime = sorted_files[0][2]
            group_size = sum(item[1] for item in sorted_files)
            example_name = sorted_files[0][0].name
            group_label = f"{example_name} ({len(sorted_files)} copies)"
            group_id = self.results_tree.insert(
                "",
                "end",
                text=group_label,
                values=(_describe_key(key), "", ""),
                open=True,
            )
            self._item_meta[group_id] = {"kind": "group", "mtime": group_mtime, "size": group_size}
            for path, size, mtime in sorted_files:
                ts = _dt.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                item_id = self.results_tree.insert(
                    group_id,
                    "end",
                    text=path.name,
                    values=(str(path.parent), ts, human_size(size)),
                )
                self._item_meta[item_id] = {"kind": "file", "mtime": mtime, "size": size, "path": path}

        # Reapply last sort to keep table stable across scans/filters.
        if self._last_sort_column is not None:
            self._sort_tree(self._last_sort_column, direction=self._last_sort_direction, remember=False, toggle=False)
        self._update_selection_status()

    def _matches_filter(self, path: Path, needle: str) -> bool:
        text = needle.casefold()
        return text in path.name.casefold() or text in str(path.parent).casefold()

    def _apply_filter(self) -> None:
        if not self.duplicates or self._last_folder is None:
            return
        self._render_results(self._last_folder, self._last_days)

    def _sort_tree(self, column: str, *, direction: bool | None = None, remember: bool = True, toggle: bool = True) -> None:
        """Sort top-level groups and their children by the selected column."""
        if direction is None:
            direction = self._sort_directions.get(column, True)
        next_direction = (not direction) if toggle else direction

        def sort_children(parent: str) -> None:
            children = list(self.results_tree.get_children(parent))
            data = [(self._sort_key(item, column), item) for item in children]
            for idx, (_, item) in enumerate(sorted(data, key=lambda pair: pair[0], reverse=not direction)):
                self.results_tree.move(item, parent, idx)

        sort_children("")
        for group in self.results_tree.get_children(""):
            sort_children(group)
        self._sort_directions[column] = next_direction
        if remember:
            self._last_sort_column = column
            self._last_sort_direction = direction

    def _sort_key(self, item: str, column: str):
        meta = self._item_meta.get(item, {})
        if column == "#0":
            return self.results_tree.item(item, "text").casefold()
        values = self.results_tree.item(item, "values")
        if column == "location":
            return values[0].casefold() if values else ""
        if column == "modified":
            return meta.get("mtime", 0)
        if column == "size":
            return meta.get("size", 0)
        return 0

    def _collect_selected_file_ids(self) -> Tuple[set[str], set[str]]:
        selected_items = set(self.results_tree.selection())
        selected_groups = {item for item in selected_items if self._item_meta.get(item, {}).get("kind") == "group"}
        selected_files = {item for item in selected_items if self._item_meta.get(item, {}).get("kind") == "file"}

        for group_id in selected_groups:
            for child in self.results_tree.get_children(group_id):
                selected_files.add(child)

        groups_affected: set[str] = set()
        for item in selected_files:
            parent = self.results_tree.parent(item)
            if parent:
                groups_affected.add(parent)
        return selected_files, groups_affected

    def _fully_selected_groups(self, selected_files: set[str], groups_affected: set[str]) -> List[str]:
        fully_selected: List[str] = []
        for group_id in self.results_tree.get_children(""):
            if group_id not in groups_affected:
                continue
            children = set(self.results_tree.get_children(group_id))
            if children and children.issubset(selected_files):
                fully_selected.append(group_id)
        return fully_selected

    def _update_selection_status(self) -> None:
        selected_files, groups_affected = self._collect_selected_file_ids()
        self.selection_var.set(f"{len(selected_files)} files selected / {len(groups_affected)} groups affected")
        if self._actions_enabled and selected_files:
            self.delete_selected_btn.configure(state="normal")
        else:
            self.delete_selected_btn.configure(state="disabled")

    def _on_tree_selection_change(self, _event: tk.Event) -> None:
        if self._selection_updating:
            return
        selected = set(self.results_tree.selection())
        if selected:
            desired = set(selected)
            for item in selected:
                if self._item_meta.get(item, {}).get("kind") == "group":
                    desired.update(self.results_tree.get_children(item))
            if desired != selected:
                self._selection_updating = True
                self.results_tree.selection_set(list(desired))
                self._selection_updating = False
        self._update_selection_status()

    def _confirm_full_group_delete(self, group_labels: List[str]) -> bool:
        message = (
            "Your selection includes every copy in the groups listed below. Continuing will delete all copies in those groups.\n\n"
            "Fully selected groups:\n"
            + "\n".join(f"- {label}" for label in group_labels)
        )
        result = self._modal_dialog(
            "All Copies Selected",
            message,
            [("Review Selection", False), ("Delete Selected (Including Full Groups)", True)],
            default_index=0,
        )
        return bool(result)

    def _on_tree_right_click(self, event: tk.Event) -> None:
        item = self.results_tree.identify_row(event.y)
        if not item:
            return
        current = set(self.results_tree.selection())
        if item not in current:
            self.results_tree.selection_set(item)
        menu = tk.Menu(self.root, tearoff=False)
        selected_files, _ = self._collect_selected_file_ids()
        menu.add_command(
            label="Delete selected",
            command=self._delete_selected,
            state="normal" if selected_files else "disabled",
        )
        menu.add_separator()
        menu.add_command(label="Copy row", command=lambda: self._copy_tree_item(item))
        meta = self._item_meta.get(item, {})
        if meta.get("kind") == "file":
            parent = self.results_tree.parent(item)
            if parent:
                menu.add_command(label="Copy group", command=lambda: self._copy_group(parent))
        elif meta.get("kind") == "group":
            menu.add_command(label="Copy group", command=lambda: self._copy_group(item))
        try:
            menu.tk_popup(event.x_root, event.y_root)
        finally:
            menu.grab_release()

    def _copy_tree_item(self, item: str) -> None:
        meta = self._item_meta.get(item, {})
        values = self.results_tree.item(item, "values")
        if meta.get("kind") == "group":
            text = f"{self.results_tree.item(item, 'text')} | {values[0] if values else ''}"
        else:
            text = f"{self.results_tree.item(item, 'text')} | {' | '.join(values)}"
        self.root.clipboard_clear()
        self.root.clipboard_append(text)

    def _copy_group(self, item: str) -> None:
        lines: List[str] = []
        lines.append(f"{self.results_tree.item(item, 'text')}")
        for child in self.results_tree.get_children(item):
            vals = self.results_tree.item(child, "values")
            lines.append(f"  {self.results_tree.item(child, 'text')} | {' | '.join(vals)}")
        self.root.clipboard_clear()
        self.root.clipboard_append("\n".join(lines))

    def _set_actions_enabled(self, enabled: bool) -> None:
        self._actions_enabled = enabled
        state = "normal" if enabled else "disabled"
        for btn in [self.copy_btn, self.export_btn, self.collapse_btn, self.expand_btn]:
            btn.configure(state=state)
        self._update_selection_status()

    def _set_filter_enabled(self, enabled: bool) -> None:
        self.filter_entry.configure(state="normal" if enabled else "disabled")

    def _center_window(self, win: tk.Toplevel) -> None:
        win.update_idletasks()
        w = win.winfo_width()
        h = win.winfo_height()
        root_x = self.root.winfo_rootx()
        root_y = self.root.winfo_rooty()
        root_w = self.root.winfo_width()
        root_h = self.root.winfo_height()
        x = root_x + max((root_w - w) // 2, 0)
        y = root_y + max((root_h - h) // 2, 0)
        win.geometry(f"{w}x{h}+{x}+{y}")

    def _modal_dialog(
        self,
        title: str,
        message: str,
        buttons: List[Tuple[str, object]],
        default_index: int | None = None,
    ) -> object:
        top = tk.Toplevel(self.root)
        top.title(title)
        top.transient(self.root)
        top.grab_set()

        body = ttk.Frame(top, padding=12)
        body.pack(fill="both", expand=True)
        ttk.Label(body, text=message, wraplength=520, justify="left").pack(fill="x", pady=(0, 10))

        btns = ttk.Frame(body)
        btns.pack(fill="x")
        result: object = None

        def on_choose(val: object) -> None:
            nonlocal result
            result = val
            top.destroy()

        button_refs = []
        for idx, (label, val) in enumerate(buttons):
            style_name = "Danger.TButton" if "delete" in label.casefold() else None
            if style_name:
                btn = ttk.Button(btns, text=label, command=lambda v=val: on_choose(v), style=style_name)
            else:
                btn = ttk.Button(btns, text=label, command=lambda v=val: on_choose(v))
            btn.pack(side="right", padx=(6 if idx else 0, 0))
            button_refs.append((btn, val))

        if default_index is not None and 0 <= default_index < len(button_refs):
            default_btn, default_val = button_refs[default_index]
            default_btn.focus_set()
            top.bind("<Return>", lambda _event: on_choose(default_val))

        self._center_window(top)
        top.wait_window()
        return result

    def _info(self, title: str, message: str) -> None:
        self._modal_dialog(title, message, [("OK", True)])

    def _error(self, title: str, message: str) -> None:
        self._modal_dialog(title, message, [("OK", False)])

    def _confirm(self, title: str, message: str) -> bool:
        return bool(self._modal_dialog(title, message, [("Cancel", False), ("Yes, delete", True)]))

    def _expand_all(self) -> None:
        for item in self.results_tree.get_children(""):
            self.results_tree.item(item, open=True)

    def _collapse_all(self) -> None:
        for item in self.results_tree.get_children(""):
            self.results_tree.item(item, open=False)

    def _on_tree_double_click(self, event: tk.Event) -> None:
        item = self.results_tree.identify_row(event.y)
        if not item:
            return
        meta = self._item_meta.get(item, {})
        if meta.get("kind") == "file":
            path = meta.get("path")
            if isinstance(path, Path) and path.exists():
                try:
                    os.startfile(str(path.parent))
                except Exception:
                    self._error("Open folder failed", f"Could not open {path.parent}")

    def _generate_report_rows(self) -> List[List[str]]:
        rows: List[List[str]] = []
        for key, files in sorted(self.duplicates.items()):
            sorted_files = sorted(files, key=lambda item: item[2], reverse=True)
            for path, size, mtime in sorted_files:
                ts = _dt.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                rows.append(
                    [
                        path.name,
                        str(path.parent),
                        ts,
                        str(size),
                        human_size(size),
                        _describe_key(key),
                    ]
                )
        return rows

    def _build_report_text(self) -> str:
        rows = self._generate_report_rows()
        if not rows:
            return "No duplicates found."
        lines = [
            f"Found {len(self.duplicates)} duplicate group(s), {_dt.datetime.now().isoformat(timespec='seconds')}",
            "",
        ]
        for key, files in sorted(self.duplicates.items()):
            lines.append(f"{files[0][0].name}  [{_describe_key(key)}]")
            for path, size, mtime in sorted(files, key=lambda item: item[2], reverse=True):
                ts = _dt.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                lines.append(f"  {path}  ({human_size(size)}, modified {ts})")
            lines.append("")
        return "\n".join(lines)

    def _copy_report(self) -> None:
        text = self._build_report_text()
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        self._info("Copied", "Scan report copied to clipboard.")

    def _export_csv(self) -> None:
        if not self.duplicates:
            self._info("No data", "Run a scan first to export results.")
            return
        path_str = filedialog.asksaveasfilename(
            parent=self.root,
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
            title="Save duplicate report as CSV",
        )
        if not path_str:
            return
        rows = self._generate_report_rows()
        try:
            with open(path_str, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["file", "folder", "modified", "size_bytes", "size_human", "criteria"])
                writer.writerows(rows)
            self._info("Exported", f"Report saved to {path_str}")
        except Exception as exc:
            self._error("Export failed", f"Could not save CSV:\n{exc}")

    def _delete_selected(self) -> None:
        selected_files, groups_affected = self._collect_selected_file_ids()
        if not selected_files:
            self._info("Nothing selected", "Select one or more file rows to delete.")
            return

        full_groups = self._fully_selected_groups(selected_files, groups_affected)
        if full_groups:
            group_labels = [self.results_tree.item(group_id, "text") for group_id in full_groups]
            if not self._confirm_full_group_delete(group_labels):
                return

        to_delete: List[Path] = []
        to_keep: List[Path] = []
        for group_id in groups_affected:
            for child in self.results_tree.get_children(group_id):
                meta = self._item_meta.get(child, {})
                path = meta.get("path")
                if not isinstance(path, Path):
                    continue
                if child in selected_files:
                    to_delete.append(path)
                else:
                    to_keep.append(path)

        if not to_delete:
            self._info("Nothing to delete", "No selected files were found in the results.")
            return

        total_size = sum(path.stat().st_size for path in to_delete if path.exists())
        confirm = self._confirm(
            "Confirm deletion",
            f"This will delete {len(to_delete)} selected file(s), freeing ~{human_size(total_size)}.\n"
            "Files not selected will be kept.\n\n"
            "Proceed?",
        )
        if not confirm:
            return

        rename_report: List[Tuple[Path, Path]] = []
        if self.rename_kept_enabled.get():
            rename_report = self._rename_conflicting_kept_files(to_keep, to_delete)
        delete_files(to_delete, on_error=self._error)
        msg = f"Deleted {len(to_delete)} selected file(s)."
        if rename_report:
            msg += f"\nRenamed {len(rename_report)} kept file(s) with name conflicts."
        self._info("Done", msg)
        self._scan()

    def _delete(self) -> None:
        if not self.duplicates:
            self._info("Nothing to delete", "No duplicates have been scanned yet.")
            return

        auto_keep: Dict[Tuple[Tuple[str, object], ...], Path] = {}
        manual_groups: Dict[Tuple[Tuple[str, object], ...], List[FileEntry]] = {}

        if self.skip_same_folder_prompt.get():
            for key, files in self.duplicates.items():
                parents = {path.parent for path, _, _ in files}
                if len(parents) == 1:
                    # Auto-keep the newest file when everything lives in the same folder.
                    newest = max(files, key=lambda item: item[2])[0]
                    auto_keep[key] = newest
                else:
                    manual_groups[key] = files
        else:
            manual_groups = self.duplicates

        keep_choices: Dict[Tuple[Tuple[str, object], ...], Path] = dict(auto_keep)
        if manual_groups:
            manual_choices = self._prompt_keep_choices(manual_groups)
            if manual_choices is None:
                return
            keep_choices.update(manual_choices)

        # Decide which files to delete based on user choices.
        to_delete: List[Path] = []
        to_keep: List[Path] = []
        for key, files in self.duplicates.items():
            selected_keep = keep_choices.get(key)
            for path, _, _ in files:
                if path != selected_keep:
                    to_delete.append(path)
                else:
                    to_keep.append(path)

        total_size = sum(path.stat().st_size for path in to_delete if path.exists())
        if not to_delete:
            self._info("Nothing to delete", "No duplicate files are marked for deletion.")
            return

        confirm = self._confirm(
            "Confirm deletion",
            f"This will delete {len(to_delete)} file(s), freeing ~{human_size(total_size)}.\n"
            f"The most recent copy in each group will be kept.\n\n"
            "Proceed?",
        )
        if not confirm:
            return

        rename_report: List[Tuple[Path, Path]] = []
        if self.rename_kept_enabled.get():
            rename_report = self._rename_conflicting_kept_files(to_keep, to_delete)
        delete_files(to_delete, on_error=self._error)
        msg = f"Deleted {len(to_delete)} duplicate file(s)."
        if rename_report:
            msg += f"\nRenamed {len(rename_report)} kept file(s) with name conflicts."
        self._info("Done", msg)
        # Refresh view after deletion.
        self._scan()

    def _prompt_keep_choices(
        self, groups: Dict[Tuple[Tuple[str, object], ...], List[FileEntry]]
    ) -> Dict[Tuple[Tuple[str, object], ...], Path] | None:
        """Show a dialog to choose which file to keep per duplicate group."""
        top = tk.Toplevel(self.root)
        top.title("Choose files to keep")
        top.transient(self.root)
        top.grab_set()

        container = ttk.Frame(top, padding=10)
        container.pack(fill="both", expand=True)

        style = ttk.Style(top)
        style.configure("KeepStatus.TLabel", foreground="#1f7a1f")
        style.configure("DeleteStatus.TLabel", foreground="#8b1d1d")

        legend = ttk.Label(container, text="Legend: KEEP = selected file; DELETE = will be removed.")
        legend.pack(anchor="w", pady=(0, 4))

        def format_keep_text(path: Path, size: int, mtime: float, show_full: bool) -> str:
            ts = _dt.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
            location = str(path if show_full else path.parent)
            return f"{location}  ({human_size(size)}, modified {ts})"

        display_rows: List[Tuple[ttk.Radiobutton, Path, int, float]] = []

        def refresh_keep_texts() -> None:
            show_full = bool(self.show_keep_full_paths.get())
            for radio, path, size, mtime in display_rows:
                radio.configure(text=format_keep_text(path, size, mtime, show_full))

        ttk.Checkbutton(
            container,
            text="Show full path + filename",
            variable=self.show_keep_full_paths,
            command=refresh_keep_texts,
        ).pack(anchor="w", pady=(0, 6))

        def set_status_labels(var: tk.IntVar, labels: List[ttk.Label]) -> None:
            selected_idx = var.get()
            for idx, label in enumerate(labels):
                if idx == selected_idx:
                    label.configure(text="KEEP", style="KeepStatus.TLabel")
                else:
                    label.configure(text="DELETE", style="DeleteStatus.TLabel")

        keep_vars: List[
            Tuple[tk.IntVar, List[FileEntry], Tuple[Tuple[str, object], ...], List[ttk.Label]]
        ] = []
        for group_idx, (key, files) in enumerate(sorted(groups.items())):
            lf = ttk.LabelFrame(container, text=_describe_key(key), padding=(8, 6))
            lf.pack(fill="both", expand=True, padx=4, pady=4)
            sorted_files = sorted(files, key=lambda item: item[2], reverse=True)
            var = tk.IntVar(value=0)
            table = ttk.Frame(lf)
            table.pack(fill="both", expand=True)
            table.columnconfigure(1, weight=1)
            ttk.Label(table, text="Status").grid(row=0, column=0, sticky="w", padx=(0, 8))
            ttk.Label(table, text="File").grid(row=0, column=1, sticky="w")
            status_labels: List[ttk.Label] = []
            for idx, (path, size, mtime) in enumerate(sorted_files):
                status_label = ttk.Label(
                    table, text="DELETE", width=7, anchor="w", style="DeleteStatus.TLabel"
                )
                status_label.grid(row=idx + 1, column=0, sticky="w", padx=(0, 8), pady=(0, 2))
                status_labels.append(status_label)
                radio = ttk.Radiobutton(
                    table,
                    text=format_keep_text(path, size, mtime, self.show_keep_full_paths.get()),
                    variable=var,
                    value=idx,
                    command=lambda v=var, labels=status_labels: set_status_labels(v, labels),
                )
                radio.grid(row=idx + 1, column=1, sticky="w", pady=(0, 2))
                display_rows.append((radio, path, size, mtime))
            set_status_labels(var, status_labels)
            keep_vars.append((var, sorted_files, key, status_labels))

        btns = ttk.Frame(container)
        btns.pack(fill="x", pady=(6, 0))
        result: Dict[Tuple[Tuple[str, object], ...], Path] | None = None

        def on_ok() -> None:
            nonlocal result
            selection: Dict[Tuple[Tuple[str, object], ...], Path] = {}
            for var, files, key, _ in keep_vars:
                idx = var.get()
                if idx < 0 or idx >= len(files):
                    messagebox.showerror("Selection needed", "Please pick a file to keep for every group.", parent=top)
                    return
                selection[key] = files[idx][0]
            result = selection
            top.destroy()

        def on_cancel() -> None:
            top.destroy()

        def keep_newest_all() -> None:
            for var, _, _, labels in keep_vars:
                var.set(0)
                set_status_labels(var, labels)

        ttk.Button(btns, text="Cancel", command=on_cancel).pack(side="right", padx=(4, 0))
        ttk.Button(btns, text="OK", command=on_ok).pack(side="right")
        ttk.Button(btns, text="Keep newest in all groups", command=keep_newest_all).pack(side="left")

        self._center_window(top)
        top.wait_window()
        return result

    def _show_help(self) -> None:
        """Display a simple help dialog with usage tips and examples."""
        help_text = (
            "Delete Real Duplicates - Usage Guide\n\n"
            "1) Pick a folder and how many days back to scan. Days=0 scans everything.\n"
            "2) Choose duplicate checks. Hash+Size is safest; add Name/Modified time to tighten matches.\n"
            "3) Optional: limit hashing to files under a size (large files fall back to other checks).\n"
            "4) Scan. Review the groups listed in the output pane.\n"
            "5) Delete duplicates. You choose which copy to keep per group unless the\n"
            "   'Skip keep-choice dialog for same folder' toggle auto-selects the newest file.\n\n"
            "What is content hash? It reads the entire file and computes a SHA-256 digest of its bytes.\n"
            "Using Hash + Size keeps accuracy the same as Hash alone but hashes fewer files (size filters\n"
            "out obvious non-matches first). Accuracy can drop if you enable the hash size cap, because\n"
            "very large files above that limit are compared without hashes.\n\n"
            "Examples:\n"
            "- Find identical photos in Downloads from the last week: set Days=7, enable Hash+Size.\n"
            "- Clean duplicate installers regardless of timestamp: enable Hash+Size, set Days=0.\n"
            "- Quick name+size pass (faster, slightly looser): disable Hash, enable Size+File name.\n\n"
            "Notes:\n"
            "- Deletions go to the Recycle Bin when possible (via send2trash). If unavailable, files are removed.\n"
            "- Hashing large files can be slow; raise or disable the hash size limit if you need full hash coverage.\n"
            "- Duplicate groups show the most recent file first to simplify deciding which to keep.\n"
        )
        self._info("How to use", help_text)

    def _show_optional_checks(self) -> None:
        """Display optional deeper checks for advanced users."""
        extra_text = (
            "Optional checks for stricter duplicate detection:\n\n"
            "- Content hash (SHA-256): best accuracy, slower on large files. Pair with Size to prefilter.\n"
            "- Timestamps: match creation/modified times alongside size when hash is off.\n"
            "- Names/extensions and MIME type: avoid treating different file types as duplicates.\n"
            "- Media metadata: duration, resolution, bitrate, EXIF/ID3 unique IDs for photos/audio/video.\n"
            "- Embedded checksums: some archives/media embed hashes; use them when available.\n\n"
            "Tip: Start with Hash + Size for reliability. Add other signals only if you need extra certainty\n"
            "or are skipping hashing for speed/size reasons."
        )
        self._info("Optional checks", extra_text)


def main() -> None:
    root = tk.Tk()
    app = DuplicateCleanerUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
