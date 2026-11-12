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
import tempfile
import zipfile
import concurrent.futures
from email.utils import parsedate_to_datetime
from datetime import datetime
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

MAX_BYTES = 4 * 1024 * 1024


def reading_url(value, check_network=True):
    """Unwrap save links without visiting a third-party reader or login page."""
    for _ in range(8):
        p=urllib.parse.urlsplit(str(value).strip())
        if p.hostname not in ('wise.readwise.io','readwise.io','www.readwise.io','read.readwise.io') or p.path.rstrip('/')!='/save':
            return public_url(value,check_network)
        target=urllib.parse.parse_qs(p.query).get('url',[''])[0]
        if not target: raise ValueError('This Readwise link has no original article URL.')
        value=target
    raise ValueError('Too many nested reader links.')


class PublisherLinks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.links=[];self.current=None;self.refresh=None
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='a':self.current=[attrs.get('href',''),'']
        if tag=='meta' and attrs.get('http-equiv','').casefold()=='refresh':
            match=re.fullmatch(r'\s*[0-5](?:\.\d+)?\s*;\s*url=(.+)',attrs.get('content',''),re.I)
            if match:self.refresh=match.group(1).strip().strip('\"\'')
    def handle_data(self,data):
        if self.current is not None:self.current[1]+=data
    def handle_endtag(self,tag):
        if tag=='a' and self.current is not None:self.links.append(self.current);self.current=None


FEED_CATALOG = [
    ('Weekly Wisereads','https://wise.readwise.io/feed/','reading books philosophy technology essays'),
    ('Experimental History','https://www.experimental-history.com/feed','psychology science thinking research essays'),
    ('Aeon','https://aeon.co/feed.rss','philosophy psychology culture history essays'),
    ('The Marginalian','https://www.themarginalian.org/feed/','books poetry philosophy art reading'),
    ('Longreads','https://longreads.com/feed/','essays culture history writing journalism'),
    ('Quanta Magazine','https://www.quantamagazine.org/feed/','science mathematics physics research'),
    ('MIT News · Research','https://news.mit.edu/rss/research','science technology research artificial intelligence'),
    ('Public Domain Review','https://publicdomainreview.org/rss.xml','history art books literature culture'),
    ('The Conversation · Science','https://theconversation.com/global/technology/articles.atom','science technology research psychology'),
    ('Nautilus','https://nautil.us/feed/','science philosophy psychology nature'),
]

def public_book_url(title):
    """Find an exact title on the public publisher named by Wisereads."""
    normalize=lambda text:re.sub(r'[^\w]','',text.casefold())
    if not title or len(title)>250 or len(normalize(title))<6:
        raise ValueError('This Readwise-only book link has no public source title. Use the publisher link in the newsletter.')
    base='https://standardebooks.org'
    _,page=fetch(base+'/ebooks?'+urllib.parse.urlencode({'query':title}))
    parser=PublisherLinks();parser.feed(page)
    candidates={urllib.parse.urljoin(base,href) for href,label in parser.links
                if href.startswith('/ebooks/') and normalize(label)==normalize(title)}
    if len(candidates)!=1:
        raise ValueError('A unique public edition could not be identified. Open the publisher link rather than the Readwise-only link.')
    _,page=fetch(candidates.pop());parser=PublisherLinks();parser.feed(page)
    epubs=[urllib.parse.urljoin(base,href) for href,_ in parser.links
           if urllib.parse.urlsplit(href).path.endswith('.epub') and '.kepub.' not in href and '_advanced.' not in href]
    if not epubs:raise ValueError('The publisher did not provide a direct EPUB download.')
    return public_url(epubs[0])


