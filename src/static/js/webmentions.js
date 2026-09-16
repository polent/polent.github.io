(() => {
	"use strict";

	const section = document.querySelector(".webmentions");
	if (!section) return;

	const COOKIE_PATTERN = /(?:^|;\s*)wm-consent=(granted|denied)(?:;|$)/;
	const ENDPOINT = "https://webmention.io/api/mentions.jf2";
	const TIMEOUT_MS = 8000;
	const MAX_TEXT = 600;
	const MAX_PARAGRAPHS = 6;

	/* Likes, reposts, bookmarks and RSVPs are only ever shown as a number. Nobody who
	   hearts a post on Mastodon agreed to have their name republished here, and an RSVP
	   names a person just as plainly as a like does. */
	const COUNT_LABELS = {
		"like-of": "Likes",
		"repost-of": "Reposts",
		"bookmark-of": "Bookmarks",
		rsvp: "RSVPs",
	};
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
	const canFetch = typeof window.fetch === "function" && typeof AbortController === "function";

	if (readConsent() !== "granted" || !target || !results || !canFetch) {
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

	/* Rendering ------------------------------------------------------ */

	function setStatus(message, modifier) {
		results.innerHTML = "";
		results.append(
			el(
				"p",
				"webmentions__status" + (modifier ? " webmentions__status--" + modifier : ""),
				message,
			),
		);
	}

	function buildCounts(counts) {
		const list = el("ul", "webmentions__counts");
		Object.keys(COUNT_LABELS).forEach(property => {
			const total = counts.get(property);
			if (!total) return;
			const item = el("li", "webmentions__count");
			item.append(el("span", "webmentions__count-value", String(total)));
			item.append(el("span", "webmentions__count-label", COUNT_LABELS[property]));
			list.append(item);
		});
		return list;
	}

	function buildReply(item) {
		const author = item.author || {};
		const name = String(author.name || "").trim() || "Someone on the web";
		const reply = el("li", "webmentions__reply");
		const meta = el("p", "webmentions__reply-meta");

		/* Drives the CSS letter avatar. author.photo is deliberately never read. */
		meta.dataset.initial = name.slice(0, 1).toUpperCase();

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

	function render(children) {
		const seen = new Set();
		const counts = new Map();
		const replies = [];

		children.forEach(item => {
			if (!item || typeof item !== "object") return;

			const id = String(item["wm-id"] || item["wm-source"] || item.url || "");
			if (!id || seen.has(id)) return;
			seen.add(id);

			const itemTarget = item["wm-target"];
			if (itemTarget && normalize(itemTarget) !== normalize(target)) return;

			const property = item["wm-property"];
			if (Object.hasOwn(COUNT_LABELS, property)) {
				counts.set(property, (counts.get(property) || 0) + 1);
			} else if (REPLY_PROPERTIES.has(property)) {
				replies.push(item);
			}
			/* Anything else is ignored on purpose, so a new property type upstream
			   cannot quietly land in the bucket that shows names. */
		});

		if (!counts.size && !replies.length) {
			setStatus("No responses yet.");
			return;
		}

		results.innerHTML = "";
		if (counts.size) results.append(buildCounts(counts));
		if (replies.length) {
			const list = el("ol", "webmentions__replies");
			replies.forEach(item => list.append(buildReply(item)));
			results.append(list);
		}
	}

	/* Fetch ---------------------------------------------------------- */

	async function load() {
		results.setAttribute("aria-busy", "true");
		setStatus("Loading responses…", "loading");

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
			results.setAttribute("aria-busy", "false");
		}
	}

	section.hidden = false;
	load();
})();
