(() => {
	"use strict";

	const article = document.querySelector(".recipe--enhanced");
	if (!article) return;

	const slug = article.dataset.recipeSlug || "";
	const title = article.dataset.recipeTitle || "";
	const dialog = document.getElementById("cook-mode");
	const dialogSupported = dialog && typeof dialog.showModal === "function";

	const stepEls = Array.from(article.querySelectorAll(".recipe-body ol > li[id^='step']"));
	const ingredientChecks = Array.from(article.querySelectorAll(".ingredient-check"));

	const storageKey = suffix => `recipe:${slug}:${suffix}`;

	/* Ingredient checkbox persistence ------------------------------- */

	const loadIngredientState = () => {
		try {
			const raw = localStorage.getItem(storageKey("ingredients"));
			if (!raw) return;
			const checked = new Set(JSON.parse(raw));
			ingredientChecks.forEach(el => {
				const idx = Number(el.dataset.ingredientIndex);
				if (checked.has(idx)) el.checked = true;
			});
		} catch (_) {}
	};

	const saveIngredientState = () => {
		try {
			const checked = ingredientChecks
				.filter(el => el.checked)
				.map(el => Number(el.dataset.ingredientIndex));
			localStorage.setItem(storageKey("ingredients"), JSON.stringify(checked));
		} catch (_) {}
	};

	/* Broadcast ingredient checkbox state so mirrored drawer stays in sync
	   without accumulating listeners each time the dialog opens. */
	const ingredientSync = new EventTarget();

	ingredientChecks.forEach(el => {
		el.addEventListener("change", () => {
			saveIngredientState();
			ingredientSync.dispatchEvent(new CustomEvent("sync", { detail: { index: Number(el.dataset.ingredientIndex), checked: el.checked } }));
		});
		// Prevent label click from bubbling to parent interactive elements
		el.addEventListener("click", e => e.stopPropagation());
	});

	loadIngredientState();

	/* Action buttons ------------------------------------------------- */

	const actionButtons = Array.from(article.querySelectorAll(".recipe-action"));

	actionButtons.forEach(btn => {
		const action = btn.dataset.action;
		if (action === "cook-start" && (!dialogSupported || !stepEls.length)) return;
		if (action === "print-shopping" && !ingredientChecks.length) return;
		btn.hidden = false;
	});

	/* Yield scaling -------------------------------------------------- */

	const yieldContainers = Array.from(article.querySelectorAll(".recipe-yield[data-base-yield]"));
	const yieldValueEls = Array.from(article.querySelectorAll("[data-yield-value]"));
	const yieldButtons = Array.from(article.querySelectorAll(".yield-btn"));
	const qtyEls = Array.from(article.querySelectorAll(".ingredient-qty[data-base]"));

	const snapNearest = (val, steps) => {
		let best = steps[0];
		let bestDiff = Math.abs(val - best);
		for (let i = 1; i < steps.length; i++) {
			const diff = Math.abs(val - steps[i]);
			if (diff < bestDiff) {
				best = steps[i];
				bestDiff = diff;
			}
		}
		return best;
	};

	const METRIC_MID_STEPS = [25, 30, 40, 50, 60, 70, 75, 80, 90, 100];
	const SPOON_FRAC_STEPS = [0.125, 0.25, 0.5, 0.75, 1];
	const CUP_FRAC_STEPS = [
		0.25,
		1 / 3,
		0.5,
		2 / 3,
		0.75,
		1,
		1.25,
		1 + 1 / 3,
		1.5,
		1 + 2 / 3,
		1.75,
		2,
	];

	const roundQuantity = (raw, kind) => {
		switch (kind) {
			case "whole":
				return Math.max(1, Math.round(raw));
			case "produce":
				if (raw < 0.75) return 0.5;
				if (raw < 2) return Math.round(raw * 2) / 2;
				return Math.round(raw);
			case "metric":
				if (raw < 5) return Math.max(1, Math.round(raw));
				if (raw < 25) return Math.round(raw / 5) * 5;
				if (raw < 100) return snapNearest(raw, METRIC_MID_STEPS);
				if (raw < 250) return Math.round(raw / 25) * 25;
				return Math.round(raw / 50) * 50;
			case "metric-large":
				if (raw < 2) return Math.max(0.25, Math.round(raw * 4) / 4);
				return Math.round(raw * 2) / 2;
			case "spoon":
				if (raw < 1) return snapNearest(raw, SPOON_FRAC_STEPS);
				if (raw <= 3) return Math.round(raw * 2) / 2;
				return Math.round(raw);
			case "cup":
				if (raw < 0.18) return 0.125;
				if (raw < 2) return snapNearest(raw, CUP_FRAC_STEPS);
				if (raw <= 4) return Math.round(raw * 2) / 2;
				return Math.round(raw);
			case "imperial-lb":
				if (raw < 2) return Math.max(0.25, Math.round(raw * 4) / 4);
				return Math.round(raw * 2) / 2;
			case "imperial-oz":
				if (raw < 4) return Math.max(0.5, Math.round(raw * 2) / 2);
				if (raw <= 16) return Math.round(raw);
				return Math.round(raw / 2) * 2;
			default:
				return Math.max(1, Math.round(raw));
		}
	};

	const FRAC_KINDS = new Set(["spoon", "cup", "produce", "imperial-lb"]);

	const formatFractionPart = frac => {
		if (Math.abs(frac - 0.125) < 0.02) return "1/8";
		if (Math.abs(frac - 0.25) < 0.02) return "1/4";
		if (Math.abs(frac - 1 / 3) < 0.02) return "1/3";
		if (Math.abs(frac - 0.5) < 0.02) return "1/2";
		if (Math.abs(frac - 2 / 3) < 0.02) return "2/3";
		if (Math.abs(frac - 0.75) < 0.02) return "3/4";
		return "";
	};

	const formatNumber = (val, kind) => {
		if (FRAC_KINDS.has(kind)) {
			const whole = Math.floor(val + 1e-6);
			const frac = val - whole;
			if (frac < 0.02) return String(whole);
			const fracStr = formatFractionPart(frac);
			if (fracStr) return whole > 0 ? `${whole} ${fracStr}` : fracStr;
		}
		return Number.isInteger(val) ? String(val) : String(Number(val.toFixed(2)));
	};

	const YIELD_PLURALS = {
		serving: "servings",
		pizza: "pizzas",
		loaf: "loaves",
		quart: "quarts",
		sandwich: "sandwiches",
		galette: "galettes",
		bowl: "bowls",
		slider: "sliders",
		skewer: "skewers",
		wrap: "wraps",
		tartlet: "tartlets",
		dumpling: "dumplings",
		cake: "cakes",
		roll: "rolls",
		plate: "plates",
		person: "people",
		box: "boxes",
		taco: "tacos",
		burger: "burgers",
		pastry: "pastries",
		croquette: "croquettes",
		tostadita: "tostaditas",
		slice: "slices",
		chapati: "chapatis",
		samosa: "samosas",
		portion: "portions",
		tetela: "tetelas",
		piece: "pieces",
		burrito: "burritos",
		bun: "buns",
		mahamri: "mahamris",
		blossom: "blossoms",
	};
	const YIELD_SINGULARS = Object.fromEntries(
		Object.entries(YIELD_PLURALS).map(([s, p]) => [p, s]),
	);

	const inflectYieldWord = (word, count) => {
		const lower = word.toLowerCase();
		const target = count === 1 ? YIELD_SINGULARS[lower] || lower : YIELD_PLURALS[lower] || lower;
		if (target === lower) return word;
		return word[0] === word[0].toUpperCase()
			? target[0].toUpperCase() + target.slice(1)
			: target;
	};

	const formatYieldText = (original, base, current) => {
		if (current === base) return original;
		const factor = current / base;
		const out = original.replace(/^\s*(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\b/i, String(current));
		const parts = out.split("(");
		parts[0] = parts[0].replace(
			/\b([A-Za-z]+)(\s*)$/,
			(_, word, space) => inflectYieldWord(word, current) + space,
		);
		if (parts.length > 1 && !/per\s+serving/i.test(parts[1])) {
			parts[1] = parts[1].replace(
				/(\d+)(?:\s*(?:-|–|to)\s*(\d+))?(?!\s*-?inch)(\s+[A-Za-z]+)?/gi,
				(_, a, b, trailing) => {
					const sa = Math.max(1, Math.round(Number(a) * factor));
					let numStr = String(sa);
					let countForInflect = sa;
					if (b) {
						const sb = Math.max(sa, Math.round(Number(b) * factor));
						numStr = sa === sb ? String(sa) : `${sa}-${sb}`;
						countForInflect = sb;
					}
					if (!trailing) return numStr;
					const inflected = trailing.replace(
						/([A-Za-z]+)/,
						w => inflectYieldWord(w, countForInflect),
					);
					return numStr + inflected;
				},
			);
		}
		return parts.join("(");
	};

	const findAdjacentUnit = qtyEl => {
		let node = qtyEl.nextSibling;
		if (node && node.nodeType === Node.TEXT_NODE && /^\s*$/.test(node.nodeValue)) {
			node = node.nextSibling;
		}
		if (node && node.nodeType === Node.ELEMENT_NODE && node.classList.contains("ingredient-unit")) {
			return node;
		}
		return null;
	};

	const baseYield = yieldContainers.length ? Number(yieldContainers[0].dataset.baseYield) : 0;
	let currentYield = baseYield;
	let setYield = null;

	if (baseYield > 0 && yieldValueEls.length) {
		const minYield = 1;
		const maxYield = Math.max(24, baseYield * 4);

		const qtyPairs = qtyEls.map(qtyEl => {
			qtyEl.dataset.origText = qtyEl.textContent;
			const unitEl = findAdjacentUnit(qtyEl);
			if (unitEl) unitEl.dataset.origText = unitEl.textContent;
			return { qtyEl, unitEl };
		});

		yieldValueEls.forEach(el => {
			el.dataset.origText = el.textContent;
		});

		yieldButtons.forEach(btn => {
			btn.hidden = false;
		});

		setYield = nextYield => {
			currentYield = Math.max(minYield, Math.min(maxYield, nextYield));
			const factor = currentYield / baseYield;

			yieldValueEls.forEach(el => {
				el.textContent = formatYieldText(el.dataset.origText, baseYield, currentYield);
			});

			yieldButtons.forEach(btn => {
				if (btn.dataset.action === "yield-dec") {
					btn.disabled = currentYield <= minYield;
				} else if (btn.dataset.action === "yield-inc") {
					btn.disabled = currentYield >= maxYield;
				}
			});

			qtyPairs.forEach(({ qtyEl, unitEl }) => {
				if (currentYield === baseYield) {
					qtyEl.textContent = qtyEl.dataset.origText;
					if (unitEl) unitEl.textContent = unitEl.dataset.origText;
					return;
				}
				const base1 = Number(qtyEl.dataset.base);
				const kind = qtyEl.dataset.kind || "whole";
				const val1 = roundQuantity(base1 * factor, kind);
				let unitCount = val1;

				if (qtyEl.dataset.baseMax) {
					const base2 = Number(qtyEl.dataset.baseMax);
					const sep = qtyEl.dataset.sep || "-";
					const val2 = roundQuantity(base2 * factor, kind);
					qtyEl.textContent =
						val1 === val2
							? formatNumber(val1, kind)
							: `${formatNumber(val1, kind)}${sep}${formatNumber(val2, kind)}`;
					unitCount = val2;
				} else {
					qtyEl.textContent = formatNumber(val1, kind);
				}

				if (unitEl) {
					unitEl.textContent =
						unitCount <= 1 ? unitEl.dataset.one || unitEl.textContent : unitEl.dataset.many || unitEl.textContent;
				}
			});

			try {
				if (currentYield === baseYield) {
					localStorage.removeItem(storageKey("yield"));
				} else {
					localStorage.setItem(storageKey("yield"), String(currentYield));
				}
			} catch (_) {}
		};

		let initialYield = baseYield;
		try {
			const savedYield = Number(localStorage.getItem(storageKey("yield")));
			if (Number.isInteger(savedYield) && savedYield >= minYield && savedYield <= maxYield) {
				initialYield = savedYield;
			}
		} catch (_) {}

		setYield(initialYield);
	}

	article.addEventListener("click", e => {
		const btn = e.target.closest("[data-action]");
		if (!btn || !article.contains(btn)) return;
		switch (btn.dataset.action) {
			case "yield-dec":
				if (setYield) setYield(currentYield - 1);
				break;
			case "yield-inc":
				if (setYield) setYield(currentYield + 1);
				break;
			case "cook-start":
				if (dialogSupported && stepEls.length) startCookMode();
				break;
			case "print-shopping":
				printShoppingList();
				break;
			case "print-full":
				window.print();
				break;
		}
	});

	/* Print shopping list ------------------------------------------- */

	let restoreAfterPrint = null;

	function printShoppingList() {
		document.body.classList.add("print-shopping");
		const onAfterPrint = () => {
			document.body.classList.remove("print-shopping");
			window.removeEventListener("afterprint", onAfterPrint);
			restoreAfterPrint = null;
		};
		window.addEventListener("afterprint", onAfterPrint);
		restoreAfterPrint = onAfterPrint;
		window.print();
	}

	/* Cook mode ----------------------------------------------------- */

	if (!dialogSupported || !stepEls.length) return;

	const stepDisplay = dialog.querySelector("[data-cook-step]");
	const stepCurrentEl = dialog.querySelector("[data-cook-step-current]");
	const stepTotalEl = dialog.querySelector("[data-cook-step-total]");
	const prevBtn = dialog.querySelector("[data-action='cook-prev']");
	const nextBtn = dialog.querySelector("[data-action='cook-next']");
	const closeBtn = dialog.querySelector("[data-action='cook-close']");
	const drawerList = dialog.querySelector("[data-cook-ingredients]");

	let currentStep = 0;
	let wakeLock = null;
	const activeTimers = new Set();

	stepTotalEl.textContent = String(stepEls.length);

	let drawerSyncHandler = null;

	function populateDrawer() {
		drawerList.innerHTML = "";
		const mirrors = new Map();

		ingredientChecks.forEach(check => {
			const idx = Number(check.dataset.ingredientIndex);
			const text = check.closest(".ingredient-label")?.querySelector(".ingredient-text")?.textContent?.trim() || "";
			const li = document.createElement("li");
			const label = document.createElement("label");
			const mirror = document.createElement("input");
			mirror.type = "checkbox";
			mirror.checked = check.checked;
			mirror.dataset.mirrorIndex = String(idx);
			mirror.addEventListener("change", () => {
				check.checked = mirror.checked;
				check.dispatchEvent(new Event("change", { bubbles: true }));
			});
			const span = document.createElement("span");
			span.textContent = text;
			label.append(mirror, span);
			li.append(label);
			drawerList.append(li);
			mirrors.set(idx, mirror);
		});

		// Replace any previous sync handler so each dialog open starts clean.
		if (drawerSyncHandler) ingredientSync.removeEventListener("sync", drawerSyncHandler);
		drawerSyncHandler = e => {
			const m = mirrors.get(e.detail.index);
			if (m && m.checked !== e.detail.checked) m.checked = e.detail.checked;
		};
		ingredientSync.addEventListener("sync", drawerSyncHandler);
	}

	function renderStep(index) {
		currentStep = Math.max(0, Math.min(stepEls.length - 1, index));
		const source = stepEls[currentStep];
		stepDisplay.innerHTML = "";
		const p = document.createElement("p");
		p.innerHTML = source.innerHTML;
		stepDisplay.append(p);
		injectTimers(p);

		stepCurrentEl.textContent = String(currentStep + 1);
		prevBtn.disabled = currentStep === 0;
		nextBtn.disabled = currentStep === stepEls.length - 1;

		try {
			localStorage.setItem(storageKey("step"), String(currentStep));
		} catch (_) {}
	}

	/* Timers -------------------------------------------------------- */

	const TIMER_PATTERN = /\b(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;

	function toSeconds(value, unit) {
		const u = unit.toLowerCase();
		if (u.startsWith("h")) return value * 3600;
		if (u.startsWith("m")) return value * 60;
		return value;
	}

	function formatCountdown(totalSeconds) {
		const s = Math.max(0, Math.round(totalSeconds));
		const m = Math.floor(s / 60);
		const r = s % 60;
		if (m >= 60) {
			const h = Math.floor(m / 60);
			const mm = m % 60;
			return `${h}:${String(mm).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
		}
		return `${m}:${String(r).padStart(2, "0")}`;
	}

	function injectTimers(container) {
		const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
			acceptNode: node => (node.parentElement.closest(".cook-timer") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
		});
		const textNodes = [];
		let n;
		while ((n = walker.nextNode())) textNodes.push(n);

		textNodes.forEach(node => {
			const text = node.nodeValue;
			if (!TIMER_PATTERN.test(text)) return;
			TIMER_PATTERN.lastIndex = 0;
			const frag = document.createDocumentFragment();
			let lastIndex = 0;
			let match;
			while ((match = TIMER_PATTERN.exec(text)) !== null) {
				const [whole, aStr, bStr, unit] = match;
				const a = Number(aStr);
				const b = bStr ? Number(bStr) : null;
				const seconds = toSeconds(b || a, unit);
				frag.append(document.createTextNode(text.slice(lastIndex, match.index)));
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "cook-timer";
				btn.dataset.cookTimerSeconds = String(seconds);
				btn.dataset.cookTimerLabel = whole;
				btn.innerHTML = `⏱ <span class="cook-timer__label">${whole}</span>`;
				btn.addEventListener("click", () => toggleTimer(btn));
				frag.append(btn);
				lastIndex = match.index + whole.length;
			}
			frag.append(document.createTextNode(text.slice(lastIndex)));
			node.parentNode.replaceChild(frag, node);
		});
	}

	function toggleTimer(btn) {
		if (btn.dataset.cookTimerActive === "1") {
			stopTimer(btn);
			return;
		}
		const seconds = Number(btn.dataset.cookTimerSeconds);
		const labelEl = btn.querySelector(".cook-timer__label");
		const originalLabel = btn.dataset.cookTimerLabel;
		let remaining = seconds;
		btn.classList.add("cook-mode--active", "cook-timer--running");
		btn.dataset.cookTimerActive = "1";
		labelEl.textContent = formatCountdown(remaining);

		const tick = () => {
			remaining -= 1;
			if (remaining <= 0) {
				finishTimer(btn, originalLabel);
				return;
			}
			labelEl.textContent = formatCountdown(remaining);
		};
		const id = setInterval(tick, 1000);
		btn.dataset.cookTimerId = String(id);
		activeTimers.add(btn);
	}

	function stopTimer(btn) {
		const id = Number(btn.dataset.cookTimerId);
		if (id) clearInterval(id);
		btn.classList.remove("cook-timer--running");
		btn.dataset.cookTimerActive = "";
		btn.querySelector(".cook-timer__label").textContent = btn.dataset.cookTimerLabel;
		activeTimers.delete(btn);
	}

	function finishTimer(btn, originalLabel) {
		const id = Number(btn.dataset.cookTimerId);
		if (id) clearInterval(id);
		btn.classList.remove("cook-timer--running");
		btn.classList.add("cook-timer--done");
		btn.dataset.cookTimerActive = "";
		btn.querySelector(".cook-timer__label").textContent = `${originalLabel} — done`;
		activeTimers.delete(btn);
		beep();
		if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 400]);
	}

	function clearAllTimers() {
		activeTimers.forEach(btn => stopTimer(btn));
	}

	let audioCtx = null;
	function beep() {
		try {
			audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();
			osc.connect(gain);
			gain.connect(audioCtx.destination);
			osc.frequency.value = 880;
			osc.type = "sine";
			gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.9);
			osc.start();
			osc.stop(audioCtx.currentTime + 1);
		} catch (_) {}
	}

	/* Wake lock ----------------------------------------------------- */

	async function requestWakeLock() {
		if (!("wakeLock" in navigator)) return;
		try {
			wakeLock = await navigator.wakeLock.request("screen");
			wakeLock.addEventListener("release", () => { wakeLock = null; });
		} catch (_) {}
	}

	function releaseWakeLock() {
		if (wakeLock) {
			wakeLock.release().catch(() => {});
			wakeLock = null;
		}
	}

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible" && dialog.open && !wakeLock) {
			requestWakeLock();
		}
	});

	/* Open / close -------------------------------------------------- */

	function startCookMode() {
		populateDrawer();
		let startIndex = 0;
		try {
			const saved = Number(localStorage.getItem(storageKey("step")));
			if (!Number.isNaN(saved) && saved >= 0 && saved < stepEls.length) startIndex = saved;
		} catch (_) {}
		renderStep(startIndex);
		dialog.showModal();
		requestWakeLock();
	}

	function closeCookMode() {
		clearAllTimers();
		releaseWakeLock();
		if (dialog.open) dialog.close();
	}

	closeBtn.addEventListener("click", closeCookMode);
	prevBtn.addEventListener("click", () => renderStep(currentStep - 1));
	nextBtn.addEventListener("click", () => renderStep(currentStep + 1));

	dialog.addEventListener("close", () => {
		clearAllTimers();
		releaseWakeLock();
	});

	dialog.addEventListener("keydown", e => {
		if (e.key === "ArrowRight" || (e.key === " " && e.target === dialog)) {
			e.preventDefault();
			if (currentStep < stepEls.length - 1) renderStep(currentStep + 1);
		} else if (e.key === "ArrowLeft") {
			e.preventDefault();
			if (currentStep > 0) renderStep(currentStep - 1);
		}
	});
})();
