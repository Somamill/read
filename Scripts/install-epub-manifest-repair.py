#!/usr/bin/env python3
"""Add the bounded SVG declaration repair gate to an existing Calibre importer."""
from pathlib import Path
import shutil
import sys
import time


def install(importer):
    importer = Path(importer).expanduser()
    text = importer.read_text()
    marker = '# read. validated SVG manifest repair'
    if marker in text:
        return False
    anchor = '        EPUBCHECK_STATUS=$?\n'
    if text.count(anchor) != 1:
        raise ValueError('Importer validation gate was not recognized; no changes made')
    block = '''        # read. validated SVG manifest repair
        if [ "$EPUBCHECK_STATUS" -ne 0 ] && [ -f "$BOOKS/scripts/epub_manifest_repair.py" ]; then
            if "$PYTHON" "$BOOKS/scripts/epub_manifest_repair.py" --validate-repair \\
                "$FILE" "$EPUBCHECK" "$IMPORTED/Originals before SVG repair/$(/bin/date '+%Y-%m')"; then
                EPUBCHECK_STATUS=0
                EPUBCHECK_OUTPUT="EPUBCheck passed after validated SVG declaration repair."
            fi
        fi
'''
    backup = importer.with_name(importer.name+'.before-svg-repair-'+str(int(time.time())))
    shutil.copy2(importer, backup)
    importer.write_text(text.replace(anchor, anchor+block))
    return True


if __name__ == '__main__':
    print('Importer repair gate installed.' if install(sys.argv[1]) else 'Importer repair gate already installed.')
