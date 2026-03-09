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

async function run() {
	const critters = new Critters({
		path: DIST,
		inlineFonts: false,
		preload: "swap",
	});

	const files = getHtmlFiles(DIST);
	console.log(`Processing ${files.length} HTML files for critical CSS...`);

	let processed = 0;
	let skipped = 0;

	for (const file of files) {
		try {
			const html = fs.readFileSync(file, "utf-8");
			const inlined = await critters.process(html);
			fs.writeFileSync(file, inlined);
			processed++;
		} catch (err) {
			const rel = path.relative(DIST, file);
			console.warn(`Skipped ${rel}: ${err.message}`);
			skipped++;
		}
	}

	console.log(
		`Critical CSS done: ${processed} processed, ${skipped} skipped.`,
	);
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
