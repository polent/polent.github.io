// Syndicates newly added recipes to Mastodon (POSSE).
//
// Run from the repo root, after a successful deploy. It diffs the working tree
// against a durable high-water mark, posts whatever recipes were *added* in
// that range, and prints the commit the marker should advance to.
//
// Usage:
//   node scripts/post-to-mastodon.js                      # CI: diff from the marker tag
//   node scripts/post-to-mastodon.js --dry-run --since HEAD~10
//   node scripts/post-to-mastodon.js --file src/content/posts/2026-09-16-foo-1234.md
//
// Env: MASTODON (access token, write:statuses + write:media), MASTODON_SERVER,
// BEFORE_SHA (CI). Without write:media the recipe still posts, text-only.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const LOG = "[post-to-mastodon]";

// Mirrors `canonicalDomain` in src/_11ty/data/meta.js. Not required from there:
// that module is Eleventy data, and its sibling `domain` flips to localhost
// under `serve`, which would syndicate unreachable URLs.
const SITE = "https://recipe.polente.de";

const POSTS_DIR = "src/content/posts";
const POST_RE = /^src\/content\/posts\/(\d{4})-(\d{2})-(\d{2})-[a-z0-9-]+\.md$/;
const SYNC_TAG = "mastodon-syndicated";

const MAX_CHARS = 500;
const URL_WEIGHT = 23; // Mastodon counts every URL as exactly this, whatever its length
const SAFETY_MARGIN = 5;
const MAX_TAGS = 3;
const SENTENCE_FLOOR = 0.6; // keep a sentence-boundary cut only if it retains this much
const DEFAULT_MAX_POSTS = 5;
const DEFAULT_MAX_AGE_DAYS = 7;
const RATE_LIMIT_DELAY_MS = 3000;
const BACKOFFS_MS = [2000, 8000];
const MAX_RATE_LIMIT_WAIT_MS = 60000;
const VISIBILITIES = new Set(["public", "unlisted", "private", "direct"]);
const MEDIA_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
const MAX_IMAGE_BYTES = 16 * 1024 * 1024; // Mastodon's default image_size_limit
const MAX_ALT_CHARS = 1500;
const MEDIA_POLL_MS = 2000;
const MEDIA_PROCESSING_TIMEOUT_MS = 30000;

/**
 * @typedef {"public" | "unlisted" | "private" | "direct"} Visibility
 */

/**
 * @typedef {object} Options
 * @property {boolean} dryRun compose and print, never call the API
 * @property {string | null} file a single post path, bypassing git detection
 * @property {string | null} since explicit diff base, overriding the marker tag
 * @property {number} max most recipes to post in one run
 * @property {number} maxAgeDays ignore recipes whose filename date is older than this
 * @property {Visibility} visibility
 */

/**
 * @typedef {object} Recipe
 * @property {string} file repo-relative path to the markdown source
 * @property {string} slug filename minus the date prefix; the URL segment
 * @property {string} title
 * @property {string[]} tags in frontmatter order, the chef's name last
 * @property {string} intro the Introduction paragraph, as plain text
 * @property {string} url canonical URL on the live site
 * @property {Image | null} image the hero image, or null if missing on disk
 */

/**
 * @typedef {object} Image
 * @property {string} file repo-relative path to the image source
 * @property {string} alt the figure's alt text, used as the media description
 */

/**
 * @typedef {object} Composed
 * @property {string} status the full text to post
 * @property {number} weight Mastodon-counted length, guaranteed <= MAX_CHARS
 * @property {number} budget code points the body was allowed
 * @property {boolean} truncated whether the intro had to be cut
 */

/** @type {(ms: number) => Promise<void>} */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Code points, matching Ruby's String#length that Mastodon validates with.
// String#length would over-count astral characters.
/** @type {(s: string) => number} */
const countChars = s => Array.from(s).length;

/**
 * @param {...string} args
 * @returns {string} stdout, trimmed
 */
