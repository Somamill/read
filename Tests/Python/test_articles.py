"""Article behavior without accounts, remote services, or real network access."""
import json
from pathlib import Path
import socket
import sys
import tempfile
import io
import zipfile
from email.message import Message
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'Sources/ReadCore/Tools'))
import read_articles as articles


class ArticleTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.lib=articles.Library(Path(self.temp.name)/'articles');self.addCleanup(self.lib.db.close)
        dns=patch.object(socket,'getaddrinfo',return_value=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('93.184.216.34',443))])
        dns.start();self.addCleanup(dns.stop)

    def save(self,**changes):
        return self.lib.save({'url':'https://example.org/story','title':'A worthwhile story','content':'<p>Thoughtful writing with enough words to make a readable offline article.</p>',**changes})

    def test_save_again_keeps_identity_position_tags_and_finished_status(self):
        identifier=self.save(url='https://example.org/story?utm_source=newsletter#text')
        self.lib.dispatch({'action':'update','id':identifier,'tags':'哲学, reading','favorite':True})
        self.lib.dispatch({'action':'progress','id':identifier,'percentage':.99})
        self.assertEqual(self.save(),identifier)
        row=self.lib.article(identifier)
        self.assertEqual(row['progress'],.99);self.assertEqual(row['status'],'archive')
        self.assertEqual(row['tags'],'哲学, reading');self.assertEqual(row['favorite'],1)

    def test_feed_redirect_preserves_article_identity_and_future_saves(self):
        identifier=self.save(url='https://example.org/short',fetched=0)
        redirected=self.save(url='https://example.org/full',articleId=identifier)
        self.assertEqual(identifier,redirected)
        self.assertEqual(self.save(url='https://example.org/full'),identifier)
        self.assertEqual(len(self.lib.list()['items']),1)

    def test_untrusted_markup_cannot_execute_or_load_tracking_resources(self):
        identifier=self.save(content='<script>steal()</script><style>body{display:none}</style><p onclick="bad()">A readable article with enough text to save safely.</p><img src="https://tracker.test/pixel"><a href="javascript:bad()">Bad link</a><iframe src="https://bad.test"></iframe>')
        row=self.lib.article(identifier)
        for token in ['<script','<img','<iframe','onclick','javascript:','steal()','display:none']:
            self.assertNotIn(token,row['content'])
        opened=self.lib.open(identifier)
        self.assertIn("script-src 'none'",Path(opened['htmlPath']).read_text())
        self.assertEqual(opened['kind'],'article');self.assertEqual(opened['bookId'],0)
        self.assertEqual((self.lib.root/'articles.sqlite').stat().st_mode&0o777,0o600)

    def test_offline_reopen_and_highlight_document_identity(self):
        identifier=self.save();first=self.lib.open(identifier)
        with patch.object(socket,'getaddrinfo',side_effect=OSError('offline')):
            second=self.lib.open(identifier)
            linked=self.lib.dispatch({'action':'openDocument','document':first['document']})
        self.assertEqual(first['document'],second['document']);self.assertEqual(linked['articleId'],identifier)

    def test_full_text_search_finds_words_beyond_excerpt(self):
        identifier=self.save(content='<p>'+('Beginning. '*80)+'最終章 searchable ending</p>')
        self.assertEqual(self.lib.dispatch({'action':'search','query':'最終章'})['matches'],[identifier])

    def test_trash_is_recoverable_and_excluded_from_exports(self):
        identifier=self.save();self.lib.dispatch({'action':'update','id':identifier,'status':'trash'})
        self.assertEqual(self.lib.dispatch({'action':'export'})['exportText'],'')
        self.lib.dispatch({'action':'update','id':identifier,'status':'inbox'})
        self.assertIn('https://example.org/story',self.lib.dispatch({'action':'export'})['exportText'])

    def test_rss_deduplication_refresh_limit_and_unsubscribe_keep_articles(self):
        feed='<rss><channel><title>Quiet feed</title><item><title>Essay</title><link>https://example.org/essay</link><description>A readable essay summary with enough words for this test entry.</description></item></channel></rss>'
        with patch.object(articles,'fetch',return_value=('https://example.org/feed',feed)) as fetch:
            self.lib.refresh_feed('https://example.org/feed')
            self.lib.refresh_feed('https://example.org/feed')
            self.assertEqual(fetch.call_count,1)
            self.lib.refresh_feed('https://example.org/feed',force=True)
        self.assertEqual(len(self.lib.list()['items']),1)
        self.lib.dispatch({'action':'unsubscribe','url':'https://example.org/feed'})
        self.assertEqual(len(self.lib.list()['items']),1);self.assertEqual(self.lib.list()['feeds'],[])

    def test_private_addresses_and_unsafe_schemes_are_rejected(self):
        with self.assertRaises(ValueError):articles.public_url('file:///etc/passwd')
        with self.assertRaises(ValueError):articles.public_url('https://user:password@example.org/')
        with patch.object(socket,'getaddrinfo',return_value=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('127.0.0.1',80))]):
            with self.assertRaises(ValueError):articles.public_url('http://localhost/')
            request=__import__('urllib.request',fromlist=['Request']).Request('https://example.org/')
            with self.assertRaises(ValueError):articles.PublicRedirect().redirect_request(request,None,302,'',{},'http://127.0.0.1/')

    def test_readwise_save_links_unwrap_before_any_login_or_fetch(self):
        url='https://wise.readwise.io/save?url=https%3A%2F%2Fexample.org%2Fessay%3Futm_source%3Dnewsletter'
        self.assertEqual(articles.reading_url(url),'https://example.org/essay')
        with self.assertRaises(ValueError):articles.reading_url('https://wise.readwise.io/save?url=file%3A%2F%2F%2Fetc%2Fpasswd')

    def test_public_edition_lookup_requires_one_exact_title_and_uses_normal_epub(self):
        results='<a href="/ebooks/writer/book/translator">The Book</a>'
        page='<a href="/ebooks/writer/book/downloads/book.kepub.epub">Kobo</a><a href="/ebooks/writer/book/downloads/book.epub">EPUB</a>'
        with patch.object(articles,'fetch',side_effect=[('https://standardebooks.org/ebooks',results),('https://standardebooks.org/ebooks/writer/book/translator',page)]):
            self.assertEqual(articles.public_book_url('The Book'),'https://standardebooks.org/ebooks/writer/book/downloads/book.epub')
        results+='<a href="/ebooks/writer/book/other-translator">The Book</a>'
        with patch.object(articles,'fetch',return_value=('https://standardebooks.org/ebooks',results)):
            with self.assertRaisesRegex(ValueError,'unique public edition'):articles.public_book_url('The Book')

    def test_private_readwise_library_links_do_not_open_a_login_page(self):
        with self.assertRaisesRegex(ValueError,'private Readwise library'):
            self.lib.fetch_link({'url':'https://read.readwise.io/read/private-document','openAfterSave':True})

    def response(self,body,mime,url):
        response=io.BytesIO(body);response.url=url;response.headers=Message();response.headers['Content-Type']=mime
        return response

    def test_pdf_links_download_as_private_local_files(self):
        from unittest.mock import Mock
        response=self.response(b'%PDF-1.7\nExample','application/pdf','https://example.org/paper.pdf')
        opener=Mock();opener.open.return_value=response
        with patch.object(articles.urllib.request,'build_opener',return_value=opener):
            result=self.lib.fetch_link({'url':'https://example.org/paper.pdf','title':'A paper','openAfterSave':True})
        self.assertEqual(result['fileType'],'pdf');self.assertEqual(result['title'],'A paper')
        self.assertEqual(Path(result['filePath']).stat().st_mode&0o777,0o600)

    def test_epub_link_opens_native_cached_file_with_navigation(self):
        from unittest.mock import Mock
        archive=io.BytesIO()
        with zipfile.ZipFile(archive,'w') as bundle:
            bundle.writestr('META-INF/container.xml','<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>')
            bundle.writestr('book.opf','<package><metadata><title>Linked book</title><creator>Writer</creator></metadata><manifest><item id="a" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/></spine></package>')
            bundle.writestr('chapter.xhtml','<html><body><h1>First chapter</h1><p>A complete readable chapter with plenty of meaningful words for the offline reading test.</p></body></html>')
        opener=Mock();opener.open.return_value=self.response(archive.getvalue(),'application/epub+zip','https://example.org/book.epub')
        with patch.object(articles.urllib.request,'build_opener',return_value=opener):
            saved=self.lib.fetch_link({'url':'https://example.org/book.epub','openAfterSave':True})
        reader=self.lib.open(saved['savedId'])
        self.assertEqual(reader['title'],'Linked book');self.assertEqual(reader['chapters'][0]['title'],'First chapter')
        self.assertTrue((Path(reader['htmlPath']).parent/'book').is_dir());self.assertTrue(Path(reader['htmlPath']).is_file())

    def test_opening_an_existing_link_reuses_saved_text_offline(self):
        identifier=self.save()
        with patch.object(socket,'getaddrinfo',side_effect=OSError('offline')),patch.object(articles.urllib.request,'build_opener',side_effect=AssertionError('must not download again')):
            result=self.lib.fetch_link({'url':'https://example.org/story','openAfterSave':True})
        self.assertEqual(result['savedId'],identifier)

    def test_internal_chapter_links_survive_sanitization(self):
        identifier=self.save(content='<p><a href="#section">Jump</a></p><h2 id="section">A chapter</h2><p>Enough meaningful text to save and read this linked chapter.</p>')
        row=self.lib.article(identifier)
        self.assertIn('href="#section"',row['content']);self.assertIn('id="section"',row['content'])

    def test_feed_link_reuses_canonical_subscription(self):
        from unittest.mock import Mock
        xml=b'<rss><channel><title>Essays</title><item><title>A story</title><link>https://example.org/story</link><description>A thoughtful story with enough words for an offline feed preview.</description></item></channel></rss>'
        with patch.object(articles,'fetch',return_value=('https://example.org/feed',xml)):
            self.lib.refresh_feed('https://example.org/feed')
        opener=Mock();opener.open.return_value=self.response(xml,'application/rss+xml','https://example.org/feed')
        with patch.object(articles.urllib.request,'build_opener',return_value=opener):
            result=self.lib.fetch_link({'url':'https://old.example.org/feed','openAfterSave':True})
        self.assertEqual(result['subscribedFeedURL'],'https://example.org/feed')
        self.assertEqual(len(result['feeds']),1)
        self.assertEqual(len(result['items']),1)

    def test_initial_feed_import_is_latest_ten_and_does_not_flood_on_refresh(self):
        xml='<rss><channel><title>Essays</title>'+''.join('<item><title>Story '+str(i)+'</title><link>https://example.org/story'+str(i)+'</link><pubDate>Mon, '+str(i+1)+' Jun 2026 12:00:00 GMT</pubDate><description>A thoughtful story with enough words for this feed preview.</description></item>' for i in range(20))+'</channel></rss>'
        with patch.object(articles,'fetch',return_value=('https://example.org/feed',xml)):
            self.lib.refresh_feed('https://example.org/feed')
            self.lib.refresh_feed('https://example.org/feed',force=True)
        rows=self.lib.list()['items'];self.assertEqual(len(rows),10)
        self.assertEqual({r['title'] for r in rows},{'Story '+str(i) for i in range(10,20)})

    def test_images_cache_locally_without_remote_reader_requests(self):
        from unittest.mock import Mock
        identifier=self.save(content='<p>An illustrated article with enough readable text for offline use.</p><img src="https://example.org/photo.jpg" alt="A landscape">')
        before=Path(self.lib.open(identifier)['htmlPath']).read_text()
        self.assertNotIn('src="https://',before)
        opener=Mock();opener.open.return_value=self.response(b'jpeg test','image/jpeg','https://example.org/photo.jpg')
        with patch.object(articles.urllib.request,'build_opener',return_value=opener):
            result=self.lib.cache_images(identifier)
        self.assertIn('https://example.org/photo.jpg',result['images'])
        after=Path(self.lib.open(identifier)['htmlPath']).read_text()
        self.assertIn('src="images/',after)
        with patch.object(articles.urllib.request,'build_opener',side_effect=AssertionError('offline')):
            self.assertEqual(self.lib.cache_images(identifier)['images'],result['images'])

    def test_invalid_progress_and_unsupported_feed_do_not_erase_library(self):
        self.save()
        with self.assertRaises(ValueError):self.lib.dispatch({'action':'progress','id':1,'percentage':float('nan')})
        with patch.object(articles,'fetch',return_value=('https://example.org/','<html><body>not a feed</body></html>')):
            with self.assertRaises(ValueError):self.lib.refresh_feed('https://example.org/')
        self.assertEqual(len(self.lib.list()['items']),1)


if __name__=='__main__':unittest.main()
