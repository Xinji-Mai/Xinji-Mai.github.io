# Xinji Mai — academic homepage

Bilingual academic website at **https://xinji-mai.github.io/**, built with Jekyll and hosted on GitHub Pages. The English and Chinese versions share the same content structure, with a persistent language switch and light/dark theme.

## Content and layout

- `_pages/about.md`: introduction, news, selected papers, projects, education.
- `_publications/*.md`: one paper per file. Set `selected`, `order`, `summary_en`, `summary_zh`, `authors`, `venue_short`, `year`, `figure`, `figure_alt`, `figure_source`, `paperurl`, and optional `codeurl`.
- `_portfolio/*.md`: one project per file, with its repository, associated paper, real figure, and bilingual summary.
- `_layouts/research.html`: shared page shell and navigation.
- `assets/css/research.css` and `assets/js/research.js`: responsive styling and language/theme preferences.
- `assets/images/research/SOURCES.json`: provenance for the paper figures. These are original published figures, not generated illustrations.
- `_pages/game.md`, `assets/js/tasty-world.js`, and `assets/css/game.css`: Terramai. It runs entirely in the browser, using local AUTO or MANUAL controls. Keyboard and multi-touch input are supported; no model endpoint, model API key, proxy, or server is needed.

Use matching `i18n-en` and `i18n-zh` elements for translated text. Paper titles remain in their original language. Do not substitute repository URLs for paper URLs, invent publication status, or add stale star counts.

The public figure for **When Small Models Team Up** could not be retrieved from OpenReview at the time of the redesign; its text and paper link remain available. Add its verified figure when available. The CMLM-ZhongJing paper is an associated project paper, not an additional personal publication.

## Preview and checks

```sh
bundle install
bundle exec jekyll serve
# http://localhost:4000

bundle exec jekyll build
python3 scripts/check-site.py _site
npm test
```

The CI workflow builds with the repository's GitHub Pages dependencies and checks generated routes, local links, images, bilingual controls, and the game runtime. The game checks use a deterministic Node VM and Canvas stub; they do not claim to be browser visual or physical-device tests.

## Publishing

GitHub Pages builds the `master` branch at the repository root. Development changes should pass `Check academic homepage` before updating `master`. Publication detail pages use directory URLs; the previous `.html` URLs redirect to them.

The original Academic Pages / Minimal Mistakes template and license are retained. The redesign takes layout ideas from several academic websites without copying their source or text.
