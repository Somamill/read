import sys,tempfile,zipfile,unittest,subprocess
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'Sources/ReadCore/Tools'))
from epub_manifest_repair import repair_svg_manifest,validated_repair
class RepairTests(unittest.TestCase):
    def make(self,folder,version='3.0'):
        p=Path(folder)/'source.epub'
        with zipfile.ZipFile(p,'w') as z:
            z.writestr('mimetype','application/epub+zip')
            z.writestr('META-INF/container.xml','<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>')
            z.writestr('book.opf',f'<package xmlns="http://www.idpf.org/2007/opf" version="{version}"><manifest><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest></package>')
            z.writestr('cover.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><body><svg xmlns="http://www.w3.org/2000/svg"/></body></html>')
        return p
    def test_changes_only_package_and_preserves_content(self):
        with tempfile.TemporaryDirectory() as root:
            p=self.make(root);original=p.read_bytes();out=Path(root)/'fixed.epub'
            self.assertEqual(repair_svg_manifest(p,out),1);self.assertEqual(p.read_bytes(),original)
            with zipfile.ZipFile(p) as a,zipfile.ZipFile(out) as b:
                self.assertEqual(b.namelist()[0],'mimetype');self.assertEqual(b.getinfo('mimetype').compress_type,zipfile.ZIP_STORED)
                for name in a.namelist():
                    if name!='book.opf':self.assertEqual(a.read(name),b.read(name))
                self.assertIn(b'properties="nav svg"',b.read('book.opf'))
            self.assertEqual(repair_svg_manifest(out,Path(root)/'again.epub'),0)
    def test_validator_failure_keeps_original(self):
        with tempfile.TemporaryDirectory() as root:
            p=self.make(root);original=p.read_bytes()
            with patch('epub_manifest_repair.subprocess.run',return_value=subprocess.CompletedProcess([],1)):
                self.assertFalse(validated_repair(p,'epubcheck',Path(root)/'backup'))
            self.assertEqual(p.read_bytes(),original)
    def test_validation_success_retains_exact_backup(self):
        with tempfile.TemporaryDirectory() as root:
            p=self.make(root);original=p.read_bytes();backups=Path(root)/'backups'
            with patch('epub_manifest_repair.subprocess.run',return_value=subprocess.CompletedProcess([],0)):
                self.assertTrue(validated_repair(p,'epubcheck',backups))
            self.assertEqual(next(backups.iterdir()).read_bytes(),original)
            self.assertNotEqual(p.read_bytes(),original)
    def test_epub2_is_not_changed(self):
        with tempfile.TemporaryDirectory() as root:
            p=self.make(root,'2.0');out=Path(root)/'out.epub';self.assertEqual(repair_svg_manifest(p,out),0);self.assertFalse(out.exists())
    def test_signed_archive_is_left_untouched(self):
        with tempfile.TemporaryDirectory() as root:
            p=self.make(root)
            with zipfile.ZipFile(p,'a') as archive:archive.writestr('META-INF/signatures.xml','signature')
            before=p.read_bytes()
            with self.assertRaises(ValueError):repair_svg_manifest(p,Path(root)/'out.epub')
            self.assertEqual(p.read_bytes(),before)

class InstallerTests(unittest.TestCase):
    def load_installer(self):
        import importlib.util
        path=Path(__file__).resolve().parents[2]/'Scripts/install-epub-manifest-repair.py'
        spec=importlib.util.spec_from_file_location('repair_gate_installer',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
    def test_installer_is_idempotent_and_keeps_backup(self):
        with tempfile.TemporaryDirectory() as root:
            p=Path(root)/'import.sh';original='#!/bin/bash\n        EPUBCHECK_STATUS=$?\n';p.write_text(original)
            install=self.load_installer().install
            self.assertTrue(install(p));self.assertFalse(install(p))
            self.assertEqual(next(Path(root).glob('*.before-*')).read_text(),original)
    def test_unknown_importer_is_not_modified(self):
        with tempfile.TemporaryDirectory() as root:
            p=Path(root)/'import.sh';p.write_text('unknown importer')
            with self.assertRaises(ValueError):self.load_installer().install(p)
            self.assertEqual(p.read_text(),'unknown importer')
