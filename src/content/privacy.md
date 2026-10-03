---
layout: "layouts/page"
eleventyNavigation:
  key: privacy
  title: Privacy
  order: 5
title: "Privacy"
description: "What this site stores on your device, and the two third-party services it contacts only when you ask."
permalink: "/privacy/index.html"
---

This site is a static weblog. There is no analytics, no tracking, no advertising and no
third-party script running in the background. Two third-party services exist, and each one is
contacted only after you ask for it. What follows is the complete list of what this site stores
and what it can contact.

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

Liking or replying to a recipe from your own site or from the Fediverse is a public gesture,
so it is shown as one — but nothing about it reaches a server this page has not already
named. So:

- **Likes, reposts, bookmarks and RSVPs** are shown as a row of small round pictures with a
  total. Each one links back to the profile the response came from and carries that
  profile's name for screen readers.
- **Replies and mentions** are shown with the author's name, the date and the text, because
  writing a public reply to this page is a deliberate act.
- **Profile pictures are loaded only from `avatars.webmention.io`**, the copy webmention.io
  already keeps. When a response carries a picture hosted anywhere else — a personal site, a
  social network's own image server — it is simply not requested, and a coloured initial
  drawn by this site stands in. Accepting the banner therefore still means exactly one
  third party: the one the banner names.
- Those pictures are requested without a referrer, and only once they have scrolled into
  view. Long lists are capped, so a popular recipe cannot turn into hundreds of requests.
- Reply text is displayed as plain text. Any images or markup in the original are dropped,
  so reading a reply cannot cause your browser to contact a third site.

### Changing your mind

Use the **Reset my choice** button in the footer of any page. It deletes the cookie and
brings the banner back.

<h2 id="comments">Comments</h2>

Each recipe has a comments section run by **EchoThread**, a service operated by VectraSEO LLC,
Pennsylvania, USA. Comment data is stored with Amazon Web Services in the US East region.
Transfers from the EU rely on the EU-US Data Privacy Framework and Standard Contractual Clauses.

Nothing from EchoThread is part of the page. The comments load only when you press
**Load comments**, and only on that one page. The choice is not remembered: no cookie is set,
and the next recipe asks again.

When you press the button, your browser downloads EchoThread's script from
`cdn.echothread.io` and talks to EchoThread directly. That reveals your **IP address**, your
browser's user-agent string and the address of the recipe you are reading.

If you sign in and write a comment, EchoThread stores your display name, email address,
avatar, and the IP address and user agent of the submission. Signing in can go through Google,
GitHub, X, Facebook or Discord, which then also learn that you signed in. The widget keeps a
login token and interface state in your browser's local and session storage.

This site never receives any of that. To access, correct, export or delete your data, write to
`privacy@echothread.io`. See [EchoThread's privacy policy](https://echothread.io/privacy).

## Stored on your device

The cooking assistant on recipe pages uses your browser's local storage to remember which
ingredients you have ticked off and which step you were on. It is keyed per recipe, it
never leaves your device, and it is not transmitted anywhere. Clearing your browser's site
data removes it.

If you load comments, EchoThread stores a login token and interface state in local and session
storage, as described under [Comments](#comments). Clearing site data removes that too.

## Hosting

The site is served as static files by GitHub Pages. Like any web server, GitHub's
infrastructure processes the requests needed to deliver the page. See
[GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Contact

For anything on this page, see the contact details on the [imprint](/imprint/).
