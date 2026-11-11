# Gossip Harbor Review Explorer

Open **index.html** in Chrome or Edge. All 6,250 reviews are embedded; no installation, server, API key, or network is needed. Keep the app in this workspace if you want its original source JSON links to work.

- Search titles, body text, authors or review IDs. Choose all terms, any term, or exact phrase. Quote a phrase inside an all/any-term query. Search matches substrings, without stemming or translation.
- Combine star ratings, topics (any/all), date ranges, app versions, minimum text length and saved status. An unselected filter includes everything. Topic counts show the full library, not the current result count.
- Read & cite opens the full review, topic tags, source page and research notes. Copy review & citation includes the full review, date, rating, author and review ID. The Apple link is the app listing, not a direct review permalink.
- Save reviews and notes in browser storage. Export saved evidence as JSON to keep a backup; storage for local files can vary by browser or change when you move the HTML file. Backups contain full text and notes, but this version does not import them.
- Export results CSV downloads **all filtered matches**, not just the visible page, with review IDs, source paths, tags and saved notes. Spreadsheet formula-like cell values are prefixed with an apostrophe for safe opening.

Dataset: US Apple App Store, Apple ID 1623318294, February 16–November 9, 2026, 250 SerpApi pages. These are collected written reviews, not all lifetime ratings. Topic categories inherit English keyword rules from the analysis; they indicate mentions and can include false positives, mixed feedback and omissions.

`reviews.json` stores the same full review library in portable structured form. Rebuild the HTML after changing source files with `python build_review_explorer.py` from the workspace root. `app.js`, `styles.css` and `template.html` are the editable sources; `index.html` is the generated standalone app.
