# Xinji-Mai.github.io

Personal academic homepage of **Xinji Mai (麦新纪)** — Researcher in Multimodal LLMs and
Agentic Reinforcement Learning. Built on the [Academic Pages](https://github.com/academicpages/academicpages.github.io)
Jekyll template (a fork of [Minimal Mistakes](https://github.com/mmistakes/minimal-mistakes)),
hosted on **GitHub Pages**.

**Live site:** https://xinji-mai.github.io

## Features added on top of the template

- 🌐 **One-click 中 / EN language toggle** (top-right). Content is bilingual; the active
  language is remembered via `localStorage`.
- 📰 **News** and ⭐ **Highlights** sections on the homepage.
- Sidebar links for Google Scholar, ORCID, DBLP, OpenReview and GitHub.

## How it works / how to edit

| What | Where |
| --- | --- |
| Name, bio, avatar, sidebar links | `_config.yml` (the `author:` block) |
| Homepage (About / News / Highlights) | `_pages/about.md` |
| Publications (one file per paper) | `_publications/*.md` |
| Projects | `_portfolio/*.md` |
| News archive posts | `_posts/*.md` |
| CV | `_pages/cv.md` |
| Top navigation (bilingual labels) | `_data/navigation.yml` |
| Language-toggle logic (CSS + JS) | `_includes/head/custom.html` |
| Language-toggle button | `_includes/masthead.html` |

**Bilingual convention:** wrap English text in `class="i18n-en"` and Chinese in
`class="i18n-zh"` (e.g. `<span class="i18n-en">Hello</span><span class="i18n-zh">你好</span>`).
The toggle shows one at a time.

**To personalise:** replace `your-email@example.com` in `_config.yml`, and optionally set a
profile photo by pointing `author.avatar` to an image in `images/`.

## Local preview

```bash
bundle install
bundle exec jekyll serve
# open http://localhost:4000
```

Requires Ruby + Bundler. If you cannot build locally, just push to GitHub — Pages builds
the Jekyll site automatically.

## Deploy

Push to the default branch of `Xinji-Mai/Xinji-Mai.github.io`; GitHub Pages builds and
publishes it at `https://xinji-mai.github.io`. In **Settings → Pages**, set the source to
*Deploy from a branch* → your default branch → `/ (root)`.
