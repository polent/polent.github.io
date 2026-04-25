const fs = require("node:fs");
const path = require("node:path");

const DIST = path.resolve(process.cwd(), "dist");
const IMG_DIR = path.join(DIST, "img");

if (!fs.existsSync(IMG_DIR)) {
	console.log("[prune-images] dist/img does not exist, nothing to do.");
	process.exit(0);
}

const SCAN_EXTS = new Set([".html", ".xml", ".json", ".css", ".js", ".txt"]);
const IMG_REF = /\/img\/([A-Za-z0-9._-]+)/g;
const referenced = new Set();

function scan(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (full === IMG_DIR) continue;
		if (entry.isDirectory()) {
			scan(full);
		} else if (SCAN_EXTS.has(path.extname(entry.name).toLowerCase())) {
			const text = fs.readFileSync(full, "utf8");
			for (const match of text.matchAll(IMG_REF)) {
				referenced.add(match[1]);
			}
		}
	}
}

scan(DIST);

if (referenced.size === 0) {
	console.warn("[prune-images] no image references found in dist/ — skipping to avoid wiping cache on a broken build.");
	process.exit(0);
}

let kept = 0;
let removed = 0;
for (const file of fs.readdirSync(IMG_DIR)) {
	if (referenced.has(file)) {
		kept++;
	} else {
		fs.unlinkSync(path.join(IMG_DIR, file));
		removed++;
	}
}

console.log(`[prune-images] kept ${kept}, removed ${removed}`);
