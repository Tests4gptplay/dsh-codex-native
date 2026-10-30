import tarfile,json,io,gzip,hashlib,subprocess
from pathlib import Path
BASE='d0da6b0390f9423c11ea9c72a3bb194848c755f0'
VERSION='0.2.2'
p=Path('dist');p.mkdir(exist_ok=True)
old=Path('test-artifacts/dsh-codex-native-0.2.1-alpha.9-http.11-candidate.7.tgz')
assert hashlib.sha256(old.read_bytes()).hexdigest()=='28ba1e9cfe142fba3fd59a31a7b5e4356bcb9a433b63d2b8ed8fb52da5131d94'
assert json.loads(Path('package.json').read_text())['version']==VERSION
assert not subprocess.check_output(['git','diff',BASE,'HEAD','--','src','lib','cordis.patch.yml','locale','assets'])
with tarfile.open(old) as t:
 members=t.getmembers();contents={m.name:t.extractfile(m).read() for m in members if m.isfile()}
assert all(m.isfile() or m.isdir() for m in members)
a=json.loads(contents['package/package.json']);assert a['version']=='0.2.1-alpha.9-http.11-candidate.7'
a['version']=VERSION;new=dict(contents);new['package/package.json']=(json.dumps(a,ensure_ascii=False,indent=2)+'\n').encode()
out=p/f'dsh-codex-native-{VERSION}.tgz'
with out.open('wb') as f,gzip.GzipFile(filename='',fileobj=f,mode='wb',mtime=0) as z,tarfile.open(fileobj=z,mode='w') as t:
 for m in members:
  if m.isfile():m.size=len(new[m.name]);t.addfile(m,io.BytesIO(new[m.name]))
  else:t.addfile(m)
with tarfile.open(out) as t:final={m.name:t.extractfile(m).read() for m in t.getmembers() if m.isfile()}
assert set(final)==set(contents)
changed=[k for k in contents if contents[k]!=final[k]];assert changed==['package/package.json']
b=json.loads(final['package/package.json']);b['version']='0.2.1-alpha.9-http.11-candidate.7';assert b==json.loads(contents['package/package.json'])
r={'candidateCommit':BASE,'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'version':VERSION,'candidateSha256':hashlib.sha256(old.read_bytes()).hexdigest(),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'size':out.stat().st_size,'changedFiles':changed,'onlySemanticChange':'package.json version','unchangedFileCount':len(contents)-1,'runtimeUnchanged':True,'packagedHashes':{k:hashlib.sha256(v).hexdigest() for k,v in final.items()}}
assert r['sha256']=='182bd31dfa4a82b9045dc94043e2aef79fedfc5de64ce98ed00172027149faa5',r
assert r['size']==93881
(p/'promotion-manifest.json').write_text(json.dumps(r,indent=2)+'\n');(p/'SHA256SUMS').write_text(r['sha256']+'  '+out.name+'\n')
print(json.dumps({k:v for k,v in r.items() if k!='packagedHashes'},indent=2))
