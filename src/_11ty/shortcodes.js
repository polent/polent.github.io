const Image = require("@11ty/eleventy-img");
const fs = require("fs");

const imageOptions = {
	widths: [320, 640, 960, 1280, 1600],
	// JPEG kept as a final fallback for the rare browser without AVIF/WebP support.
	// Order matters — browsers pick the first <source> they understand.
	formats: ["avif", "webp", "jpeg"],
	urlPath: "/img/",
	outputDir: "./dist/img/",
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
	fetchpriority = undefined
) {
	// Use statsSync to compute expected output filenames without processing
	const stats = Image.statsSync(src, imageOptions);
	const allExist = Object.values(stats)
		.flat()
		.every((s) => fs.existsSync(`${imageOptions.outputDir}${s.filename}`));

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

	return Image.generateHTML(metadata, imageAttributes);
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
