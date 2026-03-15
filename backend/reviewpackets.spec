# -*- mode: python ; coding: utf-8 -*-

import os

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

project_root = os.path.abspath(os.path.join(SPECPATH, '..'))
backend_root = os.path.abspath(SPECPATH)

data_files = (
    collect_data_files('pandas')
    + collect_data_files('openpyxl')
    + [('collaborator_config.json', '.')]
)

hidden_imports = [
    'fastapi',
    'starlette',
    'uvicorn',
    'pydantic',
    'pydantic_core',
    'anyio',
    'sniffio',
    'idna',
    'python_multipart',
    'pandas',
    'openpyxl',
] + collect_submodules('backend')


a = Analysis(
    ['main.py'],
    pathex=[project_root, backend_root],
    binaries=[],
    datas=data_files,
    hiddenimports=hidden_imports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ReviewPacketsBackend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)
