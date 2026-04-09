const Image = require("@11ty/eleventy-img");
const fs = require("fs");

const imageOptions = {
	widths: [320, 640, 960, 1280, 1600],
	formats: ["avif", "webp"],
	urlPath: "/img/",
	outputDir: "./dist/img/",
	sharpAvifOptions: {
		quality: 50,
	},
	sharpWebpOptions: {
		quality: 65,
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

	const imageAttributes = {
		title,
		alt,
		sizes,
		loading,
		decoding: "async",
	};

	if (fetchpriority) {
		imageAttributes.fetchpriority = fetchpriority;
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
