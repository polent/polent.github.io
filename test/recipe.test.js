const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { extractRecipeData } = require("../src/_11ty/filters.js");

const COOK_MODE_SRC = fs.readFileSync(
	path.join(__dirname, "../src/static/js/cook-mode.js"),
	"utf8",
);

const SAMPLE_RECIPE_HTML = `
<h2>Introduction</h2>
<p>A test vegan pasta.</p>
<h2>Ingredients</h2>
<ul>
  <li>200g artisanal vegan pasta</li>
  <li>2 cloves garlic, minced</li>
  <li>1 small red onion, diced</li>
  <li>1 tablespoon olive oil</li>
  <li>1/2 cup vegetable broth</li>
  <li>1 can (400ml) full-fat coconut milk</li>
</ul>
<h2>Instructions</h2>
<ul>
  <li>Simmer the garlic and onion for 5 minutes until fragrant.</li>
  <li>Add the pasta and broth, then cook for 10 minutes.</li>
</ul>
<table>
  <caption class='sr-only'>Additional Information</caption>
  <tr><th scope='row'>Nutritionfacts</th><td>Calories: 420 kcal, Protein: 12g, Carbohydrates: 55g, Fat: 14g, Fiber: 6g</td></tr>
  <tr><th scope='row'>Preparation Time</th><td>25 minutes</td></tr>
  <tr><th scope='row'>Allergy Information</th><td>Gluten</td></tr>
  <tr><th scope='row'>Yield</th><td>4 servings</td></tr>
</table>
`;

