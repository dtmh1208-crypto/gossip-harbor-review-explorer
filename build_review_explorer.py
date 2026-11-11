"""Build the portable HTML explorer from its own reviews.json dataset."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / 'review-explorer'
payload = json.loads((APP / 'reviews.json').read_text(encoding='utf-8'))
reviews = payload['reviews']
assert payload['appId'] == '1623318294' and payload['store'] == 'apple_app_store'
assert len(reviews) == len({r['id'] for r in reviews}) == 6250
assert all(1 <= r['stars'] <= 5 for r in reviews)
serialized = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
# Escape HTML parsing delimiters in the embedded data; review text is untrusted content.
embedded = serialized.replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
template = (APP / 'template.html').read_text(encoding='utf-8')
html = template.replace('/* STYLES */', (APP / 'styles.css').read_text(encoding='utf-8'))
html = html.replace('/* DATA */', embedded).replace('/* APP */', (APP / 'app.js').read_text(encoding='utf-8'))
(APP / 'index.html').write_text(html, encoding='utf-8')
(APP / 'reviews.json').write_text(serialized, encoding='utf-8')
print(f'Built {APP / "index.html"}: {len(reviews):,} embedded reviews; {len(html.encode("utf-8")):,} bytes.')
