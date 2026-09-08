---
layout: research
title: "Curriculum vitae"
title_zh: "简历"
kicker: "BACKGROUND"
kicker_zh: "个人经历"
permalink: /cv/
redirect_from:
  - /resume
---
<div class="prose">
<h2><span class="i18n-en">Experience & internships</span><span class="i18n-zh">工作与实习经历</span></h2>
{% include research-experience.html %}
<h2><span class="i18n-en">Education</span><span class="i18n-zh">教育经历</span></h2>
{% include research-education.html %}
<h2><span class="i18n-en">Research & publications</span><span class="i18n-zh">研究成果</span></h2>
<ul>{% assign papers = site.publications | sort: 'date' | reverse %}{% for p in papers %}<li><a href="{{ p.paperurl | default: p.url }}">{{ p.title }}</a><br><span class="paper-authors">{{ p.authors | replace: 'Xinji Mai', '<strong>Xinji Mai</strong>' }} · {{ p.venue_short }}{% unless p.venue_short contains p.year %} · {{ p.year }}{% endunless %}</span></li>{% endfor %}</ul>
<h2><span class="i18n-en">Academic profiles</span><span class="i18n-zh">学术档案</span></h2>
<div class="bibliography-links"><a href="{{ site.author.googlescholar }}">Google Scholar ↗</a><a href="{{ site.author.dblp }}">DBLP ↗</a><a href="{{ site.author.openreview }}">OpenReview ↗</a><a href="{{ site.author.orcid }}">ORCID ↗</a></div>
</div>
