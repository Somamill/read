"""Fresh-user and ordinary Calibre libraries must not require private sync columns."""
import json,os,sqlite3,subprocess,sys,tempfile,unittest
from pathlib import Path
SCRIPT=Path(__file__).resolve().parents[2]/'Sources/ReadCore/Tools/bookshelf.py'
class PortableBookshelfTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);self.lib=self.root/'library';self.lib.mkdir();self.config=self.root/'config.json';self.config.write_text(json.dumps({'paths':{'library':str(self.lib),'state':str(self.root/'state')}}))
 def run_helper(self):return subprocess.run([sys.executable,str(SCRIPT)],env={**os.environ,'SHELF_CONFIG':str(self.config)},capture_output=True,text=True)
 def create_library(self,columns=False):
  c=sqlite3.connect(self.lib/'metadata.db');self.addCleanup(c.close)
  c.executescript('''CREATE TABLE books(id,title,sort,author_sort,uuid,path,has_cover,timestamp,last_modified,pubdate,series_index);
  INSERT INTO books VALUES(1,'日本語の本','Book','Writer','uuid','Writer/Book',0,'2026-11-09','2026-11-09',NULL,1);
  CREATE TABLE custom_columns(id,label,name);CREATE TABLE comments(book,text);CREATE TABLE data(book,format);
  CREATE TABLE authors(id,name);CREATE TABLE books_authors_link(book,author);CREATE TABLE series(id,name);CREATE TABLE books_series_link(book,series);
  CREATE TABLE tags(id,name);CREATE TABLE books_tags_link(book,tag);CREATE TABLE publishers(id,name);CREATE TABLE books_publishers_link(book,publisher);
  CREATE TABLE languages(id,lang_code);CREATE TABLE books_languages_link(book,lang_code);CREATE TABLE identifiers(book,type,val);CREATE TABLE ratings(id,rating);CREATE TABLE books_ratings_link(book,rating);''')
  if columns:c.executescript("INSERT INTO custom_columns VALUES(17,'ko_progfloat','Progress');INSERT INTO custom_columns VALUES(31,'ko_statusbool','Finished');CREATE TABLE custom_column_17(book,value);INSERT INTO custom_column_17 VALUES(1,.42);CREATE TABLE custom_column_31(book,value);INSERT INTO custom_column_31 VALUES(1,0);")
  c.commit()
 def test_fresh_user_without_calibre_has_empty_library(self):
  r=self.run_helper();self.assertEqual(r.returncode,0,r.stderr);v=json.loads(r.stdout);self.assertEqual(v['allBooks'],[]);self.assertFalse(v['libraryConfigured'])
 def test_standard_library_needs_no_sync_columns(self):
  self.create_library();r=self.run_helper();self.assertEqual(r.returncode,0,r.stderr);v=json.loads(r.stdout);self.assertEqual(v['total'],1);self.assertEqual(v['allBooks'][0]['title'],'日本語の本');self.assertIsNone(v['allBooks'][0]['progress'])
 def test_progress_columns_are_found_by_label_instead_of_numeric_ids(self):
  self.create_library(True);r=self.run_helper();self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(json.loads(r.stdout)['reading'][0]['progress'],.42)
 def test_corrupt_database_is_not_reported_as_empty(self):
  (self.lib/'metadata.db').write_bytes(b'broken');self.assertNotEqual(self.run_helper().returncode,0)

 def test_article_records_are_not_presented_as_unmatched_books(self):
  import hashlib
  self.create_library();state=self.root/'state';(state/'articles').mkdir(parents=True);url='https://example.org/essay';document=hashlib.md5(url.encode()).hexdigest()
  with sqlite3.connect(state/'articles/articles.sqlite') as c:c.execute('CREATE TABLE articles(url)');c.execute('INSERT INTO articles VALUES(?)',(url,))
  (state/'kosync-calibre-unmatched.json').write_text(json.dumps({'items':[{'document':document},{'document':'unknown-book'}],'review':[]}))
  r=self.run_helper();self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(json.loads(r.stdout)['unmatchedProgress'],[{'document':'unknown-book'}])