function git(...args) {
	return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/**
 * @param {string[]} argv
 * @returns {Options}
 */
function parseArgs(argv) {
	const opts = {
		dryRun: false,
		file: null,
		since: null,
		max: DEFAULT_MAX_POSTS,
		maxAgeDays: DEFAULT_MAX_AGE_DAYS,
		visibility: "public",
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--dry-run") opts.dryRun = true;
		else if (arg === "--file") opts.file = argv[++i];
		else if (arg === "--since") opts.since = argv[++i];
		else if (arg === "--max") opts.max = Number(argv[++i]);
		else if (arg === "--max-age-days") opts.maxAgeDays = Number(argv[++i]);
		else if (arg === "--visibility") opts.visibility = argv[++i];
		else throw new Error(`unknown argument: ${arg}`);
	}
	if (!Number.isInteger(opts.max) || opts.max < 1) {
		throw new Error("--max must be a positive integer");
	}
	if (!Number.isFinite(opts.maxAgeDays) || opts.maxAgeDays < 0) {
		throw new Error("--max-age-days must be a non-negative number");
	}
	if (!VISIBILITIES.has(opts.visibility)) {
		throw new Error(`--visibility must be one of: ${[...VISIBILITIES].join(", ")}`);
	}
	// The check above is what narrows `visibility` from string to Visibility.
	return /** @type {Options} */ (opts);
}

/**
 * @param {string} raw value of MASTODON_SERVER, with or without a trailing slash
 * @returns {string} the bare origin, e.g. "https://hellinger.wtf"
 */
function normaliseServer(raw) {
	let url;
	try {
		url = new URL(raw);
	} catch {
		throw new Error(`MASTODON_SERVER is not a valid URL: ${raw}`);
	}
	if (url.protocol !== "https:") {
		throw new Error(`MASTODON_SERVER must be https, got ${url.protocol}`);
	}
	// .origin drops the trailing slash in "https://hellinger.wtf/" and any stray path.
	return url.origin;
}

/**
 * @param {string} ref
 * @returns {boolean} whether the ref resolves to a commit in this clone
 */
function commitExists(ref) {
	try {
		execFileSync("git", ["cat-file", "-e", `${ref}^{commit}`], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

/**
 * Never guess. A wrong base is the difference between one toot and the whole
 * back catalogue, so an unresolvable base yields null rather than a fallback.
 *
 * @param {Options} opts
 * @returns {{base: string, source: string} | {base: null, source: null}}
 */
function resolveBase(opts) {
	if (opts.since) {
		if (!commitExists(opts.since)) throw new Error(`--since ref not found: ${opts.since}`);
		return { base: opts.since, source: "--since" };
	}
	if (commitExists(SYNC_TAG)) {
		return { base: SYNC_TAG, source: `tag ${SYNC_TAG}` };
	}
	const before = (process.env.BEFORE_SHA || "").trim();
	// All-zeroes is how GitHub reports a branch that did not exist before the push.
	if (before && !/^0+$/.test(before) && commitExists(before)) {
		return { base: before, source: "BEFORE_SHA" };
	}
	if (before) {
		console.warn(`${LOG} BEFORE_SHA ${before} is unusable (force push or new branch).`);
	}
	return { base: null, source: null };
}

/**
 * Byte-wise, not locale-aware: the YYYY-MM-DD- filename prefix makes that
 * chronological, and a locale comparator could reorder it.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function byPath(a, b) {
	if (a < b) return -1;
	return a > b ? 1 : 0;
}

/**
 * @param {string} base commit-ish to diff from
 * @returns {string[]} recipe paths added between base and HEAD, oldest first
 */
function changedRecipeFiles(base) {
	const out = git("diff", "--diff-filter=A", "--name-only", base, "HEAD", "--", POSTS_DIR);
	if (!out) return [];
	const files = out.split("\n").map(line => line.trim().replace(/\\/g, "/"));
	// existsSync drops anything added and then deleted within the range.
	return files.filter(file => POST_RE.test(file) && fs.existsSync(file)).sort(byPath);
}

/**
 * @param {string} file a path matching POST_RE
 * @returns {number} days since the date encoded in the filename
 */
function ageInDays(file) {
	const [, y, m, d] = POST_RE.exec(file);
	const posted = Date.UTC(Number(y), Number(m) - 1, Number(d));
	return (Date.now() - posted) / 86400000;
}

/**
 * @param {string} text the full markdown file
 * @returns {{frontmatter: string, body: string}} both raw; the frontmatter is not parsed
 */
function splitFrontmatter(text) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
	if (!match) throw new Error("no frontmatter block");
	return { frontmatter: match[1], body: match[2] };
}

/**
 * The corpus has no inline markdown in any introduction, but stripping is cheap
 * insurance against a future recipe that does.
 *
 * @param {string} md
 * @returns {string} single-spaced plain text
 */
function toPlainText(md) {
	return md
		.replace(/\{[%{][\s\S]*?[%}]\}/g, "")
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\*\*|__|[*_`]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * @param {string} file repo-relative path to a recipe markdown file
 * @returns {Recipe}
 * @throws if the frontmatter or the Introduction section is missing
 */
function parsePost(file) {
	const { frontmatter, body } = splitFrontmatter(fs.readFileSync(file, "utf8"));

	const titleMatch = /^title:\s*"(.*)"\s*$/m.exec(frontmatter);
	if (!titleMatch) throw new Error("no title in frontmatter");

	// The "- " prefix is what distinguishes tag list items from figureRecipe's
	// indented `key: "value"` pairs, so no YAML parser is needed.
	const tags = [...frontmatter.matchAll(/^\s+-\s+"(.*)"\s*$/gm)].map(m => m[1]);

	const introMatch = /^##\s+Introduction\s*\r?\n([\s\S]*?)(?=\r?\n##\s)/m.exec(body);
	if (!introMatch) throw new Error("no '## Introduction' section");
	const intro = toPlainText(introMatch[1].trim().split(/\r?\n\s*\r?\n/)[0]);
	if (!intro) throw new Error("'## Introduction' section is empty");

	// Eleventy's page.fileSlug strips the leading YYYY-MM-DD-, so the live URL
	// carries no date. Getting this wrong links every post at a 404.
	const slug = path.basename(file, ".md").replace(/^\d{4}-\d{2}-\d{2}-/, "");

	return {
		file,
		slug,
		title: titleMatch[1],
		tags,
		intro,
		url: `${SITE}/recipes/${slug}/`,
		image: parseImage(frontmatter),
	};
}

/**
 * A missing image is not an error: the toot is still worth posting without it.
 *
 * @param {string} frontmatter
 * @returns {Image | null}
 */
function parseImage(frontmatter) {
	const src = /^\s+imageSrc:\s*"(.*)"\s*$/m.exec(frontmatter);
	if (!src) return null;
	// imageSrc is "./src/media/…", relative to the repo root this runs from.
	const file = path.posix.normalize(src[1]);
	if (!MEDIA_TYPES[path.extname(file).toLowerCase()] || !fs.existsSync(file)) return null;
	const alt = /^\s+imageAlt:\s*"(.*)"\s*$/m.exec(frontmatter);
	return { file, alt: alt ? alt[1] : "" };
}

/**
 * @param {string[]} tags frontmatter tags, chef's name last
 * @returns {string} up to MAX_TAGS space-separated hashtags, or ""
 */
function buildHashtags(tags) {
	// The last tag is always the chef's capitalised name, and a personal name is
	// noise as a hashtag. Mastodon also terminates a hashtag at "-", so
	// "plant-based" has to become #plantbased or it would render as #plant.
	return tags
		.filter(tag => !/^[A-Z]/.test(tag))
		.slice(0, MAX_TAGS)
		.map(tag => `#${tag.toLowerCase().replace(/[^a-z0-9]/g, "")}`)
		.filter(tag => tag.length > 1)
		.join(" ");
}

/**
 * Cuts at the last sentence boundary if that keeps enough of the budget,
 * otherwise the last word boundary. Never mid-word.
 *
 * @param {string} text
 * @param {number} budget code points available, ellipsis included
 * @returns {string} text unchanged if it already fits
 */
function truncate(text, budget) {
	const cp = Array.from(text);
	if (cp.length <= budget) return text;
	const slice = cp.slice(0, budget - 1).join(""); // reserve one code point for the ellipsis
	const sentence = /^[\s\S]*[.!?](?=\s|$)/.exec(slice); // greedy, so the LAST terminator
	if (sentence && countChars(sentence[0]) >= budget * SENTENCE_FLOOR) {
		return `${sentence[0].trimEnd()} …`;
	}
	return `${slice.replace(/\s+\S*$/, "").trimEnd()}…`;
}

/**
 * @param {Recipe} post
 * @returns {Composed}
 * @throws if the result would exceed MAX_CHARS, which would be a bug here
 */
function compose(post) {
	const hashtags = buildHashtags(post.tags);
	const tail = hashtags ? `\n\n${hashtags}\n` : "\n\n";
	// The URL contributes URL_WEIGHT, not its real length.
	const fixed = countChars(post.title) + 2 + countChars(tail) + URL_WEIGHT;
	const budget = MAX_CHARS - fixed - SAFETY_MARGIN;
	if (budget < 40) throw new Error(`no room for body text (budget ${budget})`);

	const body = truncate(post.intro, budget);
	const status = `${post.title}\n\n${body}${tail}${post.url}`;
	const weight = countChars(status) - countChars(post.url) + URL_WEIGHT;

	if (weight > MAX_CHARS) {
		throw new Error(`composed status weighs ${weight} > ${MAX_CHARS}`);
	}
	return { status, weight, budget, truncated: body !== post.intro };
}

/**
 * @param {string} message
 * @returns {Error & {fatal: boolean}} an error the caller should not keep retrying past
 */
function fatalError(message) {
	const err = /** @type {Error & {fatal: boolean}} */ (new Error(message));
	err.fatal = true;
	return err;
}

/**
 * Pulls Mastodon's `error` field out of a response body, falling back to the
 * raw text when it is not JSON.
 *
 * @param {string} text
 * @returns {string}
 */
function errorDetail(text) {
	try {
		return JSON.parse(text).error || text;
	} catch {
		return text;
	}
}

/**
 * @param {string} target
 * @param {RequestInit} init
 * @param {number} attempt
 * @returns {Promise<Response | null>} null when a network error was retried
 * @throws the original error once the backoffs are exhausted
 */
async function attemptFetch(target, init, attempt) {
	try {
		return await fetch(target, init);
	} catch (err) {
		if (attempt >= BACKOFFS_MS.length) throw err;
		console.warn(`${LOG} network error (${err.message}), retrying`);
		await sleep(BACKOFFS_MS[attempt]);
		return null;
	}
}

/**
 * @param {Response} res
 * @param {number} attempt
 * @param {boolean} rateLimited whether a 429 has already been waited out
 * @returns {number | null} milliseconds to wait, or null if not worth retrying
 */
function retryDelayFor(res, attempt, rateLimited) {
	if (res.status === 429 && !rateLimited) {
		const reset = Date.parse(res.headers.get("x-ratelimit-reset") || "");
		const wait = Math.max(reset - Date.now(), 1000) || 1000;
		return Math.min(wait, MAX_RATE_LIMIT_WAIT_MS);
	}
	if (res.status >= 500 && attempt < BACKOFFS_MS.length) return BACKOFFS_MS[attempt];
	return null;
}

/**
 * @param {string} token
 * @returns {Record<string, string>}
 */
function baseHeaders(token) {
	return {
		Authorization: `Bearer ${token}`,
		"User-Agent": `recipe.polente.de syndication (+${SITE})`,
	};
}

/**
 * Retries 5xx and network errors, waits out a single 429, and marks 401/403
 * fatal so the caller stops rather than repeating a config error per recipe.
 *
 * @param {string} target
 * @param {RequestInit} init
 * @returns {Promise<{status: number, body: any}>} any 2xx, with its parsed JSON
 * @throws {Error & {fatal?: boolean}}
 */
async function request(target, init) {
	let rateLimited = false;

	for (let attempt = 0; ; attempt++) {
		const res = await attemptFetch(target, init, attempt);
		if (!res) continue; // network error, already waited

		if (res.ok) return { status: res.status, body: await res.json() };

		const detail = errorDetail(await res.text());
		// A bad token would fail identically for every remaining recipe.
		if (res.status === 401 || res.status === 403) {
			throw fatalError(`${res.status}: ${detail} — check the MASTODON token scope`);
		}

		const delay = retryDelayFor(res, attempt, rateLimited);
		if (delay === null) throw new Error(`${res.status}: ${detail}`);

		rateLimited = rateLimited || res.status === 429;
		console.warn(`${LOG} ${res.status} from server, retrying in ${Math.round(delay / 1000)}s`);
		await sleep(delay);
	}
}

/**
 * @param {object} args
 * @param {string} args.server normalised origin, no trailing slash
 * @param {string} args.token Mastodon access token with write:statuses
 * @param {string} args.status composed text, already known to fit
 * @param {string} args.url canonical recipe URL; also keys the idempotency header
 * @param {Visibility} args.visibility
 * @param {string[]} args.mediaIds already-processed attachments, possibly none
 * @returns {Promise<{id: string, url: string}>} the created status
 * @throws {Error & {fatal?: boolean}}
 */
async function postStatus({ server, token, status, url, visibility, mediaIds }) {
	const payload = { status, visibility, language: "en" };
	if (mediaIds.length > 0) payload.media_ids = mediaIds;

	const { body } = await request(`${server}/api/v1/statuses`, {
		method: "POST",
		headers: {
			...baseHeaders(token),
			"Content-Type": "application/json",
			// Deterministic per recipe: a re-run inside Mastodon's window returns the
			// existing status instead of creating a duplicate.
			"Idempotency-Key": crypto.createHash("sha256").update(url).digest("hex"),
		},
		body: JSON.stringify(payload),
	});
	return body;
}

/**
 * Mastodon answers 202 with `url: null` while it transcodes; a status that
 * references unprocessed media is rejected, so this waits until `url` is set.
 *
 * @param {object} args
 * @param {string} args.server normalised origin, no trailing slash
 * @param {string} args.token Mastodon access token with write:media
 * @param {Image} args.image
 * @returns {Promise<string>} the media id, ready to attach
 * @throws on any failure; the caller falls back to a text-only status
 */
async function uploadMedia({ server, token, image }) {
	const { size } = fs.statSync(image.file);
	if (size > MAX_IMAGE_BYTES) throw new Error(`image is ${size} bytes, over the upload limit`);

	const form = new FormData();
	const type = MEDIA_TYPES[path.extname(image.file).toLowerCase()];
	form.append("file", await fs.openAsBlob(image.file, { type }), path.basename(image.file));
	if (image.alt) form.append("description", Array.from(image.alt).slice(0, MAX_ALT_CHARS).join(""));

	// No Content-Type: fetch has to set it itself to include the multipart boundary.
	const headers = baseHeaders(token);
	const { body: media } = await request(`${server}/api/v2/media`, {
		method: "POST",
		headers,
		body: form,
	});
	if (media.url) return media.id;

	const deadline = Date.now() + MEDIA_PROCESSING_TIMEOUT_MS;
	while (Date.now() < deadline) {
		await sleep(MEDIA_POLL_MS);
		const { body } = await request(`${server}/api/v1/media/${media.id}`, { headers });
		if (body.url) return media.id;
	}
	throw new Error(
		`media ${media.id} still processing after ${MEDIA_PROCESSING_TIMEOUT_MS / 1000}s`,
	);
}

/**
 * Tells the workflow how far to advance the syndication marker. A no-op
 * outside Actions.
 *
 * @param {string} sha
 * @returns {void}
 */
function emitOutput(sha) {
	if (!process.env.GITHUB_OUTPUT) return;
	fs.appendFileSync(process.env.GITHUB_OUTPUT, `syndicated_sha=${sha}\n`);
}

/**
 * @param {string} heading
 * @param {string[]} files
 * @returns {void}
 */
function warnList(heading, files) {
	console.warn(`${LOG} ${heading}`);
	for (const file of files) console.warn(`${LOG}   ${path.basename(file)}`);
}

/**
 * Bounds the blast radius if the marker ever goes stale. Whatever is dropped
 * here is dropped for good: the marker still advances, so a backlog cannot
 * loop forever.
 *
 * @param {string[]} files oldest first
 * @param {Options} opts
 * @returns {string[]} the newest survivors, still oldest first
 */
function applyClamps(files, opts) {
	const fresh = files.filter(file => ageInDays(file) <= opts.maxAgeDays);
	const stale = files.filter(file => !fresh.includes(file));
	if (stale.length > 0) {
		warnList(`skipping ${stale.length} recipe(s) older than ${opts.maxAgeDays} days:`, stale);
	}
	if (fresh.length <= opts.max) return fresh;

	const heading = `${fresh.length} new recipes exceeds --max ${opts.max}; skipping:`;
	warnList(heading, fresh.slice(0, -opts.max));
	return fresh.slice(-opts.max);
}

/**
 * @param {Options} opts
 * @returns {string[] | null} null when there is no usable diff base
 */
function selectFiles(opts) {
	if (opts.file) {
		const file = opts.file.replace(/\\/g, "/");
		if (!fs.existsSync(file)) throw new Error(`file not found: ${file}`);
		return [file];
	}
	const { base, source } = resolveBase(opts);
	if (!base) return null;

	console.log(`${LOG} diffing ${base}..HEAD (base from ${source})`);
	return applyClamps(changedRecipeFiles(base), opts);
}

/**
 * @param {Options} opts
 * @returns {{server: string, token: string} | null} null on a dry run, which needs neither
 */
function loadConfig(opts) {
	if (opts.dryRun) return null;

	const token = process.env.MASTODON;
	if (!token) throw new Error("MASTODON is not set (Mastodon access token)");
	const server = normaliseServer(process.env.MASTODON_SERVER || "");
	console.log(`${LOG} server ${server}, visibility ${opts.visibility}`);
	return { server, token };
}

/**
 * @param {string} file
 * @returns {{post: Recipe, composed: Composed} | null} null if it could not be read
 */
function prepare(file) {
	try {
		const post = parsePost(file);
		return { post, composed: compose(post) };
	} catch (err) {
		console.error(`${LOG} ${path.basename(file)}: ${err.message}`);
		return null;
	}
}

/**
 * @param {Recipe} post
 * @param {Composed} composed
 * @returns {void}
 */
function reportDryRun(post, composed) {
	const from = countChars(post.intro);
	const note = composed.truncated ? `truncated from ${from}` : "untruncated";
	const fit = `weight ${composed.weight}/${MAX_CHARS}, budget ${composed.budget}`;
	console.log(`${LOG} ${post.url}`);
	console.log(`${LOG} ${fit}, ${note}`);
	if (post.image) {
		const { size } = fs.statSync(post.image.file);
		const mb = (size / 1024 / 1024).toFixed(1);
		console.log(
			`${LOG} image ${path.basename(post.image.file)} (${mb} MB), alt: "${post.image.alt}"`,
		);
		if (size > MAX_IMAGE_BYTES)
			console.warn(`${LOG} image exceeds the upload limit; would post text-only`);
		if (!post.image.alt) console.warn(`${LOG} image has no alt text`);
	} else {
		console.warn(`${LOG} image: none found; would post text-only`);
	}
	console.log("--- 8< ---");
	console.log(composed.status);
	console.log("--- >8 ---\n");
}

/**
 * Never throws: a missing scope, oversized file or stuck transcode costs the
 * toot its picture, not the toot itself.
 *
 * @param {{server: string, token: string}} config
 * @param {Recipe} post
 * @returns {Promise<string[]>} zero or one media id
 */
async function attachImage(config, post) {
	if (!post.image) {
		console.warn(`${LOG} ${post.slug}: no image found; posting text-only`);
		return [];
	}
	try {
		return [await uploadMedia({ ...config, image: post.image })];
	} catch (err) {
		console.warn(`${LOG} image upload failed for ${post.slug} (${err.message}); posting text-only`);
		return [];
	}
}

/**
 * @param {{server: string, token: string}} config
 * @param {Recipe} post
 * @param {Composed} composed
 * @param {Visibility} visibility
 * @returns {Promise<(Error & {fatal?: boolean}) | null>} null on success
 */
async function publish(config, post, composed, visibility) {
	try {
		const created = await postStatus({
			...config,
			status: composed.status,
			url: post.url,
			visibility,
			mediaIds: await attachImage(config, post),
		});
		console.log(`${LOG} posted ${post.slug} -> ${created.url}`);
		return null;
	} catch (err) {
		console.error(`${LOG} failed to post ${post.slug}: ${err.message}`);
		return err;
	}
}

/**
 * @param {string[]} files
 * @param {Options} opts
 * @param {{server: string, token: string} | null} config null for a dry run
 * @returns {Promise<{lastOk: string | null, failed: string[]}>}
 */
async function syndicate(files, opts, config) {
	/** @type {string | null} */
	let lastOk = null;
	/** @type {string[]} */
	const failed = [];

	for (const [index, file] of files.entries()) {
		const prepared = prepare(file);
		if (!prepared) {
			failed.push(file);
			continue;
		}

		if (!config) {
			reportDryRun(prepared.post, prepared.composed);
			lastOk = file;
			continue;
		}

		if (index > 0) await sleep(RATE_LIMIT_DELAY_MS);

		const err = await publish(config, prepared.post, prepared.composed, opts.visibility);
		if (!err) {
			lastOk = file;
			continue;
		}
		failed.push(file);
		if (err.fatal) break;
	}

	return { lastOk, failed };
}

/**
 * Advances only as far as the last consecutive success, so a failed recipe is
 * retried next run and nothing already posted is re-surfaced.
 *
 * @param {string | null} lastOk
 * @param {string[]} failed
 * @returns {string} empty when nothing posted, which tells the workflow to skip the tag
 */
function markerSha(lastOk, failed) {
	if (failed.length === 0) return git("rev-parse", "HEAD");
	if (lastOk) return git("log", "-1", "--format=%H", "--", lastOk);
	return "";
}

/**
 * @returns {Promise<void>}
 * @throws if any selected recipe failed to parse or post
 */
async function run() {
	const opts = parseArgs(process.argv.slice(2));
	const files = selectFiles(opts);

	if (files === null) {
		console.warn(`${LOG} no syndication base found — nothing posted.`);
		console.warn(`${LOG} seed it with: git tag -f ${SYNC_TAG} HEAD`);
		console.warn(`${LOG}               git push -f origin ${SYNC_TAG}`);
		return;
	}

	// Only a real CI run may move the marker; --file and --dry-run must not.
	const live = !opts.dryRun && !opts.file;

	if (files.length === 0) {
		console.log(`${LOG} no new recipes.`);
		// Nothing to post is a success: advance so the range stays short.
		if (live) emitOutput(git("rev-parse", "HEAD"));
		return;
	}
	console.log(`${LOG} ${files.length} new recipe(s) to post.`);

	const config = loadConfig(opts);
	const { lastOk, failed } = await syndicate(files, opts, config);

	if (live) emitOutput(markerSha(lastOk, failed));
	if (failed.length > 0) {
		throw new Error(`${failed.length} of ${files.length} recipe(s) failed`);
	}
}

run().catch(err => {
	console.error(`${LOG} ${err.message}`);
	process.exit(1);
});
