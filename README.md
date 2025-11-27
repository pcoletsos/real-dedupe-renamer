# Delete Real Duplicates

Small Tkinter utility to scan a folder for duplicate files and delete extras after you confirm which copy to keep.

## Features
- Duplicate detection using toggles: content hash (SHA-256), file size, file name, modified time.
- Optional hash size cap to skip hashing huge files.
- Quick day presets for the modified-time window.
- Manual per-group “keep” selection when deleting.

## Requirements
- Python 3.9+
- Tkinter (bundled with standard Python installers)
- Optional: `send2trash` to move deletions to the OS recycle bin instead of permanent delete.

Install optional dependency:
```bash
python -m pip install -r requirements.txt
```

## Run
```bash
python delete_real_duplicates.py
```

## Notes
- Default scan folder is your `Downloads` directory; you can browse to a different folder.
- Hashing large files can be slow; adjust or disable the hash size limit in the UI as needed.
