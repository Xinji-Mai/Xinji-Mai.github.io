"""Validate rendered site links and required content without a browser."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import sys, re

root = Path(sys.argv[1] if len(sys.argv) > 1 else '_site').resolve()
errors = []
source_papers=list(Path('_publications').glob('*.md'))
expected_papers=len(source_papers)
expected_figures=sum(bool(re.search(r'^figure:\s*\S+', p.read_text(), re.M)) for p in source_papers)
expected_projects=len(list(Path('_portfolio').glob('*.md')))
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.images=[]; self.image_classes=[]; self.links=[]; self.ids=[]; self.mains=0; self.paper_rows=0; self.project_cards=0
    def handle_starttag(self, tag, attributes):
        a=dict(attributes)
        classes=a.get('class','').split()
        if 'paper-row' in classes: self.paper_rows+=1
        if 'project-card' in classes: self.project_cards+=1
        if 'id' in a: self.ids.append(a['id'])
        if tag=='main': self.mains+=1
        if tag=='img':
            self.images.append(a.get('src','')); self.image_classes.extend(a.get('class','').split())
            if not a.get('alt'): errors.append('Image missing alternate text')
        for name in ['href','src']:
            if a.get(name): self.links.append(a[name])

for route in ['', 'publications', 'portfolio', 'cv', 'game']:
    path=root/route/'index.html'
    assert path.exists(), f'Missing route: /{route}'
    html=path.read_text(); page=Page(); page.feed(html)
    if page.mains!=1: errors.append(f'{route}: expected one main landmark, got {page.mains}')
    if len(page.ids)!=len(set(page.ids)): errors.append(f'{route}: duplicate IDs')
    for needed in ['data-language="en"','data-language="zh"','i18n-en','i18n-zh']:
        if needed not in html: errors.append(f'{route}: missing bilingual control/content {needed}')
    for link in page.links:
        u=urlsplit(link)
        if u.scheme or u.netloc or not u.path: continue
        target=(root/unquote(u.path).lstrip('/')) if u.path.startswith('/') else path.parent/unquote(u.path)
        if not target.exists(): errors.append(f'{route}: broken local URL {link}')
    if route=='publications':
        if page.paper_rows!=expected_papers: errors.append(f'Expected {expected_papers} publications, got {page.paper_rows}')
        if page.image_classes.count('paper-figure')!=expected_figures: errors.append(f'Expected {expected_figures} publication figures')
    if route=='portfolio' and (page.project_cards!=expected_projects or page.image_classes.count('project-figure')!=expected_projects): errors.append(f'Expected {expected_projects} illustrated projects')
    if route=='game' and any(x in html for x in ['AGENT_LLM_ENDPOINT','agent-proxy','Mode: LLM','fcapp.run']): errors.append('Legacy model integration remains in game')
    if '{{' in html or '{%' in html: errors.append(f'{route}: unrendered Liquid')
    print(f'Checked /{route}: {len(page.images)} images, {len(page.links)} links')
if (root/'agent-proxy').exists(): errors.append('Proxy source should not be published')
if (root/'scripts').exists(): errors.append('Development scripts should not be published')
if errors: raise SystemExit('\n'.join(errors))
print('PASS: required routes, bilingual markup, accessible images, local assets, and model integration removal')
