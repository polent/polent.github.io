(async () => {
	document.getElementById("search-str").addEventListener("keyup", event => {
		const searchString = event.target.value.toLowerCase();
		const results = [];
		posts.forEach(post => {
			if (
				post.title.toLowerCase().includes(searchString) ||
				post.excerpt.toLowerCase().includes(searchString) ||
				post.tags.toLowerCase().includes(searchString) ||
				post.content.toLowerCase().includes(searchString)
			) {
				results.push(`<li><a href="${post.url}">
            <h3>
              ${post.title}
            </h3>
            <p>
              ${post.excerpt}
            </p>
          </a></li>`);
			}
		});
		const result = document.getElementById("results");

		result.innerHTML = results.length > 0 ? results.join("") : "<li>Nothing found yet</li>";
	});

	const posts = await fetch("/search.json").then(res => res.json());
})();
