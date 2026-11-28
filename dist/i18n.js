"use strict";
(function() {
	// src/lib/i18n.ts
	var storageKey = "cheesefork.language";
	var defaultLocale = "he";
	var messages = {
		en: Object.create(null),
		he: Object.create(null),
		ar: Object.create(null)
	};
	var rtlLocales = ["he", "ar"];
	var translatedAttributes = [
		"title",
		"placeholder",
		"alt",
		"aria-label",
		"content",
		"data-intro"
	];
	var locale = getInitialLocale();
	function isSupportedLocale(value) {
		return typeof value === "string" && Object.prototype.hasOwnProperty.call(messages, value);
	}
	function decodeQueryPart(value) {
		try {
			return decodeURIComponent(value.replace(/\+/g, " "));
		} catch (error) {
			return value;
		}
	}
	function getInitialLocale() {
		const parts = window.location.search.replace(/^\?/, "").split("&");
		let i;
		let pair;
		let value;
		for (i = 0; i < parts.length; i += 1) {
			pair = parts[i].split("=");
			if (decodeQueryPart(pair[0]) === "lang") {
				value = decodeQueryPart(pair.slice(1).join("="));
				if (isSupportedLocale(value)) return value;
			}
		}
		try {
			value = window.localStorage.getItem(storageKey);
			if (isSupportedLocale(value)) return value;
		} catch (error) {}
		return defaultLocale;
	}
	function addMessages(messageLocale, catalog) {
		let key;
		if (!isSupportedLocale(messageLocale) || !catalog) return;
		for (key in catalog) if (Object.prototype.hasOwnProperty.call(catalog, key) && typeof catalog[key] === "string") messages[messageLocale][key] = catalog[key];
	}
	function t(key, params) {
		let value = messages[locale][key];
		if (typeof value !== "string") value = messages[defaultLocale][key];
		if (typeof value !== "string") value = key;
		return String(value).replace(/\{([^{}]+)\}/g, (placeholder, name) => {
			if (params && Object.prototype.hasOwnProperty.call(params, name)) return String(params[name]);
			return placeholder;
		});
	}
	function urlWithLocale(url, selectedLocale) {
		const hashIndex = url.indexOf("#");
		const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
		const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
		const queryIndex = withoutHash.indexOf("?");
		const path = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
		const query = queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1);
		const parts = query ? query.split("&") : [];
		const nextParts = [];
		let found = false;
		let i = 0;
		for (; i < parts.length; i += 1) if (decodeQueryPart(parts[i].split("=")[0]) === "lang") {
			if (!found) {
				nextParts.push(`lang=${selectedLocale}`);
				found = true;
			}
		} else nextParts.push(parts[i]);
		if (!found) nextParts.push(`lang=${selectedLocale}`);
		return `${path}?${nextParts.join("&")}${hash}`;
	}
	function withLocale(url) {
		return urlWithLocale(String(url), locale);
	}
	function setLocale(selectedLocale) {
		if (!isSupportedLocale(selectedLocale)) return false;
		try {
			window.localStorage.setItem(storageKey, selectedLocale);
		} catch (error) {}
		const url = urlWithLocale(window.location.href, selectedLocale);
		if (url !== window.location.href) window.location.assign(url);
		return true;
	}
	function applyElement(element) {
		let key = element.getAttribute("data-i18n");
		let i;
		if (key) element.textContent = t(key);
		for (i = 0; i < translatedAttributes.length; i += 1) {
			key = element.getAttribute(`data-i18n-${translatedAttributes[i]}`);
			if (key) element.setAttribute(translatedAttributes[i], t(key));
		}
		if (element.tagName === "SELECT" && element.hasAttribute("data-language-switch")) {
			const select = element;
			select.value = locale;
			if (!select.cheeseI18nLanguageBound) {
				select.addEventListener("change", function() {
					setLocale(this.value);
				});
				select.cheeseI18nLanguageBound = true;
			}
		}
	}
	function apply(root = document) {
		let selector = "[data-i18n], select[data-language-switch]";
		let i;
		if (root.nodeType === 1) applyElement(root);
		for (i = 0; i < translatedAttributes.length; i += 1) selector += `, [data-i18n-${translatedAttributes[i]}]`;
		const elements = root.querySelectorAll(selector);
		for (i = 0; i < elements.length; i += 1) applyElement(elements[i]);
	}
	document.documentElement.setAttribute("lang", locale);
	document.documentElement.setAttribute("dir", rtlLocales.includes(locale) ? "rtl" : "ltr");
	window.CheeseI18n = {
		addMessages,
		t,
		getLocale() {
			return locale;
		},
		isRTL() {
			return rtlLocales.includes(locale);
		},
		apply,
		setLocale,
		withLocale
	};
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => {
		apply(document);
	});
	else apply(document);
})();
