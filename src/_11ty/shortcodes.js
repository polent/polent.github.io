const fs = require("fs");
const path = require("path");

// eleventy-img v7 is ESM-only; this config is CommonJS. Load it on first use and
// cache the promise so the dynamic import happens once per build.
let imagePromise = null;
const loadImage = () => {
	if (!imagePromise) {
		imagePromise = import("@11ty/eleventy-img").then(mod => mod.default);
	}
	return imagePromise;
};

const imageOptions = {
	widths: [320, 640, 960, 1280, 1600],
	// JPEG kept as a final fallback for the rare browser without AVIF/WebP support.
	// Order matters — browsers pick the first <source> they understand.
	formats: ["avif", "webp", "jpeg"],
	urlPath: "/img/",
	outputDir: "./dist/img/",
	// Keep descriptive slug names for Google Image SEO instead of arbitrary hashes
	filenameFormat: function (id, src, width, format) {
		const name = path.basename(src, path.extname(src));
		return `${name}-${width}.${format}`;
	},
	sharpAvifOptions: {
		quality: 60,
	},
	sharpWebpOptions: {
		quality: 75,
	},
	sharpJpegOptions: {
		quality: 78,
		progressive: true,
		mozjpeg: true,
	},
};

const picture = async function (
	src,
	title,
	alt,
	loading = "lazy",
	sizes = "(min-width: 64rem) 1024px, 100vw",
	fetchpriority = undefined,
) {
	const Image = await loadImage();

	// statsOnly computes the expected output filenames without touching sharp
	// (v7 replaced the synchronous statsSync with this).
	const stats = await Image(src, { ...imageOptions, statsOnly: true });
	const allExist = Object.values(stats)
		.flat()
		.every(s => fs.existsSync(`${imageOptions.outputDir}${s.filename}`));

	// Skip expensive Sharp processing if all output files already exist (e.g. from CI cache)
	const metadata = allExist ? stats : await Image(src, imageOptions);

	// Eager-loaded images are LCP candidates — auto-prioritise them so callers don't
	// have to remember to pass fetchpriority="high" alongside loading="eager".
	const resolvedFetchPriority = fetchpriority || (loading === "eager" ? "high" : undefined);

	const imageAttributes = {
		title,
		alt,
		sizes,
		loading,
		decoding: "async",
	};

	if (resolvedFetchPriority) {
		imageAttributes.fetchpriority = resolvedFetchPriority;
	}

	let html = Image.generateHTML(metadata, imageAttributes);

	// Ensure the fallback <img> src points to the highest-resolution JPEG for crawlers,
	// social card scrapers, and schema extraction rather than the 320px thumbnail.
	const fallbackFormat = metadata.jpeg || metadata.png || Object.values(metadata)[0];
	if (fallbackFormat && fallbackFormat.length > 1) {
		const lowsrc = fallbackFormat[0].url;
		const highsrc = fallbackFormat[fallbackFormat.length - 1].url;
		if (lowsrc && highsrc && lowsrc !== highsrc) {
			html = html.replace(`src="${lowsrc}"`, `src="${highsrc}"`);
		}
	}

	return html;
};

const figure = function (content, caption, className) {
	let classVal = "";
	let captionVal = "";
	if (className !== undefined) {
		classVal = `class=${className}`;
	}
	if (caption !== undefined) {
		captionVal = `<figcaption>${caption}</figcaption>`;
	}
	return `<figure ${classVal}>${content}${captionVal}</figure>`;
};

module.exports = {
	picture,
	figure,
};
