from pathlib import Path
import tarfile,io,gzip,json,hashlib,re
p=Path('.');old=Path('test-artifacts/dsh-codex-native-0.2.1-alpha.9-http.11-candidate.7.tgz')
with tarfile.open(old) as t:base={m.name:t.extractfile(m).read() for m in t.getmembers() if m.isfile()}
new=dict(base);pkg=json.loads(base['package/package.json']);src=json.loads((p/'package.json').read_text());pkg['version']=src['version'];pkg['description']=src['description'];pkg['files']=list(dict.fromkeys(pkg['files']+['RELEASE_NOTES.md']))
new['package/package.json']=(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n').encode()
for n in ['README.md','README.zh.md','locale/en.json','locale/zh.json','RELEASE_NOTES.md']:new['package/'+n]=(p/n).read_bytes()
out=p/f'dsh-codex-native-{pkg["version"]}.tgz'
with out.open('wb') as f,gzip.GzipFile(filename='',fileobj=f,mode='wb',mtime=0) as z,tarfile.open(fileobj=z,mode='w') as t:
 for n,b in sorted(new.items()):
  m=tarfile.TarInfo(n);m.size=len(b);m.mode=0o644;m.mtime=0;t.addfile(m,io.BytesIO(b))
with tarfile.open(out) as t:check={m.name:t.extractfile(m).read() for m in t.getmembers() if m.isfile()}
assert check==new
changed=[n for n in base if base[n]!=check[n]];added=sorted(set(check)-set(base));assert set(changed)=={'package/package.json','package/README.md','package/README.zh.md','package/locale/en.json','package/locale/zh.json'};assert added==['package/RELEASE_NOTES.md']
for n in base:
 if n.startswith('package/lib/') or n=='package/cordis.patch.yml':assert check[n]==base[n]
assert all(pkg.get(k)==json.loads(base['package/package.json']).get(k) for k in ['scripts','devDependencies','packageManager','publishConfig'])
assert not any(k in pkg.get('scripts',{}) for k in ['preinstall','install','postinstall','prepare'])
assert pkg['description']==json.loads(check['package/locale/en.json'])['meta']['description']
links=[]
for n in ['README.md','README.zh.md','RELEASE_NOTES.md']:
 s=check['package/'+n].decode();assert 'This test candidate is' not in s and '本测试候选为' not in s
 assert 'github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.10' not in s
 for target in re.findall(r'\]\(([^)]+)\)',s):
  if not re.match(r'https?://|#',target):
   assert 'package/'+target in check,(n,target)
   links.append({'document':n,'localTarget':target,'existsInPackage':True})
manifest={'status':'FINAL_LOCAL_PACKAGE_AWAITING_BATCH_RELEASE','version':pkg['version'],'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'candidateSha256':hashlib.sha256(old.read_bytes()).hexdigest(),'changedFiles':changed,'addedFiles':added,'unchangedFiles':len(base)-len(changed),'allRuntimeBytesIdentical':True,'developmentMetadataPreserved':True,'noInstallLifecycleHooks':True,'localMarkdownLinks':links,'finalVersionDecision':'0.2.3 approved; waiting coordinated release','checks':['TGZ reread byte equality','runtime and cordis byte equality','package metadata JSON and version','package+locale English description equality','no stale current candidate labels','no old http10 install commands','all relative Markdown links resolve inside package']}
(p/'verification.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(p/'SHA256SUMS').write_text(manifest['sha256']+'  '+out.name+'\n');print(json.dumps(manifest,ensure_ascii=False,indent=2))

assert manifest["sha256"]=="fa343bdbdc9e5c482610f70594d5f1e382e89b25983da480eaabef68a1ab5eb2"
assert manifest["bytes"]==88822
import subprocess
assert not subprocess.check_output(["git","diff","d0da6b0390f9423c11ea9c72a3bb194848c755f0","HEAD","--","src","lib","cordis.patch.yml","assets"])
manifest["sourceCommit"]=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip()
manifest["status"]="VERIFIED_FROZEN_RELEASE"
Path("verification.json").write_text(json.dumps(manifest,indent=2)+"\n")
