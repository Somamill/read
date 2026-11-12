"""Run with: python3 -m unittest discover -s Tests/Python."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


class BridgeFailureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        config = root / "config.json"
        config.write_text(json.dumps({"paths": {
            "booksRoot": str(root), "state": str(root / "state"),
            "logs": str(root / "logs"),
        }}))
        tools = Path(__file__).resolve().parents[2] / "Sources/ReadCore/Tools"
        with patch.dict(os.environ, SHELF_CONFIG=str(config)), patch.object(sys, "path", [str(tools)] + sys.path):
            # Configuration is read on import; avoid reusing another test's paths.
            with patch.dict(sys.modules):
                sys.modules.pop("shelf_config", None)
                spec = importlib.util.spec_from_file_location("bridge_under_test", tools / "kosync_calibre_bridge.py")
                self.bridge = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(self.bridge)

    def test_article_sync_uses_exact_aliases_and_newest_progress_without_resurrecting_trash(self):
        import hashlib
        tools = Path(__file__).resolve().parents[2] / "Sources/ReadCore/Tools"
        with patch.object(sys, "path", [str(tools)] + sys.path):
            from read_articles import Library
            library = Library(Path(self.bridge.STATE) / "articles")
            self.addCleanup(library.db.close)
            library.db.execute("INSERT INTO articles(id,url,title,content,text,saved,updated,opened,progress,progress_updated,status,tags,favorite) VALUES(1,'https://example.org/story','Story','','',1,1,900,0.2,100,'later','keep',1)")
            library.db.execute("INSERT INTO article_aliases VALUES('https://example.org/old',1)")
            library.db.commit()
            canonical=hashlib.md5(b'https://example.org/story').hexdigest()
            alias=hashlib.md5(b'https://example.org/old').hexdigest()
            records={canonical:{'percentage':'.4','timestamp':200},alias:{'percentage':'.98','timestamp':300000},'a'*32:{'percentage':'.8','timestamp':300}}
            # Milliseconds are recognized only at realistic epoch magnitudes.
            records[alias]['timestamp']=300
            known,changed=self.bridge.sync_article_progress(records)
            self.assertEqual(known,{canonical,alias});self.assertEqual(changed,1)
            row=library.article(1)
            self.assertEqual((row['progress'],row['progress_updated'],row['opened'],row['status'],row['tags'],row['favorite']),(.98,300,900,'archive','keep',1))
            self.assertEqual(self.bridge.sync_article_progress(records)[1],0)
            records[alias]={'percentage':'.1','timestamp':250}
            self.assertEqual(self.bridge.sync_article_progress(records)[1],0)
            library.db.execute("UPDATE articles SET status='trash'");library.db.commit()
            records[canonical]={'percentage':'.5','timestamp':400}
            self.assertEqual(self.bridge.sync_article_progress(records)[1],0)
            self.assertEqual(library.article(1)['status'],'trash')

    def test_article_sync_handles_missing_database_invalid_values_and_canonical_ties(self):
        import hashlib
        self.assertEqual(self.bridge.sync_article_progress({}), (set(),0))
        tools = Path(__file__).resolve().parents[2] / "Sources/ReadCore/Tools"
        with patch.object(sys, "path", [str(tools)] + sys.path):
            from read_articles import Library
            library=Library(Path(self.bridge.STATE)/'articles');self.addCleanup(library.db.close)
            library.db.execute("INSERT INTO articles(id,url,title,content,text,saved,updated) VALUES(1,'https://example.org/story','Story','','',1,1)")
            library.db.execute("INSERT INTO article_aliases VALUES('https://example.org/old',1)");library.db.commit()
            canonical=hashlib.md5(b'https://example.org/story').hexdigest();alias=hashlib.md5(b'https://example.org/old').hexdigest()
            for value in ('NaN','Infinity','-1','1.2',None):
                self.assertEqual(self.bridge.sync_article_progress({canonical:{'percentage':value,'timestamp':200}})[1],0)
            for stamp in ('NaN','Infinity',-1,None,1e20):
                self.assertEqual(self.bridge.sync_article_progress({canonical:{'percentage':.2,'timestamp':stamp}})[1],0)
            records={canonical:{'percentage':.4,'timestamp':1700000000000},alias:{'percentage':.9,'timestamp':1700000000}}
            self.assertEqual(self.bridge.sync_article_progress(records)[1],1)
            self.assertEqual(library.article(1)['progress'],.4)
            self.assertEqual(library.article(1)['progress_updated'],1700000000)

    def test_timeout_reports_failure_without_command_credentials_and_releases_lock(self):
        bridge = self.bridge
        failure = subprocess.TimeoutExpired(["calibredb", "--password", "private-value"], 150)
        with patch.object(bridge, "cmd", side_effect=failure):
            for _ in range(2):
                with self.assertRaises(SystemExit) as result:
                    bridge.main()
                self.assertEqual(result.exception.code, 1)
        output = Path(bridge.LOGFILE).read_text()
        self.assertEqual(output.count("bridge command timed out"), 2)
        self.assertNotIn("private-value", output)
        self.assertNotIn("BRIDGE END", output)

    def test_unavailable_docker_reports_actionable_warning_without_traceback(self):
        bridge = self.bridge
        failure = subprocess.CalledProcessError(1, [bridge.DOCKER, "exec", "kosync", "private-value"])
        with patch.object(bridge, "cmd", side_effect=failure):
            with self.assertRaises(SystemExit):
                bridge.main()
        output = Path(bridge.LOGFILE).read_text()
        self.assertIn("automatic recovery will retry", output)
        self.assertNotIn("private-value", output)
        self.assertNotIn("CalledProcessError", output)

    def test_redis_snapshot_reads_all_fields_in_one_bounded_command(self):
        bridge=self.bridge
        key='user:'+bridge.USERNAME+':document:'+'a'*32
        rows=[{'_redis_key':key,'percentage':'0.25','title':'日本語','metadata':json.dumps({'author':'Writer'})}]
        with patch.object(bridge,'redis',return_value=json.dumps(rows)) as read:
            result=bridge.redis_document_snapshot()
        self.assertEqual(read.call_count,1)
        self.assertEqual(read.call_args.args[0],'EVAL')
        self.assertIn('5000',read.call_args.args[1])
        record=result['a'*32]
        with patch.object(bridge,'redis',side_effect=AssertionError('Unexpected extra Redis call')):
            metadata=bridge.redis_book_metadata(key,record['_redis_fields'])
        self.assertEqual(metadata,{'title':'日本語','author':'Writer'})
        with patch.object(bridge,'redis',return_value='{}'):
            self.assertEqual(bridge.redis_document_snapshot(),{})
        for raw in ('null','[1]','not-json'):
            with patch.object(bridge,'redis',return_value=raw):
                with self.assertRaises((ValueError,TypeError)):bridge.redis_document_snapshot()

    def test_activity_history_preserves_real_syncs_without_command_noise(self):
        bridge = self.bridge
        bridge.log("BRIDGE START")
        bridge.update_activity_history()
        bridge.log("SYNCED book=163 fields_updated=1 percentage=0.041 device=Shelf")
        bridge.log("WARNING unavailable dependency")
        events = [json.loads(line) for line in (Path(bridge.LOGS)/"reading-activity.jsonl").read_text().splitlines()]
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["bookId"],163)
        self.assertEqual(events[0]["progress"],0.041)

    def test_failed_write_does_not_mark_field_as_synced(self):
        bridge = self.bridge
        book = {"*ko_progint": 10}
        with patch.object(bridge, "cmd", return_value=subprocess.CompletedProcess([], 1, "", "server unavailable")):
            self.assertEqual(bridge.set_custom_if_changed("#ko_progint", 1, 20, book), (False, False))
        self.assertEqual(book["*ko_progint"], 10)


if __name__ == "__main__":
    unittest.main()
