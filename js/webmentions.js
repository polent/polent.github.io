(() => {
	"use strict";

	const section = document.querySelector(".webmentions");
	if (!section) return;

	const COOKIE_PATTERN = /(?:^|;\s*)wm-consent=(granted|denied)(?:;|$)/;
	const ENDPOINT = "https://webmention.io/api/mentions.jf2";
	const TIMEOUT_MS = 8000;
	const MAX_TEXT = 600;
	const MAX_PARAGRAPHS = 6;

	/* The only host a profile picture may come from. See photoUrl(). */
	const AVATAR_HOST = "avatars.webmention.io";
	const AVATAR_PX = 40; /* matches 2.5rem in _styles/components/webmentions.css */

	/* Uncapped, a recipe syndicated to Mastodon can carry hundreds of likes — that many
	   third-party image requests from somebody who asked to "see the responses", and six
	   rows of circles. The heading still reports the honest total above the pile. */
	const MAX_FACES = 24;

	/* Ordered lists, not objects, so the render order is ours and not whatever order the
	   API happened to return. */
	const FACEPILE_GROUPS = [
		{ key: "like-of", label: "Likes" },
		{ key: "repost-of", label: "Reposts" },
		{ key: "bookmark-of", label: "Bookmarks" },
	];

	/* An RSVP answers a question, so the answer belongs in the heading rather than next to
	   each face — that keeps every face's accessible name down to just the person. */
	const RSVP_GROUPS = [
		{ key: "rsvp:yes", label: "Going" },
		{ key: "rsvp:no", label: "Not going" },
		{ key: "rsvp:maybe", label: "Maybe" },
		{ key: "rsvp:interested", label: "Interested" },
		{ key: "rsvp:other", label: "RSVPs" },
	];

	const GROUPS = FACEPILE_GROUPS.concat(RSVP_GROUPS);
	const FACEPILE_PROPERTIES = new Set(FACEPILE_GROUPS.map(group => group.key));
	const REPLY_PROPERTIES = new Set(["in-reply-to", "mention-of"]);

	/* Same three lines as the inline script in consent-banner.njk. Sharing them would
	   cost either an extra request or a global — both worse than the duplication. */
	const readConsent = () => {
		try {
			const match = COOKIE_PATTERN.exec(document.cookie);
			return match ? match[1] : null;
		} catch {
			/* Cookie access can throw in a sandboxed frame or with site data blocked.
			   Returning null denies by default, which removes the section — the safe
			   direction when we cannot prove consent was given. */
			return null;
		}
	};

	const target = section.dataset.webmentionsTarget || "";
	const results = section.querySelector(".webmentions__results");
	const status = section.querySelector("[data-webmentions-status]");
	const canFetch = typeof window.fetch === "function" && typeof AbortController === "function";

	if (readConsent() !== "granted" || !target || !results || !status || !canFetch) {
		section.remove();
		return;
	}

	/* Helpers -------------------------------------------------------- */

	const el = (tag, className, text) => {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text != null) node.textContent = text;
		return node;
	};

	const normalize = url =>
		String(url || "")
			.replace(/^https?:\/\//i, "")
			.replace(/\/+$/, "")
			.toLowerCase();

	const isHttpUrl = url => typeof url === "string" && /^https?:\/\//i.test(url);

	/* Prefer the mention's own permalink, and fall back to whichever page linked here. */
	function permalinkFor(item) {
		if (isHttpUrl(item.url)) return item.url;
		if (isHttpUrl(item["wm-source"])) return item["wm-source"];
		return null;
	}

	function formatDate(value) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return null;
		const iso = date.toISOString();
		try {
			return { iso, label: new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(date) };
		} catch {
			/* Intl or the en-GB locale data can be missing in a stripped-down runtime.
			   The ISO date is a correct, readable fallback, so there is nothing to
			   report to the reader. */
			return { iso, label: iso.slice(0, 10) };
		}
	}

	/* Reply text is never inserted as markup. The privacy reason outranks the XSS one:
	   the sanitized HTML webmention.io returns routinely carries <img> tags pointing at
	   arbitrary hosts, which would reintroduce exactly the third-party requests the
	   consent gate exists to prevent. DOMParser with "text/html" is inert — no scripts
	   run, no subresources load — and only its textContent is used. */
	function plainText(item) {
		const content = item.content || {};
		let text = typeof content.text === "string" ? content.text : "";

		if (!text && typeof content.html === "string") {
			try {
				const parsed = new DOMParser().parseFromString(content.html, "text/html");
				text = parsed.body.textContent || "";
			} catch {
				/* Ignored on purpose: this is a best-effort fallback for a mention that
				   arrived without content.text. Leaving `text` empty renders the reply as
				   author and date with the permalink to the original, which is a fine
				   outcome and better than dropping the reply or failing the whole list. */
			}
		}

		text = text.replace(/[ \t]+/g, " ").trim();
		if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT).replace(/\s+\S*$/, "") + "…";
		return text;
	}

	/* Identity ------------------------------------------------------- */

	/* The one gate that keeps the consent banner's promise true: a profile picture is
	   fetched only from webmention.io's own proxy, which is the service the visitor already
	   agreed to. A photo hosted anywhere else — a personal domain, a network's image CDN, a
	   Mastodon instance — is dropped and the letter badge stands in. Parsing with URL()
	   rather than matching the string is deliberate: it lowercases the host and resolves
	   punycode, so a homograph host cannot slip past ===, and it throws on anything that is
	   not an absolute URL. */
	function photoUrl(author) {
		const raw = typeof author.photo === "string" ? author.photo.trim() : "";
		if (!raw) return null;
		try {
			const url = new URL(raw);
			if (url.protocol !== "https:" || url.hostname !== AVATAR_HOST) return null;
			if (url.username || url.password) return null;
			return url.href;
		} catch {
			/* Relative, malformed or otherwise not a URL we are willing to request. */
			return null;
		}
	}

	/* A pile of twelve links all reading "Someone on the web" is useless. When the author
	   card carries no name but does carry a profile URL, its host is public, accurate and
	   tells one person from another. */
	function displayName(author) {
		const name = String(author.name || "").trim();
		if (name) return name;
		if (isHttpUrl(author.url)) {
			try {
				return new URL(author.url).hostname.replace(/^www\./, "");
			} catch {
				/* Falls through to the generic label below. */
			}
		}
		return "Someone on the web";
	}

	/* Best effort, most reliable first. The wm-source fallback keeps the whole URL rather
	   than its origin: two nameless likes from one Mastodon instance are two people and
	   must not collapse into one face. */
	function actorKey(item, author) {
		if (isHttpUrl(author.url)) return "u:" + normalize(author.url);
		if (typeof author.photo === "string" && author.photo) return "p:" + normalize(author.photo);
		if (isHttpUrl(item["wm-source"])) return "s:" + normalize(item["wm-source"]);
		return "i:" + String(item["wm-id"] || Math.random());
	}

	function rsvpKey(item) {
		const key =
			"rsvp:" +
			String(item.rsvp || "")
				.trim()
				.toLowerCase();
		return RSVP_GROUPS.some(group => group.key === key) ? key : "rsvp:other";
	}

	/* Avatars -------------------------------------------------------- */

	function letterBadge(initial) {
		const badge = el("span", "webmentions__avatar webmentions__avatar--letter", initial);
		/* Real text now rather than content: attr(), so without this a screen reader would
		   read "J Jane Doe". */
		badge.setAttribute("aria-hidden", "true");
		return badge;
	}

	function avatarFor(author, name) {
		/* Array.from rather than slice(0, 1): slicing splits a surrogate pair and renders
		   half a character. */
		const initial = (Array.from(name)[0] || "?").toUpperCase();
		const src = photoUrl(author);
		if (!src) return letterBadge(initial);

		const img = el("img", "webmentions__avatar webmentions__avatar--photo");
		img.alt = ""; /* the name is real text inside the same link — see buildFace */
		img.width = AVATAR_PX;
		img.height = AVATAR_PX; /* attributes, so the box is reserved even before the CSS lands */
		img.loading = "lazy"; /* the section sits below a long recipe: most views fetch nothing */
		img.decoding = "async";
		img.referrerPolicy = "no-referrer";
		img.fetchPriority = "low";
		/* addEventListener rather than an inline onerror, so there is no inline handler to
		   justify if a content security policy ever lands on this site. */
		img.addEventListener("error", () => img.replaceWith(letterBadge(initial)), { once: true });
		img.src = src;
		return img;
	}

	/* Rendering ------------------------------------------------------ */

	function setStatus(message, modifier) {
		status.className =
			"webmentions__status" + (modifier ? " webmentions__status--" + modifier : "");
		status.textContent = message;
	}

	function buildFace(author) {
		const name = displayName(author);
		const face = el("li", "webmentions__face");

		const linked = isHttpUrl(author.url);
		const inner = el(linked ? "a" : "span", "webmentions__face-link");
		if (linked) {
			inner.href = author.url;
			inner.rel = "nofollow ugc noopener";
			/* A convenience for pointer users only. title is never the accessible name when
			   the element already has text content, which it always does here. */
			inner.title = name;
		}

		inner.append(avatarFor(author, name));
		inner.append(el("span", "visually-hidden", name));
		face.append(inner);
		return face;
	}

	function buildOverflow(remaining) {
		const face = el("li", "webmentions__face");
		const chip = el(
			"span",
			"webmentions__avatar webmentions__avatar--letter webmentions__avatar--more",
			"+" + remaining,
		);
		chip.setAttribute("aria-hidden", "true");
		face.append(chip);
		face.append(el("span", "visually-hidden", "and " + remaining + " more"));
		return face;
	}

	/* The heading counts distinct people, not mentions, because that is what the pile below
	   it shows. Counting mentions would put "Likes (12)" above ten faces, which reads as a
	   bug rather than as deduplication. */
	function buildFacepile(label, actors) {
		const group = el("div", "webmentions__group");

		const heading = el("h3", "webmentions__group-title", label + " ");
		heading.append(el("span", "webmentions__group-count", "(" + actors.size + ")"));
		group.append(heading);

		const list = el("ul", "webmentions__facepile");
		const all = Array.from(actors.values());
		all.slice(0, MAX_FACES).forEach(author => list.append(buildFace(author)));
		if (all.length > MAX_FACES) list.append(buildOverflow(all.length - MAX_FACES));
		group.append(list);

		return group;
	}

	function buildReply(item) {
		const author = item.author || {};
		const name = displayName(author);
		const reply = el("li", "webmentions__reply");
		const meta = el("p", "webmentions__reply-meta");

		meta.append(avatarFor(author, name));

		if (isHttpUrl(author.url)) {
			const link = el("a", "webmentions__author", name);
			link.href = author.url;
			link.rel = "nofollow ugc noopener";
			meta.append(link);
		} else {
			meta.append(el("span", "webmentions__author", name));
		}

		const when = formatDate(item.published || item["wm-received"]);
		if (when) {
			const time = el("time", "webmentions__date", when.label);
			time.dateTime = when.iso;
			meta.append(time);
		}

		const permalink = permalinkFor(item);
		if (permalink) {
			const link = el(
				"a",
				"webmentions__permalink",
				item["wm-property"] === "mention-of" ? "mentioned this" : "replied",
			);
			link.href = permalink;
			link.rel = "nofollow ugc noopener";
			meta.append(link);
		}

		reply.append(meta);

		const text = plainText(item);
		if (text) {
			const body = el("div", "webmentions__reply-body");
			text
				.split(/\n{2,}/)
				.slice(0, MAX_PARAGRAPHS)
				.forEach(paragraph => body.append(el("p", null, paragraph)));
			reply.append(body);
		}

		return reply;
	}

	function buildReplies(replies) {
		const group = el("div", "webmentions__group");

		const heading = el("h3", "webmentions__group-title", "Replies ");
		heading.append(el("span", "webmentions__group-count", "(" + replies.length + ")"));
		group.append(heading);

		const list = el("ol", "webmentions__replies");
		replies.forEach(item => list.append(buildReply(item)));
		group.append(list);

		return group;
	}

	/* Said out loud once, instead of letting the live region read two dozen names and every
	   reply body aloud the moment they arrive. The headings below already say this on screen,
	   so the status line hides itself. */
	function announce(piles, replyCount) {
		const parts = [];
		GROUPS.forEach(group => {
			const actors = piles.get(group.key);
			if (actors && actors.size) parts.push(actors.size + " " + group.label.toLowerCase());
		});
		if (replyCount) parts.push(replyCount + (replyCount === 1 ? " reply" : " replies"));
		setStatus(parts.join(", ") + ".");
		status.classList.add("visually-hidden");
	}

	function render(children) {
		const seen = new Set();
		const piles = new Map(); /* group key -> Map(actor key -> author card) */
		const replies = [];

		children.forEach(item => {
			if (!item || typeof item !== "object") return;

			const id = String(item["wm-id"] || item["wm-source"] || item.url || "");
			if (!id || seen.has(id)) return;
			seen.add(id);

			const itemTarget = item["wm-target"];
			if (itemTarget && normalize(itemTarget) !== normalize(target)) return;

			const property = item["wm-property"];
			const key = FACEPILE_PROPERTIES.has(property)
				? property
				: property === "rsvp"
					? rsvpKey(item)
					: null;

			if (key) {
				const author = item.author || {};
				if (!piles.has(key)) piles.set(key, new Map());
				/* One face per person per pile, which is the single rule indieweb.org/facepile
				   states. Scoped to the pile, not globally: somebody who both liked and
				   reposted belongs in each. */
				const actors = piles.get(key);
				const actor = actorKey(item, author);
				if (!actors.has(actor)) actors.set(actor, author);
			} else if (REPLY_PROPERTIES.has(property)) {
				replies.push(item);
			}
			/* Anything else is ignored on purpose, so a new property type upstream
			   cannot quietly land in a bucket that shows names and faces. */
		});

		if (!piles.size && !replies.length) {
			setStatus("No responses yet.");
			return;
		}

		results.innerHTML = "";
		GROUPS.forEach(group => {
			const actors = piles.get(group.key);
			if (actors && actors.size) results.append(buildFacepile(group.label, actors));
		});
		if (replies.length) results.append(buildReplies(replies));

		announce(piles, replies.length);
	}

	/* Fetch ---------------------------------------------------------- */

	async function load() {
		status.setAttribute("aria-busy", "true");
		setStatus("Loading responses…", "loading");

		/* One page, deliberately. A recipe with more than 100 responses would be undercounted,
		   but paginating doubles the third-party contact for a case this site will not meet. */
		const url = ENDPOINT + "?target=" + encodeURIComponent(target) + "&per-page=100&sort-dir=up";
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

		try {
			const response = await fetch(url, {
				signal: controller.signal,
				credentials: "omit",
				referrerPolicy: "no-referrer",
				headers: { Accept: "application/json" },
			});
			if (!response.ok) throw new Error("HTTP " + response.status);
			const data = await response.json();
			render(Array.isArray(data?.children) ? data.children : []);
		} catch {
			/* The error is deliberately not inspected. Every failure here — offline, the
			   8s abort, an HTTP status, malformed JSON — leaves the reader in the same
			   position and has the same remedy, so distinguishing them would only add
			   noise. It is not logged either: a third-party outage is not a fault of this
			   page, and the message below already says all the reader can act on. */
			setStatus("Responses could not be loaded right now.", "error");
		} finally {
			clearTimeout(timer);
			status.setAttribute("aria-busy", "false");
		}
	}

	section.hidden = false;
	load();
})();
