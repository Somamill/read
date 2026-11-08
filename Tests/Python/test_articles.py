"""Article behavior without accounts, remote services, or real network access."""
import json
from pathlib import Path
import socket
import sys
import tempfile
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

    def test_internal_chapter_links_survive_sanitization(self):
        identifier=self.save(content='<p><a href="#section">Jump</a></p><h2 id="section">A chapter</h2><p>Enough meaningful text to save and read this linked chapter.</p>')
        row=self.lib.article(identifier)
        self.assertIn('href="#section"',row['content']);self.assertIn('id="section"',row['content'])

    def test_invalid_progress_and_unsupported_feed_do_not_erase_library(self):
        self.save()
        with self.assertRaises(ValueError):self.lib.dispatch({'action':'progress','id':1,'percentage':float('nan')})
        with patch.object(articles,'fetch',return_value=('https://example.org/','<html><body>not a feed</body></html>')):
            with self.assertRaises(ValueError):self.lib.refresh_feed('https://example.org/')
        self.assertEqual(len(self.lib.list()['items']),1)


if __name__=='__main__':unittest.main()
