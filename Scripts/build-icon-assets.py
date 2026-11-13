#!/usr/bin/env python3
"""Regenerate read.'s platform assets from one app-owned vector and dot. colors."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'branding/read/icon.json'
KIT = ROOT / 'branding/dot/tokens.json'
MANIFEST = ROOT / 'branding/read/assets.json'
INPUTS = ['branding/read/icon.json', 'branding/dot/tokens.json', 'Scripts/generate_icon.swift', 'Scripts/build-icon-assets.py', 'Scripts/generate_brand_art.swift']

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if '--check' in sys.argv:
    recorded = json.loads(MANIFEST.read_text())
    stale = [name for name, expected in recorded['files'].items() if not (ROOT/name).is_file() or digest(ROOT/name) != expected]
    if stale:
        raise SystemExit('Icon assets need regeneration: ' + ', '.join(stale))
    print('read. icon sources and all platform exports match.')
    raise SystemExit(0)

spec = json.loads(SPEC.read_text())
colors = json.loads(KIT.read_text())['colors']
book = ''.join('<path d="'+' '.join(str(value) for command in page for value in command)+'"/>' for page in spec['pages'])
vector = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="read. open book"><g fill="currentColor">'+book+'</g></svg>\n'
(ROOT/'branding/read/book.svg').write_text(vector)
accent = colors['accents']['read']
paper = colors['light']['background']
# Repository and browser tiles use the same geometry and proportions as the native icon.
app_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="read. app icon"><rect width="64" height="64" rx="15.2" fill="'+paper+'"/><g fill="'+accent+'">'+book+'</g></svg>\n'
(ROOT/'branding/read/app-icon.svg').write_text(app_svg)
subprocess.run(['swift',str(ROOT/'Scripts/generate_icon.swift'),str(ROOT/'Resources/Icons/AppIcon.iconset')],check=True)
subprocess.run(['iconutil','--convert','icns',str(ROOT/'Resources/Icons/AppIcon.iconset'),'--output',str(ROOT/'Resources/Icons/AppIcon.icns')],check=True)
for source, target in [
    ('Resources/Icons/AppIcon.png','Resources/Dashboard/AppIcon.png'),
    ('Resources/Icons/MobileIcon.png','Apps/iPhone/assets/read-icon.png'),
    ('Resources/Icons/MobileIcon.png','Documentation/Brand/read-icon.png'),
    ('branding/read/app-icon.svg','Resources/Dashboard/read-icon.svg'),
    ('branding/read/app-icon.svg','Documentation/Brand/read-icon.svg'),
]:shutil.copyfile(ROOT/source,ROOT/target)
subprocess.run(['swift',str(ROOT/'Scripts/generate_brand_art.swift')],check=True)
outputs = [str(path.relative_to(ROOT)) for path in (ROOT/'Resources/Icons').rglob('*') if path.is_file()]
outputs += ['Documentation/Brand/read-hero.jpg','Documentation/Brand/read-features.jpg','Documentation/Brand/read-social-preview.jpg','branding/read/book.svg','branding/read/app-icon.svg','Resources/Dashboard/AppIcon.png','Resources/Dashboard/read-icon.svg','Apps/iPhone/assets/read-icon.png','Documentation/Brand/read-icon.png','Documentation/Brand/read-icon.svg']
MANIFEST.write_text(json.dumps({'source':'branding/read/icon.json','files':{name:digest(ROOT/name) for name in sorted(set(INPUTS+outputs))}},indent=2)+'\n')
print('Updated Mac, mobile, browser and repository icons from one source.')
