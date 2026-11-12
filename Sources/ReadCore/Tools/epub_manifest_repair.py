"""Conservatively add missing EPUB 3 SVG manifest declarations; preserve book content."""
from pathlib import Path
import posixpath
import hashlib
import os
import shutil
import subprocess
import tempfile
import uuid
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile


def repair_svg_manifest(source, destination):
    source, destination = Path(source), Path(destination)
    if source.resolve() == destination.resolve() or destination.exists():
        raise ValueError('Use a new output file; the original must remain untouched')
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        if len(entries) > 20000 or sum(x.file_size for x in entries) > 512*1024*1024:
            raise ValueError('EPUB exceeds safe repair limits')
        names = archive.namelist()
        if len(names) != len(set(names)) or 'META-INF/signatures.xml' in names:
            raise ValueError('Ambiguous or signed EPUB must not be automatically rewritten')
        container = ET.fromstring(archive.read('META-INF/container.xml'))
        rootfile = container.find('.//{*}rootfile')
        if rootfile is None:
            raise ValueError('EPUB package is missing')
        package_path = rootfile.attrib['full-path']
        package = ET.fromstring(archive.read(package_path))
        if not package.get('version','').startswith('3.'):
            return 0
        changes = 0
        for item in package.findall('.//{*}manifest/{*}item'):
            if item.get('media-type') != 'application/xhtml+xml':
                continue
            href = urllib.parse.urlsplit(item.get('href',''))
            if href.scheme or href.netloc:
                continue
            path = posixpath.normpath(posixpath.join(posixpath.dirname(package_path), urllib.parse.unquote(href.path)))
            if path.startswith(('../','/')) or path not in names:
                continue
            text = archive.read(path)
            # Match an actual SVG start tag, excluding XML comments.
            text = re.sub(rb'<!--.*?-->', b'', text, flags=re.S)
            properties = item.get('properties','').split()
            if re.search(rb'<(?:[A-Za-z_][\w.-]*:)?svg\b', text) and 'svg' not in properties:
                item.set('properties', ' '.join(properties+['svg']))
                changes += 1
        if not changes:
            return 0
        ET.register_namespace('', 'http://www.idpf.org/2007/opf')
        ET.register_namespace('dc', 'http://purl.org/dc/elements/1.1/')
        with zipfile.ZipFile(destination, 'x') as output:
            # EPUB requires mimetype first and uncompressed.
            if 'mimetype' in names:
                output.writestr('mimetype', archive.read('mimetype'), compress_type=zipfile.ZIP_STORED)
            for entry in entries:
                if entry.filename == 'mimetype':
                    continue
                data = ET.tostring(package, encoding='utf-8', xml_declaration=True) if entry.filename == package_path else archive.read(entry)
                output.writestr(entry, data)
    return changes


def validated_repair(source, validator, backups):
    """Replace only a validated candidate, retaining an exact original backup."""
    source, backups = Path(source), Path(backups)
    def digest(path):
        checksum = hashlib.sha256()
        with path.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024*1024), b''):
                checksum.update(chunk)
        return checksum.digest()
    original = digest(source)
    with tempfile.TemporaryDirectory(prefix='read-epub-repair-') as temporary:
        candidate = Path(temporary)/'candidate.epub'
        if not repair_svg_manifest(source, candidate):
            return False
        result = subprocess.run([str(validator), str(candidate)], capture_output=True, text=True, timeout=120)
        if result.returncode != 0 or digest(source) != original:
            return False
        backups.mkdir(parents=True, exist_ok=True)
        backup = backups/(source.stem+'-'+uuid.uuid4().hex[:12]+'.epub')
        shutil.copy2(source, backup)
        backup.chmod(0o600)
        if digest(backup) != original:
            raise ValueError('The original changed during backup; repair was not applied')
        fd, staged = tempfile.mkstemp(prefix='.read-validated-', suffix='.tmp', dir=source.parent)
        os.close(fd)
        try:
            shutil.copyfile(candidate, staged)
            if digest(source) != original:
                return False
            os.replace(staged, source)
        finally:
            if os.path.exists(staged):
                os.unlink(staged)
        print('SVG declaration repaired; EPUBCheck passed; exact original backed up.')
        return True


if __name__ == '__main__':
    try:
        if sys.argv[1] == '--validate-repair':
            raise SystemExit(0 if validated_repair(sys.argv[2], sys.argv[3], sys.argv[4]) else 1)
        changes = repair_svg_manifest(sys.argv[1], sys.argv[2])
        print(f'Missing SVG declarations repaired: {changes}; original content preserved.')
        raise SystemExit(0 if changes else 1)
    except (OSError, ValueError, KeyError, ET.ParseError, zipfile.BadZipFile, subprocess.SubprocessError) as error:
        print(f'Automatic manifest repair declined: {type(error).__name__}', file=sys.stderr)
        raise SystemExit(1)
