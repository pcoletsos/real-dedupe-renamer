# -*- mode: python ; coding: utf-8 -*-

# Read __version__ from core.py so the EXE name stays in sync automatically.
import importlib.util as _ilu

_spec = _ilu.spec_from_file_location("core", "core.py")
_core = _ilu.module_from_spec(_spec)
_spec.loader.exec_module(_core)
_version = _core.__version__

a = Analysis(
    ['delete_real_duplicates.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('assets/help-circle-outline.svg', 'assets'),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name=f'delete_real_duplicates-{_version}',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
