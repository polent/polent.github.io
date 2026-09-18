const Critters = require("critters");
const fs = require("node:fs");
const path = require("node:path");

const DIST = path.resolve(process.cwd(), "dist");

function getHtmlFiles(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...getHtmlFiles(full));
		} else if (entry.name.endsWith(".html")) {
			// Only process files that look like full HTML documents
			const content = fs.readFileSync(full, "utf-8");
			if (content.includes("<link") && content.includes("<head")) {
				files.push(full);
			}
		}
	}
	return files;
}

// Critters clones the <noscript> fallback link *after* rewriting the head link
// to media="print" onload="this.media='all'", so the fallback inherits both and
// would only ever apply to print. Restore it to a plain blocking stylesheet,
// recovering the intended media from the onload handler it was given.
function fixNoscriptFallback(html) {
	let patched = 0;
	const out = html.replace(/<noscript>(<link\b[^>]*>)<\/noscript>/g, (match, link) => {
		if (!/\bonload=/.test(link)) return match;
		const media = link.match(/\bonload="this\.media='([^']*)'"/);
		let fallback = link.replace(/\s+onload="[^"]*"/, "");
		fallback = media
			? fallback.replace(/\s+media="[^"]*"/, ` media="${media[1]}"`)
			: fallback.replace(/\s+media="[^"]*"/, "");
		patched++;
		return `<noscript>${fallback}</noscript>`;
	});
	return { html: out, patched };
}

async function run() {
	const critters = new Critters({
		path: DIST,
		inlineFonts: false,
		preload: "media",
	});

	const files = getHtmlFiles(DIST);
	console.log(`Processing ${files.length} HTML files for critical CSS...`);

	let processed = 0;
	let skipped = 0;
	let fallbacksFixed = 0;

	for (const file of files) {
		try {
			const html = fs.readFileSync(file, "utf-8");
			const inlined = await critters.process(html);
			const { html: final, patched } = fixNoscriptFallback(inlined);
			fs.writeFileSync(file, final);
			fallbacksFixed += patched;
			processed++;
		} catch (err) {
			const rel = path.relative(DIST, file);
			console.warn(`Skipped ${rel}: ${err.message}`);
			skipped++;
		}
	}

	console.log(
		`Critical CSS done: ${processed} processed, ${skipped} skipped, ${fallbacksFixed} noscript fallbacks normalized.`,
	);

	if (processed > 0 && fallbacksFixed === 0) {
		console.warn(
			"No noscript fallbacks were normalized — check that Critters still emits them in the expected form.",
		);
	}
}

run().catch(err => {
	console.error(err);
	process.exit(1);
});
