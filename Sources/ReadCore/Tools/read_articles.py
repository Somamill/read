"""Local read-later library. No account, API key, or hosted service required."""
import hashlib
import html
from html.parser import HTMLParser
import ipaddress
import json
from pathlib import Path
import re
import socket
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

MAX_BYTES = 4 * 1024 * 1024


def public_url(value):
    value = str(value).strip()
    p = urllib.parse.urlsplit(value)
    if p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password:
        raise ValueError('Use a public http or https article or feed URL.')
    if p.port and p.port not in (80, 443):
        raise ValueError('Article URLs must use a standard web port.')
    for record in socket.getaddrinfo(p.hostname, p.port or (443 if p.scheme == 'https' else 80), type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(record[4][0]).is_global:
            raise ValueError('Local and private network addresses cannot be saved as articles.')
    # Tracking fragments and common campaign parameters do not identify editions.
    query = [(k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True)
             if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
    return urllib.parse.urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path or '/', urllib.parse.urlencode(query), ''))


class PublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return super().redirect_request(req, fp, code, msg, headers, public_url(newurl))


def fetch(url):
    url = public_url(url)
    opener = urllib.request.build_opener(PublicRedirect)
    request = urllib.request.Request(url, headers={'User-Agent': 'read./0.3 (+https://github.com/Somamill/read)',
                                                 'Accept': 'text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml,text/xml'})
    with opener.open(request, timeout=15) as response:
        content_type = response.headers.get_content_type()
        if content_type not in ('text/html', 'application/xhtml+xml', 'application/rss+xml', 'application/atom+xml', 'application/xml', 'text/xml', 'text/plain'):
            raise ValueError('That address is not a web article or RSS/Atom feed.')
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError('This page is too large. Save a smaller article instead.')
        return public_url(response.url), data.decode(response.headers.get_content_charset() or 'utf-8', errors='replace')


class SafeArticle(HTMLParser):
    """Independent allowlist after Readability/DOMPurify; offline text by default."""
    tags = set('p div section article h1 h2 h3 h4 h5 h6 blockquote pre code ul ol li strong b em i u s a br hr sup sub table thead tbody tr th td figure figcaption dl dt dd mark'.split())
    blocked = set('script style iframe object embed form button input select textarea svg math head'.split())

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []; self.text = []; self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('input','embed'): return
        if tag in self.blocked:
            self.skip += 1
        if self.skip: return
        if tag not in self.tags: return
        attrs = dict(attrs); extra = ''
        if attrs.get('id'): extra += ' id="' + html.escape(attrs['id'][:200],quote=True) + '"'
        if tag == 'a':
            url = attrs.get('href', '')
            if url.startswith('#') or urllib.parse.urlsplit(url).scheme in ('https', 'http'):
                extra += ' href="' + html.escape(url, quote=True) + '" rel="noreferrer noopener"'
        self.parts.append('<' + tag + extra + '>')
        if tag in ('p', 'div', 'li', 'br') or tag.startswith('h'): self.text.append('\n')

    def handle_endtag(self, tag):
        if tag in self.blocked:
            self.skip = max(0, self.skip - 1)
            return
        if not self.skip and tag in self.tags and tag not in ('br', 'hr'):
            self.parts.append('</' + tag + '>')

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(html.escape(data)); self.text.append(data)


def clean_content(content):
    parser = SafeArticle(); parser.feed(str(content)[:MAX_BYTES])
    text = re.sub(r'\n\s*\n+', '\n\n', ''.join(parser.text)).strip()
    if len(text) < 40: raise ValueError('No readable article text was found. Try another page or import its text.')
    return ''.join(parser.parts), text


