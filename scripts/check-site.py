"""Validate rendered site links and required content without a browser."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else '_site').resolve()
errors = []
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.images=[]; self.image_classes=[]; self.links=[]; self.ids=[]; self.mains=0
    def handle_starttag(self, tag, attributes):
        a=dict(attributes)
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
    if route=='publications' and page.image_classes.count('paper-figure')<7: errors.append('Expected seven or more publication figures')
    if route=='portfolio' and page.image_classes.count('project-figure')!=6: errors.append('Expected six project figures')
    if route=='game' and any(x in html for x in ['AGENT_LLM_ENDPOINT','agent-proxy','Mode: LLM','fcapp.run']): errors.append('Legacy model integration remains in game')
    if '{{' in html or '{%' in html: errors.append(f'{route}: unrendered Liquid')
    print(f'Checked /{route}: {len(page.images)} images, {len(page.links)} links')
if (root/'agent-proxy').exists(): errors.append('Proxy source should not be published')
if (root/'scripts').exists(): errors.append('Development scripts should not be published')
if errors: raise SystemExit('\n'.join(errors))
print('PASS: required routes, bilingual markup, accessible images, local assets, and model integration removal')
