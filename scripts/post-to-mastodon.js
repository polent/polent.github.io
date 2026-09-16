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
// Env: MASTODON (access token, write:statuses), MASTODON_SERVER, BEFORE_SHA (CI).

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
const VISIBILITIES = new Set(["public", "unlisted", "private", "direct"]);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Code points, matching Ruby's String#length that Mastodon validates with.
// String#length would over-count astral characters.
const countChars = s => Array.from(s).length;

function git(...args) {
	return execFileSync("git", args, { encoding: "utf8" }).trim();
}

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
	return opts;
}

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

function commitExists(ref) {
	try {
		execFileSync("git", ["cat-file", "-e", `${ref}^{commit}`], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

// Never guess. A wrong base is the difference between one toot and the whole back catalogue.
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

function changedRecipeFiles(base) {
	const out = git("diff", "--diff-filter=A", "--name-only", base, "HEAD", "--", POSTS_DIR);
	if (!out) return [];
	const files = out.split("\n").map(line => line.trim().replace(/\\/g, "/"));
	// existsSync drops anything added and then deleted within the range.
	return files.filter(file => POST_RE.test(file) && fs.existsSync(file)).sort();
}

function ageInDays(file) {
	const [, y, m, d] = POST_RE.exec(file);
	const posted = Date.UTC(Number(y), Number(m) - 1, Number(d));
	return (Date.now() - posted) / 86400000;
}

function splitFrontmatter(text) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
	if (!match) throw new Error("no frontmatter block");
	return { frontmatter: match[1], body: match[2] };
}

// The corpus has no inline markdown in any introduction, but stripping is cheap
// insurance against a future recipe that does.
function toPlainText(md) {
	return md
		.replace(/\{[%{][\s\S]*?[%}]\}/g, "")
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\*\*|__|[*_`]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

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

	return { file, slug, title: titleMatch[1], tags, intro, url: `${SITE}/recipes/${slug}/` };
}

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

async function postStatus({ server, token, status, url, visibility }) {
	const body = JSON.stringify({ status, visibility, language: "en" });
	const headers = {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
		// Deterministic per recipe: a re-run inside Mastodon's window returns the
		// existing status instead of creating a duplicate.
		"Idempotency-Key": crypto.createHash("sha256").update(url).digest("hex"),
		"User-Agent": `recipe.polente.de syndication (+${SITE})`,
	};

	const backoffs = [2000, 8000];
	let rateLimitRetried = false;

	for (let attempt = 0; ; attempt++) {
		let res;
		try {
			res = await fetch(`${server}/api/v1/statuses`, { method: "POST", headers, body });
		} catch (err) {
			if (attempt < backoffs.length) {
				console.warn(`${LOG} network error (${err.message}), retrying`);
				await sleep(backoffs[attempt]);
				continue;
			}
			throw err;
		}

		if (res.ok) return res.json();

		const text = await res.text();
		const detail = (() => {
			try {
				return JSON.parse(text).error || text;
			} catch {
				return text;
			}
		})();

		if (res.status === 401 || res.status === 403) {
			const err = new Error(`${res.status}: ${detail} — check the MASTODON token scope`);
			err.fatal = true; // config problem: the remaining posts would fail identically
			throw err;
		}
		if (res.status === 429 && !rateLimitRetried) {
			rateLimitRetried = true;
			const reset = Date.parse(res.headers.get("x-ratelimit-reset") || "");
			const wait = Math.min(Math.max(reset - Date.now(), 1000) || 1000, 60000);
			console.warn(`${LOG} rate limited, waiting ${Math.round(wait / 1000)}s`);
			await sleep(wait);
			continue;
		}
		if (res.status >= 500 && attempt < backoffs.length) {
			console.warn(`${LOG} ${res.status} from server, retrying`);
			await sleep(backoffs[attempt]);
			continue;
		}
		throw new Error(`${res.status}: ${detail}`);
	}
}

function emitOutput(sha) {
	if (!process.env.GITHUB_OUTPUT) return;
	fs.appendFileSync(process.env.GITHUB_OUTPUT, `syndicated_sha=${sha}\n`);
}

async function run() {
	const opts = parseArgs(process.argv.slice(2));

	let files;
	if (opts.file) {
		const file = opts.file.replace(/\\/g, "/");
		if (!fs.existsSync(file)) throw new Error(`file not found: ${file}`);
		files = [file];
	} else {
		const { base, source } = resolveBase(opts);
		if (!base) {
			console.warn(`${LOG} no syndication base found — nothing posted.`);
			console.warn(`${LOG} seed it with: git tag -f ${SYNC_TAG} HEAD`);
			console.warn(`${LOG}               git push -f origin ${SYNC_TAG}`);
			return;
		}
		console.log(`${LOG} diffing ${base}..HEAD (base from ${source})`);
		files = changedRecipeFiles(base);

		const fresh = files.filter(file => ageInDays(file) <= opts.maxAgeDays);
		if (fresh.length < files.length) {
			const stale = files.filter(file => !fresh.includes(file));
			console.warn(`${LOG} skipping ${stale.length} recipe(s) older than ${opts.maxAgeDays} days:`);
			for (const file of stale) console.warn(`${LOG}   ${path.basename(file)}`);
		}
		files = fresh;

		if (files.length > opts.max) {
			const dropped = files.slice(0, files.length - opts.max);
			console.warn(`${LOG} ${files.length} new recipes exceeds --max ${opts.max}; skipping:`);
			for (const file of dropped) console.warn(`${LOG}   ${path.basename(file)}`);
			files = files.slice(-opts.max);
		}
	}

	if (files.length === 0) {
		console.log(`${LOG} no new recipes.`);
		// Nothing to post is a success: advance the marker so the range stays short.
		if (!opts.dryRun && !opts.file) emitOutput(git("rev-parse", "HEAD"));
		return;
	}
	console.log(`${LOG} ${files.length} new recipe(s) to post.`);

	let server = null;
	let token = null;
	if (!opts.dryRun) {
		token = process.env.MASTODON;
		if (!token) throw new Error("MASTODON is not set (Mastodon access token)");
		server = normaliseServer(process.env.MASTODON_SERVER || "");
		console.log(`${LOG} server ${server}, visibility ${opts.visibility}`);
	}

	let lastOk = null;
	const failed = [];

	for (const [index, file] of files.entries()) {
		let post;
		let composed;
		try {
			post = parsePost(file);
			composed = compose(post);
		} catch (err) {
			console.error(`${LOG} ${path.basename(file)}: ${err.message}`);
			failed.push(file);
			continue;
		}

		if (opts.dryRun) {
			const from = countChars(post.intro);
			const note = composed.truncated ? `truncated from ${from}` : "untruncated";
			const fit = `weight ${composed.weight}/${MAX_CHARS}, budget ${composed.budget}`;
			console.log(`${LOG} ${post.url}`);
			console.log(`${LOG} ${fit}, ${note}`);
			console.log("--- 8< ---");
			console.log(composed.status);
			console.log("--- >8 ---\n");
			lastOk = file;
			continue;
		}

		if (index > 0) await sleep(RATE_LIMIT_DELAY_MS);

		try {
			const created = await postStatus({
				server,
				token,
				status: composed.status,
				url: post.url,
				visibility: opts.visibility,
			});
			console.log(`${LOG} posted ${post.slug} -> ${created.url}`);
			lastOk = file;
		} catch (err) {
			console.error(`${LOG} failed to post ${post.slug}: ${err.message}`);
			failed.push(file);
			if (err.fatal) break;
		}
	}

	if (!opts.dryRun && !opts.file) {
		// Advance only as far as the last consecutive success, so a failed recipe
		// is retried on the next run and nothing already posted is re-surfaced.
		if (failed.length === 0) {
			emitOutput(git("rev-parse", "HEAD"));
		} else if (lastOk) {
			emitOutput(git("log", "-1", "--format=%H", "--", lastOk));
		}
	}

	if (failed.length > 0) {
		throw new Error(`${failed.length} of ${files.length} recipe(s) failed`);
	}
}

run().catch(err => {
	console.error(`${LOG} ${err.message}`);
	process.exit(1);
});
