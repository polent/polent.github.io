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
		if (action === "cook-start" && !dialogSupported) return;
		if (action === "print-shopping" && !ingredientChecks.length) return;
		btn.hidden = false;
	});

	article.addEventListener("click", e => {
		const btn = e.target.closest("[data-action]");
		if (!btn || !article.contains(btn)) return;
		switch (btn.dataset.action) {
			case "cook-start":
				startCookMode();
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
