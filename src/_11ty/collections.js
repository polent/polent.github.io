// Collection for posts
const posts = i => i.getFilteredByGlob("./src/content/posts/*.md").reverse();
const latest = i => i.getFilteredByGlob("./src/content/posts/*.md").reverse().slice(0, 3);
const feed = i => i.getFilteredByGlob("./src/content/posts/*.md").reverse();

module.exports = {
	posts,
	feed,
	latest,
};