def public_url(value, check_network=True):
    value = str(value).strip()
    p = urllib.parse.urlsplit(value)
    if p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password:
        raise ValueError('Use a public http or https article or feed URL.')
    if p.port and p.port not in (80, 443):
        raise ValueError('Article URLs must use a standard web port.')
    for record in (socket.getaddrinfo(p.hostname, p.port or (443 if p.scheme == 'https' else 80), type=socket.SOCK_STREAM) if check_network else []):
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
    tags = set('p div section article h1 h2 h3 h4 h5 h6 blockquote pre code ul ol li strong b em i u s a br hr sup sub table thead tbody tr th td figure figcaption dl dt dd mark img'.split())
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
        if tag=='img':
            source=attrs.get('src') or attrs.get('data-read-image') or ''
            if urllib.parse.urlsplit(source).scheme not in ('http','https'):return
            for dimension in ('width','height'):
                if attrs.get(dimension,'').isdigit() and int(attrs[dimension])<=3:return
            if re.search(r'(?i)(?:tracking|beacon|spacer|(?:^|/)pixel(?:[.?/]|$))',source):return
            self.parts.append('<img data-read-image="'+html.escape(source,quote=True)+'" alt="'+html.escape(attrs.get('alt','')[:500],quote=True)+'">')
            return
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
        if not self.skip and tag in self.tags and tag not in ('br', 'hr','img'):
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
          CREATE TABLE IF NOT EXISTS reading_views (id TEXT PRIMARY KEY,name TEXT NOT NULL,query TEXT NOT NULL,created REAL NOT NULL,updated REAL NOT NULL);
          CREATE TABLE IF NOT EXISTS article_aliases (url TEXT PRIMARY KEY,article INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS file_readers (article INTEGER PRIMARY KEY,html TEXT NOT NULL,directory TEXT NOT NULL,chapters TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS images (article INTEGER,url TEXT,path TEXT,PRIMARY KEY(article,url));
          CREATE TABLE IF NOT EXISTS feed_seen (feed TEXT,url TEXT,PRIMARY KEY(feed,url));
          CREATE TABLE IF NOT EXISTS feeds (url TEXT PRIMARY KEY,title TEXT NOT NULL,
            checked REAL DEFAULT 0,error TEXT DEFAULT '');
        ''')
        columns={row[1] for row in self.db.execute('PRAGMA table_info(articles)')}
        for name,definition in [('published','REAL DEFAULT 0'),('document_type',"TEXT DEFAULT 'article'")]:
            if name not in columns:self.db.execute('ALTER TABLE articles ADD COLUMN '+name+' '+definition)
        self.db.commit()
        (self.root / 'articles.sqlite').chmod(0o600)

    def list(self):
        return {'ok': True, 'items': [dict(x) for x in self.db.execute("SELECT id,url,title,author,site,excerpt,language,saved,updated,opened,progress,status,tags,favorite,feed,fetched,published,document_type,length(text) AS characters,(SELECT path FROM images WHERE article=articles.id LIMIT 1) AS coverPath,CASE WHEN content LIKE '%data-read-image=%' THEN 1 ELSE 0 END AS hasImages FROM articles ORDER BY CASE WHEN feed!='' AND published>0 THEN published ELSE saved END DESC,id DESC LIMIT 2000")],
                'feeds': [dict(x) for x in self.db.execute('SELECT * FROM feeds ORDER BY title')],
                'views': [dict(x) for x in self.db.execute('SELECT * FROM reading_views ORDER BY name COLLATE NOCASE')]}

    def save_view(self, payload):
        import uuid
        name = str(payload.get('name', '')).strip()
        query = str(payload.get('query', '')).strip()
        duplicate = self.db.execute('SELECT id FROM reading_views WHERE name=? AND query=?',(name,query)).fetchone() if not payload.get('id') else None
        identifier = str(payload.get('id') or (duplicate[0] if duplicate else uuid.uuid4().hex))
        if not name or len(name)>80 or not query or len(query)>1600:
            raise ValueError('Use a view name under 80 characters and a query under 1,600 characters.')
        if not re.fullmatch(r'[a-f0-9]{32}',identifier):
            raise ValueError('Invalid saved view identifier.')
        if self.db.execute('SELECT count(*) FROM reading_views').fetchone()[0]>=100 and not self.db.execute('SELECT 1 FROM reading_views WHERE id=?',(identifier,)).fetchone():
            raise ValueError('Keep up to 100 saved views.')
        stamp=time.time()
        with self.db:
            self.db.execute('INSERT INTO reading_views VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,query=excluded.query,updated=excluded.updated',(identifier,name,query,stamp,stamp))
        return self.list()

    def update_many(self, payload):
        ids=payload.get('ids')
        if not isinstance(ids,list) or not ids or len(ids)>200 or any(type(x) is not int or x<=0 for x in ids):
            raise ValueError('Select between 1 and 200 articles.')
        ids=list(dict.fromkeys(ids))
        changes={k:payload[k] for k in ('status','favorite') if k in payload}
        if not changes:raise ValueError('Choose an inbox action.')
        if 'status' in changes and changes['status'] not in ('inbox','later','archive','trash'):
            raise ValueError('Invalid article status.')
        if 'favorite' in changes:
            if changes['favorite'] not in (True,False,0,1):raise ValueError('Invalid star setting.')
            changes['favorite']=int(bool(changes['favorite']))
        marks=','.join('?' for _ in ids)
        if self.db.execute('SELECT count(*) FROM articles WHERE id IN ('+marks+')',ids).fetchone()[0]!=len(ids):
            raise ValueError('An article is no longer available. Refresh the selection.')
        with self.db:
            self.db.execute('UPDATE articles SET '+','.join(k+'=?' for k in changes)+',updated=? WHERE id IN ('+marks+')',[*changes.values(),time.time(),*ids])
            if changes.get('status')=='archive':self.db.execute('UPDATE articles SET progress=1 WHERE id IN ('+marks+')',ids)
            if changes.get('status')=='inbox':self.db.execute('UPDATE articles SET progress=0 WHERE progress>=0.97 AND id IN ('+marks+')',ids)
        return self.list()

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
        if item.get('documentType') in ('article','pdf','epub'):
            self.db.execute('UPDATE articles SET document_type=? WHERE id=?',(item['documentType'],identifier))
        preview=Path(str(item.get('previewPath','')))
        if preview.is_file() and preview.resolve().parent==(self.root/'files').resolve() and preview.suffix=='.jpg':
            self.db.execute('INSERT OR REPLACE INTO images VALUES(?,?,?)',(identifier,'preview:pdf',str(preview)))
        if item.get('published'):
            self.db.execute('UPDATE articles SET published=? WHERE id=?',(float(item['published']),identifier))
        self.db.execute('INSERT OR REPLACE INTO article_aliases(url,article) VALUES(?,?)',(fetched_url,identifier));self.db.commit()
        return identifier

    def cache_images(self, identifier):
        item=self.article(identifier)
        sources=list(dict.fromkeys(html.unescape(x) for x in re.findall(r'data-read-image="([^"]+)"',item['content'])))[:8]
        directory=self.root/'reader'/str(item['id'])/'images';directory.mkdir(parents=True,exist_ok=True)
        existing={r['url']:r['path'] for r in self.db.execute('SELECT url,path FROM images WHERE article=?',(item['id'],))}
        def download(source):
            if source in existing and Path(existing[source]).is_file():return source,existing[source]
            try:
                request=urllib.request.Request(public_url(source),headers={'User-Agent':'read./0.3'})
                with urllib.request.build_opener(PublicRedirect).open(request,timeout=7) as response:
                    suffix={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','image/avif':'.avif'}.get(response.headers.get_content_type())
                    if not suffix:return None
                    data=response.read(2*1024*1024+1)
                    if not data or len(data)>2*1024*1024:return None
                path=directory/(hashlib.sha256(source.encode()).hexdigest()+suffix);path.write_bytes(data);path.chmod(0o600)
                return source,str(path)
            except (OSError,ValueError):return None
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as workers:
            for result in workers.map(download,sources):
                if result:self.db.execute('INSERT OR REPLACE INTO images VALUES(?,?,?)',(item['id'],*result))
        self.db.commit()
        images={r['url']:'images/'+Path(r['path']).name for r in self.db.execute('SELECT url,path FROM images WHERE article=?',(item['id'],)) if Path(r['path']).is_file()}
        return {'ok':True,'articleId':item['id'],'images':images}

    def article(self, identifier):
        row = self.db.execute('SELECT * FROM articles WHERE id=?', (int(identifier),)).fetchone()
        if not row: raise ValueError('This article is no longer available.')
        return dict(row)

    def fetch_link(self, p):
        url=reading_url(p.get('url',''),False)
        requested_url=public_url(p.get('_requestedURL') or url,False)
        if int(p.get('_redirects',0))>3:raise ValueError('The publisher returned too many download pages.')
        existing=self.db.execute('SELECT id FROM articles WHERE fetched=1 AND (url=? OR id=(SELECT article FROM article_aliases WHERE url=?))',(url,url)).fetchone()
        if p.get('openAfterSave') and existing:return {**self.list(),'savedId':existing[0],'openAfterSave':True}
        url=public_url(url)
        parsed=urllib.parse.urlsplit(url)
        if parsed.hostname in ('readwise.io','www.readwise.io') and parsed.path.startswith('/reader/fd/'):
            url=public_book_url(p.get('title',''))
        elif parsed.hostname=='read.readwise.io' or (parsed.hostname in ('readwise.io','www.readwise.io') and not parsed.path.startswith('/reader/fd/')):
            raise ValueError('This is a private Readwise library link. Use the original article or file URL to read it here.')
        existing=self.db.execute('SELECT id FROM articles WHERE url=? AND fetched=1',(url,)).fetchone()
        if p.get('openAfterSave') and existing:
            return {**self.list(),'savedId':existing[0],'openAfterSave':True}
        opener=urllib.request.build_opener(PublicRedirect)
        request=urllib.request.Request(url,headers={'User-Agent':'read./0.3','Accept':'text/html,application/xhtml+xml,application/pdf,application/epub+zip,application/rss+xml,application/atom+xml,application/xml'})
        try:response=opener.open(request,timeout=20)
        except urllib.error.HTTPError as error:
            if error.code==404 and urllib.parse.urlsplit(url).path.endswith('.html/'):
                retry=dict(p);retry['url']=url.rstrip('/');return self.fetch_link(retry)
            raise
        with response:
            final=public_url(response.url);mime=response.headers.get_content_type()
            data=response.read(32*1024*1024+1)
            if len(data)>32*1024*1024:raise ValueError('This linked file exceeds the 32 MB reading limit.')
            if mime in ('application/rss+xml','application/atom+xml','application/xml','text/xml') or data.lstrip().startswith(b'<?xml'):
                try:feed_root=ET.fromstring(data)
                except ET.ParseError:feed_root=None
                if feed_root is not None and feed_root.tag.rsplit('}',1)[-1] in ('rss','feed','RDF'):
                    self.refresh_feed(final)
                    return {**self.list(),'subscribedFeedURL':final}

            if mime=='application/pdf' or data.startswith(b'%PDF-'):
                if not data.startswith(b'%PDF-'):raise ValueError('The link did not return a valid PDF.')
                kind='pdf'
            elif mime=='application/epub+zip' or (urllib.parse.urlsplit(final).path.endswith('.epub') and data.startswith(b'PK')):kind='epub'
            else:
                if mime not in ('text/html','application/xhtml+xml','text/plain'):raise ValueError('This link is not an article, PDF, or EPUB.')
                if len(data)>MAX_BYTES:raise ValueError('This article exceeds the 4 MB text limit.')
                if urllib.parse.urlsplit(final).path.endswith('.epub'):
                    page=PublisherLinks();page.feed(data.decode('utf-8',errors='replace'))
                    target=urllib.parse.urljoin(final,page.refresh or '')
                    original=urllib.parse.urlsplit(final);destination=urllib.parse.urlsplit(target)
                    if page.refresh and original.hostname=='standardebooks.org' and destination.hostname==original.hostname and destination.path==original.path and target!=final:
                        retry=dict(p);retry.update(url=public_url(target),_requestedURL=requested_url,_redirects=int(p.get('_redirects',0))+1)
                        return self.fetch_link(retry)
                    raise ValueError('The publisher returned a download page rather than an EPUB file.')
                return {'ok':True,'url':final,'html':data.decode(response.headers.get_content_charset() or 'utf-8',errors='replace'),
                        'articleId':p.get('articleId'),'openAfterSave':bool(p.get('openAfterSave'))}
        digest=hashlib.sha256(data).hexdigest();files=self.root/'files';files.mkdir(exist_ok=True)
        path=files/(digest+'.'+kind);path.write_bytes(data);path.chmod(0o600)
        if kind=='pdf':return {'ok':True,'fileType':kind,'filePath':str(path),'url':final,'title':p.get('title') or 'PDF document','openAfterSave':True}
        from epub_native import prepare_epub,local
        native=files/digest
        if not native.exists():prepare_epub(path,native)
        native_html=native/'content/index.html'
        with zipfile.ZipFile(path) as bundle:
            container=ET.fromstring(bundle.read('META-INF/container.xml'))
            opf=next(x.get('full-path') for x in container.iter() if local(x.tag)=='rootfile')
            metadata=ET.fromstring(bundle.read(opf))
            title=next((''.join(x.itertext()) for x in metadata.iter() if local(x.tag)=='title'),p.get('title') or 'EPUB')
            author=' · '.join(''.join(x.itertext()) for x in metadata.iter() if local(x.tag)=='creator')
            language=next((''.join(x.itertext()) for x in metadata.iter() if local(x.tag)=='language'),'')
        identifier=self.save({'url':final,'title':title,'author':author,'language':language,'content':native_html.read_text(encoding='utf-8'),'documentType':'epub'})
        chapters=(native/'chapters.json').read_text(encoding='utf-8')
        self.db.execute('INSERT OR REPLACE INTO file_readers VALUES(?,?,?,?)',(identifier,str(native_html),str(native),chapters))
        self.db.execute('INSERT OR REPLACE INTO article_aliases VALUES(?,?)',(requested_url,identifier));self.db.commit()
        return {**self.list(),'savedId':identifier,'openAfterSave':True}

    def open(self, identifier):
        item = self.article(identifier)
        directory = self.root / 'reader' / str(item['id']); directory.mkdir(parents=True, exist_ok=True)
        title = html.escape(item['title']); byline = html.escape(item['author'] or item['site'])
        path = directory / 'index.html'
        content=item['content']
        for row in self.db.execute('SELECT url,path FROM images WHERE article=?',(item['id'],)):
            if Path(row['path']).is_file():content=content.replace('data-read-image="'+html.escape(row['url'],quote=True)+'"','data-read-image="'+html.escape(row['url'],quote=True)+'" src="images/'+Path(row['path']).name+'"')
        path.write_text('<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\' file: data:; style-src \'unsafe-inline\'; script-src \'none\'; object-src \'none\'"><title>' + title + '</title></head><body><article><h1>' + title + '</h1><p>' + byline + '</p>' + content + '</article></body></html>', encoding='utf-8')
        path.chmod(0o600)
        self.db.execute('UPDATE articles SET opened=? WHERE id=?', (time.time(),item['id'])); self.db.commit()
        result={'ok':True,'articleId':item['id'],'bookId':0,'kind':'article','title':item['title'],
                'authors':item['author'],'sourceURL':item['url'],'document':hashlib.md5(item['url'].encode()).hexdigest(),
                'language':item['language'],'htmlPath':str(path),'workDir':str(directory),'persistentCache':True,
                'resumePercentage':item['progress'],'savedHighlights':[],'articleText':item['text'],'documentType':item['document_type']}
        file_reader=self.db.execute('SELECT * FROM file_readers WHERE article=?',(item['id'],)).fetchone()
        if file_reader and Path(file_reader['html']).is_file():
            result.update(htmlPath=file_reader['html'],workDir=file_reader['directory'],chapters=json.loads(file_reader['chapters']))
        return result

    def refresh_feed(self, url, force=False):
        url=public_url(url)
        row=self.db.execute('SELECT * FROM feeds WHERE url=?',(url,)).fetchone()
        if row and not force and time.time()-row['checked']<900:return
        try:
            final,data=fetch(url);root=ET.fromstring(data)
            def tag(node):return node.tag.rsplit('}',1)[-1]
            def value(node,names):return next((''.join(x.itertext()).strip() for x in node if tag(x) in names),'')
            if tag(root) not in ('rss','feed','RDF'):raise ValueError('Use the RSS or Atom feed address, rather than its home page.')
            channel=next((x for x in root if tag(x)=='channel'),root)
            title=value(channel,('title',)) or urllib.parse.urlsplit(url).hostname
            previous_check=row['checked'] if row else 0
            seeded=bool(self.db.execute('SELECT 1 FROM feed_seen WHERE feed=? LIMIT 1',(url,)).fetchone())
            self.db.execute('INSERT INTO feeds(url,title,checked,error) VALUES(?,?,?,?) ON CONFLICT(url) DO UPDATE SET title=excluded.title,checked=excluded.checked,error=excluded.error',(url,title,time.time(),''))
            entries=[]
            for node in [x for x in root.iter() if tag(x) in ('item','entry')][:200]:
                link=value(node,('link',)) or next((x.get('href','') for x in node if tag(x)=='link' and x.get('rel','alternate')=='alternate'),'')
                if not link:continue
                try:link=public_url(urllib.parse.urljoin(final,link))
                except (ValueError,OSError):continue
                date=value(node,('pubDate','published','updated','date'));published=0
                if date:
                    try:published=parsedate_to_datetime(date).timestamp()
                    except (TypeError,ValueError):
                        try:published=datetime.fromisoformat(date.replace('Z','+00:00')).timestamp()
                        except ValueError:pass
                entries.append((node,link,published))
            entries.sort(key=lambda item:item[2],reverse=True)
            allowed={link for _,link,_ in entries[:10]} if not row else {link for _,link,_ in entries}
            for node,link,published in reversed(entries):
                existing=self.db.execute('SELECT id FROM articles WHERE url=? OR id=(SELECT article FROM article_aliases WHERE url=?)',(link,link)).fetchone()
                if existing:
                    if published:self.db.execute('UPDATE articles SET published=? WHERE id=?',(published,existing[0]))
                    preview=value(node,('encoded','content')) or value(node,('description','summary'))
                    if preview:
                        cleaned,plain=clean_content(preview)
                        self.db.execute('UPDATE articles SET content=?,text=? WHERE id=? AND fetched=0',(cleaned,plain,existing[0]))
                    self.db.execute('INSERT OR IGNORE INTO feed_seen VALUES(?,?)',(url,link));continue
                seen=self.db.execute('SELECT 1 FROM feed_seen WHERE feed=? AND url=?',(url,link)).fetchone()
                self.db.execute('INSERT OR IGNORE INTO feed_seen VALUES(?,?)',(url,link))
                if seen or link not in allowed:continue
                if row and not seeded and (not published or published<previous_check):continue
                content=value(node,('encoded','content')) or value(node,('description','summary'))
                if len(re.sub('<[^>]+>','',content).strip())<40:content='<p>'+html.escape(value(node,('title',)))+'</p><p>Open this story to save the full article from its publisher.</p>'
                try:self.save({'url':link,'title':value(node,('title',)),'author':value(node,('creator','author')),'content':content,'feed':url,'fetched':0,'published':published})
                except (ValueError,OSError):continue
            self.db.commit()
        except Exception as error:
            if not row:raise ValueError('Could not subscribe: '+str(error)[:180])
            self.db.execute('UPDATE feeds SET checked=?,error=? WHERE url=?',(time.time(),str(error)[:200],url));self.db.commit()

    def recommend_books(self):
        """Independent public catalogs; cached, bounded requests and no account data."""
        self.db.execute('CREATE TABLE IF NOT EXISTS discovery_cache (source TEXT PRIMARY KEY, fetched REAL, payload TEXT)')
        now=time.time();groups=[]
        sources=[('Open Library','https://openlibrary.org/search.json?'+urllib.parse.urlencode({'q':'subject:fiction AND ratings_count:[20 TO *]','sort':'rating','limit':12,'fields':'key,title,author_name,cover_i,ratings_average,ratings_count'})),('Project Gutenberg','https://gutendex.com/books/?languages=en,de,ja&copyright=false&mime_type=application%2Fepub%2Bzip')]
        def fetch(source,url):
            row=self.db.execute('SELECT fetched,payload FROM discovery_cache WHERE source=?',(source,)).fetchone()
            if row and now-row[0]<21600:return json.loads(row[1])
            try:
                request=urllib.request.Request(url,headers={'User-Agent':'read-open-source/0.3.6 (book discovery; https://github.com/Somamill/read)'})
                with urllib.request.urlopen(request,timeout=8) as response:
                    raw=response.read(2*1024*1024+1)
                    if len(raw)>2*1024*1024:raise ValueError('Catalog response too large')
                    data=json.loads(raw)
                books=[]
                for x in (data.get('docs',[]) if source=='Open Library' else data.get('results',[])):
                    if source=='Open Library':
                        if not re.fullmatch(r'(?:/works/)?OL\d+W',x.get('key','')):continue
                        book={'title':x.get('title',''),'author':', '.join(x.get('author_name',[])),'url':'https://openlibrary.org/works/'+x['key'].split('/')[-1],'coverURL':'https://covers.openlibrary.org/b/id/'+str(int(x['cover_i']))+'-M.jpg' if x.get('cover_i') else '', 'reason':'Reader ratings: '+str(round(x.get('ratings_average',0),1))+'/5 · '+str(x.get('ratings_count',0))+' ratings'}
                    else:
                        book={'title':x.get('title',''),'author':', '.join(a.get('name','') for a in x.get('authors',[])),'url':'https://www.gutenberg.org/ebooks/'+str(int(x['id'])),'coverURL':x.get('formats',{}).get('image/jpeg',''),'reason':'Public-domain catalog · '+str(x.get('download_count',0))+' recorded downloads'}
                    if book['title']:books.append(book)
                    if len(books)==8:break
                group={'source':source,'books':books,'checkedAt':now,'cached':False}
                self.db.execute('INSERT OR REPLACE INTO discovery_cache VALUES(?,?,?)',(source,now,json.dumps(group)));self.db.commit()
                return group
            except Exception:
                if row:return {**json.loads(row[1]),'cached':True,'warning':'Showing saved results; this source could not refresh.'}
                if source=='Project Gutenberg':
                    classics=[(84,'Frankenstein','Mary Shelley'),(1342,'Pride and Prejudice','Jane Austen'),(2554,'Crime and Punishment','Fyodor Dostoyevsky'),(2701,'Moby Dick','Herman Melville'),(2600,'War and Peace','Leo Tolstoy'),(345,'Dracula','Bram Stoker')]
                    return {'source':source,'books':[{'title':title,'author':author,'url':f'https://www.gutenberg.org/ebooks/{identifier}','coverURL':f'https://www.gutenberg.org/cache/epub/{identifier}/pg{identifier}.cover.medium.jpg','reason':'Curated classic · public-domain edition in the USA'} for identifier,title,author in classics],'warning':'Live rankings unavailable. Showing a curated starter selection instead.'}
                return {'source':source,'books':[],'warning':'This source is temporarily unavailable.'}
        for source,url in sources:groups.append(fetch(source,url))
        return {'ok':True,'recommendationGroups':groups}

    def discover(self):
        feeds=[dict(x) for x in self.db.execute('SELECT url,title FROM feeds')]
        followed={x['url'].rstrip('/') for x in feeds}
        signals=' '.join(x['title'] for x in feeds)+' '+' '.join(x['title']+' '+x['tags'] for x in self.db.execute("SELECT title,tags FROM articles WHERE status!='trash' ORDER BY favorite DESC,opened DESC LIMIT 100"))
        terms=re.findall(r'[^\W_]{4,}',signals.casefold())
        ranked=[]
        for title,url,topics in FEED_CATALOG:
            if url.rstrip('/') in followed:continue
            interests=set(topics.split());overlap={x for x in terms if x in interests}
            # Reading activity weighs more than a generic catalog order. No remote profiling.
            score=sum(min(4,terms.count(x)) for x in overlap)
            related=[]
            for f in feeds:
                known=next((set(t.split()) for _,u,t in FEED_CATALOG if u.rstrip('/')==f['url'].rstrip('/')),set())
                shared=interests&known
                if shared:score+=len(shared)*2;related.append((len(shared),f['title']))
            reason=('Related to '+max(related)[1]) if related else ('Matches your reading: '+', '.join(sorted(overlap)[:3]) if overlap else 'Explore '+', '.join(topics.split()[:3]))
            ranked.append({'title':title,'url':url,'topics':topics,'reason':reason,'score':score})
        return {'ok':True,'suggestions':sorted(ranked,key=lambda x:(-x['score'],x['title']))[:6]}

    def dispatch(self, p):
        action = p.get('action','list')
        if action=='save_view':return self.save_view(p)
        if action=='delete_view':
            with self.db:self.db.execute('DELETE FROM reading_views WHERE id=?',(str(p.get('id','')),))
            return self.list()
        if action=='bulk':return self.update_many(p)
        if action=='discover':return self.discover()
        if action=='recommend_books':return self.recommend_books()
        if action=='neighbor':
            current=self.article(p['id']);rows=[x for x in self.list()['items'] if x['status']!='trash' and x['document_type']=='article' and (not current['feed'] or x['feed']==current['feed'])];index=next((i for i,x in enumerate(rows) if x['id']==current['id']),-1);target=index+(-1 if int(p.get('direction',1))<0 else 1)
            return {'ok':True,'id':rows[target]['id'] if index>=0 and 0<=target<len(rows) else None}
        if action=='search':
            query=str(p.get('query','')).strip()[:300]
            return {'ok':True,'matches':[r[0] for r in self.db.execute('SELECT id FROM articles WHERE instr(lower(text),lower(?))>0 OR instr(lower(title),lower(?))>0 OR instr(lower(tags),lower(?))>0',(query,query,query))]}
        if action=='fetch':
            return self.fetch_link(p)
        if action=='save':
            identifier = self.save(p['item'])
            return {**self.list(),'savedId':identifier,'openAfterSave':bool(p.get('openAfterSave'))}
        if action=='images':return self.cache_images(p['id'])
        if action=='cover':
            row=self.db.execute('SELECT path FROM images WHERE article=? LIMIT 1',(int(p['id']),)).fetchone()
            return {'ok':True,'path':row['path'] if row else ''}
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
