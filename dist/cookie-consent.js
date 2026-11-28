"use strict";
(function() {
	// src/lib/cookie-consent.ts
	var storageKey = "cheesefork.analyticsConsent";
	var gtmUrl = "https://www.googletagmanager.com/gtm.js?id=GTM-5QHXJDHX";
	var granted = false;
	var scriptLoaded = false;
	var banner = null;
	window.dataLayer = window.dataLayer || [];
	function push(..._command) {
		window.dataLayer.push(arguments);
	}
	window.gtag = function(..._command) {
		if (granted) window.dataLayer.push(arguments);
	};
	function getStoredChoice() {
		try {
			const value = window.localStorage.getItem(storageKey);
			return value === "granted" || value === "denied" ? value : null;
		} catch (e) {
			return null;
		}
	}
	function storeChoice(value) {
		try {
			window.localStorage.setItem(storageKey, value);
		} catch (e) {}
	}
	function enableAnalytics() {
		if (granted) return;
		granted = true;
		push("consent", scriptLoaded ? "update" : "default", {
			analytics_storage: "granted",
			ad_storage: "denied",
			ad_user_data: "denied",
			ad_personalization: "denied"
		});
		if (!scriptLoaded) {
			scriptLoaded = true;
			push("js", /* @__PURE__ */ new Date());
			const script = document.createElement("script");
			script.async = true;
			script.src = gtmUrl;
			(document.head || document.documentElement).appendChild(script);
		}
	}
	function deleteAnalyticsCookies() {
		const hostParts = window.location.hostname.split(".");
		const domains = [""];
		for (let i = 0; i < hostParts.length - 1; i++) domains.push(`; domain=.${hostParts.slice(i).join(".")}`);
		document.cookie.split(";").forEach((cookie) => {
			const name = cookie.split("=")[0].trim();
			if (name === "_ga" || name === "_gid" || name === "_gat" || name.startsWith("_ga_") || name.startsWith("_gat_")) domains.forEach((domain) => {
				document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
			});
		});
	}
	function disableAnalytics() {
		if (granted) {
			push("consent", "update", { analytics_storage: "denied" });
			granted = false;
		}
		deleteAnalyticsCookies();
	}
	function hideBanner() {
		if (banner) {
			banner.remove();
			banner = null;
		}
	}
	function choose(value) {
		storeChoice(value);
		if (value === "granted") enableAnalytics();
		else disableAnalytics();
		hideBanner();
	}
	function createButton(className, textKey, value) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = `btn btn-sm ${className}`;
		button.setAttribute("data-cookie-consent", value);
		button.textContent = CheeseI18n.t(textKey);
		button.addEventListener("click", () => {
			choose(value);
		});
		return button;
	}
	function showBanner() {
		if (banner) return;
		const panel = document.createElement("div");
		banner = panel;
		panel.className = "cookie-consent bg-light border shadow";
		panel.setAttribute("role", "dialog");
		panel.setAttribute("aria-modal", "false");
		panel.setAttribute("aria-labelledby", "cookie-consent-title");
		panel.setAttribute("aria-describedby", "cookie-consent-message");
		const title = document.createElement("h2");
		title.id = "cookie-consent-title";
		title.className = "cookie-consent-title";
		title.textContent = CheeseI18n.t("consent.title");
		const message = document.createElement("p");
		message.id = "cookie-consent-message";
		message.className = "cookie-consent-message";
		message.textContent = `${CheeseI18n.t("consent.message")} `;
		const privacy = document.createElement("a");
		privacy.href = "https://github.com/talisraeli/cheese-fork/blob/gh-pages/docs/PRIVACY.md";
		privacy.target = "_blank";
		privacy.rel = "noopener";
		privacy.textContent = CheeseI18n.t("consent.privacy");
		message.appendChild(privacy);
		const buttons = document.createElement("div");
		buttons.className = "cookie-consent-buttons";
		buttons.appendChild(createButton("btn-primary", "consent.accept", "granted"));
		buttons.appendChild(createButton("btn-outline-secondary", "consent.decline", "denied"));
		panel.appendChild(title);
		panel.appendChild(message);
		panel.appendChild(buttons);
		document.body.appendChild(panel);
	}
	function init() {
		document.querySelectorAll("[data-cookie-settings]").forEach((link) => {
			link.addEventListener("click", (event) => {
				event.preventDefault();
				showBanner();
			});
		});
		if (getStoredChoice() === null && !document.body.hasAttribute("data-cookie-consent-silent")) showBanner();
	}
	if (getStoredChoice() === "granted") enableAnalytics();
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
	window.CheeseCookieConsent = {
		show: showBanner,
		accept() {
			choose("granted");
		},
		decline() {
			choose("denied");
		},
		isGranted() {
			return granted;
		}
	};
})();