/* Lightweight DOM harness for exercising cook-mode.js in Node */
function createDomEnvironment(html) {
	const VOID_TAGS = new Set(["input", "img", "br", "hr", "meta", "link"]);
	const toKebab = s => s.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);

	function parseAttrs(raw) {
		const attrs = {};
		const re = /([a-zA-Z0-9:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
		let m;
		while ((m = re.exec(raw)) !== null) {
			attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
		}
		return attrs;
	}

	function escapeText(str) {
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}

	function parseFragment(fragmentHtml) {
		const root = new ElementNode("fragment");
		const stack = [root];
		const tokenRe = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9-]+)\s*>|<([a-zA-Z0-9-]+)([^>]*?)\s*(\/?)>|([^<]+)/g;
		let m;
		while ((m = tokenRe.exec(fragmentHtml)) !== null) {
			if (m[1]) {
				const closeTag = m[1].toLowerCase();
				for (let i = stack.length - 1; i > 0; i--) {
					if (stack[i].tagName === closeTag) {
						stack.length = i;
						break;
					}
				}
			} else if (m[2]) {
				const tag = m[2].toLowerCase();
				const selfClosing = Boolean(m[4]) || VOID_TAGS.has(tag);
				const el = new ElementNode(tag, parseAttrs(m[3] || ""));
				stack[stack.length - 1].appendChild(el);
				if (!selfClosing) stack.push(el);
			} else if (m[5]) {
				const text = m[5]
					.replace(/&quot;/g, '"')
					.replace(/&#39;/g, "'")
					.replace(/&lt;/g, "<")
					.replace(/&gt;/g, ">")
					.replace(/&amp;/g, "&");
				stack[stack.length - 1].appendChild(new TextNode(text));
			}
		}
		return root.childNodes;
	}

	class BaseNode {
		constructor(nodeType) {
			this.nodeType = nodeType;
			this.parentNode = null;
			this.childNodes = [];
		}
		get nextSibling() {
			if (!this.parentNode) return null;
			const idx = this.parentNode.childNodes.indexOf(this);
			return idx >= 0 && idx + 1 < this.parentNode.childNodes.length
				? this.parentNode.childNodes[idx + 1]
				: null;
		}
		get parentElement() {
			return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
		}
	}

	class TextNode extends BaseNode {
		constructor(text) {
			super(3);
			this.nodeValue = String(text);
		}
		get textContent() {
			return this.nodeValue;
		}
		set textContent(v) {
			this.nodeValue = String(v);
		}
	}

	function matchSimpleSelector(el, sel) {
		if (!el || el.nodeType !== 1) return false;
		let rest = sel.trim();
		const tagMatch = rest.match(/^[a-zA-Z0-9-]+/);
		if (tagMatch) {
			if (el.tagName !== tagMatch[0].toLowerCase()) return false;
			rest = rest.slice(tagMatch[0].length);
		}
		while (rest.length > 0) {
			if (rest.startsWith(".")) {
				const m = rest.match(/^\.([a-zA-Z0-9_-]+)/);
				if (!el.classList.contains(m[1])) return false;
				rest = rest.slice(m[0].length);
			} else if (rest.startsWith("#")) {
				const m = rest.match(/^#([a-zA-Z0-9_-]+)/);
				if (el.id !== m[1]) return false;
				rest = rest.slice(m[0].length);
			} else if (rest.startsWith("[")) {
				const m = rest.match(/^\[([a-zA-Z0-9_-]+)(?:(\^?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/);
				if (!m) return false;
				const attrName = m[1].toLowerCase();
				const op = m[2];
				const expected = m[3] ?? m[4] ?? m[5];
				if (!(attrName in el.attributes)) return false;
				const actual = el.attributes[attrName];
				if (op === "=" && actual !== expected) return false;
				if (op === "^=" && !actual.startsWith(expected)) return false;
				rest = rest.slice(m[0].length);
			} else {
				return false;
			}
		}
		return true;
	}

	function matchComplexSelector(el, selector) {
		const parts = selector
			.trim()
			.replace(/\s*>\s*/g, " > ")
			.split(/\s+/);
		let current = el;
		let idx = parts.length - 1;
		if (!matchSimpleSelector(current, parts[idx])) return false;
		idx -= 1;
		while (idx >= 0) {
			if (parts[idx] === ">") {
				idx -= 1;
				current = current.parentNode;
				if (!current || !matchSimpleSelector(current, parts[idx])) return false;
				idx -= 1;
			} else {
				let ancestor = current.parentNode;
				let found = false;
				while (ancestor && ancestor.nodeType === 1) {
					if (matchSimpleSelector(ancestor, parts[idx])) {
						current = ancestor;
						found = true;
						break;
					}
					ancestor = ancestor.parentNode;
				}
				if (!found) return false;
				idx -= 1;
			}
		}
		return true;
	}

	class ElementNode extends BaseNode {
		constructor(tagName, attrs = {}) {
			super(1);
			this.tagName = tagName.toLowerCase();
			this.attributes = attrs;
			this._listeners = new Map();
			this.open = false;
			this.classList = {
				add: (...names) => {
					const set = new Set((this.attributes.class || "").split(/\s+/).filter(Boolean));
					names.forEach(n => set.add(n));
					this.attributes.class = Array.from(set).join(" ");
				},
				remove: (...names) => {
					const removeSet = new Set(names);
					const next = (this.attributes.class || "")
						.split(/\s+/)
						.filter(c => c && !removeSet.has(c));
					this.attributes.class = next.join(" ");
				},
				contains: name => (this.attributes.class || "").split(/\s+/).includes(name),
			};
			this.dataset = new Proxy(
				{},
				{
					get: (_, prop) => this.attributes[`data-${toKebab(String(prop))}`],
					set: (_, prop, val) => {
						this.attributes[`data-${toKebab(String(prop))}`] = String(val);
						return true;
					},
				},
			);
		}
		get id() {
			return this.attributes.id || "";
		}
		set id(v) {
			this.attributes.id = String(v);
		}
		get type() {
			return this.attributes.type || "";
		}
		set type(v) {
			this.attributes.type = String(v);
		}
		get hidden() {
			return "hidden" in this.attributes;
		}
		set hidden(v) {
			if (v) this.attributes.hidden = "";
			else delete this.attributes.hidden;
		}
		get disabled() {
			return "disabled" in this.attributes;
		}
		set disabled(v) {
			if (v) this.attributes.disabled = "";
			else delete this.attributes.disabled;
		}
		get checked() {
			return "checked" in this.attributes;
		}
		set checked(v) {
			if (v) this.attributes.checked = "";
			else delete this.attributes.checked;
		}
		get parentElement() {
			return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
		}
		get textContent() {
			return this.childNodes.map(c => c.textContent).join("");
		}
		set textContent(val) {
			this.childNodes = val === "" ? [] : [new TextNode(String(val))];
			if (this.childNodes[0]) this.childNodes[0].parentNode = this;
		}
		get innerHTML() {
			return this.childNodes
				.map(c => {
					if (c.nodeType === 3) return escapeText(c.nodeValue);
					const attrStr = Object.entries(c.attributes)
						.map(([k, v]) => (v === "" ? k : `${k}="${v}"`))
						.join(" ");
					const open = attrStr ? `<${c.tagName} ${attrStr}>` : `<${c.tagName}>`;
					if (VOID_TAGS.has(c.tagName)) return open;
					return `${open}${c.innerHTML}</${c.tagName}>`;
				})
				.join("");
		}
		set innerHTML(htmlStr) {
			this.childNodes = [];
			parseFragment(htmlStr).forEach(n => this.appendChild(n));
		}
		appendChild(node) {
			if (node.tagName === "fragment") {
				[...node.childNodes].forEach(c => this.appendChild(c));
				return node;
			}
			node.parentNode = this;
			this.childNodes.push(node);
			return node;
		}
		append(...nodes) {
			for (const n of nodes) {
				this.appendChild(typeof n === "string" ? new TextNode(n) : n);
			}
		}
		replaceChild(newChild, oldChild) {
			const idx = this.childNodes.indexOf(oldChild);
			if (idx < 0) return oldChild;
			const replacements =
				newChild.tagName === "fragment" ? [...newChild.childNodes] : [newChild];
			replacements.forEach(r => {
				r.parentNode = this;
			});
			this.childNodes.splice(idx, 1, ...replacements);
			oldChild.parentNode = null;
			return oldChild;
		}
		contains(other) {
			let cur = other;
			while (cur) {
				if (cur === this) return true;
				cur = cur.parentNode;
			}
			return false;
		}
		closest(selector) {
			let cur = this;
			while (cur && cur.nodeType === 1) {
				if (matchComplexSelector(cur, selector)) return cur;
				cur = cur.parentNode;
			}
			return null;
		}
		querySelectorAll(selector) {
			const selectors = selector.split(",").map(s => s.trim());
			const results = [];
			const walk = node => {
				for (const child of node.childNodes) {
					if (child.nodeType === 1) {
						if (selectors.some(s => matchComplexSelector(child, s))) {
							results.push(child);
						}
						walk(child);
					}
				}
			};
			walk(this);
			return results;
		}
		querySelector(selector) {
			return this.querySelectorAll(selector)[0] || null;
		}
		addEventListener(type, fn) {
			if (!this._listeners.has(type)) this._listeners.set(type, []);
			this._listeners.get(type).push(fn);
		}
		dispatchEvent(evt) {
			evt.target = evt.target || this;
			let cur = this;
			while (cur) {
				const fns = cur._listeners?.get(evt.type) || [];
				for (const fn of fns) fn(evt);
				if (!evt.bubbles) break;
				cur = cur.parentNode;
			}
			return true;
		}
		click() {
			this.dispatchEvent({ type: "click", bubbles: true, target: this, preventDefault() {} });
		}
		showModal() {
			this.open = true;
		}
		close() {
			this.open = false;
			this.dispatchEvent({ type: "close", bubbles: false, target: this });
		}
	}

	const root = new ElementNode("body");
	root.innerHTML = html;

	const NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
	const storageMap = new Map();

	const document = {
		body: root,
		querySelector: sel => root.querySelector(sel),
		querySelectorAll: sel => root.querySelectorAll(sel),
		getElementById: id => root.querySelector(`#${id}`),
		createElement: tag => new ElementNode(tag),
		createTextNode: text => new TextNode(text),
		createDocumentFragment: () => new ElementNode("fragment"),
		createTreeWalker: (container, whatToShow, filter) => {
			const nodes = [];
			const collect = n => {
				for (const c of n.childNodes) {
					if (c.nodeType === 3) {
						if (!filter || filter.acceptNode(c) === NodeFilter.FILTER_ACCEPT) {
							nodes.push(c);
						}
					} else if (c.nodeType === 1) {
						collect(c);
					}
				}
			};
			collect(container);
			let i = -1;
			return {
				nextNode: () => {
					i += 1;
					return i < nodes.length ? nodes[i] : null;
				},
			};
		},
		addEventListener() {},
		visibilityState: "visible",
	};

	const window = {
		addEventListener() {},
		removeEventListener() {},
		print() {},
	};

	const localStorage = {
		getItem: k => (storageMap.has(k) ? storageMap.get(k) : null),
		setItem: (k, v) => storageMap.set(k, String(v)),
		removeItem: k => storageMap.delete(k),
	};

	const context = {
		document,
		window,
		localStorage,
		navigator: {},
		Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
		NodeFilter,
		EventTarget,
		CustomEvent,
		Event: class SimpleEvent {
			constructor(type, opts = {}) {
				this.type = type;
				this.bubbles = Boolean(opts.bubbles);
			}
		},
		setInterval: () => 1,
		clearInterval: () => {},
		Math,
		Number,
		String,
		Array,
		Set,
		Map,
		Object,
		JSON,
	};

	vm.runInNewContext(COOK_MODE_SRC, context, { filename: "cook-mode.js" });

	return { document, localStorage };
}

function buildPostDomHtml(recipeData, title = "Test Vegan Pasta") {
	return `
    <article class="wrapper layout-grid recipe h-entry recipe--enhanced"
      data-recipe-slug="test-vegan-pasta"
      data-recipe-title="${title}">
      <header class="layout-span recipe-header">
        <dl class="recipe-meta" aria-label="Recipe summary">
          <dt>Yield</dt>
          <dd class="recipe-yield" data-base-yield="${recipeData.yieldBase}">
            <button type="button" class="yield-btn" data-action="yield-dec" aria-label="Decrease yield" hidden>−</button>
            <span class="yield-value" data-yield-value aria-live="polite">${recipeData.yield}</span>
            <button type="button" class="yield-btn" data-action="yield-inc" aria-label="Increase yield" hidden>+</button>
          </dd>
        </dl>
        <div class="recipe-actions" role="group" aria-label="Recipe actions">
          <button type="button" class="recipe-action recipe-action--primary" data-action="cook-start" hidden>
            <span aria-hidden="true">▶</span> Start cooking
          </button>
          <button type="button" class="recipe-action" data-action="print-shopping" hidden>
            Print shopping list
          </button>
          <button type="button" class="recipe-action" data-action="print-full">
            Print recipe
          </button>
        </div>
      </header>
      <div class="layout-span | content-main flow recipe-body e-content">
        ${recipeData.modifiedHtml}
      </div>
    </article>
    <dialog id="cook-mode" class="cook-mode">
      <div class="cook-mode__frame">
        <header class="cook-mode__header">
          <p class="cook-mode__title" id="cook-mode-title">${title}</p>
          <button type="button" class="cook-mode__close" data-action="cook-close" aria-label="Exit cook mode">×</button>
        </header>
        <p class="cook-mode__progress">
          Step <span data-cook-step-current>1</span> of <span data-cook-step-total>–</span>
        </p>
        <div class="cook-mode__step" data-cook-step></div>
        <nav class="cook-mode__nav">
          <button type="button" class="cook-mode__nav-btn" data-action="cook-prev">Previous</button>
          <button type="button" class="cook-mode__nav-btn cook-mode__nav-btn--next" data-action="cook-next">Next</button>
        </nav>
        <details class="cook-mode__drawer">
          <summary class="cook-mode__drawer-summary">Ingredients</summary>
          <ul class="cook-mode__ingredients" data-cook-ingredients></ul>
        </details>
      </div>
    </dialog>
  `;
}

test("extractRecipeData preserves step IDs, orders instructions, and annotates yield and ingredients", () => {
	const data = extractRecipeData(
		SAMPLE_RECIPE_HTML,
		"https://recipe.polente.de/recipes/test-vegan-pasta/",
		"Test Vegan Pasta",
		["vegan", "Emily"],
	);

	assert.equal(data.yield, "4 servings");
	assert.equal(data.yieldBase, 4);
	assert.equal(data.instructions.length, 2);
	assert.equal(data.ingredients.length, 6);

	// Plain text preserved for Schema.org JSON-LD
	assert.equal(data.ingredients[0], "200g artisanal vegan pasta");
	assert.equal(data.ingredients[3], "1 tablespoon olive oil");

	// Instructions must be converted to <ol> with #step1, #step2
	assert.match(data.modifiedHtml, /<ol>[\s\S]*<li id="step1">/);
	assert.match(data.modifiedHtml, /<li id="step2">/);

	// Bottom table yield cell must carry hidden stepper buttons
	assert.match(data.modifiedHtml, /data-base-yield="4"/);
	assert.match(data.modifiedHtml, /<button[^>]*class="yield-btn"[^>]*hidden>/);

	// Ingredient quantities and units annotated
	assert.match(data.modifiedHtml, /data-base="200" data-kind="metric">200<\/span>g/);
	assert.match(data.modifiedHtml, /data-base="2" data-kind="whole">2<\/span> <span class="ingredient-unit" data-one="clove" data-many="cloves">cloves<\/span>/);
	assert.match(data.modifiedHtml, /data-base="1" data-kind="produce">1<\/span> small red onion/);
	assert.match(data.modifiedHtml, /data-base="0.5" data-kind="cup">1\/2<\/span> <span class="ingredient-unit" data-one="cup" data-many="cups">cup<\/span>/);
	// Container size inside parens (400ml) must not be annotated
	assert.doesNotMatch(data.modifiedHtml, /data-base="400"/);
});

test("cook-mode.js unhides buttons, opens cook mode without ReferenceError, navigates steps, and closes", () => {
	const data = extractRecipeData(
		SAMPLE_RECIPE_HTML,
		"https://recipe.polente.de/recipes/test-vegan-pasta/",
		"Test Vegan Pasta",
		["vegan", "Emily"],
	);
	const { document } = createDomEnvironment(buildPostDomHtml(data));

	const cookBtn = document.querySelector("[data-action='cook-start']");
	const yieldBtns = document.querySelectorAll(".yield-btn");
	const dialog = document.getElementById("cook-mode");

	assert.equal(cookBtn.hidden, false);
	assert.equal(yieldBtns.length, 4);
	yieldBtns.forEach(btn => assert.equal(btn.hidden, false));

	// Clicking Start cooking must open the modal and populate ingredients + step timers
	assert.doesNotThrow(() => cookBtn.click());
	assert.equal(dialog.open, true);
	assert.equal(document.querySelector("[data-cook-step-current]").textContent, "1");
	assert.equal(document.querySelector("[data-cook-step-total]").textContent, "2");
	assert.equal(document.querySelectorAll("[data-cook-ingredients] li").length, 6);
	assert.match(document.querySelector("[data-cook-step]").innerHTML, /cook-timer/);

	// Step navigation
	const nextBtn = document.querySelector("[data-action='cook-next']");
	const prevBtn = document.querySelector("[data-action='cook-prev']");
	assert.equal(prevBtn.disabled, true);
	assert.equal(nextBtn.disabled, false);

	nextBtn.click();
	assert.equal(document.querySelector("[data-cook-step-current]").textContent, "2");
	assert.equal(prevBtn.disabled, false);
	assert.equal(nextBtn.disabled, true);

	prevBtn.click();
	assert.equal(document.querySelector("[data-cook-step-current]").textContent, "1");

	// Close cook mode
	document.querySelector("[data-action='cook-close']").click();
	assert.equal(dialog.open, false);
});

test("cook-mode.js scales ingredients with culinary rounding, inflects units, and syncs cook mode drawer", () => {
	const data = extractRecipeData(
		SAMPLE_RECIPE_HTML,
		"https://recipe.polente.de/recipes/test-vegan-pasta/",
		"Test Vegan Pasta",
		["vegan", "Emily"],
	);
	const { document, localStorage } = createDomEnvironment(buildPostDomHtml(data));

	const incBtn = document.querySelector("[data-action='yield-inc']");
	const decBtn = document.querySelector("[data-action='yield-dec']");
	const yieldVals = document.querySelectorAll("[data-yield-value]");
	const qtys = () => document.querySelectorAll(".ingredient-qty").map(el => el.textContent);
	const units = () => document.querySelectorAll(".ingredient-unit").map(el => el.textContent);

	// Base yield is 4 -> scale up to 7 (factor 1.75 => 200g * 1.75 = 350g, garlic 2*1.75=3.5 -> 4)
	incBtn.click(); // 5
	incBtn.click(); // 6
	incBtn.click(); // 7
	assert.equal(yieldVals[0].textContent, "7 servings");
	assert.equal(yieldVals[1].textContent, "7 servings");
	assert.equal(localStorage.getItem("recipe:test-vegan-pasta:yield"), "7");

	// Check scaled values at 7 servings (factor 1.75):
	// 200g -> 350g, 2 cloves -> 4, 1 onion -> 2, 1 tbsp -> 2 tablespoons, 1/2 cup (0.875) -> 3/4 cup, 1 can -> 2 cans
	assert.deepEqual(qtys(), ["350", "4", "2", "2", "3/4", "2"]);
	assert.deepEqual(units(), ["cloves", "tablespoons", "cup", "cans"]);

	// Scale down to 1 serving (factor 0.25):
	// 200g * 0.25 = 50g, 2 cloves * 0.25 = 0.5 -> min 1 clove, 1 onion * 0.25 = 0.25 -> 1/2,
	// 1 tbsp * 0.25 = 1/4 tablespoon, 1/2 cup * 0.25 = 1/8 cup, 1 can * 0.25 = 0.25 -> min 1 can
	for (let i = 0; i < 6; i++) decBtn.click();
	assert.equal(yieldVals[0].textContent, "1 serving");
	assert.equal(decBtn.disabled, true);
	assert.deepEqual(qtys(), ["50", "1", "1/2", "1/4", "1/8", "1"]);
	assert.deepEqual(units(), ["clove", "tablespoon", "cup", "can"]);

	// Open cook mode and verify drawer shows scaled quantities
	document.querySelector("[data-action='cook-start']").click();
	const drawerItems = document.querySelectorAll("[data-cook-ingredients] li").map(li => li.textContent);
	assert.equal(drawerItems[0], "50g artisanal vegan pasta");
	assert.equal(drawerItems[1], "1 clove garlic, minced");
	assert.equal(drawerItems[2], "1/2 small red onion, diced");
});

test("cook-mode.js keeps cook-start hidden and safe when a recipe has zero parsed steps", () => {
	const data = extractRecipeData(
		SAMPLE_RECIPE_HTML,
		"https://recipe.polente.de/recipes/test-vegan-pasta/",
		"Test Vegan Pasta",
		["vegan", "Emily"],
	);
	const htmlWithoutSteps = buildPostDomHtml({
		...data,
		modifiedHtml: data.modifiedHtml.replace(/<ol>[\s\S]*?<\/ol>/i, ""),
	});
	const { document } = createDomEnvironment(htmlWithoutSteps);
	const cookBtn = document.querySelector("[data-action='cook-start']");
	assert.equal(cookBtn.hidden, true);
	assert.doesNotThrow(() => cookBtn.click());
});
