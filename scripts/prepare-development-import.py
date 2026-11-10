"""Prepare parameter-safe SQL batches for the connected Supabase tool; never sends data itself."""
import argparse, base64, json, pathlib, uuid

FIELDS = ('logline','key_points','characters','synopsis','changes','verification','scope')
def quote(value):
    return "'" + str(value).replace("'", "''") + "'"
def prepare(bundle_path, out):
    path=pathlib.Path(bundle_path); bundle=json.loads(path.read_text()); out=pathlib.Path(out)
    owner=str(uuid.UUID(bundle['owner_id'])); key=str(uuid.UUID(bundle['import_key']))
    report=bundle['report']; review=bundle['review']; meta=bundle['metadata']
    for field in FIELDS:
        if not isinstance(report.get(field),str) or not report[field].strip(): raise ValueError('Missing report field: '+field)
    if review.get('independent') is not True or not review.get('author_run_id') or not review.get('reviewer_run_id') or review['author_run_id']==review['reviewer_run_id'] or not review.get('findings') or not review.get('recheck'): raise ValueError('Actual independent review and recheck required')
    verdict=bundle.get('verdict','needs_revision')
    if verdict not in ('completed','needs_revision'): raise ValueError('Invalid verdict')
    files=bundle['files']; required={'report.pdf':('application/pdf',b'%PDF'),'characters.png':('image/png',b'\x89PNG\r\n\x1a\n'),'spaces.png':('image/png',b'\x89PNG\r\n\x1a\n')}
    assets=[]; batches=[]
    for name,(mime,magic) in required.items():
        data=(path.parent/files[name]).read_bytes()
        if not data.startswith(magic) or not 0<len(data)<=20_000_000: raise ValueError('Invalid file: '+name)
        encoded=base64.b64encode(data).decode(); parts=[encoded[i:i+48000] for i in range(0,len(encoded),48000)]
        assets.append(dict(name=name,mime=mime,chunks=len(parts),bytes=len(data)))
        for i,part in enumerate(parts): batches.append('select public.ip_dev_import_asset('+','.join(map(quote,(owner,key,name,mime)))+','+str(i)+','+quote(part)+');\n')
    report=dict(report,assets=assets)
    out.mkdir(parents=True,exist_ok=False)
    j=lambda obj: quote(json.dumps(obj,ensure_ascii=False))+'::jsonb'
    (out/'000-begin.sql').write_text('select public.ip_dev_import_begin('+quote(owner)+','+quote(key)+','+j(meta)+','+j(review)+');\n')
    for i,batch in enumerate(batches,1): (out/f'{i:04d}-asset.sql').write_text(batch)
    (out/f'{len(batches)+1:04d}-finish.sql').write_text('select public.ip_dev_import_finish('+quote(owner)+','+quote(key)+','+j(report)+','+quote(verdict)+');\n')
    return len(batches)+2
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('bundle');parser.add_argument('output');args=parser.parse_args()
    print(f'Prepared {prepare(args.bundle,args.output)} SQL batches. Execute in filename order through the authorized Supabase connector.')
