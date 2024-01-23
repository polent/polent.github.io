const Image = require("@11ty/eleventy-img");

const picture = async function (
	src,
	title,
	alt,
	loading = "lazy",
	sizes = "(min-width: 64rem) 1024px, 100vw"
) {
	const metadata = await Image(src, {
		widths: [150, 300, 600, 1200, 1800, 2150],
		formats: ["avif", "jpeg"],
		urlPath: "/img/",
		outputDir: "./dist/img/",
		sharpAvifOptions: {
			quality: 40,
		},
		sharpJpegOptions: {
			quality: 40,
		},
	});

	const imageAttributes = {
		title,
		alt,
		sizes,
		loading,
	};

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
