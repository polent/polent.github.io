const Image = require("@11ty/eleventy-img");

const picture = async function (
	src,
	title,
	alt,
	loading = "lazy",
	sizes = "(min-width: 64rem) 1024px, 100vw",
	fetchpriority = undefined
) {
	const metadata = await Image(src, {
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
	});

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
