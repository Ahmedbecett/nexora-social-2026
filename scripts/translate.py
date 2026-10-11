"""Machine-translate the English dictionary into every language in LANGUAGES.
usage: node scripts/dump-en.mjs > /tmp/en.json && python3 scripts/translate.py [codes...]"""
import json, re, sys, time, urllib.parse, urllib.request, concurrent.futures as cf, os
EN = json.load(open('/tmp/en.json'))
SRC = open(os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n.js'), encoding='utf8').read()
CODES = [c for c in re.findall(r"\['([a-zA-Z-]+)', '", SRC[SRC.index('LANGUAGES = ['):]) if c not in ('ar', 'en')]
if len(sys.argv) > 1: CODES = sys.argv[1:]
GMAP = {'he': 'iw'}
PH = re.compile(r'\{[a-zA-Z0-9_]+\}')

def gtx(texts, tl):
    data = urllib.parse.urlencode([('q', t) for t in texts]).encode()
    url = f'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl={GMAP.get(tl, tl)}'
    for i in range(6):
        try:
            req = urllib.request.Request(url, data=data, headers={'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'})
            r = json.load(urllib.request.urlopen(req, timeout=40))
            r = [x if isinstance(x, str) else x[0] for x in r]
            if len(r) == len(texts): return r
        except Exception as e:
            pass
        time.sleep(2 + i * 4)
    raise RuntimeError('translate failed ' + tl)

def protect(s):
    phs = PH.findall(s)
    for i, p in enumerate(phs): s = s.replace(p, f'⟦{i}⟧', 1)
    return s, phs

def restore(s, phs):
    for i, p in enumerate(phs):
        s = re.sub(rf'⟦\s*{i}\s*⟧', lambda m: p, s)
    return s

def translate_many(items, tl):
    out = {}
    for i in range(0, len(items), 60):
        chunk = items[i:i + 60]
        prot = [protect(v) for _, v in chunk]
        res = gtx([p for p, _ in prot], tl)
        for (k, v), r, (_, phs) in zip(chunk, res, prot):
            r = restore((r or '').strip(), phs)
            out[k] = r if r and all(p in r for p in phs) else v
    return out

def do_lang(tl):
    path = f'src/locales/{tl}.json'
    if os.path.exists(path): return tl, 'skip'
    flat = [(k, v) for k, v in EN.items() if isinstance(v, str)]
    errs = [(k, v) for k, v in EN['errors'].items()]
    d = translate_many(flat, tl)
    d['errors'] = translate_many(errs, tl)
    json.dump(d, open(path, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    return tl, len(d)

with cf.ThreadPoolExecutor(6) as ex:
    for f in cf.as_completed([ex.submit(do_lang, c) for c in CODES]):
        try: print(*f.result(), flush=True)
        except Exception as e: print('ERR', e, flush=True)
