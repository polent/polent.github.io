---
layout: "layouts/page"
eleventyNavigation:
  key: privacy
  title: Privacy
  order: 5
title: "Privacy"
description: "What this site stores on your device, and the one third-party service it can contact."
permalink: "/privacy/index.html"
---

This site is a static weblog. There is no analytics, no tracking, no advertising and no
third-party script running in the background. What follows is the complete list of what it
stores and what it can contact.

## The one cookie

| Property | Value |
| --- | --- |
| Name | `wm-consent` |
| Values | `granted` or `denied` |
| Set by | this site only (first-party) |
| Lifetime | 180 days |
| Purpose | remembering your answer to the banner about responses from other websites |

Nothing else is stored in a cookie. The cookie records a yes or a no and nothing about
who you are.

## Responses from other websites

Recipes on this site can be replied to, liked or linked from elsewhere on the web using
[Webmention](https://indieweb.org/Webmention), an open standard. Those responses are
collected for this site by **webmention.io**, a service operated by Aaron Parecki and
hosted in the United States.

If you choose **Show responses**, then on every recipe page your browser makes a request
directly to `webmention.io`. That request necessarily reveals your **IP address**, your
browser's user-agent string and the address of the recipe you are reading. This site never
sees any of that, and webmention.io's handling of it is governed by
[their own terms](https://webmention.io/settings/terms).

If you choose **No thanks**, or if you simply never answer, no request is ever made and the
responses section is removed from the page.

### What is shown, and what is not

Someone who likes a recipe from their own site or from the Fediverse has not thereby agreed
to have their name and photograph republished here. So:

- **Likes, reposts, bookmarks and RSVPs** are shown only as a total number. No names, no
  links to individuals.
- **Replies and mentions** are shown with the author's name, the date and the text, because
  writing a public reply to this page is a deliberate act.
- **No profile pictures are ever loaded**, from webmention.io or from anywhere else. The
  coloured initial next to a reply is drawn by this site, not fetched.
- Reply text is displayed as plain text. Any images or markup in the original are dropped,
  so reading a reply cannot cause your browser to contact a third site.

### Changing your mind

Use the **Reset my choice** button in the footer of any page. It deletes the cookie and
brings the banner back.

## Stored on your device

The cooking assistant on recipe pages uses your browser's local storage to remember which
ingredients you have ticked off and which step you were on. It is keyed per recipe, it
never leaves your device, and it is not transmitted anywhere. Clearing your browser's site
data removes it.

## Hosting

The site is served as static files by GitHub Pages. Like any web server, GitHub's
infrastructure processes the requests needed to deliver the page. See
[GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Contact

For anything on this page, see the contact details on the [imprint](/imprint/).
