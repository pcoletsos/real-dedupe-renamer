from __future__ import annotations

import datetime as _dt
import hashlib
import os
import threading
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, scrolledtext, ttk
except ImportError as exc:  # pragma: no cover - tkinter is standard but allow clearer error.
    raise SystemExit("tkinter is required to run this tool.") from exc


FileEntry = Tuple[Path, int, float]  # path, size, modified timestamp


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


def gather_recent_files(folder: Path, days_back: int) -> Iterable[FileEntry]:
    """Yield files in folder (recursively) modified within the last `days_back` days."""
    cutoff = _dt.datetime.now().timestamp() - days_back * 24 * 3600
    for path in folder.rglob("*"):
        if not path.is_file():
            continue
        stat = path.stat()
        if stat.st_mtime >= cutoff:
            yield (path, stat.st_size, stat.st_mtime)


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
                    continue
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
                components.append(("mtime", int(mtime)))

            if not components:
                continue

            key = tuple(components)
            groups.setdefault(key, []).append((path, size, mtime))

    return {k: v for k, v in groups.items() if len(v) > 1}, hash_skipped


def delete_files(paths: Iterable[Path]) -> None:
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
            # Show errors via messagebox to avoid silent failures.
            messagebox.showerror("Delete failed", f"Could not delete {path}:\n{exc}")


