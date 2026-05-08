---
layout: "layouts/tag-results"
title: "Tags"
pagination:
  data: "collections"
  size: 1
  alias: "tag"
  filter:
    - "all"
    - "posts"
    - "latest"
    - "featured"
    - "feed"
permalink: "/tag/{{ tag | slug }}/"
---
