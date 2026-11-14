"""Behavioral tests for the local annotation library; no accounts/network needed."""
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime
from unittest.mock import patch
import urllib.error

TOOLS=Path(__file__).resolve().parents[2]/'Sources/ReadCore/Tools'
sys.path.insert(0,str(TOOLS))
import shelf_annotations as annotations


class AnnotationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/'annotations.sqlite'
        self.lib=annotations.Library(self.path); self.addCleanup(lambda:self.lib.db.close())

    def add(self,**changes):
        return self.lib.put({'title':'Book','author':'Writer','text':'A passage','bookId':7,'source':'Shelf',**changes})[0]

    def test_daily_review_includes_local_book_and_article_passages(self):
        self.lib.save_settings({'reviewSize':2})
        book=self.add(text='A passage from a book',sourceId='book')
        article=self.add(text='A passage from an article',bookId=0,source='read. articles',sourceId='article')
        for i in range(8):self.add(text='An imported passage '+str(i),bookId=0,source='Readwise',sourceId=str(i))
        self.assertEqual({x['id'] for x in self.lib.review()},{book['id'],article['id']})

    def test_persistent_notes_favorites_search_and_private_permissions(self):
        item=self.add(); self.lib.update(item['id'],{'note':'remember this','tags':['日本語','research'],'favorite':True})
        other=annotations.Library(self.path)
        try:
            rows=other.filter({'search':'日本語','favorite':True,'notes':True})
            self.assertEqual(len(rows),1); self.assertEqual(rows[0]['note'],'remember this')
            self.assertEqual(self.path.stat().st_mode & 0o777,0o600)
        finally: other.db.close()

    def test_same_quote_at_different_locations_is_not_deduplicated(self):
        self.add(start=1,end=10); self.add(start=100,end=109)
        self.assertEqual(len(self.lib.items()),2)
        self.add(start=1,end=10)
        self.assertEqual(len(self.lib.items()),2)

    def test_filtered_response_keeps_review_independent_of_search(self):
        first=self.add(text='First saved passage')
        second=self.add(text='Second saved passage',source='read. articles',bookId=0)
        result=annotations.dispatch(self.lib,{'action':'list','rules':{'search':'First'}})
        self.assertEqual([x['id'] for x in result['items']],[first['id']])
        self.assertEqual({x['id'] for x in result['review']},{first['id'],second['id']})
        self.assertEqual(result['reviewStatus']['remaining'],result['settings']['reviewSize'])

    def test_review_contains_unique_passages_when_categories_overlap(self):
        shared=self.add(source='read. articles',bookId=7)
        other=self.add(text='Another passage')
        self.lib.save_settings({'reviewSize':2})
        cards=self.lib.review()
        self.assertEqual({x['id'] for x in cards},{shared['id'],other['id']})
        self.assertEqual(len(cards),2)

    def test_paused_jobs_do_not_starve_ready_uploads(self):
        self.lib.save_settings({'destinations':{'readwise':True,'crosspoint':True},'paused':['crosspoint']})
        ready=self.add(text='Ready to send')
        self.lib.enqueue(ready['id'],'readwise')
        for i in range(6):
            blocked=self.add(text='Paused '+str(i))
            self.lib.enqueue(blocked['id'],'crosspoint')
        with self.lib.db:
            self.lib.db.execute("UPDATE queue SET updated=100 WHERE destination='readwise'")
            self.lib.db.execute("UPDATE queue SET updated=200 WHERE destination='crosspoint'")
        with patch.object(annotations.urllib.request,'urlopen') as upload:
            upload.return_value.__enter__.return_value.status=201
            self.lib.sync({'token':'fixture-token','syncKey':'fixture-key'})
            self.assertEqual(upload.call_count,1)
        jobs=self.lib.queue()
        self.assertEqual(next(j['status'] for j in jobs if j['destination']=='readwise'),'sent')
        self.assertTrue(all(j['status']=='pending' for j in jobs if j['destination']=='crosspoint'))

    def test_upload_batch_stays_bounded_and_drains_without_duplicates(self):
        self.lib.save_settings({'destinations':{'readwise':True}})
        for i in range(8): self.lib.put({'text':'Passage '+str(i)},enqueue=True)
        with patch.object(annotations.urllib.request,'urlopen') as upload:
            upload.return_value.__enter__.return_value.status=201
            self.lib.sync({'token':'fixture-token'})
            self.assertEqual(upload.call_count,5)
            self.lib.sync({'token':'fixture-token'})
            self.lib.sync({'token':'fixture-token'})
            self.assertEqual(upload.call_count,8)
        self.assertTrue(all(j['status']=='sent' for j in self.lib.queue()))

    def test_source_identity_survives_reimport_and_archive(self):
        item=self.add(source='Kindle',sourceId='provider-1')
        self.lib.update(item['id'],{'archived':True,'note':'my note'})
        self.add(source='Kindle',sourceId='provider-1',text='Updated source text')
        self.assertEqual(self.lib.filter(),[])
        self.assertEqual(self.lib.items()[0]['note'],'my note')

    def test_backup_restore_is_idempotent_and_retains_archive(self):
        item=self.add(); self.lib.update(item['id'],{'archived':True})
        self.lib.collection('Notes',{'notes':True})
        content=annotations.dispatch(self.lib,{'action':'backup'})['content']
        for _ in range(2): annotations.dispatch(self.lib,{'action':'restore','content':content})
        self.assertEqual(len(self.lib.items()),1)
        self.assertTrue(self.lib.items()[0]['archived'])
        self.assertEqual(len(self.lib.collections()),1)
        self.assertNotIn('queue',json.loads(content))

    def test_import_preview_does_not_write_and_apply_merges(self):
        p={'action':'previewImport','content':json.dumps([{'text':'短い','title':'本','sourceId':'abc'}]),'format':'json'}
        result=annotations.dispatch(self.lib,p)
        self.assertEqual(result['total'],1); self.assertEqual(self.lib.items(),[])
        p['action']='import'
        self.assertEqual(annotations.dispatch(self.lib,p)['added'],1)
        self.assertEqual(annotations.dispatch(self.lib,p)['added'],0)

    def test_import_is_atomic_on_invalid_record(self):
        content=json.dumps([{'text':'Good'},{'text':'Bad','bookId':'not a number'}])
        with self.assertRaises(ValueError): annotations.dispatch(self.lib,{'action':'import','content':content})
        self.assertEqual(self.lib.items(),[])

    def test_csv_roundtrip_and_markdown_templates(self):
        self.add(text='Quote, with "commas"\nand newlines',note='My note',tags=['tag'])
        settings=self.lib.settings(); settings['exportTemplate']='{title} / {author}\n{highlights}'
        markdown=annotations.export_items(self.lib.items(),settings,'markdown')
        self.assertIn('Book / Writer',markdown); self.assertIn('My note',markdown)
        content=annotations.export_items(self.lib.items(),settings,'csv')
        parsed=annotations.parse_import(content,'csv')
        self.assertEqual(parsed[0]['text'],self.lib.items()[0]['text'])

    def test_kindle_parser_and_koreader_json(self):
        clippings='Book (Author)\n- Your Highlight on Location 10-11 | Added today\n\nPassage\n==========\n'
        self.assertEqual(annotations.parse_import(clippings,'kindle')[0]['author'],'Author')
        self.assertEqual(annotations.parse_import('{"Book":[{"text":"短い"}]}','koreader')[0]['title'],'Book')

    def test_review_includes_short_japanese_and_honors_schedule_and_exclusions(self):
        x=self.add(text='月'); self.add(text='Other',tags=['exclude'])
        self.lib.save_settings({'excludedTags':['exclude'],'reviewSize':5})
        self.assertEqual([r['id'] for r in self.lib.review()],[x['id']])
        self.lib.reviewed(x['id'],7)
        self.assertEqual(self.lib.review(),[])
        self.lib.save_settings({'reviewDays':[]}); self.assertEqual(self.lib.review(),[])

    def test_collection_scopes_review(self):
        self.add(tags=['focus']); self.add(text='Other')
        c=self.lib.collection('Focus',{'tag':'focus'})
        self.lib.save_settings({'reviewCollection':c['id']})
        self.assertEqual(len(self.lib.review()),1)

    def test_daily_review_goal_survives_reopening_and_does_not_refill_forever(self):
        self.lib.save_settings({'reviewSize':3})
        for i in range(8):self.add(text='Passage '+str(i))
        for _ in range(3):self.lib.reviewed(self.lib.review()[0]['id'],7)
        reopened=annotations.Library(self.path)
        try:
            self.assertEqual(reopened.review(),[])
            self.assertEqual(reopened.review_status()['reviewed'],3)
            reopened.save_settings({'reviewSize':5})
            self.assertEqual(len(reopened.review()),2)
        finally:reopened.db.close()

    def test_duplicate_review_is_idempotent_and_schedule_uses_local_midnight(self):
        item=self.add(note='Personal note')
        self.lib.reviewed(item['id'],1)
        once=self.lib.items()[0]
        self.lib.reviewed(item['id'],30)
        self.assertEqual(self.lib.items()[0],once)
        self.assertEqual(once['reviewCount'],1)
        self.assertEqual(once['note'],'Personal note')
        self.assertEqual(datetime.fromtimestamp(once['nextReview']).hour,0)
        self.assertGreater(once['nextReview'],annotations.now())
        backup=annotations.dispatch(self.lib,{'action':'backup'})['content']
        self.assertEqual(json.loads(backup)['highlights'][0]['lastReviewedAt'],once['lastReviewedAt'])

    def test_queue_survives_restart_and_never_duplicates_sent_job(self):
        self.lib.save_settings({'destinations':{'readwise':True}})
        x=self.lib.put({'text':'Passage','title':'Book'},enqueue=True)[0]
        self.assertEqual(self.lib.queue()[0]['status'],'pending')
        class Response:
            status=201
            def __enter__(self):return self
            def __exit__(self,*args):pass
        with patch.object(annotations.urllib.request,'urlopen',return_value=Response()) as request:
            self.lib.sync({'token':'private'})
            self.lib.enqueue(x['id']); self.lib.sync({'token':'private'})
            self.assertEqual(request.call_count,1)
        self.assertEqual(self.lib.queue()[0]['status'],'sent')
        self.assertNotIn('private',self.path.read_bytes().decode('latin1'))

    def test_pause_and_ambiguous_timeout_require_explicit_retry(self):
        self.lib.save_settings({'destinations':{'readwise':True},'paused':['readwise']})
        self.lib.put({'text':'Passage'},enqueue=True)
        with patch.object(annotations.urllib.request,'urlopen',side_effect=TimeoutError) as request:
            self.lib.sync({'token':'secret'}); self.assertEqual(request.call_count,0)
            self.lib.save_settings({'paused':[]})
            self.lib.sync({'token':'secret'}); self.lib.sync({'token':'secret'})
            self.assertEqual(request.call_count,1)
        self.assertEqual(self.lib.queue()[0]['status'],'uncertain')

    def test_http_rate_limit_has_backoff(self):
        self.lib.save_settings({'destinations':{'readwise':True}})
        self.lib.put({'text':'Passage'},enqueue=True)
        with patch.object(annotations.urllib.request,'urlopen',side_effect=urllib.error.HTTPError('https://readwise.io',429,'limited',{},None)) as request:
            self.lib.sync({'token':'secret'}); self.lib.sync({'token':'secret'})
            self.assertEqual(request.call_count,1)
        self.assertEqual(self.lib.queue()[0]['status'],'failed')
        self.assertGreater(self.lib.queue()[0]['next_at'],annotations.now())

    def test_archive_cancels_pending_upload_without_deleting_source(self):
        self.lib.save_settings({'destinations':{'readwise':True}})
        item=self.lib.put({'text':'Passage'},enqueue=True)[0]
        self.lib.update(item['id'],{'archived':True})
        self.assertEqual(self.lib.queue(),[]); self.assertEqual(len(self.lib.items()),1)

    def test_remote_edit_conflicts_preserve_local_notes_until_resolved(self):
        item=self.add(source='Readwise Reader',sourceId='remote',note='Original')
        self.lib.update(item['id'],{'note':'Personal edit'})
        self.add(source='Readwise Reader',sourceId='remote',note='Original')
        self.assertEqual(self.lib.conflicts(),[])
        self.add(source='Readwise Reader',sourceId='remote',note='Remote edit')
        conflict=self.lib.conflicts()[0]
        self.assertEqual(self.lib.items()[0]['note'],'Personal edit')
        self.lib.resolve(conflict['id'],False)
        self.add(source='Readwise Reader',sourceId='remote',note='Remote edit')
        self.assertEqual(self.lib.conflicts(),[])
        self.add(source='Readwise Reader',sourceId='remote',note='New remote edit')
        self.lib.resolve(self.lib.conflicts()[0]['id'],True)
        self.assertEqual(self.lib.items()[0]['note'],'New remote edit')

    def test_restore_to_another_library_preserves_deep_links(self):
        original=self.add()
        backup=annotations.dispatch(self.lib,{'action':'backup'})['content']
        other=annotations.Library(Path(self.temp.name)/'other.sqlite')
        try:
            annotations.dispatch(other,{'action':'restore','content':backup})
            self.assertEqual(other.items()[0]['id'],original['id'])
        finally: other.db.close()

    def test_invalid_restore_does_not_partially_modify_library(self):
        self.add()
        backup=json.dumps({'version':1,'highlights':[{'text':'New passage'}],'settings':{'reviewSize':'bad'}})
        with self.assertRaises(ValueError): annotations.dispatch(self.lib,{'action':'restore','content':backup})
        self.assertEqual(len(self.lib.items()),1)

    def test_apple_books_supported_schema_is_read_only(self):
        apple_root=Path(self.temp.name)/'apple'; apple_root.mkdir()
        path=apple_root/'annotations.sqlite3'
        conn=sqlite3.connect(path)
        conn.execute('CREATE TABLE ZAEANNOTATION (ZANNOTATIONSELECTEDTEXT TEXT,ZANNOTATIONASSETID TEXT,ZANNOTATIONUUID TEXT,ZANNOTATIONNOTE TEXT,ZANNOTATIONDELETED INTEGER)')
        conn.execute("INSERT INTO ZAEANNOTATION VALUES ('A quote','asset','uuid','note',0)")
        conn.execute("INSERT INTO ZAEANNOTATION VALUES ('Deleted','asset','uuid2','',1)")
        conn.commit(); conn.close(); before=path.read_bytes()
        # The adapter searches Apple-style .sqlite files only.
        actual=path.with_suffix('.sqlite'); path.rename(actual)
        rows=annotations.apple_books_annotations([actual.parent],{'asset':{'title':'Book','author':'Author'}})
        self.assertEqual(len(rows),1); self.assertEqual(rows[0]['note'],'note')
        self.assertEqual(actual.read_bytes(),before)

if __name__=='__main__': unittest.main()