class DuplicateCleanerUI:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        root.title("Delete Real Duplicates")

        self.folder_var = tk.StringVar(value=str(default_downloads_folder()))
        self.days_var = tk.IntVar(value=2)
        self.use_hash = tk.BooleanVar(value=True)
        self.use_size = tk.BooleanVar(value=True)
        self.use_name = tk.BooleanVar(value=False)
        self.use_mtime = tk.BooleanVar(value=False)
        self.hash_limit_enabled = tk.BooleanVar(value=True)
        self.hash_max_mb = tk.IntVar(value=500)
        self._scanning = False
        self._last_hash_skipped = 0
        self.duplicates: Dict[Tuple[Tuple[str, object], ...], List[FileEntry]] = {}

        self._build_layout()

    def _build_layout(self) -> None:
        frm = ttk.Frame(self.root, padding=12)
        frm.grid(row=0, column=0, sticky="nsew")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

        # Folder chooser.
        ttk.Label(frm, text="Folder to scan:").grid(row=0, column=0, sticky="w")
        entry = ttk.Entry(frm, textvariable=self.folder_var, width=60)
        entry.grid(row=0, column=1, sticky="ew", padx=(4, 4))
        browse_btn = ttk.Button(frm, text="Browse...", command=self._browse_folder)
        browse_btn.grid(row=0, column=2, sticky="e")
        frm.columnconfigure(1, weight=1)

        # Days back.
        ttk.Label(frm, text="Days back:").grid(row=1, column=0, sticky="w", pady=(6, 0))
        days_spin = ttk.Spinbox(frm, from_=0, to=365, textvariable=self.days_var, width=6)
        days_spin.grid(row=1, column=1, sticky="w", pady=(6, 0))
        quick_days = ttk.Frame(frm)
        quick_days.grid(row=1, column=2, sticky="w", pady=(6, 0))
        ttk.Label(quick_days, text="Quick:").grid(row=0, column=0, sticky="w", padx=(0, 4))
        for idx, val in enumerate([0, 1, 2, 7, 30], start=1):
            ttk.Button(quick_days, text=str(val), width=3, command=lambda v=val: self._set_days(v)).grid(
                row=0, column=idx, padx=(0, 2)
            )

        # Duplicate criteria toggles.
        criteria = ttk.LabelFrame(frm, text="Duplicate checks", padding=(8, 6))
        criteria.grid(row=2, column=0, columnspan=3, sticky="ew", pady=(10, 4))
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
        ttk.Label(hash_limit, text="MB (skips larger files when hashing is on)").grid(
            row=0, column=2, sticky="w"
        )

        # Buttons.
        btn_frame = ttk.Frame(frm)
        btn_frame.grid(row=3, column=0, columnspan=3, sticky="w", pady=(10, 6))
        self.scan_btn = ttk.Button(btn_frame, text="Scan", command=self._scan)
        self.scan_btn.grid(row=0, column=0, padx=(0, 6))
        self.delete_btn = ttk.Button(btn_frame, text="Delete duplicates", command=self._delete, state="disabled")
        self.delete_btn.grid(row=0, column=1)

        # Output area.
        self.output = scrolledtext.ScrolledText(frm, width=90, height=20, state="disabled")
        self.output.grid(row=4, column=0, columnspan=3, sticky="nsew", pady=(8, 6))
        frm.rowconfigure(4, weight=1)

        # Suggestions on other parameters.
        suggestions = (
            "Other checks to strengthen 'real duplicate' detection:\n"
            "- SHA-256 hash of file contents (most reliable but slower).\n"
            "- File creation/modification timestamps (if identical alongside size).\n"
            "- File extension and MIME type consistency.\n"
            "- Audio/image metadata (duration, resolution) for media files.\n"
            "- Embedded checksums (e.g., ID3 tags, EXIF unique IDs) where applicable.\n"
        )
        suggestion_box = tk.Text(frm, height=6, wrap="word", state="disabled", background="#f8f8f8")
        suggestion_box.grid(row=5, column=0, columnspan=3, sticky="ew", pady=(4, 0))
        suggestion_box.configure(state="normal")
        suggestion_box.insert("1.0", suggestions)
        suggestion_box.configure(state="disabled")

    def _browse_folder(self) -> None:
        folder = filedialog.askdirectory(initialdir=self.folder_var.get() or str(Path.cwd()))
        if folder:
            self.folder_var.set(folder)

    def _set_days(self, days: int) -> None:
        self.days_var.set(max(0, min(days, 365)))

    def _scan(self) -> None:
        if self._scanning:
            return

        folder = Path(self.folder_var.get()).expanduser()
        days = max(self.days_var.get(), 0)

        if not folder.exists() or not folder.is_dir():
            messagebox.showerror("Invalid folder", f"{folder} is not a valid directory.")
            return

        if not any([self.use_hash.get(), self.use_size.get(), self.use_name.get(), self.use_mtime.get()]):
            messagebox.showerror("No criteria selected", "Select at least one duplicate check.")
            return

        self._scanning = True
        self.scan_btn.configure(state="disabled")
        self.delete_btn.configure(state="disabled")
        self.output.configure(state="normal")
        self.output.delete("1.0", tk.END)
        self.output.insert(tk.END, "Scanning...\n")
        self.output.configure(state="disabled")

        thread = threading.Thread(
            target=self._run_scan_thread,
            args=(folder, days),
            daemon=True,
        )
        thread.start()

    def _run_scan_thread(self, folder: Path, days: int) -> None:
        try:
            entries = list(gather_recent_files(folder, days))
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
            self.root.after(0, lambda: messagebox.showerror("Scan failed", str(exc)))
            self.root.after(0, self._finish_scan)
            return

        self.root.after(0, lambda: self._on_scan_complete(folder, days, duplicates, hash_skipped))

    def _on_scan_complete(
        self,
        folder: Path,
        days: int,
        duplicates: Dict[Tuple[Tuple[str, object], ...], List[FileEntry]],
        hash_skipped: int,
    ) -> None:
        self.duplicates = duplicates
        self._last_hash_skipped = hash_skipped
        self._render_results(folder, days)
        if self.duplicates:
            self.delete_btn.configure(state="normal")
        self._finish_scan()

    def _finish_scan(self) -> None:
        self._scanning = False
        self.scan_btn.configure(state="normal")

    def _render_results(self, folder: Path, days: int) -> None:
        self.output.configure(state="normal")
        self.output.delete("1.0", tk.END)
        if not self.duplicates:
            self.output.insert(tk.END, f"No duplicates found in {folder} (last {days} day(s)).\n")
            self.output.configure(state="disabled")
            self.delete_btn.configure(state="disabled")
            return

        total_dupes = sum(len(v) - 1 for v in self.duplicates.values())
        self.output.insert(
            tk.END,
            f"Found {len(self.duplicates)} duplicate group(s) "
            f"covering {total_dupes} deletable file(s) in {folder} (last {days} day(s)).\n\n",
        )

        for key, files in sorted(self.duplicates.items()):
            example_name = files[0][0].name
            self.output.insert(tk.END, f"- {example_name}  [{_describe_key(key)}]\n")
            for path, _, mtime in sorted(files, key=lambda item: item[2], reverse=True):
                ts = _dt.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                self.output.insert(tk.END, f"    {path} (modified {ts})\n")
            self.output.insert(tk.END, "\n")

        if self._last_hash_skipped:
            self.output.insert(
                tk.END,
                f"Note: skipped hashing {self._last_hash_skipped} large file(s) due to the hash size limit.\n",
            )
        self.output.configure(state="disabled")

    def _delete(self) -> None:
        if not self.duplicates:
            messagebox.showinfo("Nothing to delete", "No duplicates have been scanned yet.")
            return

        keep_choices = self._prompt_keep_choices()
        if keep_choices is None:
            return

        # Decide which files to delete based on user choices.
        to_delete: List[Path] = []
        for key, files in self.duplicates.items():
            selected_keep = keep_choices.get(key)
            for path, _, _ in files:
                if path != selected_keep:
                    to_delete.append(path)

        total_size = sum(path.stat().st_size for path in to_delete if path.exists())
        if not to_delete:
            messagebox.showinfo("Nothing to delete", "No duplicate files are marked for deletion.")
            return

        confirm = messagebox.askyesno(
            "Confirm deletion",
            f"This will delete {len(to_delete)} file(s), freeing ~{human_size(total_size)}.\n"
            f"The most recent copy in each group will be kept.\n\n"
            "Proceed?",
        )
        if not confirm:
            return

        delete_files(to_delete)
        messagebox.showinfo("Done", f"Deleted {len(to_delete)} duplicate file(s).")
        # Refresh view after deletion.
        self._scan()

    def _prompt_keep_choices(self) -> Dict[Tuple[Tuple[str, object], ...], Path] | None:
        """Show a dialog to choose which file to keep per duplicate group."""
        top = tk.Toplevel(self.root)
        top.title("Choose files to keep")
        top.transient(self.root)
        top.grab_set()

        container = ttk.Frame(top, padding=10)
        container.pack(fill="both", expand=True)

        keep_vars: List[Tuple[tk.IntVar, List[FileEntry], Tuple[Tuple[str, object], ...]]] = []
        for group_idx, (key, files) in enumerate(sorted(self.duplicates.items())):
            lf = ttk.LabelFrame(container, text=_describe_key(key), padding=(8, 6))
            lf.pack(fill="both", expand=True, padx=4, pady=4)
            sorted_files = sorted(files, key=lambda item: item[2], reverse=True)
            var = tk.IntVar(value=0)
            for idx, (path, size, mtime) in enumerate(sorted_files):
                ts = _dt.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                text = f"{path}  ({human_size(size)}, modified {ts})"
                ttk.Radiobutton(lf, text=text, variable=var, value=idx).pack(anchor="w", pady=(0, 2))
            keep_vars.append((var, sorted_files, key))

        btns = ttk.Frame(container)
        btns.pack(fill="x", pady=(6, 0))
        result: Dict[Tuple[Tuple[str, object], ...], Path] | None = None

        def on_ok() -> None:
            nonlocal result
            selection: Dict[Tuple[Tuple[str, object], ...], Path] = {}
            for var, files, key in keep_vars:
                idx = var.get()
                if idx < 0 or idx >= len(files):
                    messagebox.showerror("Selection needed", "Please pick a file to keep for every group.", parent=top)
                    return
                selection[key] = files[idx][0]
            result = selection
            top.destroy()

        def on_cancel() -> None:
            top.destroy()

        ttk.Button(btns, text="Cancel", command=on_cancel).pack(side="right", padx=(4, 0))
        ttk.Button(btns, text="OK", command=on_ok).pack(side="right")

        top.wait_window()
        return result


def main() -> None:
    root = tk.Tk()
    app = DuplicateCleanerUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
