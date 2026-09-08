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
<h2><span class="i18n-en">Experience</span><span class="i18n-zh">工作经历</span></h2>
<div class="affiliation-strip"><a class="affiliation" href="https://tongyi.aliyun.com/"><img src="{{ '/assets/images/identity/tongyi.svg' | relative_url }}" alt="Tongyi logo" width="42" height="42"><div><strong><span class="i18n-en">Tongyi Lab, Alibaba Group</span><span class="i18n-zh">阿里巴巴集团 · 通义实验室</span></strong><small><span class="i18n-en">Researcher · Shanghai, China</span><span class="i18n-zh">研究者 · 中国上海</span></small></div></a></div>
<p><span class="i18n-en">Research on agentic reinforcement learning and multimodal models, with a focus on self-evolving agent systems, reasoning, and scaling laws.</span><span class="i18n-zh">从事智能体强化学习与多模态模型研究，关注自进化智能体系统、推理能力与规模化规律。</span></p>
<h2><span class="i18n-en">Education</span><span class="i18n-zh">教育经历</span></h2>
{% include research-education.html %}
<h2><span class="i18n-en">Research & publications</span><span class="i18n-zh">研究成果</span></h2>
<ul>{% assign papers = site.publications | sort: 'order' %}{% for p in papers %}<li><a href="{{ p.paperurl | default: p.url }}">{{ p.title }}</a><br><span class="paper-authors">{{ p.authors | replace: 'Xinji Mai', '<strong>Xinji Mai</strong>' }} · {{ p.venue_short }}{% unless p.venue_short contains p.year %} · {{ p.year }}{% endunless %}</span></li>{% endfor %}</ul>
<h2><span class="i18n-en">Academic profiles</span><span class="i18n-zh">学术档案</span></h2>
<div class="bibliography-links"><a href="{{ site.author.googlescholar }}">Google Scholar ↗</a><a href="{{ site.author.dblp }}">DBLP ↗</a><a href="{{ site.author.openreview }}">OpenReview ↗</a><a href="{{ site.author.orcid }}">ORCID ↗</a></div>
</div>
