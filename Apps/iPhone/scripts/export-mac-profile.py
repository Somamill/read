#!/usr/bin/env python3
"""Read an owner's existing Mac connections. JSON is piped only into the encrypted pairing helper."""
import hashlib,json,os,pathlib,socket,sqlite3,subprocess,sys,urllib.request
home=pathlib.Path.home()
config_path=pathlib.Path(os.environ.get('SHELF_CONFIG',home/'Library/Application Support/Shelf/config.json'))
config=json.loads(config_path.read_text())
def path(key,default):return pathlib.Path(config.get('paths',{}).get(key,default)).expanduser()
state=path('state','~/Books/state');username=config.get('account',{}).get('username','reader')
password=(state/'calibre-server-password').read_text().strip()
sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
try:sock.connect(('8.8.8.8',80));ip=sock.getsockname()[0]
finally:sock.close()
services=config.get('services',{})
def lan(raw):
 from urllib.parse import urlsplit,urlunsplit
 u=urlsplit(raw);host=u.hostname
 if host in ('localhost','127.0.0.1','0.0.0.0'):host=ip
 return urlunsplit((u.scheme,host+(':'+str(u.port) if u.port else ''),u.path,u.query,''))
opds=services.get('readerOpds') or lan(services.get('calibreOpds','http://127.0.0.1:8080/opds/'))
local=services.get('calibreOpds','http://127.0.0.1:8080/opds/').split('/opds')[0]
manager=urllib.request.HTTPPasswordMgrWithDefaultRealm();manager.add_password(None,local,username,password)
client=urllib.request.build_opener(urllib.request.HTTPDigestAuthHandler(manager),urllib.request.HTTPBasicAuthHandler(manager))
def get(url,headers=None):
 with client.open(urllib.request.Request(url,headers=headers or {}),timeout=20) as response:return json.load(response)
search=get(local+'/ajax/search?num=20000&sort=last_modified&sort_order=desc')
base=opds.split('/opds')[0].rstrip('/')+'/'
records=[]
# Keep only metadata needed by the phone; never export local filesystem paths or book contents.
fields=['uuid','title','authors','thumbnail','cover','main_format','other_formats','timestamp','last_modified','user_metadata','identifiers']
for offset in range(0,len(search['book_ids']),100):
 ids=','.join(map(str,search['book_ids'][offset:offset+100]));rows=get(local+'/ajax/books?ids='+ids)
 for book_id,b in rows.items():
  if isinstance(b,dict):
   metadata={k:b.get(k) for k in fields if k in b}
   # Custom columns may contain entire highlight exports. Only sync fields are needed.
   metadata['user_metadata']={k:{'#value#':v.get('#value#',v.get('#value'))} for k,v in (b.get('user_metadata') or {}).items() if k in ('#ko_md5','#ko_progfloat','#ko_lastmod') and isinstance(v,dict)}
   records.append({'id':book_id,'metadata':metadata})
key=hashlib.md5(password.encode()).hexdigest();sync=services.get('readerSync')
if not sync:
 for candidate in [services.get('crosspointApi','http://127.0.0.1:17303'),'http://127.0.0.1:17200']:
  try:
   auth=get(candidate.rstrip('/')+'/users/auth',{'Accept':'application/vnd.koreader.v1+json','x-auth-user':username,'x-auth-key':key})
   if auth.get('username')==username or auth.get('authorized') in ('OK',True):sync=lan(candidate);break
  except Exception:pass
if not sync:raise RuntimeError('The existing sync credentials did not authenticate. No pairing profile was created.')
credentials_path=home/'Library/Application Support/Shelf/credentials.json'
credentials=json.loads(credentials_path.read_text()) if credentials_path.exists() else {}
enc_key='';env_file=state/'crosspoint-sync.env'
if env_file.exists():
 for line in env_file.read_text().splitlines():
  if line.startswith('TOKEN_ENC_KEY='):enc_key=line.split('=',1)[1].strip().strip('"\'')
encrypted={};db_path=path('crosspointDatabase','~/Books/KOSync/crosspoint-sync/data/crosspoint.db')
if db_path.exists():
 db=sqlite3.connect('file:'+str(db_path)+'?mode=ro',uri=True)
 for conn,cipher in db.execute('SELECT connector_id,cred_enc FROM connector_accounts WHERE user_id IN (SELECT id FROM users WHERE username=?) AND enabled=1',(username,)):
  if conn in ('hardcover','readwise','readwise-reader'):encrypted[conn]=cipher
 db.close()
result={'version':1,'settings':{'opds':opds,'sync':sync,'username':username,'readerSync':bool(credentials.get('readwise-reader-token'))},'secrets':{'opdsUser':username,'opdsPassword':password,'syncPassword':password,'readwise':credentials.get('readwise-reader-token','')},'catalog':{'base':base,'records':records},'services':['Calibre','KOReader / CrossPoint']+(['Readwise Reader'] if credentials.get('readwise-reader-token') else []),'_connectorKey':enc_key,'_encrypted':encrypted}
# Snapshot saved annotations read-only; private data stays inside the encrypted handoff.
annotation_path=home/'Library/Application Support/Shelf/annotations.sqlite'
result['highlights']=[]
result['catalog']['metadataVersion']=2
if annotation_path.exists():
 db=sqlite3.connect(annotation_path.resolve().as_uri()+'?mode=ro',uri=True,timeout=5)
 try:
  db.execute('PRAGMA query_only=ON')
  result['highlights']=[json.loads(r[0]) for r in db.execute('SELECT value FROM highlights LIMIT 20001')]
  if len(result['highlights'])>20000:raise RuntimeError('The highlight library is too large for a setup handoff. Export a smaller selection instead.')
  # Strip source location paths and source URLs; only review data is transferred.
  allowed=('id','bookId','title','author','text','note','source','sourceCategory','createdAt','archived','frequency','reviewCount','lastReviewedAt','nextReview')
  result['highlights']=[{k:h[k] for k in allowed if k in h} for h in result['highlights']]
 finally:db.close()
encoded=json.dumps(result,ensure_ascii=False)
if len(encoded.encode())>8*1024*1024:raise RuntimeError('The private setup snapshot exceeds 8 MB. Export highlights separately.')
sys.stdout.write(encoded)
