"""Build a portable, offline HTML explorer from the verified iOS review CSV."""
import csv
from datetime import datetime
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / 'review-explorer'
TOPICS = {
    'ad-mismatch': ('Ad mismatch', 'Ad mismatch indicators (screen)'),
    'advertising': ('Ads & advertising', 'Advertising / ads'),
    'energy': ('Energy & pacing', 'Energy / stamina'),
    'spending': ('Spending & currency', 'Spending / purchases / premium currency'),
    'story': ('Story & characters', 'Story / characters / mystery'),
    'enjoyment': ('Enjoyment & relaxation', 'Fun / enjoyment / addictive / relaxing'),
    'decoration': ('Decoration & restoration', 'Design / decoration / restoration'),
    'events': ('Events & collections', 'Events / cards / collections'),
    'technical': ('Bugs & progress', 'Technical / progress-loss indicators (screen)'),
    'graphics': ('Graphics & animation', 'Graphics / artwork / animation'),
    'support': ('Customer support', 'Support / service'),
}
reviews = []
with (ROOT / 'ios_review_analysis' / 'coded_reviews.csv').open(encoding='utf-8-sig', newline='') as f:
    for row in csv.DictReader(f):
        tags = row['topic_screens'].split('; ')
        reviews.append({
            'id': row['review_id'], 'date': datetime.strptime(row['date'], '%b %d, %Y').strftime('%Y-%m-%d'),
            'stars': int(row['rating']), 'version': row['version'].removeprefix('Version '),
            'author': row['author'], 'title': row['title'], 'text': row['text'],
            'words': int(row['body_word_count']),
            'categories': [key for key, (_, source) in TOPICS.items() if source in tags],
            'page': int(row['source_page']), 'source': row['source_file'].replace('\\', '/'),
        })
assert len(reviews) == len({r['id'] for r in reviews}) == 6250
assert all(1 <= r['stars'] <= 5 for r in reviews)
payload = {'appId': '1623318294', 'store': 'apple_app_store', 'country': 'us',
           'topics': {k: {'name': v[0], 'rule': v[1]} for k, v in TOPICS.items()}, 'reviews': reviews}
serialized = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
# Escape HTML parsing delimiters in the embedded data; review text is untrusted content.
embedded = serialized.replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
template = (APP / 'template.html').read_text(encoding='utf-8')
html = template.replace('/* STYLES */', (APP / 'styles.css').read_text(encoding='utf-8'))
html = html.replace('/* DATA */', embedded).replace('/* APP */', (APP / 'app.js').read_text(encoding='utf-8'))
(APP / 'index.html').write_text(html, encoding='utf-8')
(APP / 'reviews.json').write_text(serialized, encoding='utf-8')
print(f'Built {APP / "index.html"}: {len(reviews):,} embedded reviews; {len(html.encode("utf-8")):,} bytes.')