class Library:
    def __init__(self, root):
        self.root = Path(root); self.root.mkdir(parents=True, exist_ok=True)
        self.root.chmod(0o700)
        self.db = sqlite3.connect(self.root / 'articles.sqlite', timeout=10)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY, url TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
            author TEXT DEFAULT '', site TEXT DEFAULT '', content TEXT NOT NULL,
            text TEXT NOT NULL, excerpt TEXT DEFAULT '', language TEXT DEFAULT '',
            saved REAL NOT NULL, updated REAL NOT NULL, opened REAL DEFAULT 0,
            progress REAL DEFAULT 0, status TEXT DEFAULT 'inbox', tags TEXT DEFAULT '',
            favorite INTEGER DEFAULT 0, feed TEXT DEFAULT '', fetched INTEGER DEFAULT 1);
          CREATE TABLE IF NOT EXISTS article_aliases (url TEXT PRIMARY KEY,article INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS feeds (url TEXT PRIMARY KEY,title TEXT NOT NULL,
            checked REAL DEFAULT 0,error TEXT DEFAULT '');
        ''')
        (self.root / 'articles.sqlite').chmod(0o600)

    def list(self):
        return {'ok': True, 'items': [dict(x) for x in self.db.execute('SELECT id,url,title,author,site,excerpt,language,saved,updated,opened,progress,status,tags,favorite,feed,fetched,length(text) AS characters FROM articles ORDER BY saved DESC LIMIT 2000')],
                'feeds': [dict(x) for x in self.db.execute('SELECT * FROM feeds ORDER BY title')]}

    def save(self, item):
        url = public_url(item.get('url', ''))
        fetched_url=url
        prior=self.db.execute('SELECT a.id,a.url FROM articles a JOIN article_aliases l ON a.id=l.article WHERE l.url=?',(url,)).fetchone()
        if not prior and item.get('articleId'):
            prior=self.db.execute('SELECT id,url FROM articles WHERE id=?',(int(item['articleId']),)).fetchone()
        if prior: url=prior['url']
        content, text = clean_content(item.get('content', ''))
        title = str(item.get('title') or urllib.parse.urlsplit(url).hostname)[:500]
        # Re-saving must preserve highlights, identity, progress, tags, and archive.
        self.db.execute('''INSERT INTO articles(url,title,author,site,content,text,excerpt,language,saved,updated,feed,fetched)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET
          title=excluded.title,author=excluded.author,site=excluded.site,content=excluded.content,
          text=excluded.text,excerpt=excluded.excerpt,language=excluded.language,updated=excluded.updated,fetched=excluded.fetched''',
          (url,title,str(item.get('author',''))[:300],urllib.parse.urlsplit(url).hostname,content,text,text[:300],str(item.get('language',''))[:30],time.time(),time.time(),str(item.get('feed','')),int(item.get('fetched',1))))
        self.db.commit()
        identifier=self.db.execute('SELECT id FROM articles WHERE url=?', (url,)).fetchone()[0]
        self.db.execute('INSERT OR REPLACE INTO article_aliases(url,article) VALUES(?,?)',(fetched_url,identifier));self.db.commit()
        return identifier

    def article(self, identifier):
        row = self.db.execute('SELECT * FROM articles WHERE id=?', (int(identifier),)).fetchone()
        if not row: raise ValueError('This article is no longer available.')
        return dict(row)

    def open(self, identifier):
        item = self.article(identifier)
        directory = self.root / 'reader' / str(item['id']); directory.mkdir(parents=True, exist_ok=True)
        title = html.escape(item['title']); byline = html.escape(item['author'] or item['site'])
        path = directory / 'index.html'
        path.write_text('<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'none\'; object-src \'none\'"><title>' + title + '</title></head><body><article><h1>' + title + '</h1><p>' + byline + '</p>' + item['content'] + '</article></body></html>', encoding='utf-8')
        path.chmod(0o600)
        self.db.execute('UPDATE articles SET opened=? WHERE id=?', (time.time(),item['id'])); self.db.commit()
        return {'ok':True,'articleId':item['id'],'bookId':0,'kind':'article','title':item['title'],
                'authors':item['author'],'sourceURL':item['url'],'document':hashlib.md5(item['url'].encode()).hexdigest(),
                'language':item['language'],'htmlPath':str(path),'workDir':str(directory),'persistentCache':True,
                'resumePercentage':item['progress'],'savedHighlights':[],'articleText':item['text']}

    def refresh_feed(self, url, force=False):
        url = public_url(url)
        row = self.db.execute('SELECT * FROM feeds WHERE url=?', (url,)).fetchone()
        if row and not force and time.time()-row['checked'] < 900: return
        try:
            final, data = fetch(url)
            root = ET.fromstring(data)
            def tag(node): return node.tag.rsplit('}',1)[-1]
            def value(node, names):
                return next((''.join(x.itertext()).strip() for x in node if tag(x) in names), '')
            if tag(root) not in ('rss','feed','RDF'): raise ValueError('Use the RSS or Atom feed address, rather than its home page.')
            channel = next((x for x in root if tag(x)=='channel'),root)
            title = value(channel,('title',)) or urllib.parse.urlsplit(url).hostname
            self.db.execute('INSERT INTO feeds(url,title,checked,error) VALUES(?,?,?,?) ON CONFLICT(url) DO UPDATE SET title=excluded.title,checked=excluded.checked,error=excluded.error',(url,title,time.time(),''))
            for node in [x for x in root.iter() if tag(x) in ('item','entry')][:40]:
                link = value(node,('link',))
                if not link: link = next((x.get('href','') for x in node if tag(x)=='link' and x.get('rel','alternate')=='alternate'),'')
                if not link: continue
                try:
                    link = public_url(urllib.parse.urljoin(final,link))
                    if self.db.execute('SELECT 1 FROM articles WHERE url=?',(link,)).fetchone(): continue
                    content = value(node,('encoded','content')) or value(node,('description','summary'))
                    self.save({'url':link,'title':value(node,('title',)),'author':value(node,('creator','author')),'content':content,'feed':url,'fetched':0})
                except (ValueError,OSError): continue
            self.db.commit()
        except Exception as error:
            if not row: raise ValueError('Could not subscribe: '+str(error)[:180])
            self.db.execute('UPDATE feeds SET checked=?,error=? WHERE url=?',(time.time(),str(error)[:200],url)); self.db.commit()

    def dispatch(self, p):
        action = p.get('action','list')
        if action=='search':
            query=str(p.get('query','')).strip()[:300]
            return {'ok':True,'matches':[r[0] for r in self.db.execute('SELECT id FROM articles WHERE instr(lower(text),lower(?))>0 OR instr(lower(title),lower(?))>0 OR instr(lower(tags),lower(?))>0',(query,query,query))]}
        if action=='fetch':
            url, content = fetch(p.get('url',''))
            return {'ok':True,'url':url,'html':content,'articleId':p.get('articleId')}
        if action=='save':
            identifier = self.save(p['item'])
            return {**self.list(),'savedId':identifier,'openAfterSave':bool(p.get('openAfterSave'))}
        if action=='open': return self.open(p['id'])
        if action=='openDocument':
            for row in self.db.execute('SELECT id,url FROM articles'):
                if hashlib.md5(row['url'].encode()).hexdigest()==p.get('document'): return self.open(row['id'])
            raise ValueError('This article is no longer in the local library.')
        if action=='progress':
            percentage = float(p['percentage'])
            if not 0 <= percentage <= 1: raise ValueError('Invalid reading position.')
            self.db.execute("UPDATE articles SET progress=?,opened=?,status=CASE WHEN ?>=0.97 THEN 'archive' WHEN status='inbox' THEN 'later' ELSE status END WHERE id=?",(percentage,time.time(),percentage,int(p['id']))); self.db.commit()
        if action=='update':
            for field in ('status','tags','favorite'):
                if field not in p: continue
                value = p[field]
                if field=='status' and value not in ('inbox','later','archive','trash'): raise ValueError('Invalid article status.')
                if field=='favorite': value = int(bool(value))
                self.db.execute('UPDATE articles SET '+field+'=? WHERE id=?',(str(value)[:500],int(p['id'])))
                if field=='status' and value=='archive': self.db.execute('UPDATE articles SET progress=1 WHERE id=?',(int(p['id']),))
                if field=='status' and value=='inbox': self.db.execute('UPDATE articles SET progress=0 WHERE id=? AND progress>=0.97',(int(p['id']),))
            self.db.commit()
        if action=='subscribe': self.refresh_feed(p.get('url',''),force=True)
        if action=='refresh':
            for row in self.db.execute('SELECT url FROM feeds ORDER BY checked LIMIT 25').fetchall(): self.refresh_feed(row['url'])
        if action=='unsubscribe':
            self.db.execute('DELETE FROM feeds WHERE url=?',(p['url'],)); self.db.commit()
        if action=='export':
            items = [self.article(p['id'])] if p.get('id') else [dict(x) for x in self.db.execute("SELECT * FROM articles WHERE status!='trash'")]
            return {'ok':True,'exportText':'\n\n---\n\n'.join('# '+x['title']+'\n\n'+x['url']+'\n\n'+x['text'] for x in items)}
        return self.list()


def main():
    from shelf_config import configured_path
    root = configured_path('state',str(Path.home()/'Books/state')) / 'articles'
    library = Library(root)
    try:
        result = library.dispatch(json.load(sys.stdin))
        print(json.dumps(result,ensure_ascii=False))
    finally: library.db.close()


if __name__=='__main__':
    try: main()
    except Exception as error: print(json.dumps({'ok':False,'error':str(error)[:250]},ensure_ascii=False)); sys.exit(1)
