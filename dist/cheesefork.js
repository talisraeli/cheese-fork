"use strict";
(function() {
	// src/lib/i18n-dialogs.ts
	[
		"DEFAULT",
		"INFO",
		"PRIMARY",
		"SECONDARY",
		"SUCCESS",
		"WARNING",
		"DANGER",
		"DARK",
		"LIGHT"
	].forEach((type) => {
		BootstrapDialog.DEFAULT_TEXTS[BootstrapDialog[`TYPE_${type}`]] = CheeseI18n.t(`shell.dialog.${type.toLowerCase()}`);
	});
	[
		"OK",
		"CANCEL",
		"CONFIRM"
	].forEach((label) => {
		BootstrapDialog.DEFAULT_TEXTS[label] = CheeseI18n.t(`shell.dialog.${label.toLowerCase()}`);
	});
	var createCloseButton = BootstrapDialog.prototype.createCloseButton;
	BootstrapDialog.prototype.createCloseButton = function() {
		const button = createCloseButton.call(this);
		button.find("button.close").attr("aria-label", CheeseI18n.t("shell.dialog.close"));
		return button;
	};
	// src/lib/moment-locale.ts
	if (CheeseI18n.getLocale() === "ar") {
		const keepDigits = (text) => text;
		moment.updateLocale("ar", {
			preparse: keepDigits,
			postformat: keepDigits
		});
	}
	moment.locale(CheeseI18n.getLocale());
	// src/lib/template.ts
	function escapeHtml$1(value) {
		return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}
	function render(template, values) {
		return template.replace(/\s*\n\s*/g, "").replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}|\{\{t:([\w.-]+)\}\}/g, (match, raw, escaped, key) => {
			if (key) return escapeHtml$1(CheeseI18n.t(key));
			const name = raw || escaped;
			const value = values ? values[name] : void 0;
			if (value === void 0 || value === null) throw new Error(`Missing template value: ${name}`);
			return raw ? String(value) : escapeHtml$1(value);
		});
	}
	// src/lib/templates/modeless-restore-button.html?cheesefork-template
	var modeless_restore_button_default = "<div class=\"bootstrap-dialog-close-button\">\n    <button class=\"close d-none d-sm-inline-block\" aria-label=\"{{t:shell.dialog.modeless}}\"><i class=\"far fa-window-restore bootstrap-dialog-restore-icon\"></i></button>\n</div>\n";
	// src/lib/modeless-dialog.ts
	var MODELESS_DIALOGS = "body > .bootstrap-dialog.cheesefork-modeless-dialog";
	var BASE_Z_INDEX = 1e3;
	function zIndex(element) {
		return Number(element.css("z-index"));
	}
	function lowerDialogsAbove(modelessDialogs, prevZIndex) {
		modelessDialogs.each(function() {
			const iter = $(this);
			if (zIndex(iter) > prevZIndex) iter.css("z-index", zIndex(iter) - 1);
		});
	}
	function showBootstrapDialogWithModelessButton(dialogName, options) {
		const newOptions = $.extend({}, options, {
			onshow(dialog) {
				const restoreButton = $(render(modeless_restore_button_default)).css(CheeseI18n.isRTL() ? "margin-right" : "margin-left", "auto");
				dialog.getModalHeader().find(".bootstrap-dialog-close-button").before(restoreButton);
				restoreButton.click(() => {
					gtag("event", `bootstrap-dialog-restore-${dialogName}`);
					restoreButton.hide();
					$("body").removeClass("modal-open").css({ "padding-right": "" }).find("> .modal-backdrop").hide();
					const numOfModelessDialogs = $(MODELESS_DIALOGS).length;
					const thatDialogModal = dialog.getModal();
					thatDialogModal.removeClass("modal").addClass("cheesefork-modeless-dialog").css("z-index", BASE_Z_INDEX + numOfModelessDialogs).click(() => {
						const modelessDialogs = $(MODELESS_DIALOGS);
						const prevZIndex = zIndex(thatDialogModal);
						if (prevZIndex < BASE_Z_INDEX + modelessDialogs.length - 1) {
							lowerDialogsAbove(modelessDialogs, prevZIndex);
							thatDialogModal.css("z-index", BASE_Z_INDEX + modelessDialogs.length - 1);
						}
					});
					dialog.options.draggable = true;
					dialog.makeModalDraggable();
				});
				if (options.onshow) options.onshow(dialog);
			},
			onhidden(dialog) {
				const modelessDialogs = $(MODELESS_DIALOGS);
				const prevZIndex = zIndex(dialog.getModal());
				if (prevZIndex < BASE_Z_INDEX + modelessDialogs.length - 1) lowerDialogsAbove(modelessDialogs, prevZIndex);
				if (options.onhidden) options.onhidden(dialog);
			}
		});
		return BootstrapDialog.show(newOptions);
	}
	// src/components/course-button-list/templates/delete-area.html?cheesefork-template
	var delete_area_default = "<div class=\"course-button-list-delete-area\"><i class=\"fas fa-trash-alt\"></i></div>\n";
	// src/components/course-button-list/templates/new-layer-area.html?cheesefork-template
	var new_layer_area_default = "<div class=\"course-button-list-new-layer-area\" title=\"{{t:courses.layers.moveToNew}}\"><i class=\"fas fa-layer-group\"></i></div>\n";
	// src/components/course-button-list/templates/drag-handle.html?cheesefork-template
	var drag_handle_default = "<span class=\"course-button-list-drag-handle\"><i class=\"fas fa-grip-vertical\"></i></span>\n";
	// src/components/course-button-list/templates/course-item.html?cheesefork-template
	var course_item_default = "<li class=\"list-group-item active course-button-list-item\" data-course-number=\"{{course}}\"></li>\n";
	// src/components/course-button-list/templates/info-badge.html?cheesefork-template
	var info_badge_default = "<span class=\"badge badge-secondary float-right\"><span class=\"course-button-list-badge-text\">i</span></span>\n";
	// src/components/course-button-list/templates/info-dialog.html?cheesefork-template
	var info_dialog_default = "<div class=\"course-information\"></div><br><br>\n<div class=\"course-feedback\"></div>\n<h3 class=\"text-center\">{{t:courses.histograms}}</h3><div class=\"inline-histograms\"></div>\n";
	// src/components/course-button-list/templates/tooltip.html?cheesefork-template
	var tooltip_default$2 = "<div class=\"tooltip{{extraClass}}\" role=\"tooltip\"><div class=\"arrow arrow-fix-placement\"></div><div class=\"tooltip-inner{{extraClassInner}}\"></div></div>\n";
	// src/components/histogram-browser/templates/histograms.html?cheesefork-template
	var histograms_default = "<div class=\"histogram-container{{activatedClass}}\">\n    <div class=\"histogram-overlay-message\">\n        <div class=\"alert alert-primary\" role=\"alert\">{{t:histogram.shareRequired}}</div>\n        <div class=\"histogram-overlay-message-button-container\">\n            <button type=\"button\" class=\"btn btn-primary histogram-button-share\">{{t:histogram.share}}</button>\n        </div>\n        <div class=\"histogram-overlay-message-button-container\">\n            <button type=\"button\" class=\"btn histogram-button-activate\">{{t:histogram.alreadyShared}}</button>\n        </div>\n        <div class=\"histogram-overlay-message-button-container\">\n            <button type=\"button\" class=\"btn histogram-button-snooze\">{{t:histogram.shareLater}}</button>\n        </div>\n    </div>\n    <div class=\"histogram-content\">\n        <div class=\"form-row\">\n            <div class=\"form-group col-{{grid}}-6 histogram-semesters\"></div>\n            <div class=\"form-group col-{{grid}}-6 histogram-categories\"></div>\n        </div>\n        <div class=\"histogram-data table-responsive\">\n            <table class=\"table table-bordered table-sm\">\n                <thead class=\"thead-light\">\n                    <tr>\n                        <th scope=\"col\">{{t:histogram.students}}</th>\n                        <th scope=\"col\">{{t:histogram.passed}}</th>\n                        <th scope=\"col\">{{t:histogram.failed}}</th>\n                        <th scope=\"col\">{{t:histogram.passPercent}}</th>\n                        <th scope=\"col\">{{t:histogram.minimum}}</th>\n                        <th scope=\"col\">{{t:histogram.maximum}}</th>\n                        <th scope=\"col\">{{t:histogram.average}}</th>\n                        <th scope=\"col\">{{t:histogram.median}}</th>\n                    </tr>\n                </thead>\n                <tbody>\n                    <tr>\n                        <td class=\"histogram-value-students\"></td>\n                        <td class=\"histogram-value-pass\"></td>\n                        <td class=\"histogram-value-fail\"></td>\n                        <td class=\"histogram-value-passPercent\"></td>\n                        <td class=\"histogram-value-min\"></td>\n                        <td class=\"histogram-value-max\"></td>\n                        <td class=\"histogram-value-average\"></td>\n                        <td class=\"histogram-value-median\"></td>\n                    </tr>\n                </tbody>\n            </table>\n        </div>\n        <div class=\"histogram-image-container-outer\"><div class=\"histogram-image-container\"></div></div>\n        <p class=\"histogram-image-note small text-muted\"></p>\n        <div class=\"histogram-staff-table row mt-3 d-none\">\n            <div class=\"col-{{grid}}-6\">\n                <table class=\"table table-bordered table-sm\">\n                    <thead class=\"thead-light\">\n                        <tr>\n                            <th scope=\"col\">{{t:histogram.staffMember}}</th>\n                            <th scope=\"col\">{{t:histogram.staffRole}}</th>\n                        </tr>\n                    </thead>\n                    <tbody>\n                    </tbody>\n                </table>\n            </div>\n        </div>\n        <div>\n            <a href=\"{{shareUrl}}\" target=\"_blank\" class=\"small\">{{t:histogram.share}}</a>\n        </div>\n    </div>\n</div>\n";
	// src/components/histogram-browser/templates/no-histograms.html?cheesefork-template
	var no_histograms_default = "<div>{{t:histogram.empty}}</div>\n<div>\n    <a href=\"{{shareUrl}}\" target=\"_blank\" class=\"small\">{{t:histogram.share}}</a>\n</div>\n";
	// src/components/histogram-browser/templates/share-guide.html?cheesefork-template
	var share_guide_default = "<div class=\"histogram-modal-guide-content\">\n    <div class=\"form-group language-selector d-inline-flex\">\n        <i class=\"fas fa-globe\" aria-hidden=\"true\"></i>\n        <label for=\"histogram-guide-language\" class=\"sr-only\">{{t:sharing.language}}</label>\n        <select id=\"histogram-guide-language\" class=\"language-switch\" data-language-switch aria-label=\"{{t:sharing.language}}\">\n            <option value=\"en\" lang=\"en\">English</option><option value=\"he\" lang=\"he\">עברית</option><option value=\"ar\" lang=\"ar\">العربية</option>\n        </select>\n    </div>\n    <p>{{t:sharing.guide.intro}}</p>\n    <p>{{t:sharing.guide.scriptIntro}} <a href=\"{{scriptUrl}}\" target=\"_blank\" rel=\"noopener\">{{t:sharing.here}}</a>.</p>\n    <p>{{t:sharing.guide.repositoryIntro}} <a href=\"https://github.com/michael-maltsev/technion-histograms\" target=\"_blank\" rel=\"noopener\">{{t:sharing.here}}</a>.</p>\n    <p>{{t:sharing.guide.privacy}}</p>\n    <p>{{t:sharing.guide.mobile}}</p>\n    <h3>{{t:sharing.guide.extensionTitle}} <a href=\"https://chromewebstore.google.com/detail/technion-plus-plus/pfhjnidbfndnjhpcpfecngcigdjebemk\" target=\"_blank\" rel=\"noopener\">Technion Plus Plus</a></h3>\n    <ol>\n        <li class=\"mb-0\">{{t:sharing.guide.open}} <a href=\"https://grades.technion.ac.il/\" target=\"_blank\" rel=\"noopener\">{{t:sharing.guide.gradesSite}}</a> {{t:sharing.guide.signIn}}</li>\n        <li class=\"mb-0\">{{t:sharing.guide.click}} <a href=\"assets/share-histograms-guide-technionplus-1.png\" target=\"_blank\" rel=\"noopener\">{{t:sharing.guide.extensionButton}}</a>.</li>\n        <li>{{t:sharing.guide.skipToFour}}</li>\n    </ol>\n    <h3>{{t:sharing.guide.manualTitle}}</h3>\n    <ol>\n        <li>{{t:sharing.guide.copyCode}}\n            <div class=\"form-row mt-2\"><div class=\"form-group mb-0 col-md-12\">\n                <textarea dir=\"ltr\" class=\"form-control\" id=\"javascript-code-container\" aria-label=\"{{t:sharing.guide.codeLabel}}\" rows=\"4\" readonly></textarea>\n                <button type=\"button\" class=\"btn btn-primary mt-2\" id=\"javascript-code-copy-button\">{{t:sharing.guide.copy}}</button>\n            </div></div>\n        </li>\n        <li>{{t:sharing.guide.visitGrades}}\n            <div class=\"form-group\"><a class=\"btn btn-primary mt-2\" href=\"https://grades.technion.ac.il/\" role=\"button\" target=\"_blank\" rel=\"noopener\">{{t:sharing.guide.openGrades}}</a></div>\n        </li>\n        <li>\n            <p><strong>{{t:sharing.guide.chrome}}</strong> {{t:sharing.guide.chromeInstructions}}<br>\n                <img class=\"border border-primary mt-2 img-fluid d-none d-sm-block\" src=\"assets/share-histograms-guide-1.png\" alt=\"{{t:sharing.guide.pasteImageAlt}}\">\n                <img class=\"border border-primary mt-2 img-fluid d-block d-sm-none\" src=\"assets/share-histograms-guide-mobile-1.png\" alt=\"{{t:sharing.guide.pasteImageAlt}}\">\n            </p>\n            <p><strong>{{t:sharing.guide.otherBrowsers}}</strong> {{t:sharing.guide.otherBrowserInstructions}}</p>\n        </li>\n        <li><p>{{t:sharing.guide.waitForData}}<br>\n            <strong>{{t:sharing.guide.important}}</strong> {{t:sharing.guide.avoidBrowsing}}<br>\n            <img class=\"border border-primary mt-2 img-fluid d-none d-sm-block\" src=\"assets/share-histograms-guide-2.png\" alt=\"{{t:sharing.guide.shareImageAlt}}\">\n            <img class=\"border border-primary mt-2 img-fluid d-block d-sm-none\" src=\"assets/share-histograms-guide-mobile-2.png\" alt=\"{{t:sharing.guide.shareImageAlt}}\">\n        </p></li>\n        <li>{{t:sharing.guide.waitForCompletion}}</li>\n    </ol>\n</div>\n";
	// \0@oxc-project+runtime@0.156.0/helpers/esm/objectWithoutPropertiesLoose.js
	function _objectWithoutPropertiesLoose(r, e) {
		if (null == r) return {};
		var t = {};
		for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
			if (e.includes(n)) continue;
			t[n] = r[n];
		}
		return t;
	}
	// \0@oxc-project+runtime@0.156.0/helpers/esm/objectWithoutProperties.js
	function _objectWithoutProperties(e, t) {
		if (null == e) return {};
		var o, r, i = _objectWithoutPropertiesLoose(e, t);
		if (Object.getOwnPropertySymbols) {
			var s = Object.getOwnPropertySymbols(e);
			for (r = 0; r < s.length; r++) o = s[r], t.includes(o) || {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]);
		}
		return i;
	}
	// \0@oxc-project+runtime@0.156.0/helpers/esm/typeof.js
	function _typeof(o) {
		"@babel/helpers - typeof";
		return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
			return typeof o;
		} : function(o) {
			return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
		}, _typeof(o);
	}
	// \0@oxc-project+runtime@0.156.0/helpers/esm/toPrimitive.js
	function toPrimitive(t, r) {
		if ("object" != _typeof(t) || !t) return t;
		var e = t[Symbol.toPrimitive];
		if (void 0 !== e) {
			var i = e.call(t, r || "default");
			if ("object" != _typeof(i)) return i;
			throw new TypeError("@@toPrimitive must return a primitive value.");
		}
		return ("string" === r ? String : Number)(t);
	}
	// \0@oxc-project+runtime@0.156.0/helpers/esm/toPropertyKey.js
	function toPropertyKey(t) {
		var i = toPrimitive(t, "string");
		return "symbol" == _typeof(i) ? i : i + "";
	}
	// \0@oxc-project+runtime@0.156.0/helpers/esm/defineProperty.js
	function _defineProperty(e, r, t) {
		return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
			value: t,
			enumerable: !0,
			configurable: !0,
			writable: !0
		}) : e[r] = t, e;
	}
	// \0@oxc-project+runtime@0.156.0/helpers/esm/objectSpread2.js
	function ownKeys(e, r) {
		var t = Object.keys(e);
		if (Object.getOwnPropertySymbols) {
			var o = Object.getOwnPropertySymbols(e);
			r && (o = o.filter(function(r) {
				return Object.getOwnPropertyDescriptor(e, r).enumerable;
			})), t.push.apply(t, o);
		}
		return t;
	}
	function _objectSpread2(e) {
		for (var r = 1; r < arguments.length; r++) {
			var t = null != arguments[r] ? arguments[r] : {};
			r % 2 ? ownKeys(Object(t), !0).forEach(function(r) {
				_defineProperty(e, r, t[r]);
			}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r) {
				Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
			});
		}
		return e;
	}
	// src/components/histogram-browser/histogram-browser.ts
	var _excluded = ["passFail"];
	var HistogramBrowser = class {
		static createShareGuide() {
			return createShareGuide();
		}
		constructor(element, options) {
			this.element = element;
			this.selectColumnGrid = options.selectColumnGrid;
			this.shareGuideInNewWindow = options.shareGuideInNewWindow;
		}
		loadHistograms(course) {
			const element = this.element;
			element.text(t("histogram.loading"));
			const onError = () => {
				const fallbackUrl = `https://michael-maltsev.github.io/technion-histograms/${course}/`;
				element.text(`${t("histogram.loadFailed")} `);
				const urlElement = $("<a target=\"_blank\" rel=\"noopener\">").prop("href", fallbackUrl).text(t("histogram.here"));
				element.append(urlElement);
				element.append(".");
			};
			const url = `https://michael-maltsev.github.io/technion-histograms/${course}/index.min.json`;
			const request = new XMLHttpRequest();
			request.open("GET", url, true);
			request.onload = () => {
				let data = null;
				if (request.status === 200) try {
					data = JSON.parse(request.response);
				} catch (e) {}
				else if (request.status === 404) data = {};
				if (data) renderHistograms(this, course, data);
				else onError();
			};
			request.onerror = onError;
			request.send();
		}
	};
	function t(key, params) {
		return CheeseI18n.t(key, params);
	}
	function roundGrade(strGrade) {
		return strGrade.trim().replace(/\.\d+$/, "") || "--";
	}
	function renderHistograms(histogramBrowser, course, data) {
		const element = histogramBrowser.element;
		const semesters = Object.keys(data);
		if (semesters.length > 0) {
			const semesterSelect = $("<select class=\"form-control\">").attr("aria-label", t("histogram.semester"));
			semesters.sort((a, b) => b.localeCompare(a, void 0, { numeric: true })).forEach((semester, i) => {
				let text = semesterFriendlyName$1(semester);
				const props = [];
				const termA = data[semester].Final_A || data[semester].Exam_A;
				if (termA) props.push(t("histogram.summary.a", { grade: roundGrade(termA.average) }));
				const termB = data[semester].Final_B || data[semester].Exam_B;
				if (termB) props.push(t("histogram.summary.b", { grade: roundGrade(termB.average) }));
				const final = data[semester].Finals;
				if (final) props.push(t("histogram.summary.final", { grade: roundGrade(final.average) }));
				const staff = data[semester].Staff;
				if (staff) {
					let lecturer = null;
					staff.forEach((item) => {
						if (!lecturer && item.title === "מרצה - אחראי מקצוע") lecturer = item.name;
					});
					if (lecturer) props.push(lecturer);
				}
				if (props.length > 0) {
					text += "\xA0".repeat(Math.max(2, 16 - text.length));
					text += props.join("\xA0\xA0");
				}
				semesterSelect.append($("<option>", {
					value: semester,
					text,
					selected: i === 0
				}));
			});
			const activated = shouldActivateHistogramView();
			const selectColumnGrid = histogramBrowser.selectColumnGrid || "lg";
			const html = render(histograms_default, {
				activatedClass: activated ? " histogram-activated" : "",
				grid: selectColumnGrid,
				shareUrl: CheeseI18n.withLocale("share-histograms.html")
			});
			element.html(html).find(".histogram-semesters").empty().append(semesterSelect);
			element.find(".histogram-button-share").click(() => {
				onButtonShare(histogramBrowser);
			});
			element.find(".histogram-button-activate").click(() => {
				onButtonActivate(histogramBrowser);
			});
			element.find(".histogram-button-snooze").click(() => {
				onButtonSnooze(histogramBrowser);
			});
			semesterSelect.on("change", function() {
				onSemesterSelect(histogramBrowser, course, this.value, data[this.value]);
			}).trigger("change");
		} else {
			const noDataHtml = render(no_histograms_default, { shareUrl: CheeseI18n.withLocale("share-histograms.html") });
			element.html(noDataHtml);
		}
	}
	function popupWindow(url, title, win, w, h) {
		const y = win.outerHeight / 2 + win.screenY - h / 2;
		const x = win.outerWidth / 2 + win.screenX - w / 2;
		return win.open(url, title, `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${w}, height=${h}, top=${y}, left=${x}`);
	}
	function createShareGuide() {
		const guide = $(render(share_guide_default, { scriptUrl: CheeseI18n.withLocale("share-histograms.js") }));
		const scriptLink = document.createElement("a");
		scriptLink.href = CheeseI18n.withLocale("share-histograms.js");
		const code = `avascript:var url=${JSON.stringify(scriptLink.href)};var script=document.createElement('script');script.src=url;document.head.appendChild(script);`;
		guide.find("#javascript-code-container").val(code).on("focus", function() {
			this.select();
		}).on("mouseup", (event) => {
			event.preventDefault();
		});
		guide.find("#javascript-code-copy-button").click(function() {
			const button = $(this);
			copyToClipboard$1(code, () => {
				const text = button.text();
				button.text(`${text} ✓`).prop("disabled", true);
				setTimeout(() => {
					button.text(text).prop("disabled", false);
				}, 500);
			}, () => {
				alert(t("sharing.copyFailed"));
			});
		});
		CheeseI18n.apply(guide[0]);
		return guide;
	}
	function onButtonShare(histogramBrowser) {
		gtag("event", "histogram-button-share");
		if (histogramBrowser.shareGuideInNewWindow) {
			popupWindow(CheeseI18n.withLocale("share-histograms.html"), "share-histograms.html", window, 800, 600);
			return;
		}
		BootstrapDialog.show({
			title: t("histogram.share"),
			message: createShareGuide(),
			buttons: [{
				label: t("histogram.shared"),
				cssClass: "btn-primary",
				action(dialog) {
					gtag("event", "histogram-share-submit");
					const nextShowDate = /* @__PURE__ */ new Date();
					nextShowDate.setDate(nextShowDate.getDate() + 120);
					activateAndSetNextShowDate(histogramBrowser, nextShowDate);
					dialog.close();
				}
			}, {
				label: t("histogram.close"),
				action(dialog) {
					dialog.close();
				}
			}]
		});
	}
	function onButtonActivate(histogramBrowser) {
		gtag("event", "histogram-button-claim-activate");
		const nextShowDate = /* @__PURE__ */ new Date();
		nextShowDate.setDate(nextShowDate.getDate() + 120);
		activateAndSetNextShowDate(histogramBrowser, nextShowDate);
	}
	function onButtonSnooze(histogramBrowser) {
		gtag("event", "histogram-button-snooze");
		const nextShowDate = /* @__PURE__ */ new Date();
		nextShowDate.setHours(nextShowDate.getHours() + 1);
		activateAndSetNextShowDate(histogramBrowser, nextShowDate);
	}
	function shouldActivateHistogramView() {
		try {
			const nextShowDate = localStorage.getItem("nextHistogramShareMessage");
			return !!nextShowDate && Date.now() < Number(nextShowDate);
		} catch (e) {
			return true;
		}
	}
	function activateAndSetNextShowDate(histogramBrowser, nextShowDate) {
		try {
			localStorage.setItem("nextHistogramShareMessage", nextShowDate.valueOf().toString());
		} catch (e) {}
		activateHistogramView(histogramBrowser);
	}
	function activateHistogramView(histogramBrowser) {
		histogramBrowser.element.find(".histogram-container").addClass("histogram-activated");
	}
	function onSemesterSelect(histogramBrowser, course, semester, data) {
		const element = histogramBrowser.element;
		const categories = [
			"Exam_A",
			"Final_A",
			"Exam_B",
			"Final_B",
			"Exam_C",
			"Final_C",
			"Finals"
		];
		const categorySelect = $("<select class=\"form-control\">").attr("aria-label", t("histogram.category"));
		categories.forEach((category) => {
			const categoryData = data[category];
			if (!categoryData) return;
			let text = categoryFriendlyName(category);
			text += `: ${roundGrade(categoryData.average)}`;
			categorySelect.append($("<option>", {
				value: category,
				text
			}));
		});
		categorySelect.find("option:last").attr("selected", "selected");
		element.find(".histogram-categories").empty().append(categorySelect);
		categorySelect.on("change", function() {
			const category = this.value;
			onCategorySelect(histogramBrowser, course, semester, category, data[category]);
		}).trigger("change");
		const staffTable = element.find(".histogram-staff-table");
		if (data.Staff) {
			const staffTableBody = staffTable.find("tbody");
			staffTableBody.html("");
			data.Staff.forEach((staffPerson) => {
				const row = $("<tr>").append($("<td>").text(staffPerson.name)).append($("<td>").text(staffTitleFriendlyName(staffPerson.title)));
				staffTableBody.append(row);
			});
			staffTable.removeClass("d-none");
		} else staffTable.addClass("d-none");
	}
	function onCategorySelect(histogramBrowser, course, semester, category, data) {
		const element = histogramBrowser.element;
		const { passFail: passFailText } = data, values = _objectWithoutProperties(data, _excluded);
		const passFail = passFailText.split("/", 2);
		const newData = _objectSpread2(_objectSpread2({}, values), {}, {
			pass: passFail[0],
			fail: passFail[1] || ""
		});
		Object.keys(newData).forEach((item) => {
			const text = newData[item].trim() || "-";
			element.find(`.histogram-data .histogram-value-${item}`).text(text);
		});
		const imageUrl = `https://michael-maltsev.github.io/technion-histograms/${course}/${semester}/${category}.png`;
		element.find(".histogram-image-container").empty().append($("<img class=\"img-fluid histogram-image\">").prop("src", imageUrl).attr("alt", t("histogram.imageAlt", {
			course,
			semester: semesterFriendlyName$1(semester),
			category: categoryFriendlyName(category)
		})));
		element.find(".histogram-image-note").text(t("histogram.imageNote"));
	}
	function semesterFriendlyName$1(semester) {
		const year = parseInt(semester.slice(0, 4), 10);
		switch (semester.slice(4)) {
			case "01": return t("histogram.semester.winter", {
				year,
				nextYear: year + 1
			});
			case "02": return t("histogram.semester.spring", { year: year + 1 });
			case "03": return t("histogram.semester.summer", { year: year + 1 });
			default: return semester;
		}
	}
	function categoryFriendlyName(category) {
		const histogramCategories = {
			Exam_A: "histogram.category.examA",
			Final_A: "histogram.category.finalA",
			Exam_B: "histogram.category.examB",
			Final_B: "histogram.category.finalB",
			Exam_C: "histogram.category.examC",
			Final_C: "histogram.category.finalC",
			Finals: "histogram.category.finals"
		};
		return histogramCategories[category] ? t(histogramCategories[category]) : category;
	}
	function staffTitleFriendlyName(title) {
		const titles = {
			"מרצה - אחראי מקצוע": "histogram.staff.courseCoordinator",
			מרצה: "histogram.staff.lecturer",
			מתרגל: "histogram.staff.teachingAssistant",
			מתרגלת: "histogram.staff.teachingAssistant",
			"מתרגל - אחראי תרגול": "histogram.staff.teachingCoordinator"
		};
		return titles[title] ? t(titles[title]) : title;
	}
	function copyToClipboard$1(text, onSuccess, onFailure) {
		if (!navigator.clipboard) {
			fallbackCopyTextToClipboard(text);
			return;
		}
		navigator.clipboard.writeText(text).then(() => {
			onSuccess();
		}, (err) => {
			onFailure();
		});
		function fallbackCopyTextToClipboard(text) {
			const textArea = document.createElement("textarea");
			textArea.value = text;
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			let successful = false;
			try {
				successful = document.execCommand("copy");
			} catch (err) {}
			document.body.removeChild(textArea);
			if (successful) onSuccess();
			else onFailure();
		}
	}
	// src/components/course-button-list/whatsapp-group-link.ts
	function makeWhatsappGroupLinkContent(data) {
		const result = $("<div>");
		let linksFound = 0;
		const whatsappLinks = [];
		[
			"whatsappGroupLink",
			"whatsappGroupLink2",
			"whatsappGroupLink3"
		].forEach((whatsappLinkKey) => {
			const url = data[whatsappLinkKey];
			if (url && url.match(/^https:\/\/chat\.whatsapp\.com\//)) {
				whatsappLinks.push(url);
				linksFound++;
			}
		});
		whatsappLinks.forEach((url, i) => {
			let linkText = CheeseI18n.t("courses.whatsappGroup");
			if (i > 0) linkText += ` ${i + 1}`;
			result.append($("<div>", { html: $("<a>", {
				href: url,
				target: "_blank",
				rel: "noopener",
				onclick: "gtag('event', 'info-click-group-link-whatsapp')",
				text: linkText
			}) }));
		});
		let url = data.telegramGroupLink;
		if (url && url.match(/^https:\/\/t\.me\/.+/)) {
			linksFound++;
			result.append($("<div>", { html: $("<a>", {
				href: url,
				target: "_blank",
				rel: "noopener",
				onclick: "gtag('event', 'info-click-group-link-telegram')",
				text: CheeseI18n.t("courses.telegramGroup")
			}) }));
		}
		url = data.discordServerLink;
		if (url && url.match(/^https:\/\/(discord\.gg|discord\.com\/invite)\/.+/)) {
			linksFound++;
			result.append($("<div>", { html: $("<a>", {
				href: url,
				target: "_blank",
				rel: "noopener",
				onclick: "gtag('event', 'info-click-group-link-discord')",
				text: CheeseI18n.t("courses.discordServer")
			}) }));
		}
		if (linksFound > 1) result.prepend($("<div>").text(CheeseI18n.t("courses.groupsJoinMany")));
		else if (linksFound > 0) result.prepend($("<div>").text(CheeseI18n.t("courses.groupsJoinOne")));
		else result.text(CheeseI18n.t("courses.groupsNone"));
		return result;
	}
	function makeWhatsappGroupLinkForm(data) {
		return $("<form>", { html: [
			$("<input>", {
				type: "text",
				value: data.whatsappGroupLink || "",
				class: "form-control mt-2 whatsapp-group-link",
				placeholder: "https://chat.whatsapp.com/...",
				"aria-label": CheeseI18n.t("courses.whatsappGroup"),
				style: "direction: ltr;",
				pattern: "https://chat\\.whatsapp\\.com/.+",
				maxlength: 300
			}),
			$("<input>", {
				type: "text",
				value: data.whatsappGroupLink2 || "",
				class: "form-control mt-2 whatsapp-group-link2",
				placeholder: "https://chat.whatsapp.com/...",
				"aria-label": CheeseI18n.t("courses.whatsappGroup"),
				style: "direction: ltr;",
				pattern: "https://chat\\.whatsapp\\.com/.+",
				maxlength: 300
			}),
			$("<input>", {
				type: "text",
				value: data.whatsappGroupLink3 || "",
				class: "form-control mt-2 whatsapp-group-link3",
				placeholder: "https://chat.whatsapp.com/...",
				"aria-label": CheeseI18n.t("courses.whatsappGroup"),
				style: "direction: ltr;",
				pattern: "https://chat\\.whatsapp\\.com/.+",
				maxlength: 300
			}),
			$("<input>", {
				type: "text",
				value: data.telegramGroupLink || "",
				class: "form-control mt-2 telegram-group-link",
				placeholder: "https://t.me/...",
				"aria-label": CheeseI18n.t("courses.telegramGroup"),
				style: "direction: ltr;",
				pattern: "https://t\\.me/.+",
				maxlength: 300
			}),
			$("<input>", {
				type: "text",
				value: data.discordServerLink || "",
				class: "form-control mt-2 discord-server-link",
				placeholder: "https://discord.gg/...",
				"aria-label": CheeseI18n.t("courses.discordServer"),
				style: "direction: ltr;",
				pattern: "https://(discord\\.gg|discord\\.com/invite)/.+",
				maxlength: 300
			}),
			$("<div>", {
				class: "invalid-feedback",
				html: [
					$("<div>").text(CheeseI18n.t("courses.groupWhatsappFormat", { url: "https://chat.whatsapp.com/..." })),
					$("<div>").text(CheeseI18n.t("courses.groupTelegramFormat", { url: "https://t.me/..." })),
					$("<div>").text(CheeseI18n.t("courses.groupDiscordFormat", {
						url: "https://discord.gg/...",
						alternative: "https://discord.com/invite/..."
					}))
				]
			})
		] });
	}
	function showWhatsappGroupLink(course) {
		let groupLinksData = {};
		const whatsappGroupDialog = BootstrapDialog.show({
			title: CheeseI18n.t("courses.groupsTitle"),
			message: $("<div>", {
				class: "whatsapp-group-link-content",
				text: CheeseI18n.t("courses.loading")
			}),
			onshow(dialog) {
				dialog.getButton("update-link").disable();
			},
			buttons: [{
				id: "update-link",
				label: CheeseI18n.t("courses.updateLinks"),
				action(dialog) {
					const content = dialog.getModalBody().find(".whatsapp-group-link-content");
					const form = content.find("form").get(0);
					if (!form) {
						content.empty().append(makeWhatsappGroupLinkForm(groupLinksData));
						content.find("form input:first").focus();
						return;
					}
					if (form.checkValidity() === false) {
						form.classList.add("was-validated");
						return;
					}
					form.classList.remove("was-validated");
					const button = dialog.getButton("update-link");
					button.disable();
					const newGroupLinksData = {};
					const newGroupLinksDataWithDelete = {};
					const newGroupLinksDataSelectors = {
						whatsappGroupLink: ".whatsapp-group-link",
						whatsappGroupLink2: ".whatsapp-group-link2",
						whatsappGroupLink3: ".whatsapp-group-link3",
						telegramGroupLink: ".telegram-group-link",
						discordServerLink: ".discord-server-link"
					};
					Object.keys(newGroupLinksDataSelectors).forEach((key) => {
						const selector = newGroupLinksDataSelectors[key];
						const url = String(content.find(selector).val()).trim().replace(/[?&]fbclid=[a-zA-Z0-9_-]+$/, "").replace(/[?&]mode=\w+$/, "");
						if (url !== "") {
							newGroupLinksData[key] = url;
							newGroupLinksDataWithDelete[key] = url;
						} else newGroupLinksDataWithDelete[key] = firebase.firestore.FieldValue.delete();
					});
					newGroupLinksDataWithDelete.updatedBy = firebase.auth().currentUser.uid;
					newGroupLinksDataWithDelete.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
					firebase.firestore().collection("courseExtraDetails").doc(course).set(newGroupLinksDataWithDelete, { merge: true }).then(() => {
						groupLinksData = newGroupLinksData;
						content.empty().append(makeWhatsappGroupLinkContent(groupLinksData));
						button.enable();
					}, (error) => {
						button.enable();
						alert(CheeseI18n.t("courses.groupSaveFailed", { error }));
					});
				}
			}, {
				label: CheeseI18n.t("courses.close"),
				action(dialog) {
					dialog.close();
				}
			}]
		});
		const onError = (errorMessage) => {
			whatsappGroupDialog.getModalBody().find(".whatsapp-group-link-content").text(errorMessage);
		};
		const authenticated = typeof firebase !== "undefined" && firebase.auth && firebase.auth().currentUser !== null;
		if (typeof firebase === "undefined") onError(CheeseI18n.t("courses.firebaseUnavailable"));
		else if (!authenticated) onError(CheeseI18n.t("courses.groupLoginRequired"));
		else firebase.firestore().collection("courseExtraDetails").doc(course).get().then((doc) => {
			if (doc.exists) groupLinksData = doc.data();
			whatsappGroupDialog.getModalBody().find(".whatsapp-group-link-content").empty().append(makeWhatsappGroupLinkContent(groupLinksData));
			whatsappGroupDialog.getButton("update-link").enable();
		}, (error) => {
			onError(CheeseI18n.t("courses.loadFailed"));
		});
	}
	// src/components/course-button-list/templates/feedback-window.html?cheesefork-template
	var feedback_window_default = "<div class=\"course-feedback-window bg-light border shadow\" role=\"dialog\" aria-modal=\"false\" aria-labelledby=\"course-feedback-window-title\">\n    <div class=\"course-feedback-window-header\">\n        <h2 class=\"course-feedback-window-title\" id=\"course-feedback-window-title\"></h2>\n        <a class=\"course-feedback-window-button\" target=\"_blank\" rel=\"noopener\" aria-label=\"{{t:courses.originalFeedback.newWindow}}\" title=\"{{t:courses.originalFeedback.newWindow}}\"><i class=\"fas fa-external-link-alt\" aria-hidden=\"true\"></i></a>\n        <button type=\"button\" class=\"close course-feedback-window-button\" aria-label=\"{{t:courses.close}}\"><span aria-hidden=\"true\">&times;</span></button>\n    </div>\n    <iframe class=\"course-feedback-window-frame\" referrerpolicy=\"no-referrer\"></iframe>\n    <div class=\"course-feedback-window-note small text-muted\">{{t:courses.originalFeedback.note}}</div>\n</div>\n";
	// src/components/course-button-list/course-info-dialog.ts
	function setInfoDialogContent(dialog, course, courseManager) {
		const modalBody = dialog.getModalBody();
		const courseDescriptionHtmlWithLinks = courseManager.getDescription(course, {
			html: true,
			relatedCourseInfo: true,
			links: true,
			whatsappGroupLink: true,
			logging: true
		});
		const courseInfo = $("<div>", { html: courseDescriptionHtmlWithLinks });
		courseInfo.find(".whatsapp-group-link").click(() => {
			showWhatsappGroupLink(courseManager.toNewCourseNumber(course));
			return false;
		});
		courseInfo.find(".source-content").addBack().contents().filter(function() {
			return this.nodeType === Node.TEXT_NODE;
		}).each(function() {
			let replaced = false;
			const html = $("<div>").text(this.textContent || "").html().replace(/\b(?:\d{5,8})\b/g, (match) => {
				const matchCourse = courseManager.toSemesterFormatCourseNumber(courseManager.stringToCourseNumber(match));
				if (matchCourse === course) return match;
				let url;
				if (currentSemester < "202401") {
					if (matchCourse.length !== 6) return match;
					url = `https://students.technion.ac.il/local/technionsearch/course/${matchCourse}`;
				} else {
					if (matchCourse.length !== 8) return match;
					const currentSemesterYear = currentSemester.slice(0, 4);
					const currentSemesterSapSemester = parseInt(currentSemester.slice(4), 10) - 1 + 200;
					const sapLanguage = CheeseI18n.getLocale() === "en" ? "EN" : "HE";
					url = `https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=${sapLanguage}&sap-ui-language=${sapLanguage}#/details/${currentSemesterYear}/${currentSemesterSapSemester}/SM/${matchCourse}`;
				}
				let tooltipTitle;
				let onmouseover = void 0;
				if (courseManager.doesExist(matchCourse)) tooltipTitle = courseManager.getTitle(matchCourse);
				else {
					tooltipTitle = CheeseI18n.t("courses.notOffered");
					onmouseover = `var that = this;if (!$(that).attr("data-name-loading")) {$(that).attr("data-name-loading", true);$.get("${`https://michael-maltsev.github.io/technion-course-names/num/${matchCourse}`}", function (name) {$(that).attr("data-original-title", "${matchCourse} - " + name + ${JSON.stringify(` ${CheeseI18n.t("courses.notOffered")}`)});if ($(that).is(":hover")) { $(that).tooltip("show"); }});}`;
				}
				replaced = true;
				return $("<a>", {
					href: url,
					target: "_blank",
					rel: "noopener",
					onclick: "gtag('event', 'info-click-dependency-link-rishum')",
					onmouseover,
					title: tooltipTitle,
					"data-toggle": "tooltip",
					"data-trigger": "hover",
					text: match
				})[0].outerHTML;
			});
			if (replaced) {
				const newElement = $("<span>", { html });
				newElement.find("[data-toggle=\"tooltip\"]").tooltip();
				$(this).replaceWith(newElement);
			}
		});
		modalBody.find(".course-information").empty().append(courseInfo);
		const originalFeedbackUrl = getOriginalFeedbackUrl(courseManager, course);
		const originalFeedbackLink = $("<a>", {
			class: "btn btn-primary",
			href: originalFeedbackUrl,
			target: "_blank",
			rel: "noopener",
			role: "button",
			text: CheeseI18n.t("courses.originalFeedback.button")
		}).click((event) => {
			if (event.ctrlKey || event.metaKey || event.shiftKey) return;
			event.preventDefault();
			gtag("event", "course-feedback-original-site-click");
			showOriginalFeedbackWindow(originalFeedbackUrl, courseManager.getCourseName(course));
		});
		const originalFeedbackNote = $("<div>", {
			class: "small text-muted mt-1",
			text: CheeseI18n.t("courses.originalFeedback.note")
		});
		modalBody.find(".course-feedback").addClass("text-center mb-4").empty().append(originalFeedbackLink, originalFeedbackNote);
		new HistogramBrowser(modalBody.find(".inline-histograms"), {}).loadHistograms(courseManager.toNewCourseNumber(course));
	}
	function getOriginalFeedbackUrl(courseManager, course) {
		return `https://cheesefork.cf/course-widget-comments.html?course=${encodeURIComponent(courseManager.toNewCourseNumber(course))}`;
	}
	var originalFeedbackWindow = null;
	var originalFeedbackWindowSize = null;
	var originalFeedbackWindowMinSize = {
		width: 260,
		height: 220
	};
	function showOriginalFeedbackWindow(url, courseName) {
		const title = CheeseI18n.t("courses.originalFeedback.windowTitle", { course: courseName });
		if (!originalFeedbackWindow) originalFeedbackWindow = createOriginalFeedbackWindow();
		originalFeedbackWindow.find(".course-feedback-window-title").text(title);
		originalFeedbackWindow.find(".course-feedback-window-button[target]").attr("href", url);
		originalFeedbackWindow.find("iframe").attr({
			src: url,
			title
		});
		originalFeedbackWindow.removeClass("d-none");
		fitOriginalFeedbackWindow(true);
	}
	function createOriginalFeedbackWindow() {
		const feedbackWindow = $(render(feedback_window_default)).appendTo("body");
		feedbackWindow.find("button.close").click(() => {
			feedbackWindow.find("iframe").attr("src", "about:blank");
			feedbackWindow.addClass("d-none");
		});
		if (feedbackWindow.draggable) feedbackWindow.draggable({
			handle: ".course-feedback-window-header",
			cancel: ".course-feedback-window-button",
			containment: "window",
			iframeFix: true
		});
		if (feedbackWindow.resizable) {
			feedbackWindow.resizable({
				handles: "n, e, s, w, ne, nw, se, sw",
				minWidth: originalFeedbackWindowMinSize.width,
				minHeight: originalFeedbackWindowMinSize.height,
				start() {
					feedbackWindow.addClass("course-feedback-window-resizing");
				},
				stop(event, ui) {
					feedbackWindow.removeClass("course-feedback-window-resizing");
					originalFeedbackWindowSize = {
						width: ui.size.width,
						height: ui.size.height
					};
					fitOriginalFeedbackWindow(false);
				}
			});
			feedbackWindow.find(CheeseI18n.isRTL() ? ".ui-resizable-sw" : ".ui-resizable-se").addClass("course-feedback-window-grip");
		}
		$(window).on("resize", (event) => {
			if (event.target === window && !feedbackWindow.hasClass("d-none")) fitOriginalFeedbackWindow(false);
		});
		return feedbackWindow;
	}
	function getOriginalFeedbackWindowDefaultSize(screenWidth, screenHeight, margin) {
		const phone = screenWidth < 576;
		const width = screenWidth * (phone ? 1 : .6);
		const height = screenHeight * (phone ? 1 : .85);
		const grow = Math.max(1, originalFeedbackWindowMinSize.width / width, originalFeedbackWindowMinSize.height / height);
		const shrink = Math.min(1, (screenWidth - 2 * margin) / (width * grow), (screenHeight - 2 * margin) / (height * grow));
		return {
			width: width * grow * shrink,
			height: height * grow * shrink
		};
	}
	function fitOriginalFeedbackWindow(center) {
		const feedbackWindow = originalFeedbackWindow;
		if (!feedbackWindow) return;
		const screenWidth = window.innerWidth || document.documentElement.clientWidth;
		const screenHeight = window.innerHeight || document.documentElement.clientHeight;
		const margin = screenWidth < 576 ? 8 : 16;
		const size = originalFeedbackWindowSize || getOriginalFeedbackWindowDefaultSize(screenWidth, screenHeight, margin);
		const width = Math.round(Math.max(0, Math.min(size.width, screenWidth - 2 * margin)));
		const height = Math.round(Math.max(0, Math.min(size.height, screenHeight - 2 * margin)));
		if (feedbackWindow.resizable && feedbackWindow.hasClass("ui-resizable")) feedbackWindow.resizable("option", {
			maxWidth: Math.max(originalFeedbackWindowMinSize.width, screenWidth - 2 * margin),
			maxHeight: Math.max(originalFeedbackWindowMinSize.height, screenHeight - 2 * margin)
		});
		let left;
		let top;
		if (center) {
			left = (screenWidth - width) / 2;
			top = (screenHeight - height) / 2;
		} else {
			const position = feedbackWindow.position();
			left = Math.min(Math.max(margin, position.left), screenWidth - width - margin);
			top = Math.min(Math.max(margin, position.top), screenHeight - height - margin);
		}
		feedbackWindow.css({
			width,
			height,
			left: Math.round(Math.max(0, left)),
			top: Math.round(Math.max(0, top))
		});
	}
	// src/components/course-button-list/lists.ts
	function getAllLists(that) {
		return that.element.find("ul.course-button-list-badge-container");
	}
	function getLayerList(that, layerId) {
		if (!layerId) return that.badgeContainer;
		return getAllLists(that).filter(`[data-layer-id="${layerId}"]`);
	}
	function getListLayerId(list) {
		return list.attr("data-layer-id") || "";
	}
	function findCourseItems(that, course, layerId) {
		return (layerId === void 0 ? getAllLists(that) : getLayerList(that, layerId)).find(`li.list-group-item[data-course-number="${course}"]`);
	}
	function findCustomEventItem(that, eventId) {
		return getAllLists(that).find("li.course-button-list-custom-event").filter(function() {
			return $(this).attr("data-custom-event-id") === String(eventId);
		});
	}
	function courseColors(that, course, layerId) {
		return {
			"background-color": that.colorGenerator(course, null, layerId),
			color: that.textColorGenerator(course, null, layerId)
		};
	}
	function customEventColors(that, eventId, title) {
		return {
			"background-color": that.colorGenerator(title, `custom_event_${eventId}`),
			color: that.textColorGenerator(title, `custom_event_${eventId}`)
		};
	}
	function moveCustomEventsToEnd(list) {
		list.append(list.children("li.course-button-list-custom-event"));
	}
	// src/components/course-button-list/templates/layer-collapse.html?cheesefork-template
	var layer_collapse_default = "<span class=\"course-button-list-layer-collapse\" role=\"button\" tabindex=\"0\"><i class=\"fas fa-fw\"></i></span>\n";
	// src/components/course-button-list/templates/layer-menu.html?cheesefork-template
	var layer_menu_default = "<span class=\"dropdown course-button-list-layer-menu\">\n    <span class=\"course-button-list-layer-menu-button\" data-toggle=\"dropdown\" aria-haspopup=\"true\" aria-expanded=\"false\"><i class=\"fas fa-ellipsis-v\"></i></span>\n    <div class=\"dropdown-menu dropdown-menu-right text-right\">\n        <a class=\"dropdown-item course-button-list-layer-rename\" href=\"#\">{{t:courses.layers.rename}}</a>\n        <a class=\"dropdown-item course-button-list-layer-add\" href=\"#\">{{t:courses.layers.add}}</a>\n        <a class=\"dropdown-item course-button-list-layer-duplicate\" href=\"#\">{{t:courses.layers.duplicate}}</a>\n        <a class=\"dropdown-item course-button-list-layer-delete\" href=\"#\">{{t:courses.layers.delete}}</a>\n    </div>\n</span>\n";
	// src/components/course-button-list/templates/layer-visibility.html?cheesefork-template
	var layer_visibility_default = "<span class=\"course-button-list-layer-visibility\"><i class=\"far\"></i></span>\n";
	// src/components/course-button-list/layer-header.ts
	function makeLayerHeader(that, layer) {
		const header = $("<div class=\"course-button-list-layer-header\">").attr("data-layer-id", layer.id);
		const visibility = $(render(layer_visibility_default));
		visibility.find("i").addClass(layer.hidden ? "fa-square" : "fa-check-square");
		const name = $("<span class=\"course-button-list-layer-name\">").text(layer.name);
		const collapse = $(render(layer_collapse_default));
		collapse.on("click", () => {
			setLayerCollapsed(that, layer, !layer.collapsed);
			that.onLayerCollapseChange(layer.id, !!layer.collapsed);
		}).on("keydown", function(e) {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				$(this).trigger("click");
			}
		});
		header.append(collapse, visibility, name);
		if (that.readonly) return header;
		const menu = $(render(layer_menu_default));
		header.append(menu);
		header.click((e) => {
			if ($(e.target).closest(".course-button-list-layer-collapse, .course-button-list-layer-visibility, .course-button-list-layer-menu").length === 0) that.setActiveLayer(layer.id);
		});
		visibility.attr("title", CheeseI18n.t("courses.layers.toggleVisibility")).click(() => {
			that.onLayerVisibilityChange(layer.id, !layer.hidden);
		});
		menu.find(".course-button-list-layer-rename").click((e) => {
			e.preventDefault();
			showLayerRenameDialog(that, layer);
		});
		menu.find(".course-button-list-layer-add").click((e) => {
			e.preventDefault();
			that.onLayerCreate(null, null);
		});
		menu.find(".course-button-list-layer-duplicate").click((e) => {
			e.preventDefault();
			that.onLayerDuplicate(layer.id);
		});
		menu.find(".course-button-list-layer-delete").click((e) => {
			e.preventDefault();
			showLayerDeleteDialog(that, layer);
		});
		return header;
	}
	function showLayerRenameDialog(that, layer) {
		const input = $("<input type=\"text\" class=\"form-control\" maxlength=\"20\">").val(layer.name);
		const rename = (dialog) => {
			dialog.close();
			const name = String(input.val()).trim();
			if (name !== "" && name !== layer.name) that.onLayerRename(layer.id, name);
		};
		BootstrapDialog.show({
			title: CheeseI18n.t("courses.layers.renameTitle"),
			message: input,
			onshown(dialog) {
				input.focus().select().keydown((e) => {
					if (e.key === "Enter") rename(dialog);
				});
			},
			buttons: [{
				label: CheeseI18n.t("courses.layers.save"),
				cssClass: "btn-primary",
				action: rename
			}, {
				label: CheeseI18n.t("courses.close"),
				action(dialog) {
					dialog.close();
				}
			}]
		});
	}
	function showLayerDeleteDialog(that, layer) {
		const message = $("<div>").text(CheeseI18n.t("courses.layers.deleteMessage", { name: layer.name }));
		BootstrapDialog.show({
			title: CheeseI18n.t("courses.layers.deleteTitle"),
			message,
			buttons: [{
				label: CheeseI18n.t("courses.layers.deleteConfirm"),
				cssClass: "btn-danger",
				action(dialog) {
					dialog.close();
					that.onLayerDelete(layer.id);
				}
			}, {
				label: CheeseI18n.t("courses.close"),
				action(dialog) {
					dialog.close();
				}
			}]
		});
	}
	function setLayerCollapsed(that, layer, collapsed) {
		layer.collapsed = collapsed;
		getLayerList(that, layer.id).toggleClass("course-button-list-layer-collapsed", collapsed);
		const header = that.element.find(".course-button-list-layer-header").filter(function() {
			return $(this).attr("data-layer-id") === layer.id;
		});
		header.toggleClass("course-button-list-layer-header-collapsed", collapsed);
		const collapsedIcon = CheeseI18n.isRTL() ? "fa-caret-left" : "fa-caret-right";
		header.find(".course-button-list-layer-collapse").attr({
			title: CheeseI18n.t(collapsed ? "courses.layers.expand" : "courses.layers.collapse"),
			"aria-expanded": collapsed ? "false" : "true"
		}).find("i").removeClass("fa-caret-down fa-caret-left fa-caret-right").addClass(collapsed ? collapsedIcon : "fa-caret-down");
	}
	function removeLayers(that) {
		that.element.find(".course-button-list-layer-header").remove();
		getAllLists(that).not(that.badgeContainer).remove();
		that.badgeContainer.removeClass("course-button-list-layer-hidden course-button-list-layer-active course-button-list-layer-collapsed");
		that.element.removeClass("course-button-list-with-layers");
		that.layers = [];
	}
	// src/components/course-button-list/course-button-list.ts
	var CourseButtonList = class {
		constructor(element, options) {
			this.sortableInitialized = false;
			this.layers = [];
			this.activeLayerId = "";
			this.infoDialogs = [];
			this.element = element;
			this.courseManager = options.courseManager;
			this.colorGenerator = options.colorGenerator;
			this.textColorGenerator = options.textColorGenerator || (() => "white");
			this.readonly = options.readonly;
			this.onHoverIn = options.onHoverIn;
			this.onHoverOut = options.onHoverOut;
			this.onEnableCourse = options.onEnableCourse;
			this.onDisableCourse = options.onDisableCourse;
			this.onReorder = options.onReorder;
			this.onCourseMove = options.onCourseMove;
			this.onLayerCreate = options.onLayerCreate;
			this.onLayerDuplicate = options.onLayerDuplicate;
			this.onLayerRename = options.onLayerRename;
			this.onLayerDelete = options.onLayerDelete;
			this.onLayerVisibilityChange = options.onLayerVisibilityChange;
			this.onLayerCollapseChange = options.onLayerCollapseChange || (() => {});
			this.onCustomEventHoverIn = options.onCustomEventHoverIn;
			this.onCustomEventHoverOut = options.onCustomEventHoverOut;
			this.onCustomEventMove = options.onCustomEventMove;
			this.onCustomEventRemove = options.onCustomEventRemove;
			const that = this;
			that.sortableInitialized = false;
			that.layers = [];
			that.activeLayerId = "";
			if (that.readonly) that.element.addClass("course-button-list-readonly");
			this.badgeContainer = $("<ul class=\"course-button-list-badge-container list-group\">");
			that.element.append(that.badgeContainer);
			if (!that.readonly) {
				this.deleteArea = $(render(delete_area_default));
				this.newLayerArea = $(render(new_layer_area_default));
				this.dropAreas = $("<div class=\"course-button-list-drop-areas\">").append(this.newLayerArea, this.deleteArea);
				this.dropAreas.hide();
				this.element.append(this.dropAreas);
			}
			that.infoDialogs = [];
		}
		setLayers(layers) {
			const that = this;
			that.destroySortable();
			removeLayers(that);
			that.layers = layers;
			if (!layers.some((layer) => layer.id === that.activeLayerId)) that.activeLayerId = "";
			if (layers.length === 0) return;
			that.element.addClass("course-button-list-with-layers");
			layers.forEach((layer) => {
				let list = that.badgeContainer;
				if (layer.id) {
					list = $("<ul class=\"course-button-list-badge-container list-group\">").attr("data-layer-id", layer.id);
					if (that.dropAreas) list.insertBefore(that.dropAreas);
					else that.element.append(list);
				}
				list.toggleClass("course-button-list-layer-hidden", !!layer.hidden);
				makeLayerHeader(that, layer).insertBefore(list);
				setLayerCollapsed(that, layer, !!layer.collapsed);
			});
			that.setActiveLayer(that.activeLayerId);
			that.initializeSortableIfNeeded();
		}
		expandLayer(layerId) {
			const that = this;
			const layer = that.layers.filter((layer) => layer.id === layerId)[0];
			if (layer && layer.collapsed) {
				setLayerCollapsed(that, layer, false);
				that.onLayerCollapseChange(layer.id, false);
			}
		}
		getActiveLayerId() {
			return this.activeLayerId;
		}
		setActiveLayer(layerId) {
			const that = this;
			that.activeLayerId = layerId;
			if (!that.readonly) that.element.find(".course-button-list-layer-header").each(function() {
				$(this).toggleClass("course-button-list-layer-active", $(this).attr("data-layer-id") === layerId);
			});
		}
		addCourse(course, layerId) {
			const that = this;
			const list = getLayerList(that, layerId);
			const courseTitle = that.courseManager.getTitle(course);
			const spanAbsolute = $("<div class=\"content-wrapper\">").empty().append($("<span class=\"content-absolute\">").text(courseTitle).attr({
				lang: /[א-ת]/.test(courseTitle) ? "he" : "en",
				dir: "auto"
			}));
			const spanBoldHidden = $("<span class=\"content-bold-hidden\">").text(courseTitle).attr({
				lang: /[א-ת]/.test(courseTitle) ? "he" : "en",
				dir: "auto"
			});
			const dragHandle = $(render(drag_handle_default));
			const button = $(render(course_item_default, { course }));
			const badge = $(render(info_badge_default));
			button.css(courseColors(that, course, layerId)).click(function() {
				if (!that.readonly) onCourseButtonClick($(this), course);
			}).hover(function() {
				$(this).addClass("course-button-list-item-hovered");
				that.onHoverIn(course, getListLayerId($(this).parent()));
			}, function() {
				$(this).removeClass("course-button-list-item-hovered");
				that.onHoverOut(course, getListLayerId($(this).parent()));
			}).append(dragHandle, spanAbsolute, spanBoldHidden, badge);
			const courseDescriptionHtml = that.courseManager.getDescription(course, { html: true });
			badge.hover(function() {
				$(this).removeClass("badge-secondary");
				$(this).addClass("badge-primary");
			}, function() {
				$(this).removeClass("badge-primary");
				$(this).addClass("badge-secondary");
			}).click(function(e) {
				e.stopPropagation();
				gtag("event", "course-button-list-info-click");
				const firstTimeTooltipBadge = getAllLists(that).find("[data-special-tooltip=\"first-time\"]");
				if (firstTimeTooltipBadge.length > 0) {
					firstTimeTooltipBadge.tooltip("dispose");
					addTooltipToBadge(firstTimeTooltipBadge, courseDescriptionHtml, false);
					try {
						localStorage.setItem("dontShowHistogramsTip", Date.now().toString());
					} catch (e) {}
				}
				$(this).tooltip("hide");
				showBootstrapDialogWithModelessButton("course-info", {
					title: courseTitle,
					size: BootstrapDialog.SIZE_WIDE,
					message: render(info_dialog_default),
					onshow(dialog) {
						that.infoDialogs.push(dialog);
						setInfoDialogContent(dialog, course, that.courseManager);
					},
					onhidden(dialog) {
						const index = that.infoDialogs.indexOf(dialog);
						if (index !== -1) that.infoDialogs.splice(index, 1);
					}
				});
			});
			let showFirstTimeTooltip = false;
			if (getAllLists(that).find("li.list-group-item[data-course-number]:first").length === 0) try {
				showFirstTimeTooltip = !localStorage.getItem("dontShowHistogramsTip");
			} catch (e) {}
			let tooltipHtml = courseDescriptionHtml;
			if (showFirstTimeTooltip) tooltipHtml = $("<div>").text(CheeseI18n.t("courses.histogramsReviewsTip")).html();
			addTooltipToBadge(badge, tooltipHtml, showFirstTimeTooltip);
			list.append(button);
			moveCustomEventsToEnd(list);
			that.initializeSortableIfNeeded();
			if (showFirstTimeTooltip) setTimeout(() => {
				badge.tooltip("show");
			}, 0);
			function addTooltipToBadge(badge, tooltipHtml, firstTimeTooltip) {
				let trigger = "hover";
				let extraClass = "";
				let extraClassInner = "";
				if (firstTimeTooltip) {
					trigger = "manual";
					extraClass = " course-button-list-tooltip-persistent";
					badge.attr("data-special-tooltip", "first-time");
				} else {
					extraClassInner = " course-description-tooltip-inner";
					badge.removeAttr("data-special-tooltip");
				}
				badge.prop("title", tooltipHtml).attr("data-toggle", "tooltip").tooltip({
					html: true,
					placement: "right",
					template: render(tooltip_default$2, {
						extraClass,
						extraClassInner
					}),
					trigger
				});
			}
			function onCourseButtonClick(button, course) {
				if (button.hasClass("active")) {
					button.removeClass("active").removeClass("course-button-list-item-conflicted");
					button.find(".content-absolute").removeClass("course-button-list-content-has-hidden").tooltip("dispose");
					button.css({
						"background-color": "",
						color: ""
					});
					that.onDisableCourse(course, getListLayerId(button.parent()));
				} else {
					button.addClass("active");
					button.css(courseColors(that, course, getListLayerId(button.parent())));
					that.onEnableCourse(course, getListLayerId(button.parent()));
				}
			}
		}
		initializeSortableIfNeeded() {
			const that = this;
			if (that.sortableInitialized || that.readonly) return;
			if (that.layers.length === 0 && that.badgeContainer.find("li.list-group-item").length === 0) return;
			that.sortableInitialized = true;
			let shouldDelete = false;
			let shouldCreateLayer = false;
			let cachedHeight = 0;
			let originalIndex = -1;
			let originalList = $();
			getAllLists(that).sortable({
				handle: ".course-button-list-drag-handle",
				placeholder: "course-button-list-item ui-sortable-placeholder",
				tolerance: "pointer",
				cursor: "move",
				opacity: .8,
				delay: 100,
				distance: 5,
				containment: "body",
				connectWith: ".course-button-list-badge-container, .course-button-list-delete-area",
				helper: ((event, item) => {
					cachedHeight = item.outerHeight();
					return item.clone();
				}),
				start(event, ui) {
					shouldDelete = false;
					shouldCreateLayer = false;
					originalList = ui.item.parent();
					originalIndex = ui.item.index();
					getAllLists(that).find("[data-toggle=\"tooltip\"]").tooltip("hide");
					ui.helper.addClass("ui-sortable-helper");
					ui.placeholder.outerHeight(cachedHeight);
					if (that.dropAreas) that.dropAreas.fadeIn(150);
				},
				stop(event, ui) {
					if (that.dropAreas) that.dropAreas.fadeOut(150);
					const course = ui.item.attr("data-course-number");
					const selected = ui.item.hasClass("active");
					const originalLayerId = getListLayerId(originalList);
					const newList = ui.item.parent();
					const newLayerId = getListLayerId(newList);
					const customEventId = ui.item.attr("data-custom-event-id");
					if (customEventId !== void 0) {
						const wasDeleted = shouldDelete;
						const wasMovedToNewLayer = shouldCreateLayer;
						originalList.sortable("cancel");
						setTimeout(() => {
							if (wasDeleted) that.onCustomEventRemove(customEventId, originalLayerId);
							else if (wasMovedToNewLayer) that.onLayerCreate(null, originalLayerId, customEventId);
							else if (newLayerId !== originalLayerId) that.onCustomEventMove(customEventId, originalLayerId, newLayerId);
						}, 0);
					} else if (shouldDelete) {
						ui.item.remove();
						if (course && that.onDisableCourse) that.onDisableCourse(course, originalLayerId);
					} else if (shouldCreateLayer) {
						originalList.sortable("cancel");
						if (selected) setTimeout(() => {
							that.onLayerCreate(course, originalLayerId);
						}, 0);
					} else if (newLayerId !== originalLayerId) {
						if (newList.find(`li.list-group-item[data-course-number="${course}"]`).length > 1) originalList.sortable("cancel");
						else if (selected) setTimeout(() => {
							that.onCourseMove(course, originalLayerId, newLayerId);
						}, 0);
					} else {
						if (ui.item.index() !== originalIndex && that.onReorder) that.onReorder(newLayerId);
						moveCustomEventsToEnd(newList);
					}
					shouldDelete = false;
					shouldCreateLayer = false;
				}
			});
			if (that.deleteArea) that.deleteArea.droppable({
				accept: ".course-button-list-item",
				tolerance: "pointer",
				hoverClass: "ui-droppable-hover",
				over(event, ui) {
					shouldDelete = true;
				},
				out(event, ui) {
					shouldDelete = false;
				}
			});
			if (that.newLayerArea) that.newLayerArea.droppable({
				accept: ".course-button-list-item",
				tolerance: "pointer",
				hoverClass: "ui-droppable-hover",
				over(event, ui) {
					shouldCreateLayer = true;
				},
				out(event, ui) {
					shouldCreateLayer = false;
				}
			});
		}
		destroySortable() {
			const that = this;
			if (that.sortableInitialized) {
				getAllLists(that).each(function() {
					try {
						$(this).sortable("destroy");
					} catch (e) {}
				});
				if (that.deleteArea) try {
					that.deleteArea.droppable("destroy");
				} catch (e) {}
				if (that.newLayerArea) try {
					that.newLayerArea.droppable("destroy");
				} catch (e) {}
				that.sortableInitialized = false;
			}
		}
		setFloatingCourseInfo(course) {
			const that = this;
			if (that.infoDialogs.length === 0) return;
			const dialog = that.infoDialogs[that.infoDialogs.length - 1];
			const courseTitle = that.courseManager.getTitle(course);
			if (dialog.getTitle() === courseTitle) return;
			dialog.setTitle(courseTitle);
			setInfoDialogContent(dialog, course, that.courseManager);
		}
		addCustomEvent(eventId, title, layerId) {
			const that = this;
			const spanAbsolute = $("<div class=\"content-wrapper\">").empty().append($("<span class=\"content-absolute\">").text(title));
			const spanBoldHidden = $("<span class=\"content-bold-hidden\">").text(title);
			const dragHandle = $(render(drag_handle_default));
			const item = $("<li class=\"list-group-item active course-button-list-item course-button-list-custom-event\">").attr("data-custom-event-id", eventId).css(customEventColors(that, eventId, title)).hover(function() {
				$(this).addClass("course-button-list-item-hovered");
				that.onCustomEventHoverIn($(this).attr("data-custom-event-id"));
			}, function() {
				$(this).removeClass("course-button-list-item-hovered");
				that.onCustomEventHoverOut($(this).attr("data-custom-event-id"));
			}).append(dragHandle, spanAbsolute, spanBoldHidden);
			getLayerList(that, layerId).append(item);
			that.initializeSortableIfNeeded();
		}
		updateCustomEvent(eventId, title) {
			const item = findCustomEventItem(this, eventId);
			item.find(".content-absolute, .content-bold-hidden").text(title);
			item.css(customEventColors(this, eventId, title));
		}
		removeCustomEvent(eventId) {
			findCustomEventItem(this, eventId).remove();
		}
		setHovered(course, layerId) {
			findCourseItems(this, course, layerId).addClass("course-button-list-item-hovered");
		}
		removeHovered(course, layerId) {
			findCourseItems(this, course, layerId).removeClass("course-button-list-item-hovered");
		}
		setConflicted(course, layerId) {
			findCourseItems(this, course, layerId).addClass("course-button-list-item-conflicted");
		}
		removeConflicted(course, layerId) {
			findCourseItems(this, course, layerId).removeClass("course-button-list-item-conflicted");
		}
		setLessonTypesHidden(course, lessonTypesHidden, layerId) {
			const listGroupTextItem = findCourseItems(this, course, layerId).find(".content-absolute");
			if (lessonTypesHidden.length > 0) {
				const courseManager = this.courseManager;
				const types = lessonTypesHidden.slice().sort().map((type) => courseManager.getLessonTypeLabel(type));
				const title = CheeseI18n.t("courses.hiddenLessonTypes", { types: types.join(", ") });
				const titleHtml = $("<div>").text(title).html().replace(/\n/g, "<br>");
				listGroupTextItem.addClass("course-button-list-content-has-hidden").tooltip("dispose").prop("title", titleHtml).attr("data-toggle", "tooltip").tooltip({
					html: true,
					placement: "bottom"
				});
			} else listGroupTextItem.removeClass("course-button-list-content-has-hidden").tooltip("dispose");
		}
		updateColors() {
			const that = this;
			getAllLists(that).find("li.list-group-item.active").each(function() {
				const item = $(this);
				const customEventId = item.attr("data-custom-event-id");
				item.css(customEventId !== void 0 ? customEventColors(that, customEventId, item.find(".content-bold-hidden").text()) : courseColors(that, item.attr("data-course-number"), getListLayerId(item.parent())));
			});
		}
		isCourseInList(course, layerId) {
			return findCourseItems(this, course, layerId).length > 0;
		}
		getCourseNumbers(onlySelected, layerId) {
			const that = this;
			let selector = "li.list-group-item[data-course-number]";
			if (onlySelected) selector += ".active";
			const lists = layerId === void 0 ? getAllLists(that) : getLayerList(that, layerId);
			const courseNumbers = [];
			lists.find(selector).each(function() {
				const course = $(this).attr("data-course-number");
				if (!courseNumbers.includes(course)) courseNumbers.push(course);
			});
			return courseNumbers;
		}
		clear() {
			getAllLists(this).find("[data-toggle=\"tooltip\"]").tooltip("hide");
			this.destroySortable();
			removeLayers(this);
			this.badgeContainer.empty();
		}
	};
	// src/components/course-calendar/calendar-types.ts
	function isLessonEvent(event) {
		return event.courseNumber !== null && event.lessonData !== null;
	}
	// src/components/course-calendar/lesson-events.ts
	function calendarWeek(date) {
		const days = (Date.UTC(date.year(), date.month(), date.date()) - Date.UTC(2017, 0, 1)) / 864e5;
		return Math.floor(days / 7) + 1;
	}
	function stringHexEncode(str) {
		let result = "";
		for (let i = 0; i < str.length; i++) {
			const hex = str.charCodeAt(i).toString(16);
			result += `000${hex}`.slice(-4);
		}
		return result;
	}
	function getLessonType(courseNumber, lesson) {
		if (/^(394[89]\d\d|03940[89]\d\d)$/.test(courseNumber)) return "sport";
		else return stringHexEncode(lesson["סוג"]);
	}
	function getEventLessonType(event) {
		return getLessonType(event.courseNumber, event.lessonData);
	}
	function isSameCourse(event, course, layerId) {
		return event.courseNumber === course && event.layerId === layerId;
	}
	function getCourseClassName(course, layerId) {
		return `calendar-item-${layerId ? `layer-${layerId}-` : ""}course-${course}`;
	}
	function updateLessonEvents(calendar, events) {
		const updates = events.map((event) => {
			const update = $.extend({}, event);
			delete update.title;
			delete update.lessonData;
			return update;
		});
		calendar.fullCalendar("updateEvents", updates);
	}
	function updateLessonEvent(calendar, event) {
		updateLessonEvents(calendar, [event]);
	}
	function getCourseConflictedStatus(calendar, course, layerId) {
		const lessonTypesAvailable = {};
		const lessonTypesVisible = {};
		calendar.fullCalendar("clientEvents", (event) => {
			if (!isSameCourse(event, course, layerId) || event.lessonTypeHidden) return false;
			const type = getLessonType(course, event.lessonData);
			lessonTypesAvailable[type] = true;
			if (calendarWeek(event.start) === 1) lessonTypesVisible[type] = true;
			return false;
		});
		return Object.keys(lessonTypesAvailable).some((type) => !lessonTypesVisible[type]);
	}
	function getCourseHiddenLessonTypes(calendar, course, courseManager, layerId) {
		const lessonTypesHidden = {};
		calendar.fullCalendar("clientEvents", (event) => {
			if (!isSameCourse(event, course, layerId) || !event.lessonTypeHidden) return false;
			const lesson = event.lessonData;
			const lessonType = courseManager.getLessonType(lesson);
			lessonTypesHidden[lessonType] = true;
			return false;
		});
		return Object.keys(lessonTypesHidden);
	}
	function updateCalendarMaxDayAndTime(calendar, ignoreHover) {
		let minTime = calendar.fullCalendar("getCalendar").moment("2017-01-01T08:30:00");
		let maxTime = calendar.fullCalendar("getCalendar").moment("2017-01-01T18:30:00");
		let maxDay = 4;
		calendar.fullCalendar("clientEvents", (event) => {
			if (calendarWeek(event.start) !== 1) return false;
			const endDay = event.end.clone().add(-1, "minute").day();
			if (maxDay < endDay) maxDay = endDay;
			const start = event.start.clone().set({
				year: 2017,
				month: 0,
				date: 1
			});
			let end = event.end.clone().set({
				year: 2017,
				month: 0,
				date: 1
			});
			if (event.end.day() !== event.start.day()) end = calendar.fullCalendar("getCalendar").moment("2017-01-01T24:00:00");
			if (minTime.isAfter(start)) minTime = start;
			if (maxTime.isBefore(end)) maxTime = end;
			return false;
		});
		if (minTime.minute() >= 30) minTime.set({
			minute: 30,
			second: 0,
			millisecond: 0
		});
		else minTime.set({
			minute: 0,
			second: 0,
			millisecond: 0
		});
		if (maxTime.hour() === 0) maxTime.set({
			minute: 0,
			second: 0,
			millisecond: 0
		});
		else if (maxTime.minute() > 30) maxTime.set({
			hour: maxTime.hour() + 1,
			minute: 0,
			second: 0,
			millisecond: 0
		});
		else if (maxTime.minute() > 0) maxTime.set({
			minute: 30,
			second: 0,
			millisecond: 0
		});
		else maxTime.set({
			minute: 0,
			second: 0,
			millisecond: 0
		});
		let minTimeText = minTime.format("HH:mm:ss");
		let maxTimeText = maxTime.format("kk:mm:ss");
		let hiddenDays = [];
		for (let i = maxDay + 1; i < 7; i++) hiddenDays.push(i);
		const currentMinTime = calendar.fullCalendar("option", "minTime");
		const currentMaxTime = calendar.fullCalendar("option", "maxTime");
		const currentHiddenDays = calendar.fullCalendar("option", "hiddenDays");
		if (!ignoreHover && calendar.is(":hover")) {
			if (minTimeText > currentMinTime) minTimeText = currentMinTime;
			if (maxTimeText < currentMaxTime) maxTimeText = currentMaxTime;
			if (hiddenDays.length > currentHiddenDays.length) hiddenDays = currentHiddenDays;
		}
		const newOptions = {};
		if (minTimeText !== currentMinTime) newOptions.minTime = minTimeText;
		if (maxTimeText !== currentMaxTime) newOptions.maxTime = maxTimeText;
		if (JSON.stringify(hiddenDays) !== JSON.stringify(currentHiddenDays)) newOptions.hiddenDays = hiddenDays;
		if (Object.keys(newOptions).length > 0) calendar.fullCalendar("option", newOptions);
	}
	function areEventsOverlapping(event1, event2) {
		if (event1.start.day() !== event2.start.day()) return false;
		const startTime1 = event1.start.clone().year(0).month(0).date(1);
		const endTime1 = event1.end.clone().year(0).month(0).date(1);
		const startTime2 = event2.start.clone().year(0).month(0).date(1);
		const endTime2 = event2.end.clone().year(0).month(0).date(1);
		return startTime1.isBefore(endTime2) && endTime1.isAfter(startTime2);
	}
	function makeLessonEvent(courseCalendar, course, lesson, layerId) {
		const lessonType = getLessonType(course, lesson);
		const lessonStartEnd = courseCalendar.courseManager.parseLessonTime(lesson["שעה"]);
		const lessonStartDay = {
			ראשון: 1,
			שני: 2,
			שלישי: 3,
			רביעי: 4,
			חמישי: 5,
			שישי: 6,
			א: 1,
			ב: 2,
			ג: 3,
			ד: 4,
			ה: 5,
			ו: 6
		}[lesson["יום"]];
		let lessonEndDay = lessonStartDay;
		if (lessonStartEnd.end === "00:00") lessonEndDay++;
		const eventStartEnd = {
			start: courseCalendar.element.fullCalendar("getCalendar").moment(`2017-01-0${lessonStartDay}T${lessonStartEnd.start}:00`),
			end: courseCalendar.element.fullCalendar("getCalendar").moment(`2017-01-0${lessonEndDay}T${lessonStartEnd.end}:00`)
		};
		const eventId = `${(layerId ? `${layerId}.` : "") + course}.${lesson["מס."]}.${lessonType}`;
		const courseClassName = getCourseClassName(course, layerId);
		const courseManager = courseCalendar.courseManager;
		let title = courseManager.getLessonTypeAndNumber(lesson);
		if (lesson["בניין"]) {
			title += `\n${courseManager.getBuildingLabel(lesson["בניין"])}`;
			if (lesson["חדר"]) title += ` ${lesson["חדר"]}`;
		}
		if (lesson["מרצה/מתרגל"]) {
			let staffLines = lesson["מרצה/מתרגל"].split("\n").map((name) => courseManager.getStaffLabel(name));
			if (staffLines.length > 3) {
				const staffLinesCount = staffLines.length;
				staffLines = staffLines.slice(0, 2);
				staffLines.push(CheeseI18n.t("calendar.moreStaff", { count: staffLinesCount - 2 }));
			}
			title += `\n${staffLines.join("\n")}`;
		}
		title += `\n${courseManager.getCourseName(course)}`;
		return {
			id: eventId,
			title,
			start: eventStartEnd.start,
			end: eventStartEnd.end,
			backgroundColor: courseCalendar.colorGenerator(course, null, layerId),
			textColor: courseCalendar.textColorGenerator(course, null, layerId),
			borderColor: "white",
			className: `${courseClassName} ${courseClassName}-type-${lessonType} ${courseClassName}-lesson-${lesson["מס."]}`,
			courseNumber: course,
			layerId,
			lessonData: lesson,
			selected: false,
			temporary: false
		};
	}
	function initCreateCourseEvents(courseCalendar, course, layerId) {
		const schedule = courseCalendar.courseManager.getSchedule(course);
		if (schedule.length === 0) return [];
		const lessonsAdded = {};
		const events = [];
		for (const lesson of schedule) {
			if (lessonsAdded[lesson["מס."]] && lessonsAdded[lesson["מס."]] !== lesson["קבוצה"]) continue;
			events.push(makeLessonEvent(courseCalendar, course, lesson, layerId));
			lessonsAdded[lesson["מס."]] = lesson["קבוצה"];
		}
		return events;
	}
	function makeCustomEvent(courseCalendar, eventId, eventTitle, start, end, layerId) {
		return {
			id: eventId,
			className: `custom-event${/^custom_event_\d+$/.test(eventId) ? ` calendar-item-${eventId}` : ""}`,
			title: eventTitle,
			start,
			end,
			backgroundColor: courseCalendar.colorGenerator(eventTitle, eventId),
			textColor: courseCalendar.textColorGenerator(eventTitle, eventId),
			borderColor: "white",
			editable: !courseCalendar.readonly,
			constraint: {
				start: "2017-01-01T00:00:00",
				end: "2017-01-07T24:00:00"
			},
			courseNumber: null,
			layerId,
			lessonData: null,
			selected: true,
			temporary: false
		};
	}
	// src/components/course-calendar/touch-scaling.ts
	function initTouchScalingSupport(courseCalendar) {
		const calendar = courseCalendar.element;
		let gridSlotHeight = 1.5;
		let scaling = false;
		let verticalCenter = 0;
		let pendingAnimationRequest = null;
		let renderRequired = false;
		let previousDist = 0;
		calendar.get(0).addEventListener("touchstart", (event) => {
			const target = event.target;
			target.addEventListener("touchmove", onTouchMove, { passive: true });
			target.addEventListener("touchend", onTouchEnd, { passive: true });
			target.addEventListener("touchcancel", onTouchEnd, { passive: true });
			if (!scaling && event.touches.length >= 2) {
				scaling = true;
				verticalCenter = getVerticalCenter(event.touches);
				previousDist = Math.hypot(event.touches[0].pageX - event.touches[1].pageX, event.touches[0].pageY - event.touches[1].pageY);
				pendingAnimationRequest = window.requestAnimationFrame(renderNewSlotHeight);
			} else if (scaling && event.touches.length < 2) {
				scaling = false;
				endScaling();
			}
		}, { passive: true });
		function onTouchMove(event) {
			if (scaling && event.touches.length >= 2) {
				const dist = Math.hypot(event.touches[0].pageX - event.touches[1].pageX, event.touches[0].pageY - event.touches[1].pageY);
				scaleGridSlotHeight(dist / previousDist);
				previousDist = dist;
			}
		}
		function onTouchEnd(event) {
			if (scaling) {
				if (event.type === "touchcancel" || event.touches.length < 2) {
					scaling = false;
					endScaling();
				}
			}
			let targetStillTouched = false;
			for (const touch of Array.from(event.touches)) if (touch.target === event.target) {
				targetStillTouched = true;
				break;
			}
			if (!targetStillTouched) {
				const target = event.target;
				target.removeEventListener("touchmove", onTouchMove);
				target.removeEventListener("touchend", onTouchEnd);
				target.removeEventListener("touchcancel", onTouchEnd);
			}
		}
		function endScaling() {
			if (pendingAnimationRequest !== null) {
				window.cancelAnimationFrame(pendingAnimationRequest);
				renderNewSlotHeight();
			}
		}
		function scaleGridSlotHeight(scale) {
			const prevHeight = gridSlotHeight;
			gridSlotHeight *= scale;
			if (gridSlotHeight < 1.5) gridSlotHeight = 1.5;
			else if (gridSlotHeight > 4.5) gridSlotHeight = 4.5;
			if (gridSlotHeight !== prevHeight) renderRequired = true;
		}
		function renderNewSlotHeight() {
			if (renderRequired) {
				const timeGrid = calendar.find(".fc-time-grid");
				const heightBefore = timeGrid.height();
				calendar.find(".fc-time-grid .fc-slats td").css("height", `${gridSlotHeight}em`);
				calendar.fullCalendar("render");
				calendar.fullCalendar("rerenderEvents");
				const heightAfter = timeGrid.height();
				$(window).scrollTop($(window).scrollTop() + (heightAfter - heightBefore) * verticalCenter);
				renderRequired = false;
			}
			if (scaling) pendingAnimationRequest = window.requestAnimationFrame(renderNewSlotHeight);
			else pendingAnimationRequest = null;
		}
		function getVerticalCenter(touches) {
			const timeGrid = calendar.find(".fc-time-grid");
			const top = timeGrid.offset().top;
			const height = timeGrid.height();
			let centerYRelative = ((touches[0].pageY + touches[1].pageY) / 2 - top) / height;
			if (centerYRelative < 0) centerYRelative = 0;
			else if (centerYRelative > 1) centerYRelative = 1;
			return centerYRelative;
		}
	}
	function updateDynamicSizes(courseCalendar) {
		const calendar = courseCalendar.element;
		let css = "";
		const el1 = $(".fc-time-grid .fc-slats td", calendar)[0];
		if (el1) {
			const fontSize1 = window.getComputedStyle(el1).getPropertyValue("font-size");
			css += `.course-calendar .fc-time-grid .fc-slats td { font-size: ${fontSize1}; }`;
		}
		const el2 = $(".fc-event", calendar)[0];
		if (el2) {
			const fontSize2 = window.getComputedStyle(el2).getPropertyValue("font-size");
			css += `.course-calendar .fc-event { font-size: ${fontSize2}; }`;
		} else courseCalendar.printStyleHackWaitingForEvent = true;
		if (css) {
			css = `@media print { ${css} }`;
			let styleElement = courseCalendar.printStyleHackStyleElement;
			if (!styleElement) {
				styleElement = document.createElement("style");
				document.head.appendChild(styleElement);
				courseCalendar.printStyleHackStyleElement = styleElement;
			}
			styleElement.textContent = css;
		}
	}
	// src/components/course-calendar/templates/color-button.html?cheesefork-template
	var color_button_default = "<div class=\"calendar-item-color-button\" title=\"{{t:calendar.chooseColor}}\"><i class=\"fas fa-palette\"></i></div>\n";
	// src/components/course-calendar/interactions.ts
	function initSelectLesson(events, courseNumber, lessonType, lessonNumber, layerId) {
		let selected = false;
		const conflictedIds = {};
		if (lessonNumber !== "-") events.forEach((cbEvent) => {
			if (calendarWeek(cbEvent.start) === 1 && !cbEvent.selected && isSameCourse(cbEvent, courseNumber, layerId) && getEventLessonType(cbEvent) === lessonType && cbEvent.lessonData["מס."] === lessonNumber) {
				cbEvent.selected = true;
				selected = true;
				markConflictedEvents(cbEvent);
			}
		});
		else selected = true;
		if (selected) events.forEach((cbEvent) => {
			if (isSameCourse(cbEvent, courseNumber, layerId) && getEventLessonType(cbEvent) === lessonType && cbEvent.lessonData["מס."] !== lessonNumber) {
				cbEvent.start.add(7, "days");
				cbEvent.end.add(7, "days");
				if (lessonNumber === "-") cbEvent.lessonTypeHidden = true;
			}
			if (conflictedIds[cbEvent.id]) {
				const weeks = conflictedIds[cbEvent.id];
				cbEvent.start.add(7 * weeks, "days");
				cbEvent.end.add(7 * weeks, "days");
			}
		});
		function markConflictedEvents(event) {
			events.forEach((cbEvent) => {
				if (cbEvent.layerId !== event.layerId) return;
				if (cbEvent.courseNumber === event.courseNumber && getEventLessonType(cbEvent) === getEventLessonType(event)) return;
				if (areEventsOverlapping(cbEvent, event)) {
					if (!conflictedIds[cbEvent.id]) conflictedIds[cbEvent.id] = 0;
					conflictedIds[cbEvent.id]++;
				}
			});
		}
	}
	function onSelect(start, end) {
		const that = this;
		const calendar = that.element;
		BootstrapDialog.show({
			title: CheeseI18n.t("calendar.addCustomEvent"),
			message: $("<textarea>", {
				class: "form-control",
				placeholder: CheeseI18n.t("calendar.eventDescription"),
				"aria-label": CheeseI18n.t("calendar.eventDescription"),
				dir: "auto"
			}),
			onshown(dialog) {
				dialog.getModalBody().find("textarea").focus();
			},
			onhide(dialog) {
				calendar.fullCalendar("unselect");
			},
			buttons: [{
				label: CheeseI18n.t("calendar.add"),
				cssClass: "btn-primary",
				action(dialog) {
					dialog.close();
					const eventTitle = String(dialog.getModalBody().find("textarea").val()).trim();
					if (eventTitle === "") return;
					let eventIdCounter = Math.round(Date.now() / 1e3);
					let eventId = `custom_event_${eventIdCounter}`;
					while (calendar.fullCalendar("clientEvents", eventId).length > 0) {
						eventIdCounter++;
						eventId = `custom_event_${eventIdCounter}`;
					}
					const layerId = that.getActiveLayerId ? that.getActiveLayerId() : "";
					calendar.fullCalendar("renderEvent", makeCustomEvent(that, eventId, eventTitle, start, end, layerId));
					updateCalendarMaxDayAndTime(calendar);
					that.onCustomEventAdded(eventIdCounter, {
						title: eventTitle,
						start: start.format(),
						end: end.format()
					}, layerId);
				}
			}]
		});
	}
	function onDayClick(date, jsEvent) {
		if (this.readonly || !jsEvent || !jsEvent.type.startsWith("touch")) return;
		jsEvent.preventDefault();
		const calendar = this.element;
		setTimeout(() => {
			if (calendar.fullCalendar("getView").isSelected) return;
			const slotDuration = moment.duration(calendar.fullCalendar("option", "slotDuration") || "00:30:00");
			calendar.fullCalendar("select", date, date.clone().add(slotDuration));
		}, 0);
	}
	function onEventInteractionStart() {
		this.eventInteractionActive = true;
	}
	function onEventInteractionStop() {
		const that = this;
		that.eventInteractionActive = false;
		setTimeout(() => {
			if (!that.eventInteractionActive) updateCalendarMaxDayAndTime(that.element);
		}, 0);
	}
	function onCustomEventMoveResize(event) {
		const that = this;
		const calendar = that.element;
		updateCalendarMaxDayAndTime(calendar);
		that.onCustomEventUpdated(event.id.replace(/^custom_event_/, ""), {
			title: event.title,
			start: event.start.format(),
			end: event.end.format()
		}, event.layerId);
	}
	function onEventClick(event, jsEvent) {
		if (this.readonly) return;
		const that = this;
		const calendar = that.element;
		if (isLessonEvent(event) && $(jsEvent.target).hasClass("calendar-item-unselected-hide-button") && $(jsEvent.target).is(":hover")) {
			gtag("event", "calendar-hide-click");
			const courseTitle = that.courseManager.getTitle(event.courseNumber);
			const lesson = event.lessonData;
			const lessonType = that.courseManager.getLessonTypeLabel(that.courseManager.getLessonType(lesson));
			const title = $("<span>").text(CheeseI18n.t("calendar.hideTypeTitle", { type: lessonType }));
			const message = $("<div>").text(CheeseI18n.t("calendar.hideTypeMessage", {
				type: lessonType,
				course: courseTitle
			}));
			BootstrapDialog.show({
				title,
				message,
				buttons: [{
					label: CheeseI18n.t("calendar.hide"),
					cssClass: "btn-primary",
					action(dialog) {
						gtag("event", "calendar-hide-proceed");
						dialog.close();
						const targetLessonTypeEvents = calendar.fullCalendar("clientEvents", (cbEvent) => isSameCourse(cbEvent, event.courseNumber, event.layerId) && getEventLessonType(cbEvent) === getEventLessonType(event));
						targetLessonTypeEvents.forEach((cbEvent) => {
							cbEvent.start.add(7, "days");
							cbEvent.end.add(7, "days");
							cbEvent.lessonTypeHidden = true;
						});
						updateLessonEvents(calendar, targetLessonTypeEvents);
						updateCalendarMaxDayAndTime(calendar);
						that.onLessonSelected(event.courseNumber, "-", getEventLessonType(event), event.layerId);
						const lessonTypesHidden = getCourseHiddenLessonTypes(calendar, event.courseNumber, that.courseManager, event.layerId);
						that.onLessonTypesHidden(event.courseNumber, lessonTypesHidden, event.layerId);
					}
				}, {
					label: CheeseI18n.t("calendar.close"),
					action(dialog) {
						dialog.close();
					}
				}]
			});
			return;
		}
		const colorButton = $(jsEvent.target).closest(".calendar-item-color-button");
		if (colorButton.length > 0 && colorButton.is(":hover")) {
			gtag("event", "calendar-color-click");
			if (event.courseNumber !== null) that.onColorPickerClick(event.courseNumber, null, event.layerId);
			else that.onColorPickerClick(null, event.id);
			return;
		}
		if (!isLessonEvent(event)) {
			BootstrapDialog.show({
				title: CheeseI18n.t("calendar.editCustomEvent"),
				message: $("<textarea>", {
					class: "form-control",
					placeholder: CheeseI18n.t("calendar.eventDescription"),
					"aria-label": CheeseI18n.t("calendar.eventDescription"),
					dir: "auto"
				}).val(event.title),
				onshown(dialog) {
					dialog.getModalBody().find("textarea").focus();
				},
				buttons: [{
					label: CheeseI18n.t("calendar.edit"),
					cssClass: "btn-primary",
					action(dialog) {
						dialog.close();
						const eventTitle = String(dialog.getModalBody().find("textarea").val()).trim();
						if (eventTitle === "") return;
						event.title = eventTitle;
						event.backgroundColor = that.colorGenerator(eventTitle, event.id);
						event.textColor = that.textColorGenerator(eventTitle, event.id);
						calendar.fullCalendar("updateEvent", event);
						that.onCustomEventUpdated(event.id.replace(/^custom_event_/, ""), {
							title: eventTitle,
							start: event.start.format(),
							end: event.end.format()
						}, event.layerId);
					}
				}, {
					label: CheeseI18n.t("calendar.remove"),
					action(dialog) {
						dialog.close();
						calendar.fullCalendar("removeEvents", event.id);
						updateCalendarMaxDayAndTime(calendar);
						that.onCustomEventRemoved(event.id.replace(/^custom_event_/, ""), event.layerId);
					}
				}]
			});
			return;
		}
		const selectingEvent = !event.selected;
		const conflictedCourses = {};
		event.selected = selectingEvent;
		updateLessonEvent(calendar, event);
		const sameLessonTypeEvents = calendar.fullCalendar("clientEvents", (cbEvent) => {
			if (isSameCourse(cbEvent, event.courseNumber, event.layerId) && getEventLessonType(cbEvent) === getEventLessonType(event)) {
				if (cbEvent.lessonData["מס."] === event.lessonData["מס."]) {
					handleConflictedEvents(cbEvent);
					return false;
				} else return true;
			}
			return false;
		});
		sameLessonTypeEvents.forEach((cbEvent) => {
			cbEvent.start.add(selectingEvent ? 7 : -7, "days");
			cbEvent.end.add(selectingEvent ? 7 : -7, "days");
		});
		updateLessonEvents(calendar, sameLessonTypeEvents);
		updateCalendarMaxDayAndTime(calendar);
		Object.keys(conflictedCourses).forEach((conflictedCourse) => {
			const conflicted = getCourseConflictedStatus(calendar, conflictedCourse, event.layerId);
			that.onCourseConflictedStatusChanged(conflictedCourse, conflicted, event.layerId);
		});
		if (selectingEvent) that.onLessonSelected(event.courseNumber, event.lessonData["מס."], getEventLessonType(event), event.layerId);
		else that.onLessonUnselected(event.courseNumber, event.lessonData["מס."], getEventLessonType(event), event.layerId);
		function handleConflictedEvents(event) {
			const conflictedIds = {};
			const conflictedEvents = calendar.fullCalendar("clientEvents", (cbEvent) => {
				if (!isLessonEvent(cbEvent) || cbEvent.layerId !== event.layerId) return false;
				if (cbEvent.courseNumber === event.courseNumber && getEventLessonType(cbEvent) === getEventLessonType(event)) return false;
				if (areEventsOverlapping(cbEvent, event)) {
					if (!conflictedIds[cbEvent.id]) {
						conflictedIds[cbEvent.id] = 1;
						return true;
					}
					conflictedIds[cbEvent.id]++;
					return false;
				}
				return false;
			});
			for (let i = 0; i < conflictedEvents.length; i++) {
				const weeks = conflictedIds[conflictedEvents[i].id];
				conflictedEvents[i].start.add((selectingEvent ? 7 : -7) * weeks, "days");
				conflictedEvents[i].end.add((selectingEvent ? 7 : -7) * weeks, "days");
				conflictedCourses[conflictedEvents[i].courseNumber] = true;
			}
			updateLessonEvents(calendar, conflictedEvents);
		}
	}
	function onEventMouseover(event) {
		if (!isLessonEvent(event)) return;
		const courseClassName = getCourseClassName(event.courseNumber, event.layerId);
		$(`.${courseClassName}`, this.element).addClass("calendar-item-same-course-as-hovered");
		$(`.${courseClassName}-type-${getEventLessonType(event)}`, this.element).addClass("calendar-item-same-type-as-hovered");
		this.onCourseHoverIn(event.courseNumber, event.layerId);
	}
	function onEventMouseout(event) {
		if (!isLessonEvent(event)) return;
		const courseClassName = getCourseClassName(event.courseNumber, event.layerId);
		$(`.${courseClassName}`, this.element).removeClass("calendar-item-same-course-as-hovered");
		$(`.${courseClassName}-type-${getEventLessonType(event)}`, this.element).removeClass("calendar-item-same-type-as-hovered");
		this.onCourseHoverOut(event.courseNumber, event.layerId);
	}
	function afterEventRender(event, element) {
		const that = this;
		if (that.printStyleHackWaitingForEvent) {
			updateDynamicSizes(that);
			that.printStyleHackWaitingForEvent = false;
		}
		if (event.selected) element.addClass("calendar-item-selected");
		else {
			element.addClass("calendar-item-unselected");
			if (isLessonEvent(event)) {
				const courseClassName = getCourseClassName(event.courseNumber, event.layerId);
				if ($(`.${courseClassName}-type-${getEventLessonType(event)}`, this.element).not(`.${courseClassName}-lesson-${event.lessonData["מס."]}`).length === 0) element.addClass("calendar-item-last-choice");
				if (!this.readonly && !event.temporary) element.append($("<div>", {
					class: "calendar-item-unselected-hide-button",
					text: CheeseI18n.t("calendar.hide")
				}));
			}
		}
		if (!this.readonly && !event.temporary) element.append($(render(color_button_default)));
	}
	function getColumnFormat(element) {
		return CheeseI18n.getLocale() === "en" && element.width() < 700 ? "ddd" : "dddd";
	}
	function onWindowResize() {
		const that = this;
		const format = getColumnFormat(that.element);
		if (that.element.fullCalendar("option", "columnFormat") !== format) that.element.fullCalendar("option", "columnFormat", format);
		updateDynamicSizes(that);
	}
	// src/components/course-calendar/course-calendar.ts
	var CourseCalendar = class {
		static getLessonTypeKey(courseNumber, lesson) {
			return getLessonType(courseNumber, lesson);
		}
		constructor(element, options) {
			this.eventInteractionActive = false;
			this.printStyleHackWaitingForEvent = false;
			this.printStyleHackStyleElement = null;
			this.element = element;
			this.courseManager = options.courseManager;
			this.colorGenerator = options.colorGenerator;
			this.textColorGenerator = options.textColorGenerator || (() => "white");
			this.readonly = options.readonly;
			this.onCourseHoverIn = options.onCourseHoverIn;
			this.onCourseHoverOut = options.onCourseHoverOut;
			this.onCourseConflictedStatusChanged = options.onCourseConflictedStatusChanged;
			this.onLessonTypesHidden = options.onLessonTypesHidden;
			this.onLessonSelected = options.onLessonSelected;
			this.onLessonUnselected = options.onLessonUnselected;
			this.onCustomEventAdded = options.onCustomEventAdded;
			this.onCustomEventUpdated = options.onCustomEventUpdated;
			this.onCustomEventRemoved = options.onCustomEventRemoved;
			this.onColorPickerClick = options.onColorPickerClick;
			this.getActiveLayerId = options.getActiveLayerId;
			const that = this;
			element.addClass("course-calendar").fullCalendar({
				defaultDate: "2017-01-01",
				defaultView: "agendaWeek",
				header: false,
				allDaySlot: false,
				minTime: "08:30:00",
				maxTime: "18:30:00",
				height: "auto",
				contentHeight: "auto",
				columnFormat: getColumnFormat(element),
				slotLabelFormat: "HH:mm",
				locale: CheeseI18n.getLocale(),
				isRTL: CheeseI18n.isRTL(),
				firstDay: 0,
				slotEventOverlap: false,
				displayEventTime: false,
				selectable: !that.readonly,
				selectHelper: true,
				selectOverlap: true,
				select: onSelect.bind(that),
				dayClick: onDayClick.bind(that),
				eventDragStart: onEventInteractionStart.bind(that),
				eventDragStop: onEventInteractionStop.bind(that),
				eventResizeStart: onEventInteractionStart.bind(that),
				eventResizeStop: onEventInteractionStop.bind(that),
				eventDrop: onCustomEventMoveResize.bind(that),
				eventResize: onCustomEventMoveResize.bind(that),
				eventClick: onEventClick.bind(that),
				eventMouseover: onEventMouseover.bind(that),
				eventMouseout: onEventMouseout.bind(that),
				eventAfterRender: afterEventRender.bind(that),
				windowResize: onWindowResize.bind(that)
			}).fullCalendar("option", { hiddenDays: [5, 6] });
			element.on("mouseleave", () => {
				if (that.eventInteractionActive) return;
				updateCalendarMaxDayAndTime(element, true);
			});
			initTouchScalingSupport(that);
			updateDynamicSizes(that);
		}
		addCourse(course, layerId) {
			const that = this;
			layerId = layerId || "";
			const schedule = that.courseManager.getSchedule(course);
			if (schedule.length === 0) return;
			const calendar = that.element;
			const lessonsAdded = {};
			const events = [];
			const conflictedIds = {};
			for (const lesson of schedule) {
				if (lessonsAdded[lesson["מס."]] && lessonsAdded[lesson["מס."]] !== lesson["קבוצה"]) continue;
				const event = makeLessonEvent(that, course, lesson, layerId);
				const conflictCount = countEventConflicts(event);
				if (conflictCount > 0) {
					if (!conflictedIds[event.id]) conflictedIds[event.id] = 0;
					conflictedIds[event.id] += conflictCount;
				}
				events.push(event);
				lessonsAdded[lesson["מס."]] = lesson["קבוצה"];
			}
			for (const event of events) if (conflictedIds[event.id]) {
				const weeks = conflictedIds[event.id];
				event.start.add(7 * weeks, "days");
				event.end.add(7 * weeks, "days");
			}
			calendar.fullCalendar("renderEvents", events);
			if (Object.keys(conflictedIds).length > 0 && getCourseConflictedStatus(calendar, course, layerId)) that.onCourseConflictedStatusChanged(course, true, layerId);
			updateCalendarMaxDayAndTime(calendar);
			function countEventConflicts(event) {
				let count = 0;
				calendar.fullCalendar("clientEvents", (cbEvent) => {
					if (cbEvent.courseNumber !== null && cbEvent.layerId === layerId && cbEvent.selected && areEventsOverlapping(cbEvent, event)) count++;
					return false;
				});
				return count;
			}
		}
		removeCourse(course, layerId) {
			const that = this;
			const calendar = that.element;
			layerId = layerId || "";
			const conflictedIds = {};
			const conflictedEvents = calendar.fullCalendar("clientEvents", (event) => {
				if (event.courseNumber !== null && event.layerId === layerId && event.courseNumber !== course && isConflicted(event, course)) {
					if (!conflictedIds[event.id]) {
						conflictedIds[event.id] = 1;
						return true;
					}
					conflictedIds[event.id]++;
					return false;
				}
				return false;
			});
			const conflictedCourses = {};
			for (const event of conflictedEvents) {
				const weeks = conflictedIds[event.id];
				event.start.add(-7 * weeks, "days");
				event.end.add(-7 * weeks, "days");
				conflictedCourses[event.courseNumber] = true;
			}
			updateLessonEvents(calendar, conflictedEvents);
			calendar.fullCalendar("removeEvents", (event) => isSameCourse(event, course, layerId));
			Object.keys(conflictedCourses).forEach((conflictedCourse) => {
				const conflicted = getCourseConflictedStatus(calendar, conflictedCourse, layerId);
				that.onCourseConflictedStatusChanged(conflictedCourse, conflicted, layerId);
			});
			updateCalendarMaxDayAndTime(calendar);
			function isConflicted(event, course) {
				return calendar.fullCalendar("clientEvents", (cbEvent) => isSameCourse(cbEvent, course, layerId || "") && cbEvent.selected && areEventsOverlapping(cbEvent, event)).length > 0;
			}
		}
		previewCourse(course, layerId) {
			const calendar = this.element;
			layerId = layerId || "";
			const conflictedEvents = calendar.fullCalendar("clientEvents", (event) => isSameCourse(event, course, layerId) && calendarWeek(event.start) > 1);
			const temporaryEvents = [];
			for (const conf of conflictedEvents) {
				const daysToFirstWeek = 7 * (calendarWeek(conf.start) - 1);
				const temp = {
					id: `temp_${conf.id}`,
					title: conf.title,
					start: conf.start.clone().subtract(daysToFirstWeek, "days"),
					end: conf.end.clone().subtract(daysToFirstWeek, "days"),
					backgroundColor: conf.backgroundColor,
					textColor: conf.textColor,
					borderColor: conf.borderColor,
					className: conf.className,
					courseNumber: conf.courseNumber,
					layerId: conf.layerId,
					lessonData: conf.lessonData,
					selected: conf.selected,
					temporary: true
				};
				temporaryEvents.push(temp);
			}
			calendar.fullCalendar("renderEvents", temporaryEvents);
			$(`.${getCourseClassName(course, layerId)}`, this.element).addClass("calendar-item-previewed");
			if (conflictedEvents.length > 0) updateCalendarMaxDayAndTime(calendar);
		}
		unpreviewCourse(course, layerId) {
			const calendar = this.element;
			layerId = layerId || "";
			let removed = 0;
			calendar.fullCalendar("removeEvents", (event) => {
				if (event.temporary && isSameCourse(event, course, layerId)) {
					removed++;
					return true;
				} else return false;
			});
			$(`.${getCourseClassName(course, layerId)}`, this.element).removeClass("calendar-item-previewed");
			if (removed > 0) updateCalendarMaxDayAndTime(calendar);
		}
		setCustomEventHighlighted(eventId, highlighted) {
			if (/^\d+$/.test(eventId)) $(`.calendar-item-custom_event_${eventId}`, this.element).toggleClass("calendar-item-previewed", highlighted);
		}
		loadSavedSchedule(schedule, customEvents, extraLayers) {
			const that = this;
			const calendar = that.element;
			calendar.fullCalendar("removeEvents");
			const layers = [{
				id: "",
				schedule,
				customEvents
			}].concat(extraLayers || []);
			let lessonEvents = [];
			layers.forEach((layer) => {
				Object.keys(layer.schedule).forEach((course) => {
					lessonEvents = lessonEvents.concat(initCreateCourseEvents(that, course, layer.id));
				});
			});
			layers.forEach((layer) => {
				Object.keys(layer.schedule).forEach((course) => {
					const lessons = layer.schedule[course];
					Object.keys(lessons).forEach((lessonType) => {
						const lessonNumber = lessons[lessonType];
						initSelectLesson(lessonEvents, course, lessonType, lessonNumber, layer.id);
					});
				});
			});
			const events = lessonEvents.slice();
			layers.forEach((layer) => {
				Object.keys(layer.customEvents).forEach((eventId) => {
					const eventData = layer.customEvents[eventId];
					const start = calendar.fullCalendar("getCalendar").moment(eventData.start);
					const end = calendar.fullCalendar("getCalendar").moment(eventData.end);
					events.push(makeCustomEvent(that, `custom_event_${eventId}`, eventData.title, start, end, layer.id));
				});
			});
			calendar.fullCalendar("renderEvents", events);
			updateCalendarMaxDayAndTime(calendar);
			layers.forEach((layer) => {
				Object.keys(layer.schedule).forEach((course) => {
					if (getCourseConflictedStatus(calendar, course, layer.id)) that.onCourseConflictedStatusChanged(course, true, layer.id);
					const lessonTypesHidden = getCourseHiddenLessonTypes(calendar, course, that.courseManager, layer.id);
					if (lessonTypesHidden.length > 0) that.onLessonTypesHidden(course, lessonTypesHidden, layer.id);
				});
			});
		}
		updateColors() {
			const that = this;
			const calendar = that.element;
			const lessonEvents = [];
			const customEvents = [];
			calendar.fullCalendar("clientEvents", (event) => {
				const color = event.courseNumber !== null ? that.colorGenerator(event.courseNumber, null, event.layerId) : that.colorGenerator(event.title, event.id);
				const textColor = event.courseNumber !== null ? that.textColorGenerator(event.courseNumber, null, event.layerId) : that.textColorGenerator(event.title, event.id);
				if (event.backgroundColor !== color || event.textColor !== textColor) {
					event.backgroundColor = color;
					event.textColor = textColor;
					(event.courseNumber !== null ? lessonEvents : customEvents).push(event);
				}
				return false;
			});
			updateLessonEvents(calendar, lessonEvents);
			calendar.fullCalendar("updateEvents", customEvents);
		}
		saveAsIcs(icsCal, dateFrom, dateTo, daysOff) {
			const that = this;
			const calendar = that.element;
			const dateFromArray = dateFrom.split("-");
			const dateFromObject = {
				year: parseInt(dateFromArray[0], 10),
				month: parseInt(dateFromArray[1], 10) - 1,
				date: parseInt(dateFromArray[2], 10)
			};
			const rrule = {
				freq: "WEEKLY",
				until: moment.utc(`${dateTo}T00:00:00`).add(1, "days").format()
			};
			const daysOffByDay = {};
			if (daysOff) daysOff.forEach((dateStr) => {
				const parts = dateStr.split("-");
				const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
				const day = d.getDay();
				if (!daysOffByDay[day]) daysOffByDay[day] = [];
				daysOffByDay[day].push(d);
			});
			let count = 0;
			calendar.fullCalendar("clientEvents", (event) => {
				if (calendarWeek(event.start) === 1 && event.selected) {
					let subject = "";
					let description = "";
					let location = "";
					if (isLessonEvent(event)) {
						const lesson = event.lessonData;
						subject = that.courseManager.getLessonTypeAndNumber(lesson);
						subject += ` – ${that.courseManager.getCourseName(event.courseNumber)}`;
						description = "";
						if (lesson["מרצה/מתרגל"]) description = lesson["מרצה/מתרגל"].split("\n").map((name) => that.courseManager.getStaffLabel(name)).join("\n");
						location = "";
						if (lesson["בניין"]) {
							location = that.courseManager.getBuildingLabel(lesson["בניין"]);
							if (lesson["חדר"]) location += ` ${lesson["חדר"]}`;
						}
					} else subject = event.title.replace(/\n/g, ", ");
					const begin = event.start.clone().set(dateFromObject);
					const eventDay = event.start.day();
					if (eventDay < begin.day()) begin.add(7, "days");
					begin.day(eventDay);
					const end = event.end.clone().add(begin.diff(event.start), "milliseconds");
					begin.local();
					end.local();
					icsCal.addEvent(subject, description, location, begin.format(), end.format(), rrule, daysOffByDay[eventDay]);
					count++;
				}
				return false;
			});
			return count;
		}
		removeAll() {
			const calendar = this.element;
			calendar.fullCalendar("removeEvents");
			updateCalendarMaxDayAndTime(calendar);
		}
	};
	// src/components/course-exam-info/templates/tooltip.html?cheesefork-template
	var tooltip_default$1 = "<div class=\"tooltip\" role=\"tooltip\"><div class=\"tooltip-inner\"></div></div>\n";
	// src/components/course-exam-info/course-exam-info.ts
	var CourseExamInfo = class {
		constructor(element, options) {
			this.element = element;
			this.courseManager = options.courseManager;
			this.colorGenerator = options.colorGenerator;
			this.textColorGenerator = options.textColorGenerator || (() => "white");
			this.onHoverIn = options.onHoverIn;
			this.onHoverOut = options.onHoverOut;
		}
		renderCourses(courses) {
			const that = this;
			that.element.find("[data-toggle=\"tooltip\"]").tooltip("dispose");
			const moedASpan = makeExamInfoSpan(1, courses);
			const moedBSpan = makeExamInfoSpan(2, courses);
			if (!moedASpan && !moedBSpan) that.element.empty();
			else {
				that.element.empty().append($("<div>").text(CheeseI18n.t("exams.studyDays")));
				if (moedASpan) that.element.append($("<div>").addClass("exam-info-content").text(CheeseI18n.t("exams.sessionA")).append(moedASpan));
				if (moedBSpan) that.element.append($("<div>").addClass("exam-info-content").text(CheeseI18n.t("exams.sessionB")).append(moedBSpan));
			}
			function makeExamInfoSpan(moed, courses) {
				const moedName = ["מועד א", "מועד ב"][moed - 1];
				const moedDates = {};
				const moedAmounts = {};
				courses.forEach((course) => {
					const general = that.courseManager.getGeneralInfo(course);
					if (general[moedName]) {
						const parsedDate = that.courseManager.parseExamDateTime(general[moedName]);
						if (parsedDate) moedDates[course] = moment.utc(parsedDate.start).locale(CheeseI18n.getLocale());
						if (currentSemester >= "202401") {
							const lines = general[moedName].split("\n").filter((line) => line.trim() !== "");
							moedAmounts[course] = lines.length;
						} else moedAmounts[course] = 1;
					}
				});
				const moedCourses = Object.keys(moedDates);
				if (moedCourses.length === 0) return false;
				moedCourses.sort((leftCourse, rightCourse) => {
					const left = moedDates[leftCourse];
					const right = moedDates[rightCourse];
					const diff = left.diff(right);
					return diff !== 0 ? diff : Number(leftCourse) - Number(rightCourse);
				});
				const spanExamList = $("<span>");
				let prevDaysText = null;
				moedCourses.forEach((course, i) => {
					if (i !== 0) spanExamList.append($("<span class=\"exam-info-left-arrow\">"), " ");
					const daysText = $("<span>").addClass(`exam-info-item exam-info-item-course-${course}`);
					const color = that.colorGenerator(course);
					daysText.css({
						"background-color": color,
						color: that.textColorGenerator(course)
					});
					daysText.hover(function() {
						$(this).addClass("exam-info-item-hovered");
						that.onHoverIn(course);
					}, function() {
						$(this).removeClass("exam-info-item-hovered");
						that.onHoverOut(course);
					});
					const date = moedDates[course].format("DD/MM");
					let dateWithTime = null;
					if (moedDates[course].hour() !== 0) dateWithTime = moedDates[course].format("DD/MM HH:mm");
					let elementText;
					let tooltipText = null;
					if (i === 0) {
						elementText = date;
						if (dateWithTime) tooltipText = dateWithTime;
					} else {
						const left = moedDates[moedCourses[i - 1]].clone().set({
							hour: 0,
							minute: 0,
							second: 0
						});
						const diff = moedDates[course].clone().set({
							hour: 0,
							minute: 0,
							second: 0
						}).diff(left, "days");
						elementText = diff;
						if (diff === 0) {
							daysText.addClass("exam-info-item-conflicted");
							prevDaysText === null || prevDaysText === void 0 || prevDaysText.addClass("exam-info-item-conflicted");
						}
						tooltipText = dateWithTime || date;
					}
					const spanAbsolute = $("<span class=\"content-absolute\">").text(String(elementText));
					const spanBoldHidden = $("<span class=\"content-bold-hidden\">").text(String(elementText));
					daysText.append(spanAbsolute, spanBoldHidden);
					const extraDates = moedAmounts[course] - 1;
					if (extraDates > 0) {
						daysText.addClass("exam-info-item-has-extra-dates");
						tooltipText = tooltipText ? `${tooltipText} ` : "";
						if (extraDates === 1) tooltipText += CheeseI18n.t("exams.extraDate");
						else tooltipText += CheeseI18n.t("exams.extraDates", { count: extraDates });
					}
					if (tooltipText) daysText.prop("title", tooltipText).attr("data-toggle", "tooltip").tooltip({
						placement: moed === 1 ? "top" : "bottom",
						template: tooltip_default$1.trim()
					});
					spanExamList.append(daysText);
					prevDaysText = daysText;
				});
				return spanExamList;
			}
		}
		setHovered(course) {
			$(`.exam-info-item-course-${course}`, this.element).addClass("exam-info-item-hovered");
		}
		removeHovered(course) {
			$(`.exam-info-item-course-${course}`, this.element).removeClass("exam-info-item-hovered");
		}
		setHighlighted(course) {
			$(`.exam-info-item-course-${course}`, this.element).addClass("exam-info-item-highlighted");
		}
		removeHighlighted(course) {
			$(`.exam-info-item-course-${course}`, this.element).removeClass("exam-info-item-highlighted");
		}
	};
	// src/components/course-select/templates/filter-icon.html?cheesefork-template
	var filter_icon_default = "<i class=\"fas fa-sliders-h\"></i>\n";
	// src/components/course-select/templates/tooltip.html?cheesefork-template
	var tooltip_default = "<div class=\"tooltip\" role=\"tooltip\"><div class=\"arrow\"></div><div class=\"tooltip-inner course-description-tooltip-inner\"></div></div>\n";
	// src/components/course-select/course-select.ts
	var CourseSelect = class {
		constructor(element, options) {
			this.element = element;
			this.courseManager = options.courseManager;
			this.onItemAdd = options.onItemAdd;
			this.onDropdownItemActivate = options.onDropdownItemActivate;
			this.onDropdownItemDeactivate = options.onDropdownItemDeactivate;
			this.getSelectedCoursesForFilter = options.getSelectedCoursesForFilter;
			const that = this;
			const courses = that.courseManager.getAllCourses();
			this.allCoursesCount = courses.length;
			this.filteredCoursesCount = courses.length;
			this.filterDialog = null;
			this.courseSelect = element.addClass("course-select").selectize({
				options: makeCourseSelectOptions(courses.sort(), that.courseManager),
				maxOptions: 201,
				render: { option(item) {
					if (item.value === "partial") return $("<div>").addClass("option font-italic").text(CheeseI18n.t("courses.partialList")).get(0);
					const course = item.value;
					const general = that.courseManager.getGeneralInfo(course);
					const courseDescriptionHtml = that.courseManager.getDescription(course, { html: true });
					const courseNumber = $("<abbr>").text(general["מספר מקצוע"]).prop("title", courseDescriptionHtml).attr({
						"data-toggle": "tooltip",
						"data-html": "true",
						"data-placement": "right",
						"data-template": tooltip_default.trim(),
						"data-boundary": "viewport"
					});
					const courseName = that.courseManager.getCourseName(course);
					return $("<div>").addClass("option source-content").attr({
						lang: /[א-ת]/.test(courseName) ? "he" : "en",
						dir: "auto"
					}).append(courseNumber).append(document.createTextNode(` – ${courseName}`)).get(0);
				} },
				onInitialize() {
					addFilterButton(that, this);
				},
				onClear() {
					addFilterButton(that, this);
				},
				onItemAdd(course) {
					if (course === "partial") {} else that.onItemAdd(course);
					this.clear();
				},
				onDropdownItemActivate(course) {
					if (course === "partial") return;
					that.onDropdownItemActivate(course);
				},
				onDropdownItemDeactivate(course) {
					if (course === "partial") return;
					that.onDropdownItemDeactivate(course);
				},
				searchField: [
					"text",
					"catalogName",
					"oldCourseNumber"
				]
			}).data("selectize");
			let optionTooltip = null;
			that.courseSelect.$dropdown.tooltip({ selector: "[data-toggle=tooltip]" }).on("inserted.bs.tooltip", "[data-toggle=tooltip]", function() {
				optionTooltip = {
					element: this,
					tip: $(this).data("bs.tooltip").getTipElement()
				};
			}).on("mousedown click", "[data-toggle=tooltip]", function() {
				$(this).tooltip("hide");
			});
			const disposeOptionTooltip = () => {
				if (optionTooltip) {
					$(optionTooltip.element).tooltip("dispose").removeAttr("aria-describedby");
					$(optionTooltip.tip).remove();
					optionTooltip = null;
				}
			};
			that.courseSelect.on("type", disposeOptionTooltip);
			that.courseSelect.on("dropdown_close", disposeOptionTooltip);
			filterInit(that.courseManager);
		}
		filterOpen() {
			const that = this;
			if (that.filterDialog) {
				that.filterDialog.getModalHeader().trigger("click");
				return;
			}
			gtag("event", "course-select-filter-open");
			const filterForm = $("#filter-form");
			const filterFormParent = filterForm.parent();
			let filterFormOnSubmit;
			showBootstrapDialogWithModelessButton("course-filter", {
				cssClass: "course-filter-dialog",
				title: CheeseI18n.t("filters.title"),
				message: filterForm,
				buttons: [
					{
						label: CheeseI18n.t("filters.apply"),
						cssClass: "btn-primary",
						action(dialog) {
							gtag("event", "course-select-filter-submit");
							that.filterApply();
						}
					},
					{
						label: CheeseI18n.t("filters.reset"),
						action(dialog) {
							gtag("event", "course-select-filter-reset");
							that.filterReset();
						}
					},
					{
						label: CheeseI18n.t("filters.close"),
						action(dialog) {
							dialog.close();
						}
					}
				],
				onshow(dialog) {
					$("<span>", {
						id: "filter-result",
						class: "bootstrap-dialog-message",
						css: { "margin-bottom": ".25rem" }
					}).css(CheeseI18n.isRTL() ? "margin-left" : "margin-right", "auto").prependTo(dialog.getModalFooter());
					filterFormOnSubmit = (event) => {
						event.preventDefault();
						dialog.getModalFooter().find("button.btn-primary").click();
					};
					filterForm.submit(filterFormOnSubmit);
					that.filterDialog = dialog;
				},
				onhidden(dialog) {
					if (filterFormOnSubmit) filterForm.off("submit", filterFormOnSubmit);
					filterFormParent.empty().append(filterForm);
					that.filterDialog = null;
				}
			});
		}
		filterApply() {
			const that = this;
			const filters = {};
			const selectize = (selector) => $(selector).data("selectize");
			const value = (selector) => String($(selector).val());
			const courseNumbers = (selector) => {
				const numbers = value(selector).match(/\d+/g);
				return numbers && numbers.map((num) => that.courseManager.stringToCourseNumber(num)).filter((course) => !!course).map((course) => that.courseManager.toSemesterFormatCourseNumber(course));
			};
			const faculties = selectize("#filter-faculty").items;
			if (faculties.length > 0) filters.faculties = faculties;
			const frameworks = selectize("#filter-framework").items;
			if (frameworks.length > 0) filters.frameworks = frameworks;
			const selectPointsMin = $("#filter-points-min");
			if (selectPointsMin.prop("selectedIndex") > 0) filters.pointsMin = parseFloat(String(selectPointsMin.val()));
			const selectPointsMax = $("#filter-points-max");
			if (selectPointsMax.prop("selectedIndex") < selectPointsMax.find("option").length - 1) filters.pointsMax = parseFloat(String(selectPointsMax.val()));
			const coursesTaken = courseNumbers("#filter-courses-taken-list");
			if (coursesTaken) filters.coursesTaken = coursesTaken;
			filters.filterPrerequisites = $("#filter-prerequisites").prop("checked");
			filters.filterLinkedCourses = $("#filter-linked-courses").prop("checked");
			filters.filterOverlappingCourses = $("#filter-overlapping-courses").prop("checked");
			const selectMoedAMin = $("#filter-moed-a-min");
			if (selectMoedAMin.prop("selectedIndex") > 0) filters.moedAMin = String(selectMoedAMin.val());
			const selectMoedAMax = $("#filter-moed-a-max");
			if (selectMoedAMax.prop("selectedIndex") < selectMoedAMax.find("option").length - 1) filters.moedAMax = String(selectMoedAMax.val());
			const selectMoedBMin = $("#filter-moed-b-min");
			if (selectMoedBMin.prop("selectedIndex") > 0) filters.moedBMin = String(selectMoedBMin.val());
			const selectMoedBMax = $("#filter-moed-b-max");
			if (selectMoedBMax.prop("selectedIndex") < selectMoedBMax.find("option").length - 1) filters.moedBMax = String(selectMoedBMax.val());
			filters.moedADaysMin = parseInt(value("#filter-moed-a-days-min"), 10);
			filters.moedBDaysMin = parseInt(value("#filter-moed-b-days-min"), 10);
			filters.filterWithExam = $("#filter-with-exam").prop("checked");
			filters.filterWithoutExam = $("#filter-without-exam").prop("checked");
			const coursesLimit = courseNumbers("#filter-courses-limit");
			if (coursesLimit) filters.coursesLimit = coursesLimit;
			const coursesExclude = courseNumbers("#filter-courses-exclude");
			if (coursesExclude) filters.coursesExclude = coursesExclude;
			const selectedCourses = that.getSelectedCoursesForFilter();
			if (selectedCourses.length > 0) filters.coursesCurrent = selectedCourses;
			const filtered = that.courseManager.filterCourses(filters);
			this.filteredCoursesCount = filtered.length;
			that.courseSelect.clearOptions();
			that.courseSelect.addOption(makeCourseSelectOptions(filtered.sort(), that.courseManager));
			if (that.filterDialog) that.filterDialog.getModalFooter().find("#filter-result").text(CheeseI18n.t("filters.result", {
				count: that.filteredCoursesCount,
				total: that.allCoursesCount
			}));
			updateFilterButton(that, that.courseSelect);
		}
		filterReset() {
			const that = this;
			$("#filter-form").trigger("reset");
			$("#filter-faculty").data("selectize").clear();
			$("#filter-framework").data("selectize").clear();
			if (that.filteredCoursesCount < that.allCoursesCount) {
				that.courseSelect.clearOptions();
				that.courseSelect.addOption(makeCourseSelectOptions(that.courseManager.getAllCourses().sort(), that.courseManager));
				that.filteredCoursesCount = that.allCoursesCount;
			}
			if (that.filterDialog) that.filterDialog.getModalFooter().find("#filter-result").text("");
			updateFilterButton(that, that.courseSelect);
		}
	};
	function addFilterButton(courseSelect, selectize) {
		let title = CheeseI18n.t("filters.advancedTip");
		let extraClass = "";
		if (courseSelect.filteredCoursesCount < courseSelect.allCoursesCount) {
			title += ` (${courseSelect.filteredCoursesCount}/${courseSelect.allCoursesCount})`;
			extraClass += " course-select-filter-on";
		}
		selectize.$control.append($("<button>", {
			type: "button",
			class: `btn course-select-filter-button${extraClass}`,
			html: filter_icon_default.trim(),
			title,
			"data-toggle": "tooltip",
			"data-placement": "bottom"
		}).tooltip().click(function(e) {
			e.stopPropagation();
			$(this).tooltip("hide");
			courseSelect.filterOpen();
		}).mousedown((e) => {
			e.stopPropagation();
		}).mouseup((e) => {
			e.stopPropagation();
		}));
	}
	function updateFilterButton(courseSelect, selectize) {
		const button = selectize.$control.find("button.course-select-filter-button");
		let title = CheeseI18n.t("filters.advancedTip");
		if (courseSelect.filteredCoursesCount < courseSelect.allCoursesCount) {
			title += ` (${courseSelect.filteredCoursesCount}/${courseSelect.allCoursesCount})`;
			button.addClass("course-select-filter-on");
		} else button.removeClass("course-select-filter-on");
		button.attr("data-original-title", title);
	}
	function makeCourseSelectOptions(courses, courseManager) {
		const items = courses.map((course) => {
			const general = courseManager.getGeneralInfo(course);
			return {
				value: course,
				text: `${course} – ${courseManager.getCourseName(course)}`,
				catalogName: general["שם מקצוע"],
				oldCourseNumber: courseManager.toOldCourseNumber(course)
			};
		});
		if (items.length > 201) items.splice(200, 0, {
			value: "partial",
			text: ""
		});
		return items;
	}
	function filterInit(courseManager) {
		const facultySet = {};
		const frameworkSet = {};
		const pointSet = {};
		const examDates = {
			"מועד א": {},
			"מועד ב": {}
		};
		const currentExamsYear = parseInt(currentSemester.slice(0, 4), 10) + 1;
		courseManager.getAllCourses().forEach((course) => {
			const general = courseManager.getGeneralInfo(course);
			if (general["פקולטה"]) facultySet[general["פקולטה"]] = true;
			if (general["מסגרת לימודים"]) general["מסגרת לימודים"].split("\n").forEach((item) => {
				frameworkSet[item] = true;
			});
			if (general["נקודות"]) pointSet[general["נקודות"]] = true;
			["מועד א", "מועד ב"].forEach((exam) => {
				if (general[exam]) {
					const dateTime = courseManager.parseExamDateTime(general[exam]);
					if (dateTime) {
						const day = moment.utc(dateTime.start).set({
							hour: 0,
							minute: 0,
							second: 0
						});
						const year = day.year();
						if (year === currentExamsYear) {
							if (!examDates[exam].minDay || day.isBefore(examDates[exam].minDay)) examDates[exam].minDay = day;
							if (!examDates[exam].maxDay || day.isAfter(examDates[exam].maxDay)) examDates[exam].maxDay = day;
						} else {
							const anomalyYears = examDates[exam].anomalyYears || {};
							anomalyYears[year] = true;
							examDates[exam].anomalyYears = anomalyYears;
						}
					}
				}
			});
		});
		const faculties = Object.keys(facultySet).sort();
		const selectFaculties = $("#filter-faculty");
		faculties.forEach((faculty) => {
			selectFaculties.append($("<option>", {
				value: faculty,
				text: courseManager.getFacultyLabel(faculty)
			}));
		});
		selectFaculties.selectize();
		const frameworks = Object.keys(frameworkSet).sort();
		const selectFrameworks = $("#filter-framework");
		frameworks.forEach((framework) => {
			selectFrameworks.append($("<option>", {
				value: framework,
				text: courseManager.getFrameworkLabel(framework)
			}));
		});
		selectFrameworks.selectize();
		const selectPointsMin = $("#filter-points-min");
		const selectPointsMax = $("#filter-points-max");
		const points = Object.keys(pointSet).sort((a, b) => parseFloat(a) - parseFloat(b));
		points.forEach((point, i) => {
			selectPointsMin.append($("<option>", {
				value: point,
				text: point,
				selected: i === 0
			}));
			selectPointsMax.append($("<option>", {
				value: point,
				text: point,
				selected: i === points.length - 1
			}));
		});
		[["מועד א", "moed-a"], ["מועד ב", "moed-b"]].forEach((examData) => {
			const exam = examData[0];
			const examId = examData[1];
			const anomalyYears = Object.keys(examDates[exam].anomalyYears || {}).map(Number).sort((a, b) => a - b);
			const minDay = examDates[exam].minDay;
			const maxDay = examDates[exam].maxDay;
			const selectMoedMin = $(`#filter-${examId}-min`);
			const selectMoedMax = $(`#filter-${examId}-max`);
			const addDate = (date) => {
				const dateStrFull = date.format();
				const dateStrShort = date.format("DD/MM");
				selectMoedMin.append($("<option>", {
					value: dateStrFull,
					text: dateStrShort
				}));
				selectMoedMax.append($("<option>", {
					value: dateStrFull,
					text: dateStrShort
				}));
			};
			const addYear = (year) => {
				const yearStart = moment.utc([year]).startOf("year");
				const yearEnd = moment.utc([year]).endOf("year");
				selectMoedMin.append($("<option>", {
					value: yearStart.format(),
					text: year.toString()
				}));
				selectMoedMax.append($("<option>", {
					value: yearEnd.format(),
					text: year.toString()
				}));
			};
			anomalyYears.filter((year) => year < currentExamsYear).forEach((year) => {
				addYear(year);
			});
			if (minDay && maxDay) for (const date = minDay.clone(); !date.isAfter(maxDay); date.add(1, "days")) addDate(date);
			anomalyYears.filter((year) => year > currentExamsYear).forEach((year) => {
				addYear(year);
			});
			selectMoedMax.find("option:last").attr("selected", "selected");
		});
	}
	// src/lib/analytics-links.ts
	function trackMarkedLinks(document) {
		$(document).on("click", "[data-gtag-event]", function() {
			const event = this.getAttribute("data-gtag-event");
			if (event) gtag("event", event);
		});
	}
	// src/lib/templates/course-link.html?cheesefork-template
	var course_link_default = "<a href=\"{{url}}\" target=\"_blank\" rel=\"noopener\" data-gtag-event=\"{{event}}\"><img src=\"{{icon}}\" alt=\"\" width=\"16\" height=\"16\"> {{label}}</a>\n";
	// src/lib/templates/whatsapp-link.html?cheesefork-template
	var whatsapp_link_default = "<a href=\"#\" class=\"whatsapp-group-link\" data-gtag-event=\"{{event}}\"><img src=\"assets/icon-whatsapp.png\" alt=\"\" width=\"16\" height=\"16\"> {{t:courses.links.groups}}</a>\n";
	// src/lib/course-description.ts
	function getDescription(that, course, options) {
		const general = that.coursesHashmap[course].general;
		let header = that.getTitle(course);
		let headerHtml = options.html ? sourceHtml(header) : "";
		let content = "";
		let contentHtml = "";
		function escapeHtml(value) {
			return $("<div>").text(value).html();
		}
		function sourceHtml(value) {
			return $("<span>", {
				class: "source-content",
				lang: /[א-ת]/.test(value) ? "he" : "en",
				dir: "auto",
				text: value
			})[0].outerHTML.replace(/\n/g, "<br>");
		}
		function addHeader(key, value) {
			const label = `${that.getFieldLabel(key)}: `;
			header += `\n${label}${value}`;
			if (options.html) headerHtml += `<br>${escapeHtml(label)}${/[א-ת]/.test(value) ? sourceHtml(value) : escapeHtml(value)}`;
		}
		function addContent(key, value, separator) {
			const label = key ? `${that.getFieldLabel(key)}: ` : "";
			content += separator + label + value;
			if (options.html) contentHtml += separator.replace(/\n/g, "<br>") + escapeHtml(label) + sourceHtml(value);
		}
		if (general["פקולטה"]) {
			const faculty = that.getFacultyLabel(general["פקולטה"]);
			addHeader("פקולטה", faculty === general["פקולטה"] ? that.getEnglishText(course, "faculty") || faculty : faculty);
		}
		if (general["מסגרת לימודים"]) {
			const frameworks = general["מסגרת לימודים"].split("\n");
			const frameworkLabels = frameworks.map((framework) => that.getFrameworkLabel(framework));
			addHeader("מסגרת לימודים", frameworkLabels.some((label, i) => label === frameworks[i]) && that.getEnglishText(course, "level") || frameworkLabels.join(", "));
		}
		if (general["נקודות"]) addHeader("נקודות", general["נקודות"]);
		if (general["סילבוס"]) addContent(null, that.getEnglishText(course, "syllabus") || general["סילבוס"], "\n\n");
		if (options.relatedCourseInfo) [
			"מקצועות קדם",
			"מקצועות צמודים",
			"מקצועות זהים",
			"מקצועות ללא זיכוי נוסף (מוכלים)",
			"מקצועות ללא זיכוי נוסף (מכילים)",
			"מקצועות ללא זיכוי נוסף"
		].forEach((key) => {
			if (general[key]) {
				let value = general[key].replace(/(ו-)\s+/g, "$1").replace(/(\()\s+/g, "$1").replace(/\s+(\))/g, "$1").replace(/\s+/g, " ").trim();
				if (!isCatalogLanguage()) value = value.replace(/(^|[\s(])או(?=$|[\s()])/g, `$1${CheeseI18n.t("courses.expression.or")}`).replace(/(^|[\s(])ו-\s*(?=\d|\()/g, `$1${CheeseI18n.t("courses.expression.and")} `);
				addContent(key, value, "\n\n");
			}
		});
		if (general["אחראים"]) addContent("אחראים", that.getEnglishText(course, "coordinators") || general["אחראים"], "\n\n");
		[[
			"בוחן מועד א",
			"בוחן מועד ב",
			"בוחן מועד ג",
			"בוחן מועד ד",
			"בוחן מועד ה",
			"בוחן מועד ו"
		], [
			"מועד א",
			"מועד ב",
			"מועד ג"
		]].forEach((keys) => {
			let first = true;
			keys.forEach((key) => {
				if (general[key]) {
					let value = general[key].replace(/\n\n/g, "\n========\n");
					if (!isCatalogLanguage()) value = value.split("\n").map((line) => line.replace(/^בתאריך (\d+)\.(\d+)\.(\d+)(?: יום ([א-ו]) משעה (\d+(?::\d+)?) עד השעה (\d+(?::\d+)?))?/, (match, day, month, year, weekday, start, end) => {
						let label = `${day}/${month}/${year}`;
						if (weekday) label += ` ${that.getDayLabel(weekday)} ${start}–${end}`;
						return label;
					})).join("\n");
					addContent(key, value, first ? "\n\n" : "\n");
					first = false;
				}
			});
		});
		if (general["הערות"]) addContent("הערות", that.getEnglishText(course, "notes") || general["הערות"], "\n\n");
		if (!options.html) return header + content;
		let linksHtml = "";
		if (options.links) {
			const link = (event, url, icon, labelKey) => render(course_link_default, {
				url,
				icon,
				label: CheeseI18n.t(labelKey),
				event: options.logging ? event : ""
			});
			if (currentSemester < "202401") linksHtml += `<br><br>${link("info-click-link-rishum", `https://students.technion.ac.il/local/technionsearch/course/${course}`, "assets/icon-students.png", "courses.links.studentPortal")}`;
			else {
				const currentSemesterYear = currentSemester.slice(0, 4);
				const currentSemesterSapSemester = parseInt(currentSemester.slice(4), 10) - 1 + 200;
				const sapLanguage = CheeseI18n.getLocale() === "en" ? "EN" : "HE";
				linksHtml += `<br><br>${link("info-click-link-sap", `https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=${sapLanguage}&sap-ui-language=${sapLanguage}#/details/${currentSemesterYear}/${currentSemesterSapSemester}/SM/${course}`, "assets/icon-sap.png", "courses.links.catalog")}`;
			}
			if (that.isComputerScienceCourse(course)) linksHtml += `<br>${link("info-click-link-webcourse", `https://webcourse.cs.technion.ac.il/${course}/`, "assets/icon-webcourse.png", "courses.links.webcourse")}`;
			linksHtml += `<br>${link("info-click-link-facebook", `https://www.facebook.com/search/groups/?q=${that.toOldCourseNumber(course)}`, "assets/icon-facebook.png", "courses.links.facebook")}`;
			linksHtml += `<br>${link("info-click-link-tscans", `https://scans.cheesefork.cf/?course=${course}`, "assets/icon-scans.png", "courses.links.examScans")}`;
			if (options.whatsappGroupLink) linksHtml += `<br>${render(whatsapp_link_default, { event: options.logging ? "info-click-link-whatsapp" : "" })}`;
		}
		return headerHtml + linksHtml + contentHtml;
	}
	// src/lib/course-filter.ts
	function filterCourses(that, filters) {
		const filtered = [];
		let i;
		const moedAMin = filters.moedAMin ? moment.utc(filters.moedAMin).set({
			hour: 0,
			minute: 0,
			second: 0
		}) : null;
		const moedAMax = filters.moedAMax ? moment.utc(filters.moedAMax).set({
			hour: 0,
			minute: 0,
			second: 0
		}) : null;
		const moedBMin = filters.moedBMin ? moment.utc(filters.moedBMin).set({
			hour: 0,
			minute: 0,
			second: 0
		}) : null;
		const moedBMax = filters.moedBMax ? moment.utc(filters.moedBMax).set({
			hour: 0,
			minute: 0,
			second: 0
		}) : null;
		const currentMoedADates = [];
		if (filters.moedADaysMin && filters.coursesCurrent) filters.coursesCurrent.forEach((course) => {
			const general = that.coursesHashmap[course].general;
			if (general["מועד א"]) {
				const dateTimeA = that.parseExamDateTime(general["מועד א"]);
				if (dateTimeA) {
					const moedA = moment.utc(dateTimeA.start).set({
						hour: 0,
						minute: 0,
						second: 0
					});
					currentMoedADates.push(moedA);
				}
			}
		});
		const currentMoedBDates = [];
		if (filters.moedBDaysMin && filters.coursesCurrent) filters.coursesCurrent.forEach((course) => {
			const general = that.coursesHashmap[course].general;
			if (general["מועד ב"]) {
				const dateTimeB = that.parseExamDateTime(general["מועד ב"]);
				if (dateTimeB) {
					const moedB = moment.utc(dateTimeB.start).set({
						hour: 0,
						minute: 0,
						second: 0
					});
					currentMoedBDates.push(moedB);
				}
			}
		});
		Object.keys(that.coursesHashmap).forEach((course) => {
			const general = that.coursesHashmap[course].general;
			if (filters.coursesLimit && !filters.coursesLimit.includes(course)) return;
			if (filters.coursesExclude && filters.coursesExclude.includes(course)) return;
			if (filters.faculties && general["פקולטה"] && !filters.faculties.includes(general["פקולטה"])) return;
			const frameworks = filters.frameworks;
			if (frameworks && general["מסגרת לימודים"]) {
				if (!general["מסגרת לימודים"].split("\n").some((item) => frameworks.includes(item))) return;
			}
			if (general["נקודות"]) {
				const points = parseFloat(general["נקודות"]);
				if (filters.pointsMin !== void 0 && points < filters.pointsMin) return;
				if (filters.pointsMax !== void 0 && points > filters.pointsMax) return;
			}
			if (filters.filterPrerequisites && general["מקצועות קדם"]) {
				if (!filters.coursesTaken) return;
				const booleanExpression = general["מקצועות קדם"].replace(/\s/g, "").replace(/או/g, " OR ").replace(/ו-/g, " AND ");
				if (!new BooleanExpression(booleanExpression).test(filters.coursesTaken)) return;
			}
			if (filters.filterLinkedCourses && general["מקצועות צמודים"]) {
				if (!filters.coursesTaken && !filters.coursesCurrent) return;
				const linkedCourses = general["מקצועות צמודים"].match(/\d+/g);
				if (linkedCourses) for (i = 0; i < linkedCourses.length; i++) if (filters.coursesTaken && !filters.coursesTaken.includes(linkedCourses[i]) || filters.coursesCurrent && !filters.coursesCurrent.includes(linkedCourses[i])) {} else return;
			}
			if (filters.filterOverlappingCourses && (filters.coursesTaken || filters.coursesCurrent)) {
				if (filters.coursesTaken && filters.coursesTaken.includes(course)) return;
				if (filters.coursesCurrent && filters.coursesCurrent.includes(course)) return;
				let overlappingCourses = [];
				[
					"מקצועות זהים",
					"מקצועות ללא זיכוי נוסף (מוכלים)",
					"מקצועות ללא זיכוי נוסף (מכילים)",
					"מקצועות ללא זיכוי נוסף"
				].forEach((key) => {
					if (general[key]) {
						const overlappingCoursesPart = general[key].match(/\d+/g);
						if (overlappingCoursesPart) overlappingCourses = overlappingCourses.concat(overlappingCoursesPart);
					}
				});
				for (i = 0; i < overlappingCourses.length; i++) {
					if (filters.coursesTaken && filters.coursesTaken.includes(overlappingCourses[i])) return;
					if (filters.coursesCurrent && filters.coursesCurrent.includes(overlappingCourses[i])) return;
				}
			}
			if ((moedAMin || moedAMax || filters.moedADaysMin) && general["מועד א"]) {
				const dateTimeA = that.parseExamDateTime(general["מועד א"]);
				if (dateTimeA) {
					const moedA = moment.utc(dateTimeA.start).set({
						hour: 0,
						minute: 0,
						second: 0
					});
					if (moedAMin && moedA.isBefore(moedAMin) || moedAMax && moedA.isAfter(moedAMax)) return;
					if (filters.moedADaysMin) {
						for (i = 0; i < currentMoedADates.length; i++) if (Math.abs(moedA.diff(currentMoedADates[i], "days")) < filters.moedADaysMin) return;
					}
				}
			}
			if ((moedBMin || moedBMax || filters.moedBDaysMin) && general["מועד ב"]) {
				const dateTimeB = that.parseExamDateTime(general["מועד ב"]);
				if (dateTimeB) {
					const moedB = moment.utc(dateTimeB.start).set({
						hour: 0,
						minute: 0,
						second: 0
					});
					if (moedBMin && moedB.isBefore(moedBMin) || moedBMax && moedB.isAfter(moedBMax)) return;
					if (filters.moedBDaysMin) {
						for (i = 0; i < currentMoedBDates.length; i++) if (Math.abs(moedB.diff(currentMoedBDates[i], "days")) < filters.moedBDaysMin) return;
					}
				}
			}
			if (filters.filterWithExam && (general["מועד א"] || general["מועד ב"])) return;
			if (filters.filterWithoutExam && !general["מועד א"] && !general["מועד ב"]) return;
			filtered.push(course);
		});
		return filtered;
	}
	// src/lib/course-number.ts
	function toNewCourseNumber(course) {
		let match = /^9730(\d\d)$/.exec(course);
		if (match) return `970300${match[1]}`;
		match = /^(\d\d\d)(\d\d\d)$/.exec(course);
		if (match) return `0${match[1]}0${match[2]}`;
		return course;
	}
	// src/lib/course-manager.ts
	function translated(keys, value) {
		return Object.prototype.hasOwnProperty.call(keys, value) ? CheeseI18n.t(keys[value]) : value;
	}
	var CourseManager = class {
		constructor(allCourses, englishCatalog) {
			this.coursesHashmap = {};
			this.coursesScheduleProcessed = {};
			this.englishCatalog = englishCatalog || null;
			allCourses.forEach((item) => {
				this.coursesHashmap[item.general["מספר מקצוע"]] = item;
			});
		}
		doesExist(course) {
			return course in this.coursesHashmap;
		}
		toOldCourseNumber(course) {
			let match = /^970300(\d\d)$/.exec(course);
			if (match) return `9730${match[1]}`;
			if (/^097300\d\d$/.exec(course)) return course;
			match = /^0(\d\d\d)0(\d\d\d)$/.exec(course);
			if (match) return match[1] + match[2];
			return course;
		}
		toNewCourseNumber(course) {
			return toNewCourseNumber(course);
		}
		toSemesterFormatCourseNumber(course) {
			if (currentSemester < "202401") return this.toOldCourseNumber(course);
			else return this.toNewCourseNumber(course);
		}
		isComputerScienceCourse(course) {
			return /^(23\d\d\d\d|023\d\d\d\d\d)$/.test(course);
		}
		stringToCourseNumber(str) {
			if (!str || !/^[0-9]{1,8}$/.test(str)) return null;
			if (str.length <= 6) return `00000${str}`.slice(-6);
			else return `0000000${str}`.slice(-8);
		}
		getAllCourses() {
			return Object.keys(this.coursesHashmap);
		}
		getCourseData(course) {
			if (!this.coursesScheduleProcessed[course]) this.getSchedule(course);
			return this.coursesHashmap[course];
		}
		getGeneralInfo(course) {
			return this.coursesHashmap[course].general;
		}
		getSchedule(course) {
			if (!this.coursesScheduleProcessed[course]) {
				this.coursesHashmap[course].schedule = this.processSchedule(course);
				this.coursesScheduleProcessed[course] = true;
			}
			return this.coursesHashmap[course].schedule;
		}
		processSchedule(course) {
			const general = this.coursesHashmap[course].general;
			let schedule = this.coursesHashmap[course].schedule;
			if (general["הערות"]) {
				let comment = general["הערות"];
				comment = comment.replace(/(^|[^א-ת])(ה?ס)(דנ|ד|נ)(א|ה|אות)($|[^א-ת])/g, "$1$2דנ$4$5");
				comment = comment.replace(/^(סדנת רשות:)\s*(ב?ימי|יום)(\s)/gm, "$1\n$2$3");
				const commentLines = comment.split("\n");
				for (let i = 0; i < commentLines.length; i++) {
					let line = commentLines[i];
					if (line.match(/^(\d+\.\s*)?סדנ(ת|ה|א|אות)[: ]/)) {
						let workshopsTa = "";
						let match = /(?:\n|^)מתרגל[ית]? ה?סדנ(?:א|ה|אות).*?:\s*([\s\S]*?)\s*(?:=|\n\d+\.|$)/.exec(comment);
						if (match) workshopsTa = match[1].replace(/\s+/g, " ").replace(/(\((גם אחראי[תם]?|\d+)\)\s*)+,?/g, ",").replace(/\s*,\s*/g, "\n").trim();
						const workshops = [];
						let workshopId = 101;
						for (i++; i < commentLines.length; i++) {
							line = commentLines[i];
							match = /^ב?(?:ימי|יום) ([א-ת]+)'?,?\s*(\d+)[.:](\d+)-(\d+)[.:](\d+)(?:\s*,\s*(.*?)(?:\s+(\d+))?(?:\s*,\s*(.*?))?)?\.?$/.exec(line);
							if (!match) break;
							const day = {
								ראשון: "ראשון",
								שני: "שני",
								שלישי: "שלישי",
								רביעי: "רביעי",
								חמישי: "חמישי",
								שישי: "שישי",
								א: "ראשון",
								ב: "שני",
								ג: "שלישי",
								ד: "רביעי",
								ה: "חמישי",
								ו: "שישי"
							}[match[1]];
							if (!day) break;
							if (match[6] && !match[7] && match[8] && /^\d+$/.test(match[8])) {
								match[7] = match[8];
								match[8] = "";
							}
							let building = match[6] || "";
							switch (building) {
								case "פ'":
									building = "פישבך";
									break;
								case "מ'": building = "מאייר";
							}
							const startTime = `${match[2]}:${match[3]}`;
							const endTime = `${match[4]}:${match[5]}`;
							let time = `${startTime} - ${endTime}`;
							const timeParsed = this.parseLessonTime(time);
							if (timeParsed && timeParsed.end !== "00:00" && timeParsed.start > timeParsed.end) time = `${endTime} - ${startTime}`;
							workshops.push({
								קבוצה: workshopId,
								"מס.": workshopId,
								סוג: "sadna",
								"מרצה/מתרגל": match[8] || workshopsTa,
								יום: day,
								שעה: time,
								בניין: building,
								חדר: match[7] || ""
							});
							workshopId++;
						}
						if (workshops.length > 0) schedule = schedule.concat(workshops);
						break;
					}
				}
			}
			return schedule;
		}
		getTitle(course) {
			return `${this.coursesHashmap[course].general["מספר מקצוע"]} – ${this.getCourseName(course)}`;
		}
		getEnglishText(course, field) {
			const courses = this.englishCatalog && this.englishCatalog.courses;
			const text = courses && Object.prototype.hasOwnProperty.call(courses, course) && courses[course][field];
			return typeof text === "string" && text !== "" ? text : null;
		}
		getCourseName(course) {
			return this.getEnglishText(course, "name") || this.coursesHashmap[course].general["שם מקצוע"];
		}
		getStaffLabel(name) {
			return englishCatalogLabel(this.englishCatalog, "staff", name);
		}
		getBuildingLabel(building) {
			return englishCatalogLabel(this.englishCatalog, "buildings", building);
		}
		getFieldLabel(key) {
			return translated({
				"מספר מקצוע": "courses.fields.number",
				"שם מקצוע": "courses.fields.name",
				פקולטה: "courses.fields.faculty",
				"מסגרת לימודים": "courses.fields.framework",
				נקודות: "courses.fields.credits",
				סילבוס: "courses.fields.syllabus",
				"מקצועות קדם": "courses.fields.prerequisites",
				"מקצועות צמודים": "courses.fields.corequisites",
				"מקצועות זהים": "courses.fields.equivalentCourses",
				"מקצועות ללא זיכוי נוסף (מוכלים)": "courses.fields.noAdditionalCreditIncluded",
				"מקצועות ללא זיכוי נוסף (מכילים)": "courses.fields.noAdditionalCreditIncluding",
				"מקצועות ללא זיכוי נוסף": "courses.fields.noAdditionalCredit",
				אחראים: "courses.fields.coordinators",
				הערות: "courses.fields.remarks",
				"מרצה/מתרגל": "courses.fields.staff",
				יום: "courses.fields.day",
				שעה: "courses.fields.time",
				בניין: "courses.fields.building",
				חדר: "courses.fields.room",
				קבוצה: "courses.fields.group",
				"מס.": "courses.fields.lessonNumber",
				סוג: "courses.fields.lessonType",
				"אתר הקורס": "courses.fields.website",
				"עבור לסמסטר": "courses.fields.semester",
				מיקום: "courses.fields.location",
				"מועד הבחינה": "courses.fields.examDate",
				הרצאה: "courses.fields.lectureHours",
				תרגיל: "courses.fields.tutorialHours",
				מעבדה: "courses.fields.laboratoryHours",
				"סמינר/פרויקט": "courses.fields.seminarProjectHours",
				"בוחן מועד א": "courses.fields.testSession1",
				"בוחן מועד ב": "courses.fields.testSession2",
				"בוחן מועד ג": "courses.fields.testSession3",
				"בוחן מועד ד": "courses.fields.testSession4",
				"בוחן מועד ה": "courses.fields.testSession5",
				"בוחן מועד ו": "courses.fields.testSession6",
				"מועד א": "courses.fields.examSession1",
				"מועד ב": "courses.fields.examSession2",
				"מועד ג": "courses.fields.examSession3"
			}, key);
		}
		getLessonTypeLabel(value) {
			if (isCatalogLanguage() && value !== "sadna") return value;
			return translated({
				הרצאה: "courses.lessonTypes.lecture",
				תרגול: "courses.lessonTypes.tutorial",
				תרגיל: "courses.lessonTypes.tutorial",
				מעבדה: "courses.lessonTypes.laboratory",
				סמינר: "courses.lessonTypes.seminar",
				פרויקט: "courses.lessonTypes.project",
				"סמינר/פרויקט": "courses.lessonTypes.seminarProject",
				סדנה: "courses.lessonTypes.workshop",
				sadna: "courses.lessonTypes.workshop"
			}, value);
		}
		getDayLabel(value) {
			if (isCatalogLanguage()) return value;
			return translated({
				ראשון: "calendar.days.sunday",
				שני: "calendar.days.monday",
				שלישי: "calendar.days.tuesday",
				רביעי: "calendar.days.wednesday",
				חמישי: "calendar.days.thursday",
				שישי: "calendar.days.friday",
				שבת: "calendar.days.saturday",
				א: "calendar.days.sunday",
				ב: "calendar.days.monday",
				ג: "calendar.days.tuesday",
				ד: "calendar.days.wednesday",
				ה: "calendar.days.thursday",
				ו: "calendar.days.friday",
				ש: "calendar.days.saturday"
			}, value);
		}
		getFacultyLabel(value) {
			if (isCatalogLanguage()) return value;
			return translated({
				"המחלקה ללימודים הומניסטיים ואמנות": "courses.faculties.humanities",
				"הנדסה ימית": "courses.faculties.marineEngineering",
				"הפקולטה לארכיטקטורה ובינוי ערים": "courses.faculties.architecture",
				"הפקולטה לביולוגיה": "courses.faculties.biology",
				"הפקולטה להנדסה אזרחית וסביבתית": "courses.faculties.civilEnvironmental",
				"הפקולטה להנדסה ביו-רפואית": "courses.faculties.biomedical",
				"הפקולטה להנדסה כימית": "courses.faculties.chemical",
				"הפקולטה להנדסת אווירונוטיקה וחלל": "courses.faculties.aerospace",
				"הפקולטה להנדסת ביוטכנולוגיה ומזון": "courses.faculties.biotechnologyFood",
				"הפקולטה להנדסת חשמל ומחשבים": "courses.faculties.electricalComputer",
				"הפקולטה להנדסת מכונות": "courses.faculties.mechanical",
				"הפקולטה לכימיה": "courses.faculties.chemistry",
				"הפקולטה למדע והנדסה של חומרים": "courses.faculties.materials",
				"הפקולטה למדעי המחשב": "courses.faculties.computerScience",
				"הפקולטה למדעי הנתונים וההחלטות": "courses.faculties.dataDecision",
				"הפקולטה למתמטיקה": "courses.faculties.mathematics",
				"הפקולטה לפיזיקה": "courses.faculties.physics",
				"הפקולטה לרפואה": "courses.faculties.medicine",
				"חינוך למדע וטכנולוגיה": "courses.faculties.education",
				"מדע יישומי (ג'ייקובס-קורנל)": "courses.faculties.appliedScience",
				"מערכות אוטונומיות ורובוטיקה": "courses.faculties.autonomousRobotics",
				"מתמטיקה שימושית": "courses.faculties.appliedMathematics",
				"ננו-מדעים וננו-טכנולוגיה": "courses.faculties.nanoscience",
				"תוכנית האנרגיה ע\"ש גרנד": "courses.faculties.energy",
				"הפקולטה להנדסת חשמל": "courses.faculties.electrical",
				"הפקולטה להנדסת תעשייה וניהול": "courses.faculties.industrialManagement",
				"הפקולטה להנדסת חומרים": "courses.faculties.materials",
				"המחלקה לחינוך למדע וטכנולוגיה": "courses.faculties.education"
			}, value);
		}
		getFrameworkLabel(value) {
			if (isCatalogLanguage()) return value;
			return translated({
				"לימודי הסמכה": "courses.frameworks.undergraduate",
				"מקצוע משותף": "courses.frameworks.shared",
				"תארים מתקדמים": "courses.frameworks.graduate"
			}, value);
		}
		getLessonType(lesson) {
			if (lesson["סוג"] === "sadna") return "סדנה";
			return lesson["סוג"];
		}
		getLessonTypeAndNumber(lesson) {
			if (lesson["סוג"] === "sadna") return this.getLessonTypeLabel("sadna");
			return `${this.getLessonTypeLabel(lesson["סוג"])} ${lesson["מס."]}`;
		}
		parseExamDateTime(strDate) {
			let match = /^(\d+)-(\d+)-(\d+)(?:\s+(\d+)(:\d+)\s*-\s*(\d+)(:\d+))?/.exec(strDate);
			if (!match) match = /^בתאריך (\d+)\.(\d+)\.(\d+) (?:יום [א-ו] משעה (\d+)(:\d+)? עד השעה (\d+)(:\d+)?)?/.exec(strDate);
			if (!match) return null;
			const date = `${match[3]}-${match[2]}-${match[1]}`;
			let startHour = "00";
			if (match[4] !== void 0) startHour = `00${match[4]}`.slice(-2);
			let startMinute = "00";
			if (match[5] !== void 0) startMinute = `${match[5]}00`.slice(1, 3);
			const start = `${date}T${startHour}:${startMinute}:00`;
			let endHour = "00";
			if (match[6] !== void 0) endHour = `00${match[6]}`.slice(-2);
			let endMinute = "00";
			if (match[7] !== void 0) endMinute = `${match[7]}00`.slice(1, 3);
			return {
				start,
				end: `${date}T${endHour}:${endMinute}:00`
			};
		}
		parseLessonTime(strTime) {
			const match = /^(\d+)(:\d+)? - (\d+)(:\d+)?$/.exec(strTime);
			if (!match) return null;
			const startHour = `00${match[1]}`.slice(-2);
			let startMinute = "00";
			if (match[2] !== void 0) startMinute = `${match[2]}00`.slice(1, 3);
			const start = `${startHour}:${startMinute}`;
			const endHour = `00${match[3]}`.slice(-2);
			let endMinute = "00";
			if (match[4] !== void 0) endMinute = `${match[4]}00`.slice(1, 3);
			return {
				start,
				end: `${endHour}:${endMinute}`
			};
		}
		getDescription(course, options) {
			return getDescription(this, course, options);
		}
		filterCourses(filters) {
			return filterCourses(this, filters);
		}
	};
	function englishCatalogLabel(englishCatalog, map, value) {
		const labels = englishCatalog && englishCatalog[map];
		return labels && Object.prototype.hasOwnProperty.call(labels, value) ? labels[value] : value;
	}
	function isCatalogLanguage() {
		return CheeseI18n.getLocale() === "he";
	}
	// src/app/state.ts
	var unset = null;
	var state = {
		courseManager: unset,
		colorHash: unset,
		firestoreDb: null,
		firebaseStorage: null,
		viewingSharedSchedule: false,
		previewingFromSelectControl: null,
		previewingFromSelectControlLayerId: "",
		stopScheduleWatching: null,
		currentSavedSession: unset,
		savedSessionLastState: unset,
		savedSessionUndoStack: [],
		savedSessionRedoStack: [],
		metadataDiff: {},
		customColors: {},
		currentLayers: [],
		collapsedLayerIds: {},
		calendarDaysOff: null,
		calendarAutoUpload: {
			uid: null,
			exported: null,
			uploadedFingerprint: null,
			timer: null,
			uploading: false,
			pending: false
		},
		loginDialog: null,
		courseSelect: unset,
		courseButtonList: unset,
		courseExamInfo: unset,
		courseCalendar: unset
	};
	// src/app/templates/save-error.html?cheesefork-template
	var save_error_default = "<div id=\"save-error-alert\" class=\"alert alert-danger save-error-alert\" role=\"alert\">\n    <span class=\"save-error-message\"></span>\n    <button type=\"button\" class=\"btn btn-sm btn-danger save-error-reload\">{{t:shell.error.reload}}</button>\n    <button type=\"button\" class=\"close\" aria-label=\"{{t:shell.dialog.close}}\"><span aria-hidden=\"true\">&times;</span></button>\n</div>\n";
	// src/app/firestore.ts
	function firestoreDb() {
		return state.firestoreDb;
	}
	function firestoreAuthenticatedUserDoc() {
		const user = typeof firebase !== "undefined" ? firebase.auth().currentUser : null;
		if (user !== null) {
			let doc = firestoreDb().collection("users").doc(user.uid);
			if (![
				"201701",
				"201702",
				"201703",
				"201801"
			].includes(currentSemester)) doc = doc.collection("semesters").doc(currentSemester);
			return doc;
		}
		return null;
	}
	function firestoreSave(doc, input) {
		doc.update(input).catch((error) => {
			showSaveError(CheeseI18n.t("shell.error.saveSchedule", { error: error.message || error }));
		});
	}
	function localStorageSaveFailed(error) {
		const failure = error;
		if (failure && (failure.name === "QuotaExceededError" || failure.name === "NS_ERROR_DOM_QUOTA_REACHED" || failure.code === 22 || failure.code === 1014)) showSaveError(CheeseI18n.t("shell.error.saveScheduleLocal"));
	}
	function showSaveError(message) {
		gtag("event", "save-error");
		if ($("#save-error-alert").length > 0) return;
		const notice = $(render(save_error_default));
		notice.find(".save-error-message").text(message);
		notice.find(".save-error-reload").click(() => {
			window.location.reload();
		});
		notice.find(".close").click(() => {
			notice.remove();
		});
		$("body").append(notice);
	}
	function firestoreUserDoc(userId) {
		let doc = firestoreDb().collection("users").doc(userId);
		if (![
			"201701",
			"201702",
			"201703",
			"201801"
		].includes(currentSemester)) doc = doc.collection("semesters").doc(currentSemester);
		return doc;
	}
	function firestoreDisplayNameDecode(displayName) {
		return displayName.replace("&#39;", "'");
	}
	// src/lib/ics-text.ts
	var MAX_LINE_OCTETS = 75;
	function escapeText(text) {
		return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
	}
	function utf8Length(codePoint) {
		if (codePoint < 128) return 1;
		else if (codePoint < 2048) return 2;
		else if (codePoint < 65536) return 3;
		return 4;
	}
	function foldLine(line) {
		let result = "";
		let octets = 0;
		let i = 0;
		while (i < line.length) {
			let codePoint = line.charCodeAt(i);
			let char = line.charAt(i);
			if (codePoint >= 55296 && codePoint <= 56319 && i + 1 < line.length) {
				char = line.substr(i, 2);
				codePoint = 65536;
			}
			const length = utf8Length(codePoint);
			if (octets + length > MAX_LINE_OCTETS) {
				result += "\r\n ";
				octets = 1;
			}
			result += char;
			octets += length;
			i += char.length;
		}
		return result;
	}
	function fixCalendarText(calendar) {
		return calendar.split("\r\n").filter((line) => line !== "").map((line) => foldLine(line.replace(/^SUMMARY;LANGUAGE=en-us:/, "SUMMARY:"))).join("\r\n");
	}
	function wrap(calendar) {
		return {
			addEvent(subject, description, location, begin, stop, rrule, exdates) {
				return calendar.addEvent(escapeText(subject), escapeText(description), escapeText(location), begin, stop, rrule, exdates);
			},
			build(allowEmpty) {
				const text = allowEmpty ? calendar.calendar() : calendar.build();
				return text ? fixCalendarText(text) : text;
			},
			download(filename) {
				const text = this.build();
				if (!text) return false;
				saveAs(new Blob([text], { type: "text/calendar;charset=utf-8" }), `${filename}.ics`);
				return text;
			}
		};
	}
	var IcsText = {
		escapeText,
		foldLine,
		fixCalendarText,
		wrap
	};
	// src/app/constants.ts
	var COLLAPSED_LAYERS_STORAGE_KEY = "collapsedLayers";
	var CALENDAR_AUTO_UPLOAD_DELAY_MS = 5e3;
	var DARK_TEXT_COLOR = "#212529";
	// src/app/util.ts
	function copyToClipboard(text, onSuccess, onFailure) {
		if (!navigator.clipboard) {
			fallbackCopyTextToClipboard(text);
			return;
		}
		navigator.clipboard.writeText(text).then(() => {
			onSuccess();
		}, (err) => {
			onFailure();
		});
		function fallbackCopyTextToClipboard(text) {
			const textArea = document.createElement("textarea");
			textArea.value = text;
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			let successful = false;
			try {
				successful = document.execCommand("copy");
			} catch (err) {}
			document.body.removeChild(textArea);
			if (successful) onSuccess();
			else onFailure();
		}
	}
	function setPageTitle(title) {
		$("title").removeAttr("data-i18n");
		document.title = title;
	}
	function escapeHtml(text) {
		return $("<div>").text(text).html().replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	}
	function sourceText(text, element) {
		return $(element || "<span>").addClass("source-content").attr({
			lang: /[\u0590-\u05ff]/.test(String(text)) ? "he" : "en",
			dir: "auto"
		}).text(text);
	}
	function metadataDisplayValue(key, value) {
		if (key === "יום") return state.courseManager.getDayLabel(String(value));
		if (key === "פקולטה") return state.courseManager.getFacultyLabel(String(value));
		if (key === "מסגרת לימודים") return String(value).split("\n").map((framework) => state.courseManager.getFrameworkLabel(framework)).join("\n");
		return value;
	}
	function lessonDisplayTime(lesson) {
		if (!lesson["יום"]) return null;
		return CheeseI18n.t("shell.crawler.day", { day: state.courseManager.getDayLabel(lesson["יום"]) }) + (lesson["שעה"] ? ` ${lesson["שעה"]}` : "");
	}
	function shellUrl(updates) {
		const anchor = document.createElement("a");
		anchor.href = window.location.href;
		let parameters = anchor.search ? anchor.search.slice(1).split("&") : [];
		Object.keys(updates).forEach((name) => {
			parameters = parameters.filter((parameter) => {
				let parameterName = parameter.split("=")[0].replace(/\+/g, " ");
				try {
					parameterName = decodeURIComponent(parameterName);
				} catch (error) {
					return true;
				}
				return parameterName !== name;
			});
			if (updates[name] !== null) parameters.push(`${encodeURIComponent(name)}=${encodeURIComponent(updates[name])}`);
		});
		anchor.search = parameters.length ? `?${parameters.join("&")}` : "";
		return CheeseI18n.withLocale(anchor.href);
	}
	function crawlerUrl(updates) {
		return shellUrl($.extend({
			semester: currentSemester,
			course: null,
			staff: null,
			room: null
		}, updates));
	}
	function getScrollBarWidth() {
		const $outer = $("<div>").css({
			visibility: "hidden",
			width: 100,
			overflow: "scroll"
		}).appendTo("body");
		const widthWithScroll = $("<div>").css({ width: "100%" }).appendTo($outer).outerWidth();
		$outer.remove();
		return 100 - widthWithScroll;
	}
	// src/app/metadata-diff.ts
	function shouldEnableMetadataDiff() {
		return Object.keys(availableSemesters).sort().reverse().slice(0, 4).includes(currentSemester);
	}
	function computeMetadataDiff(metadata) {
		const diff = {};
		Object.keys(metadata).forEach((course) => {
			const courseMetadata = metadata[course];
			if (!state.courseManager.doesExist(course)) {
				diff[course] = {
					exists: false,
					general: courseMetadata.general
				};
				return;
			}
			const generalCourseDiff = computeCourseGeneralMetadataDiff(courseMetadata.general, state.courseManager.getGeneralInfo(course));
			const scheduleCourseDiff = computeCourseScheduleMetadataDiff(courseMetadata.schedule, state.courseManager.getSchedule(course));
			if (generalCourseDiff.length > 0 || scheduleCourseDiff.length > 0) diff[course] = {
				exists: true,
				changes: generalCourseDiff.concat(scheduleCourseDiff)
			};
		});
		return diff;
	}
	function computeCourseGeneralMetadataDiff(oldGeneral, newGeneral) {
		const keyOrder = [
			"פקולטה",
			"מסגרת לימודים",
			"שם מקצוע",
			"מספר מקצוע",
			"אתר הקורס",
			"נקודות",
			"הרצאה",
			"תרגיל",
			"מעבדה",
			"סמינר/פרויקט",
			"סילבוס",
			"מקצועות קדם",
			"מקצועות צמודים",
			"מקצועות ללא זיכוי נוסף",
			"מקצועות ללא זיכוי נוסף (מכילים)",
			"מקצועות ללא זיכוי נוסף (מוכלים)",
			"מקצועות זהים",
			"עבור לסמסטר",
			"אחראים",
			"הערות",
			"מועד הבחינה",
			"בוחן מועד א",
			"בוחן מועד ב",
			"בוחן מועד ג",
			"בוחן מועד ד",
			"בוחן מועד ה",
			"בוחן מועד ו",
			"מועד א",
			"מועד ב",
			"מועד ג",
			"מיקום"
		];
		const compareFunction = (a, b) => {
			const aIndex = keyOrder.indexOf(a) + 1 || Number.MAX_VALUE;
			const bIndex = keyOrder.indexOf(b) + 1 || Number.MAX_VALUE;
			if (aIndex !== bIndex) return aIndex - bIndex;
			return a.localeCompare(b);
		};
		const keyExclude = {
			"אתר הקורס": true,
			"עבור לסמסטר": true,
			מיקום: true
		};
		let oldText = "";
		Object.keys(oldGeneral).sort(compareFunction).forEach((key) => {
			if (!keyExclude[key] && oldGeneral[key] !== newGeneral[key] && oldGeneral[key]) oldText += `${state.courseManager.getFieldLabel(key)}: ${metadataDisplayValue(key, oldGeneral[key])}\n`;
		});
		let newText = "";
		Object.keys(newGeneral).sort(compareFunction).forEach((key) => {
			if (!keyExclude[key] && newGeneral[key] !== oldGeneral[key] && newGeneral[key]) newText += `${state.courseManager.getFieldLabel(key)}: ${metadataDisplayValue(key, newGeneral[key])}\n`;
		});
		if (oldText === "" && newText === "") return [];
		return [{
			title: CheeseI18n.t("shell.changes.general"),
			old: oldText.trim(),
			new: newText.trim()
		}];
	}
	function computeCourseScheduleMetadataDiff(oldSchedule, newSchedule) {
		const diff = [];
		const scheduleGroups = {};
		const oldScheduleByGroups = scheduleToGroupOfTexts(oldSchedule, false);
		const newScheduleByGroups = scheduleToGroupOfTexts(newSchedule, false);
		const oldDisplayByGroups = scheduleToGroupOfTexts(oldSchedule, true);
		const newDisplayByGroups = scheduleToGroupOfTexts(newSchedule, true);
		Object.keys(scheduleGroups).sort().forEach((typeAndNumber) => {
			if (oldScheduleByGroups[typeAndNumber] !== newScheduleByGroups[typeAndNumber]) diff.push({
				title: scheduleGroups[typeAndNumber],
				old: (oldDisplayByGroups[typeAndNumber] || "").trim(),
				new: (newDisplayByGroups[typeAndNumber] || "").trim()
			});
		});
		return diff;
		function scheduleToGroupOfTexts(schedule, localized) {
			const keyOrder = [
				"מרצה/מתרגל",
				"יום",
				"שעה",
				"בניין",
				"חדר"
			];
			const compareFunction = (a, b) => {
				const aIndex = keyOrder.indexOf(a) + 1 || Number.MAX_VALUE;
				const bIndex = keyOrder.indexOf(b) + 1 || Number.MAX_VALUE;
				if (aIndex !== bIndex) return aIndex - bIndex;
				return a.localeCompare(b);
			};
			const lessonsAdded = {};
			const scheduleByGroups = {};
			schedule.forEach((lesson) => {
				if (lessonsAdded[lesson["מס."]] && lessonsAdded[lesson["מס."]] !== lesson["קבוצה"]) return;
				let lessonText = "";
				Object.keys(lesson).sort(compareFunction).forEach((key) => {
					if (key !== "קבוצה" && key !== "מס." && key !== "סוג" && lesson[key]) {
						const label = localized ? state.courseManager.getFieldLabel(key) : key;
						const value = localized ? metadataDisplayValue(key, lesson[key]) : lesson[key];
						lessonText += `${label}: ${value}\n`;
					}
				});
				let typeAndNumber = state.courseManager.getLessonType(lesson);
				if (lesson["סוג"] !== "sadna") typeAndNumber += ` ${lesson["מס."]}`;
				if (!scheduleByGroups[typeAndNumber]) scheduleByGroups[typeAndNumber] = "";
				scheduleByGroups[typeAndNumber] += `${lessonText}\n`;
				lessonsAdded[lesson["מס."]] = lesson["קבוצה"];
				scheduleGroups[typeAndNumber] = state.courseManager.getLessonTypeAndNumber(lesson);
			});
			return scheduleByGroups;
		}
	}
	function getPrettyMetadataDiff() {
		let result;
		const metadataDiff = state.metadataDiff;
		if (metadataDiff) {
			const container = $("<div class=\"course-metadata-diff-container\">");
			result = container;
			Object.keys(metadataDiff).sort().forEach((course) => {
				const courseDiff = metadataDiff[course];
				let general;
				let courseTitle;
				if (courseDiff.exists) {
					courseTitle = state.courseManager.getTitle(course);
					container.append(sourceText(courseTitle, "<h3>"));
					courseDiff.changes.forEach((diff) => {
						container.append($("<h5>").text(diff.title));
						JsDiff.diffWords(diff.old, diff.new).forEach((part) => {
							const partElement = $("<span>").text(part.value);
							if (part.added) partElement.addClass("course-metadata-diff-new");
							else if (part.removed) partElement.addClass("course-metadata-diff-old");
							container.append(partElement);
						});
					});
				} else {
					general = courseDiff.general;
					courseTitle = `${general["מספר מקצוע"]} – ${general["שם מקצוע"]}`;
					container.append(sourceText(courseTitle, "<h3>")).append($("<span>").text(CheeseI18n.t("shell.changes.removed")));
				}
			});
		} else {
			result = $("<div>");
			const explanation = escapeHtml(CheeseI18n.t("shell.changes.explanation"));
			result.html(explanation);
		}
		return result;
	}
	function setMetadataToCurrent() {
		let deletedCourses = [];
		const metadataDiff = state.metadataDiff;
		if (metadataDiff) deletedCourses = Object.keys(metadataDiff).filter((course) => !metadataDiff[course].exists);
		if (deletedCourses.length > 0 && sessionExtraLayerIds(state.currentSavedSession).length > 0) {
			const newSession = $.extend(true, {}, state.currentSavedSession);
			sessionExtraLayerIds(newSession).forEach((layerId) => {
				const layer = newSession[`${currentSemester}_layers`][layerId];
				layer.courses = layer.courses.filter((item) => !deletedCourses.includes(item));
				deletedCourses.forEach((course) => {
					delete newSession[layerLessonsKey(course, layerId)];
				});
			});
			savedSessionChangesSave(state.currentSavedSession, newSession);
			state.currentSavedSession = newSession;
		}
		const semesterCoursesKey = `${currentSemester}_courses`;
		if (deletedCourses.length > 0) state.currentSavedSession[semesterCoursesKey] = state.currentSavedSession[semesterCoursesKey].filter((item) => !deletedCourses.includes(item));
		deletedCourses.forEach((course) => {
			const courseKey = layerLessonsKey(course, "");
			delete state.currentSavedSession[courseKey];
		});
		const courseNumbers = state.courseButtonList.getCourseNumbers(true);
		const doc = firestoreAuthenticatedUserDoc();
		if (doc) {
			const input = {};
			courseNumbers.forEach((course) => {
				const metadataCourseKey = `${currentSemester}_metadata_${course}`;
				const courseData = state.courseManager.getCourseData(course);
				input[metadataCourseKey] = courseData;
			});
			if (deletedCourses.length > 0) input[semesterCoursesKey] = state.currentSavedSession[semesterCoursesKey];
			deletedCourses.forEach((course) => {
				const courseKey = layerLessonsKey(course, "");
				input[courseKey] = firebase.firestore.FieldValue.delete();
				const metadataCourseKey = `${currentSemester}_metadata_${course}`;
				input[metadataCourseKey] = firebase.firestore.FieldValue.delete();
			});
			firestoreSave(doc, input);
		} else try {
			courseNumbers.forEach((course) => {
				const metadataCourseKey = `${currentSemester}_metadata_${course}`;
				const courseData = state.courseManager.getCourseData(course);
				localStorage.setItem(metadataCourseKey, JSON.stringify(courseData));
			});
			if (deletedCourses.length > 0) localStorage.setItem(semesterCoursesKey, JSON.stringify(state.currentSavedSession[semesterCoursesKey]));
			deletedCourses.forEach((course) => {
				const courseKey = layerLessonsKey(course, "");
				localStorage.removeItem(courseKey);
				const metadataCourseKey = `${currentSemester}_metadata_${course}`;
				localStorage.removeItem(metadataCourseKey);
			});
		} catch (e) {
			localStorageSaveFailed(e);
		}
		state.metadataDiff = {};
		onMetadataDiffChange();
	}
	function onMetadataDiffChange() {
		let badgeCount = 0;
		const metadataDiff = state.metadataDiff;
		if (metadataDiff) {
			const diffCourses = Object.keys(metadataDiff);
			if (diffCourses.length > 0) badgeCount = diffCourses.reduce((accumulator, course) => {
				const diff = metadataDiff[course];
				return accumulator + (diff.exists ? diff.changes.length : 1);
			}, 0);
		} else badgeCount = 1;
		if (badgeCount > 0) {
			$("#top-navbar-changes").removeClass("d-none").find(".unread-count-badge").text(String(badgeCount));
			$("#top-navbar .navbar-toggler .unread-count-badge").text(String(badgeCount)).removeClass("d-none");
		} else {
			$("#top-navbar-changes").addClass("d-none");
			$("#top-navbar .navbar-toggler .unread-count-badge").addClass("d-none");
		}
	}
	// src/app/schedule-edits.ts
	function selectedCourseSave(course, layerId) {
		if (layerId) {
			const layerCourseNumbers = state.courseButtonList.getCourseNumbers(true, layerId);
			savedSessionUpdate((session) => {
				const layer = session[`${currentSemester}_layers`][layerId];
				layer.courses = layerCourseNumbers.concat(layer.courses.filter((item) => !layerCourseNumbers.includes(item)));
				session[layerLessonsKey(course, layerId)] = {};
			});
			return;
		}
		const metadataUpdate = !!state.metadataDiff;
		const metadataCourseKey = `${currentSemester}_metadata_${course}`;
		const courseData = metadataUpdate ? state.courseManager.getCourseData(course) : null;
		const semesterCoursesKey = `${currentSemester}_courses`;
		const courseKey = layerLessonsKey(course, "");
		const courseNumbers = state.courseButtonList.getCourseNumbers(true, "");
		state.currentSavedSession[semesterCoursesKey] = courseNumbers.concat(state.currentSavedSession[semesterCoursesKey].filter((item) => !courseNumbers.includes(item)));
		state.currentSavedSession[courseKey] = {};
		const doc = firestoreAuthenticatedUserDoc();
		if (doc) {
			const input = {};
			input[semesterCoursesKey] = state.currentSavedSession[semesterCoursesKey];
			input[courseKey] = {};
			if (metadataUpdate) input[metadataCourseKey] = courseData;
			firestoreSave(doc, input);
		} else try {
			localStorage.setItem(semesterCoursesKey, JSON.stringify(state.currentSavedSession[semesterCoursesKey]));
			localStorage.removeItem(courseKey);
			if (metadataUpdate) localStorage.setItem(metadataCourseKey, JSON.stringify(courseData));
		} catch (e) {
			localStorageSaveFailed(e);
		}
		onSavedSessionChange();
	}
	function coursesOrderSave(layerId) {
		if (layerId) {
			const layerCourseNumbers = state.courseButtonList.getCourseNumbers(true, layerId);
			savedSessionUpdate((session) => {
				const layer = session[`${currentSemester}_layers`][layerId];
				layer.courses = layerCourseNumbers.concat(layer.courses.filter((item) => !layerCourseNumbers.includes(item)));
			});
			return;
		}
		const semesterCoursesKey = `${currentSemester}_courses`;
		const courseNumbers = state.courseButtonList.getCourseNumbers(true, "");
		state.currentSavedSession[semesterCoursesKey] = courseNumbers.concat(state.currentSavedSession[semesterCoursesKey].filter((item) => !courseNumbers.includes(item)));
		const doc = firestoreAuthenticatedUserDoc();
		if (doc) {
			const input = {};
			input[semesterCoursesKey] = state.currentSavedSession[semesterCoursesKey];
			firestoreSave(doc, input);
		} else try {
			localStorage.setItem(semesterCoursesKey, JSON.stringify(state.currentSavedSession[semesterCoursesKey]));
		} catch (e) {
			localStorageSaveFailed(e);
		}
		onSavedSessionChange();
	}
	function selectedCourseUnsave(course, layerId) {
		if (layerId) {
			savedSessionUpdate((session) => {
				const layer = session[`${currentSemester}_layers`][layerId];
				layer.courses = layer.courses.filter((item) => item !== course);
				delete session[layerLessonsKey(course, layerId)];
			});
			return;
		}
		const metadataCourseKey = `${currentSemester}_metadata_${course}`;
		const semesterCoursesKey = `${currentSemester}_courses`;
		const courseKey = layerLessonsKey(course, "");
		state.currentSavedSession[semesterCoursesKey] = state.currentSavedSession[semesterCoursesKey].filter((item) => item !== course);
		delete state.currentSavedSession[courseKey];
		const removeMetadata = !sessionAllCourses(state.currentSavedSession).includes(course);
		const doc = firestoreAuthenticatedUserDoc();
		if (doc) {
			const input = {};
			input[semesterCoursesKey] = firebase.firestore.FieldValue.arrayRemove(course);
			input[courseKey] = firebase.firestore.FieldValue.delete();
			if (removeMetadata) input[metadataCourseKey] = firebase.firestore.FieldValue.delete();
			firestoreSave(doc, input);
		} else try {
			localStorage.setItem(semesterCoursesKey, JSON.stringify(state.currentSavedSession[semesterCoursesKey]));
			localStorage.removeItem(courseKey);
			if (removeMetadata) localStorage.removeItem(metadataCourseKey);
		} catch (e) {
			localStorageSaveFailed(e);
		}
		onSavedSessionChange();
		if (removeMetadata && state.metadataDiff && state.metadataDiff[course]) {
			delete state.metadataDiff[course];
			onMetadataDiffChange();
		}
	}
	function selectedLessonSave(course, lessonNumber, lessonType, layerId) {
		if (layerId) {
			savedSessionUpdate((session) => {
				session[layerLessonsKey(course, layerId)][lessonType] = lessonNumber;
			});
			return;
		}
		const courseKey = layerLessonsKey(course, "");
		state.currentSavedSession[courseKey][lessonType] = lessonNumber;
		const doc = firestoreAuthenticatedUserDoc();
		if (doc) {
			const input = {};
			input[`${courseKey}.${lessonType}`] = lessonNumber;
			firestoreSave(doc, input);
		} else try {
			localStorage.setItem(courseKey, JSON.stringify(state.currentSavedSession[courseKey]));
		} catch (e) {
			localStorageSaveFailed(e);
		}
		onSavedSessionChange();
	}
	function selectedLessonUnsave(course, lessonNumber, lessonType, layerId) {
		if (layerId) {
			savedSessionUpdate((session) => {
				delete session[layerLessonsKey(course, layerId)][lessonType];
			});
			return;
		}
		const courseKey = layerLessonsKey(course, "");
		delete state.currentSavedSession[courseKey][lessonType];
		const doc = firestoreAuthenticatedUserDoc();
		if (doc) {
			const input = {};
			input[`${courseKey}.${lessonType}`] = firebase.firestore.FieldValue.delete();
			firestoreSave(doc, input);
		} else try {
			localStorage.setItem(courseKey, JSON.stringify(state.currentSavedSession[courseKey]));
		} catch (e) {
			localStorageSaveFailed(e);
		}
		onSavedSessionChange();
	}
	function customEventSave(eventId, eventData, layerId) {
		if (layerId) {
			savedSessionUpdate((session) => {
				session[`${currentSemester}_layers`][layerId].customEvents[eventId] = eventData;
			});
			return;
		}
		const semesterCustomEventsKey = `${currentSemester}_custom_events`;
		state.currentSavedSession[semesterCustomEventsKey][eventId] = eventData;
		const doc = firestoreAuthenticatedUserDoc();
		if (doc) {
			const input = {};
			input[`${semesterCustomEventsKey}.${eventId}`] = eventData;
			firestoreSave(doc, input);
		} else try {
			localStorage.setItem(semesterCustomEventsKey, JSON.stringify(state.currentSavedSession[semesterCustomEventsKey]));
		} catch (e) {
			localStorageSaveFailed(e);
		}
		onSavedSessionChange();
	}
	function customEventUnsave(eventId, layerId) {
		const semesterColorsKey = `${currentSemester}_colors`;
		const colorKey = `custom_event_${eventId}`;
		if (layerId) {
			delete state.customColors[colorKey];
			savedSessionUpdate((session) => {
				delete session[`${currentSemester}_layers`][layerId].customEvents[eventId];
				delete session[semesterColorsKey][colorKey];
			});
			return;
		}
		const semesterCustomEventsKey = `${currentSemester}_custom_events`;
		delete state.currentSavedSession[semesterCustomEventsKey][eventId];
		const hadCustomColor = !!state.currentSavedSession[semesterColorsKey][colorKey];
		delete state.currentSavedSession[semesterColorsKey][colorKey];
		delete state.customColors[colorKey];
		const doc = firestoreAuthenticatedUserDoc();
		if (doc) {
			const input = {};
			input[`${semesterCustomEventsKey}.${eventId}`] = firebase.firestore.FieldValue.delete();
			if (hadCustomColor) customColorFirestoreInput(input, colorKey);
			firestoreSave(doc, input);
		} else try {
			localStorage.setItem(semesterCustomEventsKey, JSON.stringify(state.currentSavedSession[semesterCustomEventsKey]));
			if (hadCustomColor) customColorsLocalStorageSave();
		} catch (e) {
			localStorageSaveFailed(e);
		}
		onSavedSessionChange();
	}
	function customColorSave(colorKey, color) {
		const semesterColorsKey = `${currentSemester}_colors`;
		if (color) {
			state.currentSavedSession[semesterColorsKey][colorKey] = color;
			state.customColors[colorKey] = color;
		} else {
			delete state.currentSavedSession[semesterColorsKey][colorKey];
			delete state.customColors[colorKey];
		}
		const doc = firestoreAuthenticatedUserDoc();
		if (doc) {
			const input = {};
			customColorFirestoreInput(input, colorKey);
			firestoreSave(doc, input);
		} else try {
			customColorsLocalStorageSave();
		} catch (e) {
			localStorageSaveFailed(e);
		}
		onSavedSessionChange();
	}
	function customColorFirestoreInput(input, colorKey) {
		const semesterColorsKey = `${currentSemester}_colors`;
		const colors = state.currentSavedSession[semesterColorsKey];
		if (Object.keys(colors).length === 0) input[semesterColorsKey] = firebase.firestore.FieldValue.delete();
		else input[`${semesterColorsKey}.${colorKey}`] = colors[colorKey] || firebase.firestore.FieldValue.delete();
	}
	function customColorsLocalStorageSave() {
		const semesterColorsKey = `${currentSemester}_colors`;
		const colors = state.currentSavedSession[semesterColorsKey];
		if (Object.keys(colors).length === 0) localStorage.removeItem(semesterColorsKey);
		else localStorage.setItem(semesterColorsKey, JSON.stringify(colors));
	}
	// src/app/colors.ts
	function courseColorKey(course, layerId) {
		return layerId ? `${layerId}_${course}` : course;
	}
	function courseColorGenerator(course, customEventId, layerId) {
		const customColor = state.customColors[customEventId || courseColorKey(course, layerId)];
		if (customColor) return customColor;
		let str = state.courseManager.toOldCourseNumber(course);
		const coursePrefixForHashCalc = {
			"114246": "a",
			"124708": "c",
			"134019": "a",
			"336537": "a",
			"034055": "a"
		};
		if (coursePrefixForHashCalc[str]) str = coursePrefixForHashCalc[str] + str;
		return state.colorHash.hex(str);
	}
	function courseTextColorGenerator(course, customEventId, layerId) {
		const customColor = state.customColors[customEventId || courseColorKey(course, layerId)];
		return customColor ? readableTextColor(customColor) : "white";
	}
	function readableTextColor(backgroundColor) {
		const luminance = (hex) => {
			const channels = [
				1,
				3,
				5
			].map((i) => {
				const value = parseInt(hex.substr(i, 2), 16) / 255;
				return value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
			});
			return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
		};
		const contrast = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
		const background = luminance(backgroundColor);
		const whiteContrast = contrast(background, 1);
		const darkContrast = contrast(background, luminance(DARK_TEXT_COLOR));
		return whiteContrast < 3 && darkContrast > whiteContrast ? DARK_TEXT_COLOR : "white";
	}
	function customColorsFromSavedSession(session) {
		const colors = {};
		const savedColors = session[`${currentSemester}_colors`] || {};
		Object.keys(savedColors).forEach((colorKey) => {
			if (/^#[0-9a-f]{6}$/i.test(savedColors[colorKey])) colors[colorKey] = savedColors[colorKey];
		});
		return colors;
	}
	function updateColors() {
		state.courseButtonList.updateColors();
		state.courseCalendar.updateColors();
		state.courseExamInfo.renderCourses(getVisibleCourseNumbers());
	}
	function showColorPicker(colorKey, currentColor) {
		const palette = [];
		[.5, .35].forEach((lightness) => {
			for (let hue = 0; hue < 360; hue += 30) palette.push(hslToHex(hue, .5, lightness));
		});
		const content = $("<div class=\"color-picker\">");
		palette.forEach((color) => {
			const colorButton = $("<button type=\"button\" class=\"color-picker-item\">").attr("aria-label", color).css("background-color", color).toggleClass("color-picker-item-selected", state.customColors[colorKey] === color).click(() => {
				dialog.close();
				customColorSave(colorKey, color);
				updateColors();
			});
			content.append(colorButton);
		});
		const customInput = $("<input type=\"color\" class=\"color-picker-custom-input\" id=\"color-picker-custom-input\">").val(currentColor || "#000000").on("change", function() {
			const color = String($(this).val()).trim().toLowerCase();
			if (!/^#[0-9a-f]{6}$/.test(color)) return;
			dialog.close();
			customColorSave(colorKey, color);
			updateColors();
		});
		const customRow = $("<div class=\"color-picker-custom\">").append($("<label for=\"color-picker-custom-input\">").text(CheeseI18n.t("shell.color.custom"))).append(customInput);
		const dialog = BootstrapDialog.show({
			title: CheeseI18n.t("shell.color.title"),
			message: $("<div>").append(content, customRow),
			buttons: [{
				label: CheeseI18n.t("shell.color.default"),
				action(dialog) {
					dialog.close();
					if (state.customColors[colorKey]) {
						customColorSave(colorKey, null);
						updateColors();
					}
				}
			}, {
				label: CheeseI18n.t("shell.dialog.close"),
				action(dialog) {
					dialog.close();
				}
			}]
		});
		function hslToHex(hue, saturation, lightness) {
			const a = saturation * Math.min(lightness, 1 - lightness);
			return `#${[
				0,
				8,
				4
			].map((n) => {
				const k = (n + hue / 30) % 12;
				const value = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
				return `0${Math.round(value * 255).toString(16)}`.slice(-2);
			}).join("")}`;
		}
	}
	// src/app/layers.ts
	function layerLessonsKey(course, layerId) {
		return `${currentSemester}_${layerId ? `${layerId}_` : ""}${course}`;
	}
	function sessionExtraLayerIds(session) {
		const semesterLayersKey = `${currentSemester}_layers`;
		return Object.keys(session[semesterLayersKey] || {}).filter((layerId) => layerId !== "default").sort();
	}
	function sessionLayerCourses(session, layerId) {
		if (!layerId) return session[`${currentSemester}_courses`] || [];
		return session[`${currentSemester}_layers`][layerId].courses;
	}
	function sessionAllCourses(session) {
		const courses = [];
		[""].concat(sessionExtraLayerIds(session)).forEach((layerId) => {
			sessionLayerCourses(session, layerId).forEach((course) => {
				if (!courses.includes(course)) courses.push(course);
			});
		});
		return courses;
	}
	function savedLayersSanitize(savedLayers) {
		const layers = {};
		let extraLayersCount = 0;
		if (!savedLayers || typeof savedLayers !== "object") return layers;
		const source = savedLayers;
		Object.keys(source).forEach((layerId) => {
			const savedLayer = source[layerId];
			if (!savedLayer || typeof savedLayer !== "object") return;
			const layer = {};
			if (typeof savedLayer.name === "string") layer.name = savedLayer.name;
			if (savedLayer.hidden) layer.hidden = true;
			if (layerId === "default") layers[layerId] = layer;
			else if (/^layer\d+$/.test(layerId)) {
				layer.courses = Array.isArray(savedLayer.courses) ? savedLayer.courses.filter((course) => typeof course === "string") : [];
				layer.customEvents = savedLayer.customEvents && typeof savedLayer.customEvents === "object" ? savedLayer.customEvents : {};
				layers[layerId] = layer;
				extraLayersCount++;
			}
		});
		return extraLayersCount > 0 ? layers : {};
	}
	function layersFromSavedSession(session) {
		const extraLayerIds = sessionExtraLayerIds(session);
		if (extraLayerIds.length === 0) return [];
		const savedLayers = session[`${currentSemester}_layers`];
		const firstLayer = savedLayers.default || {};
		return [{
			id: "",
			name: firstLayer.name || CheeseI18n.t("shell.layers.defaultName", { number: 1 }),
			hidden: !!firstLayer.hidden
		}].concat(extraLayerIds.map((layerId) => ({
			id: layerId,
			name: savedLayers[layerId].name || CheeseI18n.t("shell.layers.unnamed"),
			hidden: !!savedLayers[layerId].hidden
		})));
	}
	function isLayerVisible(layerId) {
		return !state.currentLayers.some((layer) => layer.id === layerId && layer.hidden);
	}
	function getVisibleCourseNumbers() {
		if (state.currentLayers.length === 0) return state.courseButtonList.getCourseNumbers(true);
		const courseNumbers = [];
		state.currentLayers.forEach((layer) => {
			if (!layer.hidden) state.courseButtonList.getCourseNumbers(true, layer.id).forEach((course) => {
				if (!courseNumbers.includes(course)) courseNumbers.push(course);
			});
		});
		return courseNumbers;
	}
	function getLayerIdsOfCourse(course) {
		if (state.currentLayers.length === 0) return [""];
		const layerIds = state.currentLayers.map((layer) => layer.id).filter((layerId) => state.courseButtonList.isCourseInList(course, layerId));
		if (state.previewingFromSelectControl === course && !layerIds.includes(state.previewingFromSelectControlLayerId)) layerIds.push(state.previewingFromSelectControlLayerId);
		return layerIds;
	}
	function savedSessionUpdate(updateFunc) {
		const newSession = $.extend(true, {}, state.currentSavedSession);
		updateFunc(newSession);
		savedSessionChangesSave(state.currentSavedSession, newSession);
		state.currentSavedSession = newSession;
		metadataDiffRemoveUnusedCourses();
		onSavedSessionChange();
	}
	function savedSessionUpdateAndReload(updateFunc) {
		savedSessionUpdate(updateFunc);
		setScheduleFromSavedSession(state.currentSavedSession, true);
		state.courseSelect.filterApply();
	}
	function metadataDiffRemoveUnusedCourses() {
		const metadataDiff = state.metadataDiff;
		if (!metadataDiff) return;
		const courses = sessionAllCourses(state.currentSavedSession);
		let changed = false;
		Object.keys(metadataDiff).forEach((course) => {
			if (!courses.includes(course)) {
				delete metadataDiff[course];
				changed = true;
			}
		});
		if (changed) onMetadataDiffChange();
	}
	function sessionLayerCourseMove(session, course, fromLayerId, toLayerId, toLayerCourses) {
		const semesterCoursesKey = `${currentSemester}_courses`;
		const semesterLayersKey = `${currentSemester}_layers`;
		const setLayerCourses = (layerId, courses) => {
			if (layerId) session[semesterLayersKey][layerId].courses = courses;
			else session[semesterCoursesKey] = courses;
		};
		setLayerCourses(fromLayerId, sessionLayerCourses(session, fromLayerId).filter((item) => item !== course));
		toLayerCourses = toLayerCourses || [course];
		setLayerCourses(toLayerId, toLayerCourses.concat(sessionLayerCourses(session, toLayerId).filter((item) => !toLayerCourses.includes(item))));
		const fromKey = layerLessonsKey(course, fromLayerId);
		session[layerLessonsKey(course, toLayerId)] = session[fromKey] || {};
		delete session[fromKey];
		sessionCourseColorMove(session, course, fromLayerId, toLayerId);
	}
	function sessionCourseColorMove(session, course, fromLayerId, toLayerId) {
		const colors = session[`${currentSemester}_colors`];
		const fromColorKey = courseColorKey(course, fromLayerId);
		const toColorKey = courseColorKey(course, toLayerId);
		if (colors[fromColorKey]) colors[toColorKey] = colors[fromColorKey];
		else delete colors[toColorKey];
		delete colors[fromColorKey];
	}
	function sessionLayerCourseColorsRemove(session, layerId) {
		const colors = session[`${currentSemester}_colors`];
		Object.keys(colors).forEach((colorKey) => {
			if (colorKey.indexOf(`${layerId}_`) === 0) delete colors[colorKey];
		});
	}
	function layerCourseMove(course, fromLayerId, toLayerId) {
		const toLayerCourses = state.courseButtonList.getCourseNumbers(true, toLayerId);
		savedSessionUpdateAndReload((session) => {
			sessionLayerCourseMove(session, course, fromLayerId, toLayerId, toLayerCourses);
		});
	}
	function sessionLayerCustomEvents(session, layerId) {
		if (!layerId) return session[`${currentSemester}_custom_events`];
		return session[`${currentSemester}_layers`][layerId].customEvents;
	}
	function sessionLayerCustomEventMove(session, eventId, fromLayerId, toLayerId) {
		const fromCustomEvents = sessionLayerCustomEvents(session, fromLayerId);
		if (fromCustomEvents[eventId]) {
			sessionLayerCustomEvents(session, toLayerId)[eventId] = fromCustomEvents[eventId];
			delete fromCustomEvents[eventId];
		}
	}
	function layerCustomEventMove(eventId, fromLayerId, toLayerId) {
		savedSessionUpdateAndReload((session) => {
			sessionLayerCustomEventMove(session, eventId, fromLayerId, toLayerId);
		});
	}
	function layerCustomEventRemove(eventId, layerId) {
		savedSessionUpdateAndReload((session) => {
			delete sessionLayerCustomEvents(session, layerId)[eventId];
			delete session[`${currentSemester}_colors`][`custom_event_${eventId}`];
		});
	}
	function newLayerIdFor(layers) {
		let layerIdCounter = Math.round(Date.now() / 1e3);
		while (layers[`layer${layerIdCounter}`]) layerIdCounter++;
		return `layer${layerIdCounter}`;
	}
	function layerCreate(course, fromLayerId, customEventId) {
		const semesterLayersKey = `${currentSemester}_layers`;
		let newLayerId;
		savedSessionUpdateAndReload((session) => {
			const layers = session[semesterLayersKey];
			newLayerId = newLayerIdFor(layers);
			layers[newLayerId] = {
				name: CheeseI18n.t("shell.layers.defaultName", { number: sessionExtraLayerIds(session).length + 2 }),
				courses: [],
				customEvents: {}
			};
			if (course !== null) sessionLayerCourseMove(session, course, fromLayerId, newLayerId);
			else if (customEventId !== void 0) sessionLayerCustomEventMove(session, customEventId, fromLayerId, newLayerId);
		});
		if (course === null && customEventId === void 0) state.courseButtonList.setActiveLayer(newLayerId);
	}
	function layerDuplicate(layerId) {
		const semesterLayersKey = `${currentSemester}_layers`;
		const semesterColorsKey = `${currentSemester}_colors`;
		let newLayerId;
		const layerName = state.currentLayers.filter((layer) => layer.id === layerId)[0].name;
		savedSessionUpdateAndReload((session) => {
			const layers = session[semesterLayersKey];
			const colors = session[semesterColorsKey];
			const copyId = newLayerIdFor(layers);
			newLayerId = copyId;
			const courses = sessionLayerCourses(session, layerId).slice();
			const layer = {
				name: CheeseI18n.t("courses.layers.copyName", { name: layerName }),
				courses,
				customEvents: {}
			};
			layers[copyId] = layer;
			courses.forEach((course) => {
				session[layerLessonsKey(course, copyId)] = $.extend(true, {}, session[layerLessonsKey(course, layerId)] || {});
				if (colors[courseColorKey(course, layerId)]) colors[courseColorKey(course, copyId)] = colors[courseColorKey(course, layerId)];
			});
			const usedEventIds = {};
			[""].concat(sessionExtraLayerIds(session)).forEach((otherLayerId) => {
				Object.keys(sessionLayerCustomEvents(session, otherLayerId) || {}).forEach((eventId) => {
					usedEventIds[eventId] = true;
				});
			});
			let eventIdCounter = Math.round(Date.now() / 1e3);
			const customEvents = sessionLayerCustomEvents(session, layerId) || {};
			Object.keys(customEvents).sort().forEach((eventId) => {
				while (usedEventIds[eventIdCounter]) eventIdCounter++;
				const newEventId = String(eventIdCounter);
				usedEventIds[newEventId] = true;
				layer.customEvents[newEventId] = $.extend(true, {}, customEvents[eventId]);
				if (colors[`custom_event_${eventId}`]) colors[`custom_event_${newEventId}`] = colors[`custom_event_${eventId}`];
			});
		});
		state.courseButtonList.setActiveLayer(newLayerId);
	}
	function layerRename(layerId, name) {
		const semesterLayersKey = `${currentSemester}_layers`;
		savedSessionUpdateAndReload((session) => {
			const layers = session[semesterLayersKey];
			const key = layerId || "default";
			layers[key] = layers[key] || {};
			layers[key].name = name;
		});
	}
	function layerVisibilityChange(layerId, hidden) {
		const semesterLayersKey = `${currentSemester}_layers`;
		savedSessionUpdateAndReload((session) => {
			const layers = session[semesterLayersKey];
			const key = layerId || "default";
			layers[key] = layers[key] || {};
			if (hidden) layers[key].hidden = true;
			else delete layers[key].hidden;
			if (Object.keys(layers.default || {}).length === 0) delete layers.default;
		});
	}
	function collapsedLayersLoad() {
		const result = {};
		try {
			const saved = JSON.parse(String(localStorage.getItem(COLLAPSED_LAYERS_STORAGE_KEY)));
			const ids = saved && saved[currentSemester];
			if (Array.isArray(ids)) ids.forEach((id) => {
				if (typeof id === "string" && id) result[id] = true;
			});
		} catch (e) {}
		return result;
	}
	function collapsedLayersSave() {
		if (state.viewingSharedSchedule) return;
		try {
			let saved = null;
			try {
				saved = JSON.parse(String(localStorage.getItem(COLLAPSED_LAYERS_STORAGE_KEY)));
			} catch (e) {}
			if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
			const ids = Object.keys(state.collapsedLayerIds);
			if (ids.length > 0) saved[currentSemester] = ids;
			else delete saved[currentSemester];
			if (Object.keys(saved).length > 0) localStorage.setItem(COLLAPSED_LAYERS_STORAGE_KEY, JSON.stringify(saved));
			else localStorage.removeItem(COLLAPSED_LAYERS_STORAGE_KEY);
		} catch (e) {}
	}
	function isLayerCollapsed(layerId) {
		return !!state.collapsedLayerIds[layerId || "default"];
	}
	function layerCollapseChange(layerId, collapsed) {
		const key = layerId || "default";
		if (collapsed) state.collapsedLayerIds[key] = true;
		else delete state.collapsedLayerIds[key];
		state.currentLayers.forEach((layer) => {
			if (layer.id === layerId) layer.collapsed = collapsed;
		});
		collapsedLayersSave();
	}
	function layerDelete(layerId) {
		let collapsedKey = layerId;
		if (!layerId) {
			collapsedKey = state.currentLayers[1] && state.currentLayers[1].id;
			if (collapsedKey && isLayerCollapsed(collapsedKey)) state.collapsedLayerIds.default = true;
			else delete state.collapsedLayerIds.default;
		}
		if (collapsedKey) delete state.collapsedLayerIds[collapsedKey];
		collapsedLayersSave();
		const semesterCoursesKey = `${currentSemester}_courses`;
		const semesterCustomEventsKey = `${currentSemester}_custom_events`;
		const semesterLayersKey = `${currentSemester}_layers`;
		savedSessionUpdateAndReload((session) => {
			const layers = session[semesterLayersKey];
			sessionLayerCourses(session, layerId).forEach((course) => {
				delete session[layerLessonsKey(course, layerId)];
			});
			const layerCustomEvents = layerId ? layers[layerId].customEvents : session[semesterCustomEventsKey];
			Object.keys(layerCustomEvents || {}).forEach((eventId) => {
				delete session[`${currentSemester}_colors`][`custom_event_${eventId}`];
			});
			if (layerId) {
				sessionLayerCourseColorsRemove(session, layerId);
				delete layers[layerId];
			} else {
				const nextLayerId = sessionExtraLayerIds(session)[0];
				const nextLayer = layers[nextLayerId];
				session[semesterCoursesKey] = nextLayer.courses;
				nextLayer.courses.forEach((course) => {
					const nextLayerKey = layerLessonsKey(course, nextLayerId);
					session[layerLessonsKey(course, "")] = session[nextLayerKey] || {};
					delete session[nextLayerKey];
					sessionCourseColorMove(session, course, nextLayerId, "");
				});
				sessionLayerCourseColorsRemove(session, nextLayerId);
				session[semesterCustomEventsKey] = nextLayer.customEvents;
				layers.default = { name: nextLayer.name };
				if (nextLayer.hidden) layers.default.hidden = true;
				delete layers[nextLayerId];
			}
			if (sessionExtraLayerIds(session).length === 0) session[semesterLayersKey] = {};
		});
	}
	// src/app/semesters.ts
	function semesterFriendlyName(semester) {
		const year = parseInt(semester.slice(0, 4), 10);
		switch (semester.slice(4)) {
			case "01": return CheeseI18n.t("shell.semester.winter", {
				year,
				nextYear: year + 1
			});
			case "02": return CheeseI18n.t("shell.semester.spring", {
				year,
				nextYear: year + 1
			});
			case "03": return CheeseI18n.t("shell.semester.summer", {
				year,
				nextYear: year + 1
			});
			default: return semester;
		}
	}
	function semesterFriendlyNameForFileName(semester) {
		const year = parseInt(semester.slice(0, 4), 10);
		switch (semester.slice(4)) {
			case "01": return `winter-${year}-${year + 1}`;
			case "02": return `spring-${year + 1}`;
			case "03": return `summer-${year + 1}`;
			default: return semester;
		}
	}
	function updateGeneralInfoLine() {
		let courses = 0;
		let points = 0;
		getVisibleCourseNumbers().forEach((course) => {
			const general = state.courseManager.getGeneralInfo(course);
			courses++;
			points += parseFloat(general["נקודות"]);
		});
		const pointsText = points.toFixed(1).replace(/\.0+$/, "");
		let text;
		if (courses > 0) {
			if (courses === 1) text = CheeseI18n.t("shell.summary.oneCourse");
			else text = CheeseI18n.t("shell.summary.courses", { count: courses });
			text += CheeseI18n.t("shell.summary.separator");
			if (pointsText === "1") text += CheeseI18n.t("shell.summary.oneCredit");
			else text += CheeseI18n.t("shell.summary.credits", { count: pointsText });
		} else text = CheeseI18n.t("shell.summary.none");
		$("#general-info").text(text);
	}
	// src/app/calendar-export.ts
	function loadCalendarDaysOff(onLoaded, onError) {
		if (state.calendarDaysOff) {
			onLoaded(state.calendarDaysOff);
			return;
		}
		const calendarEventsUrl = `https://michael-maltsev.github.io/technion-calendar-events/${currentSemester}.json`;
		$.getJSON(calendarEventsUrl).done((data) => {
			state.calendarDaysOff = data.daysOff || [];
			onLoaded(state.calendarDaysOff);
		}).fail((jqXHR) => {
			if (jqXHR.status === 404) {
				state.calendarDaysOff = [];
				onLoaded(state.calendarDaysOff);
			} else onError();
		});
	}
	function buildScheduleCalendar(daysOff) {
		const extraCalendarHeaders = [
			`NAME:${IcsText.escapeText(semesterFriendlyName(currentSemester))}`,
			"REFRESH-INTERVAL;VALUE=DURATION:PT1H",
			"X-PUBLISHED-TTL:PT1H",
			"BEGIN:VTIMEZONE",
			"TZID:Asia/Jerusalem",
			"X-LIC-LOCATION:Asia/Jerusalem",
			"BEGIN:DAYLIGHT",
			"TZNAME:IDT",
			"TZOFFSETFROM:+0200",
			"TZOFFSETTO:+0300",
			"DTSTART:19700327T020000",
			"RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1FR",
			"END:DAYLIGHT",
			"BEGIN:STANDARD",
			"TZNAME:IST",
			"TZOFFSETFROM:+0300",
			"TZOFFSETTO:+0200",
			"DTSTART:19701025T020000",
			"RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
			"END:STANDARD",
			"END:VTIMEZONE"
		];
		const icsCal = IcsText.wrap(ics(`cheesefork.cf-${Date.now()}`, "CheeseFork²", extraCalendarHeaders, "Asia/Jerusalem"));
		let dateFrom = availableSemesters[currentSemester].start;
		const dateTo = availableSemesters[currentSemester].end;
		if (dateFrom === "2023-03-21") dateFrom = "2023-03-19";
		state.courseCalendar.saveAsIcs(icsCal, dateFrom, dateTo, daysOff);
		getVisibleCourseNumbers().forEach((course) => {
			const general = state.courseManager.getGeneralInfo(course);
			["מועד א", "מועד ב"].forEach((moed) => {
				if (general[moed]) {
					const parsedDate = state.courseManager.parseExamDateTime(general[moed]);
					if (parsedDate) {
						const title = `${state.courseManager.getFieldLabel(moed)} – ${state.courseManager.getCourseName(course)}`;
						icsCal.addEvent(title, "", "", parsedDate.start, parsedDate.end);
					}
				}
			});
		});
		return icsCal;
	}
	function calendarFileRef(uid) {
		return state.firebaseStorage.ref().child(`${uid}/${semesterFriendlyNameForFileName(currentSemester)}.ics`);
	}
	function calendarFileUrl(uid) {
		return `https://firebasestorage.googleapis.com/v0/b/${firebase.app().options.storageBucket}/o/${encodeURIComponent(calendarFileRef(uid).fullPath)}?alt=media`;
	}
	function calendarFingerprint(calendar) {
		const text = calendar.split("\r\n").filter((line) => !/^(UID|DTSTAMP):/.test(line)).join("\r\n");
		const imul = (a, b) => {
			const ah = a >>> 16 & 65535;
			const al = a & 65535;
			const bh = b >>> 16 & 65535;
			const bl = b & 65535;
			return al * bl + (ah * bl + al * bh << 16 >>> 0) | 0;
		};
		let h1 = 3735928559;
		let h2 = 1103547991;
		for (let i = 0; i < text.length; i++) {
			const ch = text.charCodeAt(i);
			h1 = imul(h1 ^ ch, 2654435761);
			h2 = imul(h2 ^ ch, 1597334677);
		}
		h1 = imul(h1 ^ h1 >>> 16, 2246822507) ^ imul(h2 ^ h2 >>> 13, 3266489909);
		h2 = imul(h2 ^ h2 >>> 16, 2246822507) ^ imul(h1 ^ h1 >>> 13, 3266489909);
		return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
	}
	function uploadCalendarFile(uid, calendar) {
		const fingerprint = calendarFingerprint(calendar);
		return calendarFileRef(uid).putString(calendar, "raw", {
			cacheControl: "public, max-age=0",
			contentType: "text/calendar; charset=utf-8",
			customMetadata: { fingerprint }
		}).then((snapshot) => {
			if (state.calendarAutoUpload.uid === uid) state.calendarAutoUpload.uploadedFingerprint = fingerprint;
			return snapshot;
		});
	}
	function calendarAutoUploadSchedule() {
		var _state$calendarAutoUp;
		if (state.viewingSharedSchedule || typeof firebase === "undefined" || firebase.auth().currentUser === null) return;
		clearTimeout((_state$calendarAutoUp = state.calendarAutoUpload.timer) !== null && _state$calendarAutoUp !== void 0 ? _state$calendarAutoUp : void 0);
		state.calendarAutoUpload.timer = setTimeout(calendarAutoUploadRun, CALENDAR_AUTO_UPLOAD_DELAY_MS);
	}
	function calendarAutoUploadRun() {
		const user = firebase.auth().currentUser;
		if (!user) return;
		if (state.calendarAutoUpload.uploading) {
			state.calendarAutoUpload.pending = true;
			return;
		}
		if (state.calendarAutoUpload.uid !== user.uid) {
			state.calendarAutoUpload.uid = user.uid;
			state.calendarAutoUpload.exported = null;
			state.calendarAutoUpload.uploadedFingerprint = null;
		}
		whenCalendarExported(user.uid, () => {
			loadCalendarDaysOff((daysOff) => {
				if (firebase.auth().currentUser !== user) return;
				const calendar = buildScheduleCalendar(daysOff).build(true);
				if (calendarFingerprint(calendar) === state.calendarAutoUpload.uploadedFingerprint) return;
				state.calendarAutoUpload.uploading = true;
				uploadCalendarFile(user.uid, calendar).then(() => {
					calendarAutoUploadDone();
				}, (error) => {
					gtag("event", "calendar-auto-upload-error");
					calendarAutoUploadDone();
				});
			}, () => {});
		});
	}
	function calendarAutoUploadDone() {
		state.calendarAutoUpload.uploading = false;
		if (state.calendarAutoUpload.pending) {
			state.calendarAutoUpload.pending = false;
			calendarAutoUploadSchedule();
		}
	}
	function whenCalendarExported(uid, onExported) {
		if (state.calendarAutoUpload.exported !== null) {
			if (state.calendarAutoUpload.exported) onExported();
			return;
		}
		calendarFileRef(uid).getMetadata().then((metadata) => {
			if (state.calendarAutoUpload.uid === uid) {
				state.calendarAutoUpload.exported = true;
				state.calendarAutoUpload.uploadedFingerprint = metadata && metadata.customMetadata && metadata.customMetadata.fingerprint || null;
				onExported();
			}
		}, (error) => {
			if (state.calendarAutoUpload.uid === uid && error && error.code === "storage/object-not-found") state.calendarAutoUpload.exported = false;
		});
	}
	// src/app/history.ts
	function restoreSavedSession(currentSession, sessionToRestore) {
		savedSessionChangesSave(currentSession, sessionToRestore);
		setScheduleFromSavedSession(sessionToRestore);
	}
	function savedSessionChangesSave(currentSession, sessionToRestore) {
		const newKeys = [];
		const removeKeys = [];
		const newMetadataCourses = [];
		const semesterCoursesKey = `${currentSemester}_courses`;
		const currentCourses = currentSession[semesterCoursesKey];
		const newCourses = sessionToRestore[semesterCoursesKey];
		if (JSON.stringify(currentCourses) !== JSON.stringify(newCourses)) newKeys.push(semesterCoursesKey);
		currentCourses.forEach((course) => {
			if (!newCourses.includes(course)) {
				const courseKey = layerLessonsKey(course, "");
				removeKeys.push(courseKey);
			}
		});
		newCourses.forEach((course) => {
			const courseKey = layerLessonsKey(course, "");
			if (!currentCourses.includes(course)) newKeys.push(courseKey);
			else {
				const currentLessons = currentSession[courseKey];
				const newLessons = sessionToRestore[courseKey];
				if (JSON.stringify(currentLessons) !== JSON.stringify(newLessons)) newKeys.push(courseKey);
			}
		});
		const semesterCustomEventsKey = `${currentSemester}_custom_events`;
		const currentCustomEvents = currentSession[semesterCustomEventsKey];
		const newCustomEvents = sessionToRestore[semesterCustomEventsKey];
		if (JSON.stringify(currentCustomEvents) !== JSON.stringify(newCustomEvents)) newKeys.push(semesterCustomEventsKey);
		const semesterColorsKey = `${currentSemester}_colors`;
		if (JSON.stringify(currentSession[semesterColorsKey]) !== JSON.stringify(sessionToRestore[semesterColorsKey])) {
			if (Object.keys(sessionToRestore[semesterColorsKey]).length === 0) removeKeys.push(semesterColorsKey);
			else newKeys.push(semesterColorsKey);
		}
		const semesterLayersKey = `${currentSemester}_layers`;
		const currentSavedLayers = currentSession[semesterLayersKey];
		const newSavedLayers = sessionToRestore[semesterLayersKey];
		if (JSON.stringify(currentSavedLayers) !== JSON.stringify(newSavedLayers)) {
			if (Object.keys(newSavedLayers).length > 0) newKeys.push(semesterLayersKey);
			else removeKeys.push(semesterLayersKey);
		}
		sessionExtraLayerIds(currentSession).forEach((layerId) => {
			sessionLayerCourses(currentSession, layerId).forEach((course) => {
				if (!newSavedLayers[layerId] || !newSavedLayers[layerId].courses.includes(course)) removeKeys.push(layerLessonsKey(course, layerId));
			});
		});
		sessionExtraLayerIds(sessionToRestore).forEach((layerId) => {
			sessionLayerCourses(sessionToRestore, layerId).forEach((course) => {
				const courseKey = layerLessonsKey(course, layerId);
				if (JSON.stringify(currentSession[courseKey]) !== JSON.stringify(sessionToRestore[courseKey])) newKeys.push(courseKey);
			});
		});
		if (state.metadataDiff) {
			const currentAllCourses = sessionAllCourses(currentSession);
			const newAllCourses = sessionAllCourses(sessionToRestore);
			currentAllCourses.forEach((course) => {
				if (!newAllCourses.includes(course)) {
					const metadataCourseKey = `${currentSemester}_metadata_${course}`;
					removeKeys.push(metadataCourseKey);
				}
			});
			newAllCourses.forEach((course) => {
				if (!currentAllCourses.includes(course)) newMetadataCourses.push(course);
			});
		}
		const doc = firestoreAuthenticatedUserDoc();
		if (doc) {
			const input = {};
			removeKeys.forEach((key) => {
				input[key] = firebase.firestore.FieldValue.delete();
			});
			newKeys.forEach((key) => {
				input[key] = sessionToRestore[key];
			});
			newMetadataCourses.forEach((course) => {
				const metadataCourseKey = `${currentSemester}_metadata_${course}`;
				input[metadataCourseKey] = state.courseManager.getCourseData(course);
			});
			firestoreSave(doc, input);
		} else try {
			removeKeys.forEach((key) => {
				localStorage.removeItem(key);
			});
			newKeys.forEach((key) => {
				localStorage.setItem(key, JSON.stringify(sessionToRestore[key]));
			});
			newMetadataCourses.forEach((course) => {
				const metadataCourseKey = `${currentSemester}_metadata_${course}`;
				localStorage.setItem(metadataCourseKey, JSON.stringify(state.courseManager.getCourseData(course)));
			});
		} catch (e) {
			localStorageSaveFailed(e);
		}
	}
	function setScheduleFromSavedSession(session, restoreScrollPosition) {
		let scrollTop;
		if (restoreScrollPosition) scrollTop = $(window).scrollTop();
		state.customColors = customColorsFromSavedSession(session);
		const semesterCoursesKey = `${currentSemester}_courses`;
		state.courseButtonList.clear();
		state.currentLayers = layersFromSavedSession(session);
		state.currentLayers.forEach((layer) => {
			layer.collapsed = isLayerCollapsed(layer.id);
		});
		state.courseButtonList.setLayers(state.currentLayers);
		let schedule = {};
		(session[semesterCoursesKey] || []).forEach((course) => {
			if (!schedule[course] && state.courseManager.doesExist(course)) {
				state.courseButtonList.addCourse(course);
				const lessons = session[layerLessonsKey(course, "")] || {};
				schedule[course] = lessons;
			}
		});
		let customEvents = session[`${currentSemester}_custom_events`] || {};
		const extraLayers = [];
		if (state.currentLayers.length === 0) Object.keys(customEvents).sort().forEach((eventId) => {
			state.courseButtonList.addCustomEvent(eventId, customEvents[eventId].title, "");
		});
		state.currentLayers.forEach((layer) => {
			const layerCustomEvents = sessionLayerCustomEvents(session, layer.id) || {};
			Object.keys(layerCustomEvents).sort().forEach((eventId) => {
				state.courseButtonList.addCustomEvent(eventId, layerCustomEvents[eventId].title, layer.id);
			});
			if (!layer.id) {
				if (layer.hidden) {
					schedule = {};
					customEvents = {};
				}
				return;
			}
			const layerSchedule = {};
			sessionLayerCourses(session, layer.id).forEach((course) => {
				if (!layerSchedule[course] && state.courseManager.doesExist(course)) {
					state.courseButtonList.addCourse(course, layer.id);
					layerSchedule[course] = session[layerLessonsKey(course, layer.id)] || {};
				}
			});
			if (!layer.hidden) extraLayers.push({
				id: layer.id,
				schedule: layerSchedule,
				customEvents: session[`${currentSemester}_layers`][layer.id].customEvents
			});
		});
		state.courseCalendar.loadSavedSchedule(schedule, customEvents, extraLayers);
		updateGeneralInfoLine();
		state.courseExamInfo.renderCourses(getVisibleCourseNumbers());
		if (restoreScrollPosition) $(window).scrollTop(scrollTop);
	}
	function resetSchedule() {
		state.customColors = {};
		state.currentLayers = [];
		state.courseButtonList.clear();
		state.courseCalendar.removeAll();
		updateGeneralInfoLine();
		state.courseExamInfo.renderCourses([]);
		state.courseSelect.filterReset();
	}
	function sessionCopy(session) {
		return $.extend(true, {}, session);
	}
	function updateUndoRedoButtons() {
		$("#top-navbar-undo").toggleClass("d-none", state.savedSessionUndoStack.length === 0);
		$("#top-navbar-redo").toggleClass("d-none", state.savedSessionRedoStack.length === 0);
	}
	function onSavedSessionReset() {
		state.savedSessionLastState = sessionCopy(state.currentSavedSession);
		state.savedSessionUndoStack = [];
		state.savedSessionRedoStack = [];
		updateUndoRedoButtons();
		calendarAutoUploadSchedule();
	}
	function onSavedSessionChange() {
		if (JSON.stringify(state.savedSessionLastState) !== JSON.stringify(state.currentSavedSession)) {
			state.savedSessionUndoStack.push(state.savedSessionLastState);
			if (state.savedSessionUndoStack.length > 50) state.savedSessionUndoStack.shift();
			state.savedSessionRedoStack = [];
			state.savedSessionLastState = sessionCopy(state.currentSavedSession);
		}
		updateUndoRedoButtons();
		calendarAutoUploadSchedule();
	}
	function makeUndo() {
		if (state.savedSessionUndoStack.length === 0) return;
		const session = state.savedSessionUndoStack.pop();
		restoreSavedSession(state.currentSavedSession, session);
		state.savedSessionRedoStack.push(state.currentSavedSession);
		state.currentSavedSession = sessionCopy(session);
		state.savedSessionLastState = session;
		updateUndoRedoButtons();
		calendarAutoUploadSchedule();
	}
	function makeRedo() {
		if (state.savedSessionRedoStack.length === 0) return;
		const session = state.savedSessionRedoStack.pop();
		restoreSavedSession(state.currentSavedSession, session);
		state.savedSessionUndoStack.push(state.savedSessionLastState);
		state.currentSavedSession = session;
		state.savedSessionLastState = sessionCopy(session);
		updateUndoRedoButtons();
		calendarAutoUploadSchedule();
	}
	function initUndoRedoKeyboardShortcuts() {
		$(document).on("keydown", (event) => {
			if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
			const target = event.target;
			if ($(target).is("input, textarea, select, [contenteditable], [contenteditable] *") || $(".modal.show").length > 0) return;
			let key = String(event.key).toLowerCase();
			if (!/^[a-z]$/.test(key)) {
				const code = event.originalEvent && event.originalEvent.code;
				if (code === "KeyZ" || event.keyCode === 90) key = "z";
				else if (code === "KeyY" || event.keyCode === 89) key = "y";
			}
			const redo = key === "z" && event.shiftKey || key === "y" && !event.shiftKey;
			const undo = key === "z" && !event.shiftKey;
			if (!undo && !redo) return;
			event.preventDefault();
			const button = $(undo ? "#top-navbar-undo" : "#top-navbar-redo");
			if (!button.hasClass("d-none")) button.find("a").trigger("click");
		});
	}
	// src/lib/ics-import.ts
	function parseEvents(text) {
		const lines = String(text).replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
		const events = [];
		let current = null;
		lines.forEach((line) => {
			if (line === "BEGIN:VEVENT") {
				current = {};
				return;
			}
			if (line === "END:VEVENT") {
				if (current) events.push(current);
				current = null;
				return;
			}
			if (!current) return;
			const colon = line.indexOf(":");
			if (colon === -1) return;
			const nameAndParams = line.slice(0, colon).split(";");
			const name = nameAndParams[0].toUpperCase();
			const params = {};
			nameAndParams.slice(1).forEach((param) => {
				const eq = param.indexOf("=");
				if (eq !== -1) params[param.slice(0, eq).toUpperCase()] = param.slice(eq + 1);
			});
			if (!current[name]) current[name] = {
				params,
				value: line.slice(colon + 1)
			};
		});
		return events;
	}
	function unescapeText(value) {
		return String(value || "").replace(/\\([\\;,nN])/g, (match, ch) => ch === "n" || ch === "N" ? "\n" : ch);
	}
	function parseDateTime(property) {
		if (!property) return null;
		const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/.exec(property.value);
		if (!match) return null;
		let date;
		if (match[7]) date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]));
		else date = new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]);
		const pad = (n) => `0${n}`.slice(-2);
		return {
			day: date.getDay(),
			time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
		};
	}
	function match(text, courseManager, lessonTypeKey) {
		const result = {
			courses: {},
			courseOrder: [],
			customEvents: [],
			unmatched: []
		};
		const coursesByName = {};
		const addName = (name, course) => {
			name = String(name || "").replace(/\s+/g, " ").trim();
			if (name) {
				coursesByName[name] = coursesByName[name] || [];
				if (!coursesByName[name].includes(course)) coursesByName[name].push(course);
			}
		};
		courseManager.getAllCourses().forEach((course) => {
			addName(courseManager.getGeneralInfo(course)["שם מקצוע"], course);
			addName(courseManager.getCourseName(course), course);
		});
		const typeMatches = (lesson, type) => lesson["סוג"] === type || courseManager.getLessonType(lesson) === type || courseManager.getLessonTypeLabel(lesson["סוג"]) === type;
		const dayNames = [
			"ראשון",
			"שני",
			"שלישי",
			"רביעי",
			"חמישי",
			"שישי",
			"שבת"
		];
		const timeMatches = (lesson, when) => {
			if (!when) return false;
			const time = courseManager.parseLessonTime(lesson["שעה"]);
			return lesson["יום"] === dayNames[when.day] && !!time && time.start === when.time;
		};
		const findLesson = (summary, when) => {
			let parsed = /^(.+?) (\d+) [-–] (.+)$/.exec(summary);
			let type;
			let number;
			let name;
			if (parsed) {
				type = parsed[1];
				number = parseInt(parsed[2], 10);
				name = parsed[3];
			} else {
				parsed = /^(\S+) [-–] (.+)$/.exec(summary);
				if (!parsed) return null;
				type = parsed[1];
				number = null;
				name = parsed[2];
			}
			name = name.replace(/\s+/g, " ").trim();
			const candidates = [];
			(coursesByName[name] || []).forEach((course) => {
				courseManager.getSchedule(course).forEach((lesson) => {
					if (typeMatches(lesson, type) && (number === null ? lesson["סוג"] === "sadna" : parseInt(String(lesson["מס."]), 10) === number)) candidates.push({
						course,
						lesson
					});
				});
			});
			if (candidates.length === 0) return {
				course: null,
				lesson: null
			};
			const exact = candidates.filter((candidate) => timeMatches(candidate.lesson, when));
			return exact.length > 0 ? exact[0] : candidates[0];
		};
		parseEvents(text).forEach((event) => {
			const summary = unescapeText(event.SUMMARY && event.SUMMARY.value).trim();
			if (!summary) return;
			if (!event.RRULE) return;
			const start = parseDateTime(event.DTSTART);
			const end = parseDateTime(event.DTEND);
			const found = findLesson(summary, start);
			if (found && found.course && found.lesson) {
				const course = found.course;
				if (!result.courses[course]) {
					result.courses[course] = {};
					result.courseOrder.push(course);
				}
				result.courses[course][lessonTypeKey(course, found.lesson)] = found.lesson["מס."];
				return;
			}
			if (found && /^.+ \d+ [-–] /.test(summary)) {
				if (!result.unmatched.includes(summary)) result.unmatched.push(summary);
				return;
			}
			if (start && end) result.customEvents.push({
				title: summary,
				day: start.day,
				start: start.time,
				end: end.day === start.day ? end.time : "24:00"
			});
		});
		return result;
	}
	var IcsImport = {
		parseEvents,
		unescapeText,
		match
	};
	// src/app/schedule-sync.ts
	function watchSharedSchedule(onLoadedFunc) {
		let firstDataLoaded = false;
		firestoreUserDoc(scheduleSharingUserId).onSnapshot((result) => {
			const data = result.data();
			setScheduleFromSavedSession(result.exists && data ? savedSessionFromFirestoreData(data) : {}, !firstDataLoaded);
			if (result.exists && data && data.displayName) {
				const displayName = firestoreDisplayNameDecode(data.displayName);
				$("#sharing-user-name").text(displayName);
				$("#sharing-user-known").removeClass("d-none");
				$("#sharing-user-unknown").addClass("d-none");
				setPageTitle(`${displayName} – ${CheeseI18n.t("shell.meta.title")}`);
			} else {
				$("#sharing-user-unknown").removeClass("d-none");
				$("#sharing-user-known").addClass("d-none");
				setPageTitle(CheeseI18n.t("shell.meta.title"));
			}
			if (!firstDataLoaded) {
				onLoadedFunc();
				firstDataLoaded = true;
			}
		}, (error) => {
			alert(CheeseI18n.t("shell.error.loadData", { error }));
		});
	}
	function watchSavedSchedule(onLoadedFunc) {
		const doc = firestoreAuthenticatedUserDoc();
		if (doc) {
			let firstDataLoaded = false;
			state.stopScheduleWatching = doc.onSnapshot((result) => {
				if (result.metadata.hasPendingWrites) return;
				if (!firstDataLoaded) {
					const displayName = firebase.auth().currentUser.displayName;
					if (!result.exists || result.get("displayName") !== displayName) doc.set({ displayName }, { merge: true });
				}
				const data = result.exists ? result.data() : {};
				const session = savedSessionFromFirestoreData(data);
				setScheduleFromSavedSession(session, !firstDataLoaded);
				if (shouldEnableMetadataDiff()) {
					const metadata = savedMetadataFromFirestoreData(data);
					state.metadataDiff = metadata ? computeMetadataDiff(metadata) : null;
					onMetadataDiffChange();
				} else state.metadataDiff = null;
				state.currentSavedSession = session;
				onSavedSessionReset();
				if (!firstDataLoaded) {
					firstDataLoaded = true;
					onLoadedFunc();
				}
			}, (error) => {
				alert(CheeseI18n.t("shell.error.loadData", { error }));
			});
		} else {
			const onStorageEvent = (e) => {
				const prefix = `${currentSemester}_`;
				if (e.key === null || e.key.lastIndexOf(prefix, 0) === 0) {
					const session = savedSessionFromLocalStorage();
					setScheduleFromSavedSession(session, true);
					if (shouldEnableMetadataDiff()) {
						const metadata = savedMetadataFromLocalStorage();
						state.metadataDiff = metadata ? computeMetadataDiff(metadata) : null;
						onMetadataDiffChange();
					} else state.metadataDiff = null;
					state.currentSavedSession = session;
					onSavedSessionReset();
				}
			};
			window.addEventListener("storage", onStorageEvent);
			state.stopScheduleWatching = () => {
				window.removeEventListener("storage", onStorageEvent);
			};
			const session = savedSessionFromLocalStorage();
			setScheduleFromSavedSession(session, false);
			if (shouldEnableMetadataDiff()) {
				const metadata = savedMetadataFromLocalStorage();
				state.metadataDiff = metadata ? computeMetadataDiff(metadata) : null;
				onMetadataDiffChange();
			} else state.metadataDiff = null;
			state.currentSavedSession = session;
			onSavedSessionReset();
			onLoadedFunc();
		}
	}
	function sessionCustomEventCount(session) {
		let count = Object.keys(session[`${currentSemester}_custom_events`] || {}).length;
		sessionExtraLayerIds(session).forEach((layerId) => {
			count += Object.keys(session[`${currentSemester}_layers`][layerId].customEvents).length;
		});
		return count;
	}
	function canonicalJson(value) {
		if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
		if (value && typeof value === "object") {
			const object = value;
			return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
		}
		return JSON.stringify(value);
	}
	function sessionsMerge(accountSession, localSession) {
		const session = sessionCopy(accountSession);
		const semesterCoursesKey = `${currentSemester}_courses`;
		const semesterCustomEventsKey = `${currentSemester}_custom_events`;
		const semesterColorsKey = `${currentSemester}_colors`;
		const semesterLayersKey = `${currentSemester}_layers`;
		session[semesterCoursesKey] = session[semesterCoursesKey] || [];
		session[semesterCustomEventsKey] = session[semesterCustomEventsKey] || {};
		session[semesterColorsKey] = session[semesterColorsKey] || {};
		session[semesterLayersKey] = session[semesterLayersKey] || {};
		const colors = session[semesterColorsKey];
		const localColors = localSession[semesterColorsKey] || {};
		const copyColor = (fromKey, toKey) => {
			if (localColors[fromKey] && !colors[toKey]) colors[toKey] = localColors[fromKey];
		};
		const usedEventIds = {};
		Object.keys(session[semesterCustomEventsKey]).forEach((eventId) => {
			usedEventIds[eventId] = true;
		});
		sessionExtraLayerIds(session).forEach((layerId) => {
			Object.keys(session[semesterLayersKey][layerId].customEvents).forEach((eventId) => {
				usedEventIds[eventId] = true;
			});
		});
		const addCustomEvents = (localEvents, targetEvents) => {
			Object.keys(localEvents || {}).forEach((eventId) => {
				let newEventId = eventId;
				while (usedEventIds[newEventId]) newEventId = String(parseInt(newEventId, 10) + 1);
				usedEventIds[newEventId] = true;
				targetEvents[newEventId] = $.extend(true, {}, localEvents[eventId]);
				copyColor(`custom_event_${eventId}`, `custom_event_${newEventId}`);
			});
		};
		sessionLayerCourses(localSession, "").forEach((course) => {
			if (state.courseManager.doesExist(course) && !session[semesterCoursesKey].includes(course)) {
				session[semesterCoursesKey].push(course);
				session[layerLessonsKey(course, "")] = $.extend(true, {}, localSession[layerLessonsKey(course, "")]);
				copyColor(course, course);
			}
		});
		addCustomEvents(localSession[semesterCustomEventsKey], session[semesterCustomEventsKey]);
		const layers = session[semesterLayersKey];
		sessionExtraLayerIds(localSession).forEach((layerId) => {
			const localLayer = localSession[semesterLayersKey][layerId];
			let newLayerId = layerId;
			while (layers[newLayerId]) newLayerId = `layer${parseInt(newLayerId.slice(5), 10) + 1}`;
			const layer = {
				name: localLayer.name,
				courses: [],
				customEvents: {}
			};
			if (localLayer.hidden) layer.hidden = true;
			layers[newLayerId] = layer;
			localLayer.courses.forEach((course) => {
				if (state.courseManager.doesExist(course) && !layer.courses.includes(course)) {
					layer.courses.push(course);
					session[layerLessonsKey(course, newLayerId)] = $.extend(true, {}, localSession[layerLessonsKey(course, layerId)]);
					copyColor(courseColorKey(course, layerId), courseColorKey(course, newLayerId));
				}
			});
			addCustomEvents(localLayer.customEvents, layer.customEvents);
		});
		return session;
	}
	function localStorageScheduleClear() {
		try {
			const prefix = `${currentSemester}_`;
			const keys = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key !== null && key.lastIndexOf(prefix, 0) === 0) keys.push(key);
			}
			keys.forEach((key) => {
				localStorage.removeItem(key);
			});
		} catch (e) {}
	}
	function offerLocalScheduleImport() {
		const localSession = savedSessionFromLocalStorage();
		const localCourses = sessionAllCourses(localSession).filter((course) => state.courseManager.doesExist(course));
		const localEventCount = sessionCustomEventCount(localSession);
		if (localCourses.length === 0 && localEventCount === 0 || canonicalJson(localSession) === canonicalJson(state.currentSavedSession)) return;
		const summary = (courses, events) => CheeseI18n.t("shell.importLocal.summary", {
			courses,
			events
		});
		const message = $("<div>");
		message.append($("<p>").text(CheeseI18n.t("shell.importLocal.message", {
			local: summary(localCourses.length, localEventCount),
			account: summary(sessionAllCourses(state.currentSavedSession).length, sessionCustomEventCount(state.currentSavedSession))
		})));
		const clearCheckbox = $("<input type=\"checkbox\" class=\"form-check-input\" id=\"import-local-clear\" checked>");
		message.append($("<div class=\"form-check\">").append(clearCheckbox).append($("<label class=\"form-check-label\" for=\"import-local-clear\">").text(CheeseI18n.t("shell.importLocal.clearLocal"))));
		const choose = (dialog, choice) => {
			gtag("event", `import-local-${choice}`);
			dialog.close();
			let newSession = null;
			if (choice === "use") newSession = localSession;
			else if (choice === "merge") newSession = sessionsMerge(state.currentSavedSession, localSession);
			if (newSession) {
				restoreSavedSession(state.currentSavedSession, newSession);
				state.currentSavedSession = sessionCopy(newSession);
				onSavedSessionChange();
			}
			if (clearCheckbox.prop("checked")) localStorageScheduleClear();
		};
		BootstrapDialog.show({
			title: CheeseI18n.t("shell.importLocal.title"),
			message,
			cssClass: "import-local-dialog",
			buttons: [
				{
					id: "import-local-merge",
					label: CheeseI18n.t("shell.importLocal.merge"),
					cssClass: "btn-primary",
					action(dialog) {
						choose(dialog, "merge");
					}
				},
				{
					id: "import-local-use",
					label: CheeseI18n.t("shell.importLocal.useLocal"),
					action(dialog) {
						choose(dialog, "use");
					}
				},
				{
					id: "import-local-keep",
					label: CheeseI18n.t("shell.importLocal.keepAccount"),
					action(dialog) {
						choose(dialog, "keep");
					}
				}
			]
		});
	}
	function sessionFromIcsImport(result) {
		const session = {};
		session[`${currentSemester}_courses`] = result.courseOrder.slice();
		result.courseOrder.forEach((course) => {
			session[layerLessonsKey(course, "")] = $.extend({}, result.courses[course]);
		});
		const customEvents = {};
		let eventId = Math.round(Date.now() / 1e3);
		result.customEvents.forEach((customEvent) => {
			const date = `2017-01-0${customEvent.day + 1}T`;
			customEvents[String(eventId++)] = {
				title: customEvent.title,
				start: `${date + customEvent.start}:00`,
				end: `${date + customEvent.end}:00`
			};
		});
		session[`${currentSemester}_custom_events`] = customEvents;
		session[`${currentSemester}_colors`] = {};
		session[`${currentSemester}_layers`] = {};
		return session;
	}
	function offerIcsImport(text) {
		const result = IcsImport.match(text, state.courseManager, CourseCalendar.getLessonTypeKey);
		const message = $("<div>");
		const unmatchedList = () => {
			if (result.unmatched.length === 0) return;
			message.append($("<p class=\"mb-1\">").text(CheeseI18n.t("shell.importIcs.unmatched", { semester: semesterFriendlyName(currentSemester) })));
			const list = $("<ul class=\"mb-0\">");
			result.unmatched.forEach((summary) => {
				list.append($("<li dir=\"auto\">").text(summary));
			});
			message.append(list);
		};
		if (result.courseOrder.length === 0 && result.customEvents.length === 0) {
			message.append($("<p>").text(CheeseI18n.t("shell.importIcs.nothing")));
			unmatchedList();
			BootstrapDialog.show({
				title: CheeseI18n.t("shell.importIcs.title"),
				message,
				buttons: [{
					label: CheeseI18n.t("shell.dialog.close"),
					action(dialog) {
						dialog.close();
					}
				}]
			});
			return;
		}
		message.append($("<p>").text(CheeseI18n.t("shell.importIcs.found", {
			courses: result.courseOrder.length,
			events: result.customEvents.length,
			semester: semesterFriendlyName(currentSemester)
		})));
		unmatchedList();
		message.append($("<p class=\"mt-3 mb-0 small text-muted\">").text(CheeseI18n.t("shell.importIcs.existingNote")));
		BootstrapDialog.show({
			title: CheeseI18n.t("shell.importIcs.title"),
			message,
			buttons: [{
				id: "import-ics-confirm",
				label: CheeseI18n.t("shell.importIcs.import"),
				cssClass: "btn-primary",
				action(dialog) {
					dialog.close();
					gtag("event", "import-ics");
					const newSession = sessionsMerge(state.currentSavedSession, sessionFromIcsImport(result));
					restoreSavedSession(state.currentSavedSession, newSession);
					state.currentSavedSession = sessionCopy(newSession);
					onSavedSessionChange();
				}
			}, {
				label: CheeseI18n.t("shell.dialog.cancel"),
				action(dialog) {
					dialog.close();
				}
			}]
		});
	}
	function savedSessionFromLocalStorage() {
		const semesterCoursesKey = `${currentSemester}_courses`;
		const session = {};
		try {
			session[semesterCoursesKey] = JSON.parse(localStorage.getItem(semesterCoursesKey) || "[]");
			session[semesterCoursesKey].forEach((course) => {
				const courseKey = layerLessonsKey(course, "");
				session[courseKey] = JSON.parse(localStorage.getItem(courseKey) || "{}");
			});
		} catch (e) {
			session[semesterCoursesKey] = [];
		}
		const semesterCustomEventsKey = `${currentSemester}_custom_events`;
		try {
			session[semesterCustomEventsKey] = JSON.parse(localStorage.getItem(semesterCustomEventsKey) || "{}");
		} catch (e) {
			session[semesterCustomEventsKey] = {};
		}
		const semesterColorsKey = `${currentSemester}_colors`;
		try {
			session[semesterColorsKey] = JSON.parse(localStorage.getItem(semesterColorsKey) || "{}");
		} catch (e) {
			session[semesterColorsKey] = {};
		}
		const semesterLayersKey = `${currentSemester}_layers`;
		try {
			session[semesterLayersKey] = savedLayersSanitize(JSON.parse(localStorage.getItem(semesterLayersKey) || "{}"));
			sessionExtraLayerIds(session).forEach((layerId) => {
				sessionLayerCourses(session, layerId).forEach((course) => {
					const courseKey = layerLessonsKey(course, layerId);
					session[courseKey] = JSON.parse(localStorage.getItem(courseKey) || "{}");
				});
			});
		} catch (e) {
			session[semesterLayersKey] = {};
		}
		return session;
	}
	function savedMetadataFromLocalStorage() {
		let metadata = {};
		try {
			const courses = sessionAllCourses(savedSessionFromLocalStorage());
			courses.forEach((course) => {
				const metadataCourseKey = `${currentSemester}_metadata_${course}`;
				const courseMetadataEncoded = localStorage.getItem(metadataCourseKey);
				if (courseMetadataEncoded) metadata[course] = JSON.parse(courseMetadataEncoded);
			});
			if (courses.length > 0 && Object.keys(metadata).length === 0) metadata = null;
		} catch (e) {}
		return metadata;
	}
	function savedSessionFromFirestoreData(data) {
		const semesterCoursesKey = `${currentSemester}_courses`;
		const session = {};
		session[semesterCoursesKey] = data[semesterCoursesKey] || [];
		session[semesterCoursesKey].forEach((course) => {
			const courseKey = layerLessonsKey(course, "");
			session[courseKey] = data[courseKey] || {};
		});
		const semesterCustomEventsKey = `${currentSemester}_custom_events`;
		session[semesterCustomEventsKey] = data[semesterCustomEventsKey] || {};
		const semesterColorsKey = `${currentSemester}_colors`;
		session[semesterColorsKey] = data[semesterColorsKey] || {};
		const semesterLayersKey = `${currentSemester}_layers`;
		session[semesterLayersKey] = savedLayersSanitize(data[semesterLayersKey]);
		sessionExtraLayerIds(session).forEach((layerId) => {
			sessionLayerCourses(session, layerId).forEach((course) => {
				const courseKey = layerLessonsKey(course, layerId);
				session[courseKey] = data[courseKey] || {};
			});
		});
		return session;
	}
	function savedMetadataFromFirestoreData(data) {
		let metadata = {};
		const courses = sessionAllCourses(savedSessionFromFirestoreData(data));
		courses.forEach((course) => {
			const metadataCourseKey = `${currentSemester}_metadata_${course}`;
			if (data[metadataCourseKey]) metadata[course] = data[metadataCourseKey];
		});
		if (courses.length > 0 && Object.keys(metadata).length === 0) metadata = null;
		return metadata;
	}
	// src/app/auth.ts
	function firebaseInit() {
		firebase.initializeApp({
			apiKey: "AIzaSyDEbZvXmlT5HiVDHwruqpuvI6nSc5DGoLU",
			authDomain: "cheesefork-squared.firebaseapp.com",
			projectId: "cheesefork-squared",
			storageBucket: "cheesefork-squared.firebasestorage.app",
			messagingSenderId: "985208375940",
			appId: "1:985208375940:web:432d864e1636b1bf8ed0d1",
			measurementId: "G-7B3BP56GNV"
		});
		firebase.auth().languageCode = CheeseI18n.getLocale();
		state.firestoreDb = firebase.firestore();
		state.firebaseStorage = firebase.storage();
	}
	function loginTermsNote() {
		const linkByName = {
			terms: {
				url: "https://github.com/talisraeli/cheese-fork/blob/gh-pages/docs/TERMS.md",
				label: CheeseI18n.t("shell.login.termsLink")
			},
			privacy: {
				url: "https://github.com/talisraeli/cheese-fork/blob/gh-pages/docs/PRIVACY.md",
				label: CheeseI18n.t("shell.login.privacyLink")
			}
		};
		const note = $("<p class=\"login-terms-note small text-muted text-center mt-3 mb-0\">");
		CheeseI18n.t("shell.login.terms").split(/(\{terms\}|\{privacy\})/).forEach((part) => {
			const link = linkByName[part.slice(1, -1)];
			if (link && part.charAt(0) === "{") note.append($("<a target=\"_blank\" rel=\"noopener\">").attr("href", link.url).text(link.label));
			else if (part) note.append(document.createTextNode(part));
		});
		return note;
	}
	function firebaseAuthUIInit(onInitialized) {
		const uiConfig = {
			signInFlow: "popup",
			signInOptions: [firebase.auth.GoogleAuthProvider.PROVIDER_ID, firebase.auth.EmailAuthProvider.PROVIDER_ID],
			callbacks: { signInSuccessWithAuthResult(authResult) {
				if (authResult.user) {
					var _state$loginDialog;
					(_state$loginDialog = state.loginDialog) === null || _state$loginDialog === void 0 || _state$loginDialog.close();
				}
				return false;
			} },
			credentialHelper: firebaseui.auth.CredentialHelper.NONE
		};
		const firebaseUI = new firebaseui.auth.AuthUI(firebase.auth());
		let authInitialized = false;
		firebase.auth().onAuthStateChanged((user) => {
			if (user) handleSignedInUser(user);
			else handleSignedOutUser();
			if (!authInitialized) {
				onInitialized();
				authInitialized = true;
			} else if (user) {
				var _state$stopScheduleWa;
				$("#page-loader").show();
				(_state$stopScheduleWa = state.stopScheduleWatching) === null || _state$stopScheduleWa === void 0 || _state$stopScheduleWa.call(state);
				resetSchedule();
				watchSavedSchedule(() => {
					$("#page-loader").hide();
					offerLocalScheduleImport();
				});
			} else {
				var _state$stopScheduleWa2;
				(_state$stopScheduleWa2 = state.stopScheduleWatching) === null || _state$stopScheduleWa2 === void 0 || _state$stopScheduleWa2.call(state);
				resetSchedule();
				watchSavedSchedule(() => {});
			}
		});
		function handleSignedInUser(user) {
			$("#top-navbar-login").addClass("d-none");
			$("#top-navbar-logout").removeClass("d-none").find("a").attr("data-original-title", CheeseI18n.t("shell.login.signedInAs", { name: firestoreDisplayNameDecode(user.displayName || user.email || CheeseI18n.t("shell.login.unknown")) }));
			$("#top-navbar-share").find("a").removeClass("disabled").tooltip("disable");
			$("#top-navbar-api").removeClass("d-none");
		}
		function handleSignedOutUser() {
			$("#top-navbar-logout").addClass("d-none");
			$("#top-navbar-api").addClass("d-none");
			$("#top-navbar-login").removeClass("d-none");
			$("#top-navbar-share").find("a").addClass("disabled").tooltip("enable");
			firebaseUI.start("#firebaseui-auth-container", uiConfig);
		}
	}
	// src/lib/url.ts
	function getParameterByName(name, url) {
		const escapedName = name.replace(/[[\]]/g, "\\$&");
		const results = new RegExp(`[?&]${escapedName}(=([^&#]*)|&|#|$)`).exec(url || window.location.href);
		if (!results) return null;
		if (!results[2]) return "";
		return decodeURIComponent(results[2].replace(/\+/g, " "));
	}
	// src/app/crawlers.ts
	var DAY_FOR_SORTING = {
		ראשון: "א",
		שני: "ב",
		שלישי: "ג",
		רביעי: "ד",
		חמישי: "ה",
		שישי: "ו"
	};
	function crawlersInfo() {
		const courseParameter = getParameterByName("course");
		const staffParameter = getParameterByName("staff");
		const roomParameter = getParameterByName("room");
		if (courseParameter === null && staffParameter === null && roomParameter === null) return false;
		const content = $("<div class=\"col-md-12\">");
		let title = `${semesterFriendlyName(currentSemester)} - CheeseFork²`;
		if (courseParameter !== null) {
			if (state.courseManager.doesExist(courseParameter)) {
				crawlersMakeCourseContent(content, courseParameter);
				title = `${state.courseManager.getTitle(courseParameter)} – ${title}`;
			} else {
				crawlersMakeListHeader(content, "course");
				crawlersMakeCourseListContent(content);
				title = `${CheeseI18n.t("shell.crawler.courses")} – ${title}`;
			}
		} else if (staffParameter !== null) {
			if (crawlersMakeStaffContent(content, staffParameter)) title = `${staffParameter} – ${title}`;
			else {
				crawlersMakeListHeader(content, "staff");
				crawlersMakeStaffListContent(content);
				title = `${CheeseI18n.t("shell.crawler.staff")} – ${title}`;
			}
		} else if (crawlersMakeRoomContent(content, roomParameter)) title = `${roomParameter} – ${title}`;
		else {
			crawlersMakeListHeader(content, "room");
			crawlersMakeRoomListContent(content);
			title = `${CheeseI18n.t("shell.crawler.rooms")} – ${title}`;
		}
		setPageTitle(title);
		$("#content-container").empty().append(content);
		$("#top-navbar-home").removeClass("d-none");
		$("#top-navbar-share").addClass("d-none");
		$("#top-navbar-calendar").addClass("d-none");
		$("#top-navbar-semester").addClass("d-none");
		$("#course-select").hide();
		$("#top-navbar-supported-content").removeClass("top-navbar-content-uninitialized");
		$("#filter-form").remove();
		$("#page-loader").hide();
		return true;
	}
	function crawlersMakeListHeader(content, currentList) {
		Object.keys(availableSemesters).sort().forEach((semester) => {
			const text = semesterFriendlyName(semester);
			if (semester === currentSemester) content.append($("<span>").text(text));
			else {
				const targetList = {};
				targetList[currentList] = "all";
				targetList.semester = semester;
				const url = crawlerUrl(targetList);
				content.append($("<a>").text(text).prop("href", url));
			}
			content.append("<br>");
		});
		content.append("<br>");
		const listToText = {
			course: CheeseI18n.t("shell.crawler.courses"),
			staff: CheeseI18n.t("shell.crawler.staff"),
			room: CheeseI18n.t("shell.crawler.rooms")
		};
		[
			"course",
			"staff",
			"room"
		].forEach((list) => {
			const text = listToText[list];
			if (list === currentList) content.append($("<span>").text(text));
			else {
				const targetList = {};
				targetList[list] = "all";
				const url = crawlerUrl(targetList);
				content.append($("<a>").text(text).prop("href", url));
			}
			content.append("<br>");
		});
		content.append("<br>");
	}
	function crawlersMakeCourseContent(content, course) {
		const url = crawlerUrl({ course: "all" });
		content.append($("<a>").text(CheeseI18n.t("shell.crawler.courseList")).prop("href", url));
		content.append("<br><br>");
		const description = state.courseManager.getDescription(course, {
			html: true,
			relatedCourseInfo: true,
			links: true
		});
		content.append($("<div>").html(description));
		const lessonsAdded = {};
		state.courseManager.getSchedule(course).forEach((lesson) => {
			if (lessonsAdded[lesson["מס."]] && lessonsAdded[lesson["מס."]] !== lesson["קבוצה"]) return;
			content.append("<br>");
			const typeAndNumber = state.courseManager.getLessonTypeAndNumber(lesson);
			content.append($("<div style=\"font-weight: bold;\">").text(typeAndNumber));
			if (lesson["מרצה/מתרגל"]) {
				const staffContents = $("<div>").text(`${state.courseManager.getFieldLabel("מרצה/מתרגל")}: `);
				lesson["מרצה/מתרגל"].split("\n").forEach((name, i) => {
					if (i > 0) staffContents.append(", ");
					const staffUrl = crawlerUrl({ staff: name });
					const staffLink = sourceText(state.courseManager.getStaffLabel(name), "<a>").prop("href", staffUrl);
					staffContents.append(staffLink);
				});
				content.append(staffContents);
			}
			if (lesson["יום"]) content.append($("<div>").text(`${state.courseManager.getFieldLabel("יום")}: ${state.courseManager.getDayLabel(lesson["יום"])}`));
			if (lesson["שעה"]) content.append($("<div>").text(`${state.courseManager.getFieldLabel("שעה")}: ${lesson["שעה"]}`));
			let roomUrl;
			let roomLink;
			if (lesson["בניין"] && lesson["חדר"]) {
				content.append($("<div>").text(`${state.courseManager.getFieldLabel("בניין")}: `).append(sourceText(state.courseManager.getBuildingLabel(lesson["בניין"]))));
				roomUrl = crawlerUrl({ room: `${lesson["בניין"]} ${lesson["חדר"]}` });
				roomLink = sourceText(lesson["חדר"], "<a>").prop("href", roomUrl);
				content.append($("<div>").text(`${state.courseManager.getFieldLabel("חדר")}: `).append(roomLink));
			} else if (lesson["בניין"]) {
				roomUrl = crawlerUrl({ room: lesson["בניין"] });
				roomLink = sourceText(state.courseManager.getBuildingLabel(lesson["בניין"]), "<a>").prop("href", roomUrl);
				content.append($("<div>").text(`${state.courseManager.getFieldLabel("בניין")}: `).append(roomLink));
			} else if (lesson["חדר"]) content.append($("<div>").text(`${state.courseManager.getFieldLabel("חדר")}: `).append(sourceText(lesson["חדר"])));
			lessonsAdded[lesson["מס."]] = lesson["קבוצה"];
		});
	}
	function crawlersMakeCourseListContent(content) {
		state.courseManager.getAllCourses().sort().forEach((cbCourse) => {
			const title = state.courseManager.getTitle(cbCourse);
			const url = crawlerUrl({ course: cbCourse });
			content.append(sourceText(title, "<a>").prop("href", url));
			content.append("<br>");
		});
	}
	function crawlersMakeStaffContent(content, staff) {
		const schedule = [];
		state.courseManager.getAllCourses().forEach((course) => {
			const lessonsAdded = {};
			state.courseManager.getSchedule(course).forEach((lesson) => {
				if (lessonsAdded[lesson["מס."]] && lessonsAdded[lesson["מס."]] !== lesson["קבוצה"]) return;
				if (lesson["מרצה/מתרגל"] && lesson["מרצה/מתרגל"].split("\n").includes(staff)) {
					let time = null;
					if (lesson["יום"]) {
						if (lesson["שעה"]) time = `יום ${lesson["יום"]} ${lesson["שעה"]}`;
						else time = `יום ${lesson["יום"]}`;
					}
					schedule.push({
						course,
						time,
						displayTime: lessonDisplayTime(lesson)
					});
				}
				lessonsAdded[lesson["מס."]] = lesson["קבוצה"];
			});
		});
		if (schedule.length === 0) return false;
		const url = crawlerUrl({ staff: "all" });
		content.append($("<a>").text(CheeseI18n.t("shell.crawler.staffList")).prop("href", url));
		content.append("<br><br>");
		content.append(sourceText(staff, "<b>"));
		content.append("<br>");
		schedule.sort((a, b) => {
			if (!a.time && !b.time) return 0;
			else if (!a.time) return 1;
			else if (!b.time) return -1;
			else {
				const aTimeForCompare = a.time.replace(/^יום (\S+)/, (match, p1) => DAY_FOR_SORTING[p1] || p1);
				const bTimeForCompare = b.time.replace(/^יום (\S+)/, (match, p1) => DAY_FOR_SORTING[p1] || p1);
				return aTimeForCompare.localeCompare(bTimeForCompare, void 0, { numeric: true });
			}
		}).forEach((item) => {
			if (item.time) content.append($("<span>").text(`${item.displayTime} – `));
			const url = crawlerUrl({ course: item.course });
			const courseTitle = state.courseManager.getTitle(item.course);
			content.append(sourceText(courseTitle, "<a>").prop("href", url));
			content.append("<br>");
		});
		return true;
	}
	function crawlersMakeStaffListContent(content) {
		const staff = {};
		state.courseManager.getAllCourses().forEach((course) => {
			state.courseManager.getSchedule(course).forEach((lesson) => {
				if (lesson["מרצה/מתרגל"]) lesson["מרצה/מתרגל"].split("\n").forEach((name) => {
					staff[name] = true;
				});
			});
		});
		Object.keys(staff).sort().forEach((name) => {
			const url = crawlerUrl({ staff: name });
			content.append(sourceText(name, "<a>").prop("href", url));
			content.append("<br>");
		});
	}
	function crawlersMakeRoomContent(content, room) {
		const schedule = [];
		state.courseManager.getAllCourses().forEach((course) => {
			const lessonsAdded = {};
			state.courseManager.getSchedule(course).forEach((lesson) => {
				if (lessonsAdded[lesson["מס."]] && lessonsAdded[lesson["מס."]] !== lesson["קבוצה"]) return;
				let roomCompare = null;
				if (lesson["בניין"]) {
					if (lesson["חדר"]) roomCompare = `${lesson["בניין"]} ${lesson["חדר"]}`;
					else roomCompare = lesson["בניין"];
				}
				if (roomCompare && room === roomCompare) {
					let time = null;
					if (lesson["יום"]) {
						if (lesson["שעה"]) time = `יום ${lesson["יום"]} ${lesson["שעה"]}`;
						else time = `יום ${lesson["יום"]}`;
					}
					schedule.push({
						course,
						time,
						displayTime: lessonDisplayTime(lesson)
					});
				}
				lessonsAdded[lesson["מס."]] = lesson["קבוצה"];
			});
		});
		if (schedule.length === 0) return false;
		const url = crawlerUrl({ room: "all" });
		content.append($("<a>").text(CheeseI18n.t("shell.crawler.roomList")).prop("href", url));
		content.append("<br><br>");
		content.append(sourceText(room, "<b>"));
		content.append("<br>");
		schedule.sort((a, b) => {
			if (!a.time && !b.time) return 0;
			else if (!a.time) return 1;
			else if (!b.time) return -1;
			else {
				const aTimeForCompare = a.time.replace(/^יום (\S+)/, (match, p1) => DAY_FOR_SORTING[p1] || p1);
				const bTimeForCompare = b.time.replace(/^יום (\S+)/, (match, p1) => DAY_FOR_SORTING[p1] || p1);
				return aTimeForCompare.localeCompare(bTimeForCompare, void 0, { numeric: true });
			}
		}).forEach((item) => {
			if (item.time) content.append($("<span>").text(`${item.displayTime} – `));
			const url = crawlerUrl({ course: item.course });
			const courseTitle = state.courseManager.getTitle(item.course);
			content.append(sourceText(courseTitle, "<a>").prop("href", url));
			content.append("<br>");
		});
		return true;
	}
	function crawlersMakeRoomListContent(content) {
		const rooms = {};
		state.courseManager.getAllCourses().forEach((course) => {
			state.courseManager.getSchedule(course).forEach((lesson) => {
				if (lesson["בניין"]) {
					if (lesson["חדר"]) rooms[`${lesson["בניין"]} ${lesson["חדר"]}`] = true;
					else rooms[lesson["בניין"]] = true;
				}
			});
		});
		Object.keys(rooms).sort().forEach((room) => {
			const url = crawlerUrl({ room });
			content.append(sourceText(room, "<a>").prop("href", url));
			content.append("<br>");
		});
	}
	// src/app/api-key.ts
	function apiAssistantPrompt(apiBaseUrl, docsRawUrl, semester) {
		return [
			"Help me manage my CheeseFork² course schedule (Technion) through its HTTP API.",
			"",
			`Base URL: ${apiBaseUrl}`,
			"Authentication: send the header \"Authorization: Bearer YOUR_API_KEY\" with every request.",
			`Full documentation: ${docsRawUrl}`,
			"",
			"Key facts:",
			`- Semesters are YYYYSS: YYYY01 is winter YYYY–YYYY+1, YYYY02 spring, YYYY03 summer. My current semester is ${semester}.`,
			"- GET /semesters/{semester}/schedule returns my whole schedule, GET /semesters/{semester}/courses my courses.",
			"- POST /semesters/{semester}/courses with {\"course\": \"02340114\"} adds a course; DELETE /semesters/{semester}/courses/{course} removes it.",
			"- GET /semesters lists the semesters. GET /semesters/{semester}/catalog?q=... searches courses by number or Hebrew name.",
			"- GET /semesters/{semester}/catalog/{course} lists the lessons of a course. Choose one with PUT /semesters/{semester}/courses/{course}/lessons/{type} and {\"number\": 11}, where type is lecture, tutorial, lab, seminar, project or workshop.",
			"- GET /semesters/{semester}/conflicts lists overlapping lessons and events. Layers are alternative plans: GET/POST /semesters/{semester}/layers, POST .../layers/{layer}/duplicate, and ?layer={layer} on other endpoints.",
			"- Custom weekly events: POST /semesters/{semester}/custom-events with {\"title\": \"Gym\", \"day\": \"monday\", \"startTime\": \"08:30\", \"endTime\": \"10:00\"}.",
			"- Errors return {\"error\": {\"code\", \"message\"}}. The limit is 60 requests per minute; on 429, wait for the Retry-After seconds.",
			"",
			"Read the documentation before making changes. If you can make HTTP requests, call the API yourself; otherwise give me curl commands to run. If I have not given you my API key yet, ask me for it. Before removing courses or events, or replacing chosen lessons, tell me what will change and wait for my confirmation."
		].join("\n");
	}
	function showApiKeyDialog() {
		const apiBaseUrl = "https://api.cf.talisrae.li/v1";
		const docsUrl = "https://github.com/talisraeli/cheese-fork/blob/gh-pages/docs/API.md";
		const docsRawUrl = "https://raw.githubusercontent.com/talisraeli/cheese-fork/gh-pages/docs/API.md";
		const functions = firebase.functions();
		const content = $("<div class=\"api-key-dialog\">");
		const docsLink = $("<a target=\"_blank\" rel=\"noopener\">").attr("href", docsUrl).text(CheeseI18n.t("shell.api.docs"));
		$("<p>").text(`${CheeseI18n.t("shell.api.intro")} `).append(docsLink).appendTo(content);
		$("<p>").text(CheeseI18n.t("shell.api.baseUrl")).append($("<code class=\"d-block text-left\" dir=\"ltr\">").text(apiBaseUrl)).appendTo(content);
		const status = $("<p class=\"api-key-status\">").text(CheeseI18n.t("shell.api.loading")).appendTo(content);
		const newKey = $("<div class=\"api-key-new d-none\">").appendTo(content);
		const prompt = apiAssistantPrompt(apiBaseUrl, docsRawUrl, currentSemester);
		const promptSection = $("<div class=\"api-key-prompt\">").appendTo(content);
		$("<p class=\"mb-1\">").text(CheeseI18n.t("shell.api.promptIntro")).appendTo(promptSection);
		$("<textarea class=\"form-control text-monospace small\" rows=\"6\" readonly dir=\"ltr\">").val(prompt).on("focus click", function() {
			this.select();
		}).appendTo(promptSection);
		const promptCopyButton = $("<button type=\"button\" class=\"btn btn-outline-secondary btn-sm mt-1\">").text(CheeseI18n.t("shell.api.promptCopy")).click(() => {
			copyToClipboard(prompt, () => {
				promptCopyButton.text(CheeseI18n.t("shell.api.copied"));
			}, () => {
				alert(CheeseI18n.t("shell.error.copy"));
			});
		}).appendTo(promptSection);
		let hasKey = false;
		let busy = true;
		function formatTime(millis) {
			const dateLocale = CheeseI18n.getLocale() === "ar" ? "ar-u-nu-latn" : CheeseI18n.getLocale();
			return millis ? new Date(millis).toLocaleString(dateLocale) : CheeseI18n.t("shell.api.never");
		}
		function showStatus(result) {
			hasKey = !!result.exists;
			if (hasKey) status.text(CheeseI18n.t("shell.api.status", {
				hint: `${result.hint}…`,
				created: formatTime(result.createdAt),
				used: formatTime(result.lastUsedAt)
			}));
			else status.text(CheeseI18n.t("shell.api.none"));
		}
		function showNewKey(key) {
			const input = $("<input type=\"text\" class=\"form-control\" readonly dir=\"ltr\">").val(key);
			input.on("focus click", function() {
				this.select();
			});
			const copyButton = $("<button type=\"button\" class=\"btn btn-outline-secondary\">").text(CheeseI18n.t("shell.api.copy")).click(() => {
				copyToClipboard(key, () => {
					copyButton.text(CheeseI18n.t("shell.api.copied"));
				}, () => {
					alert(CheeseI18n.t("shell.error.copy"));
				});
			});
			newKey.empty().append($("<p class=\"text-warning\">").text(CheeseI18n.t("shell.api.copyNow"))).append($("<div class=\"input-group\">").append(input).append($("<div class=\"input-group-append\">").append(copyButton))).removeClass("d-none");
		}
		function hideNewKey() {
			newKey.addClass("d-none").empty();
		}
		function updateButtons(dialog) {
			const createButton = dialog.getButton("api-key-create");
			createButton.text(CheeseI18n.t(hasKey ? "shell.api.replace" : "shell.api.create"));
			createButton.prop("disabled", busy);
			dialog.getButton("api-key-revoke").toggleClass("d-none", !hasKey).prop("disabled", busy);
		}
		function call(dialog, name, onResult) {
			busy = true;
			updateButtons(dialog);
			functions.httpsCallable(name)().then((response) => {
				busy = false;
				onResult(response.data);
				updateButtons(dialog);
			}, (error) => {
				busy = false;
				updateButtons(dialog);
				status.text(CheeseI18n.t("shell.api.error", { error: error.message }));
			});
		}
		function confirmIf(condition, message, okLabel, onConfirmed) {
			if (!condition) {
				onConfirmed();
				return;
			}
			BootstrapDialog.confirm({
				title: CheeseI18n.t("shell.api.title"),
				message,
				type: BootstrapDialog.TYPE_WARNING,
				btnOKLabel: okLabel,
				btnCancelLabel: CheeseI18n.t("shell.dialog.cancel"),
				callback(confirmed) {
					if (confirmed) onConfirmed();
				}
			});
		}
		call(BootstrapDialog.show({
			title: CheeseI18n.t("shell.api.title"),
			message: content,
			buttons: [
				{
					id: "api-key-create",
					label: CheeseI18n.t("shell.api.create"),
					cssClass: "btn-primary",
					action(dialog) {
						confirmIf(hasKey, CheeseI18n.t("shell.api.replaceConfirm"), CheeseI18n.t("shell.api.replace"), () => {
							gtag("event", "api-key-create");
							call(dialog, "apiKeyCreate", (result) => {
								showStatus({
									exists: true,
									hint: result.hint,
									createdAt: result.createdAt,
									lastUsedAt: null
								});
								showNewKey(result.key);
							});
						});
					}
				},
				{
					id: "api-key-revoke",
					label: CheeseI18n.t("shell.api.revoke"),
					cssClass: "btn-outline-danger d-none",
					action(dialog) {
						confirmIf(true, CheeseI18n.t("shell.api.revokeConfirm"), CheeseI18n.t("shell.api.revoke"), () => {
							gtag("event", "api-key-revoke");
							call(dialog, "apiKeyRevoke", (result) => {
								hideNewKey();
								showStatus(result);
							});
						});
					}
				},
				{
					label: CheeseI18n.t("shell.dialog.close"),
					action(dialog) {
						dialog.close();
					}
				}
			]
		}), "apiKeyStatus", showStatus);
	}
	// src/app/templates/scans-popup.html?cheesefork-template
	var scans_popup_default = "<a href=\"https://scans.cheesefork.cf/\" target=\"_blank\" rel=\"noopener\" data-gtag-event=\"scans-click-logo\">\n    <img src=\"https://scans.cheesefork.cf/scanner_technion.png\" width=\"30%\" class=\"mx-auto d-block\" alt=\"{{t:shell.scans.logo}}\">\n</a><br>\n{{t:shell.scans.studying}}<br>\n{{t:shell.scans.find}}<br>\n{{t:shell.scans.contribute}}<br>\n<br>\n{{t:shell.scans.invitation}}<a href=\"https://scans.cheesefork.cf/\" target=\"_blank\" rel=\"noopener\" data-gtag-event=\"scans-click-link\">{{t:shell.scans.link}}</a>{{t:shell.scans.help}}<br>\n{{t:shell.scans.goodLuck}}<br>\n<br>\n<div class=\"form-check\">\n    <input class=\"form-check-input\" type=\"checkbox\" id=\"dont-show-technion-scans-popup\"> <label class=\"form-check-label\" for=\"dont-show-technion-scans-popup\">{{t:shell.notice.dontShow}}</label>\n</div>\n";
	// src/app/templates/weekly-popup.html?cheesefork-template
	var weekly_popup_default = "{{t:shell.weekly.message}}<br>\n<br>\n<div class=\"form-check\">\n    <input class=\"form-check-input\" type=\"checkbox\" id=\"dont-show-thursday-graph-popup\"> <label class=\"form-check-label\" for=\"dont-show-thursday-graph-popup\">{{t:shell.weekly.dontShow}}</label>\n</div>\n<br>\n<div class=\"facebook-iframe-container\"></div>\n";
	// src/app/popups.ts
	function showExtraContentOnLoad() {
		showWhatsNewPopup(() => showIntro() || showThursdayGraphPopup() || showTechnionScansPopup());
	}
	function showWhatsNewPopup(onDone, force) {
		try {
			const seenVersion = parseInt(String(localStorage.getItem("whatsNewSeenVersion")), 10);
			if (!force && seenVersion >= 4) {
				onDone();
				return;
			}
		} catch (e) {}
		const features = [
			{
				key: "layers",
				icon: "fas fa-layer-group"
			},
			{
				key: "colors",
				icon: "fas fa-palette"
			},
			{
				key: "calendar",
				icon: "fas fa-calendar-check"
			},
			{
				key: "import",
				icon: "fas fa-file-upload"
			},
			{
				key: "language",
				icon: "fas fa-globe"
			},
			{
				key: "api",
				icon: "fas fa-key"
			}
		];
		const t = (feature, name) => CheeseI18n.t(`shell.whatsNew.${feature.key}.${name}`);
		const hasText = (feature, name) => {
			const key = `shell.whatsNew.${feature.key}.${name}`;
			return CheeseI18n.t(key) !== key;
		};
		const featureIcon = (feature) => $("<span class=\"whats-new-icon text-warning\" aria-hidden=\"true\">").append($("<i>").addClass(feature.icon));
		const pages = [];
		const welcomePage = $("<div class=\"whats-new-page\">");
		welcomePage.append($("<p>").text(CheeseI18n.t("shell.whatsNew.intro")));
		const overview = $("<ul class=\"list-unstyled mb-2\">");
		features.forEach((feature, i) => {
			const item = $("<button type=\"button\" class=\"whats-new-item\">").append(featureIcon(feature)).append($("<span class=\"whats-new-item-text\">").append($("<h6 class=\"mb-0 font-weight-bold\">").text(t(feature, "title")))).click(() => {
				showPage(i + 1);
			});
			overview.append($("<li>").append(item));
		});
		welcomePage.append(overview);
		welcomePage.append($("<p class=\"small text-muted mb-0\">").text(CheeseI18n.t("shell.whatsNew.overviewHint")));
		pages.push(welcomePage);
		features.forEach((feature) => {
			const page = $("<div class=\"whats-new-page\">");
			page.append($("<div class=\"whats-new-page-header\">").append(featureIcon(feature)).append($("<h5 class=\"mb-0 font-weight-bold\">").text(t(feature, "title"))));
			page.append($("<p>").text(t(feature, "text")));
			page.append($("<h6 class=\"font-weight-bold\">").text(CheeseI18n.t("shell.whatsNew.howTo")));
			const steps = $("<ol class=\"whats-new-steps\">");
			t(feature, "steps").split("\n").forEach((step) => {
				steps.append($("<li>").text(step));
			});
			page.append(steps);
			if (hasText(feature, "note")) page.append($("<div class=\"whats-new-note\">").append($("<strong>").text(`${CheeseI18n.t("shell.whatsNew.note")}: `)).append($("<span>").text(t(feature, "note"))));
			pages.push(page);
		});
		const pagesContainer = $("<div class=\"whats-new-pages\">");
		pages.forEach((page) => {
			pagesContainer.append(page);
		});
		const dots = $("<div class=\"whats-new-dots\">");
		pages.forEach((page, i) => {
			dots.append($("<button type=\"button\" class=\"whats-new-dot\">").attr("aria-label", CheeseI18n.t("shell.whatsNew.goToPage", {
				number: i + 1,
				count: pages.length
			})).click(() => {
				showPage(i);
			}));
		});
		const message = $("<div class=\"whats-new\">").append(pagesContainer, dots);
		let dialog = null;
		let currentPage = 0;
		function showPage(index) {
			currentPage = Math.max(0, Math.min(index, pages.length - 1));
			pages.forEach((page, i) => {
				page.toggleClass("d-none", i !== currentPage);
			});
			dots.children().each(function(i) {
				$(this).toggleClass("active", i === currentPage).attr("aria-current", i === currentPage ? "step" : null);
			});
			pagesContainer.scrollTop(0);
			if (dialog) {
				const last = currentPage === pages.length - 1;
				dialog.getButton("whats-new-previous").toggleClass("d-none", currentPage === 0);
				dialog.getButton("whats-new-skip").toggleClass("d-none", last);
				dialog.getButton("whats-new-next").text(CheeseI18n.t(last ? "shell.tour.done" : "shell.tour.next"));
			}
			if (currentPage > 0) gtag("event", `whats-new-page-${features[currentPage - 1].key}`);
		}
		showPage(0);
		gtag("event", "whats-new-show");
		dialog = BootstrapDialog.show({
			title: CheeseI18n.t("shell.whatsNew.title"),
			message,
			cssClass: "whats-new-dialog",
			buttons: [
				{
					id: "whats-new-skip",
					label: CheeseI18n.t("shell.tour.skip"),
					cssClass: "btn-link whats-new-skip",
					action(dialog) {
						dialog.close();
					}
				},
				{
					id: "whats-new-previous",
					label: CheeseI18n.t("shell.tour.previous"),
					cssClass: "btn-secondary",
					action() {
						showPage(currentPage - 1);
					}
				},
				{
					id: "whats-new-next",
					label: CheeseI18n.t("shell.tour.next"),
					cssClass: "btn-primary",
					action(dialog) {
						if (currentPage === pages.length - 1) dialog.close();
						else showPage(currentPage + 1);
					}
				}
			],
			onhide() {
				try {
					localStorage.setItem("whatsNewSeenVersion", 4 .toString());
				} catch (e) {}
			},
			onhidden() {
				onDone();
			}
		});
		dialog.getModal().on("keydown", (event) => {
			if ($(event.target).is("input, textarea, select")) return;
			const forward = CheeseI18n.isRTL() ? "ArrowLeft" : "ArrowRight";
			const backward = CheeseI18n.isRTL() ? "ArrowRight" : "ArrowLeft";
			if (event.key === forward || event.key === backward) {
				event.preventDefault();
				showPage(currentPage + (event.key === forward ? 1 : -1));
			}
		});
		showPage(0);
	}
	function showIntro() {
		try {
			if (localStorage.getItem("dontShowIntro")) return false;
		} catch (e) {}
		if (state.courseButtonList.getCourseNumbers(true).length > 0) {
			try {
				localStorage.setItem("dontShowIntro", Date.now().toString());
			} catch (e) {}
			return false;
		}
		introJs().setOptions({
			nextLabel: CheeseI18n.t("shell.tour.next"),
			prevLabel: CheeseI18n.t("shell.tour.previous"),
			skipLabel: CheeseI18n.t("shell.tour.skip"),
			doneLabel: CheeseI18n.t("shell.tour.done"),
			disableInteraction: true,
			exitOnOverlayClick: false,
			showStepNumbers: false,
			scrollToElement: false,
			helperElementPadding: 0
		}).onexit(() => {
			try {
				localStorage.setItem("dontShowIntro", Date.now().toString());
			} catch (e) {}
		}).start();
		return true;
	}
	function showThursdayGraphPopup() {
		if (/* @__PURE__ */ new Date() < /* @__PURE__ */ new Date("2019-05-09T08:00:00")) return false;
		try {
			const nextShowDate = localStorage.getItem("nextShowThursdayGraphPopup");
			if (nextShowDate && Date.now() < Number(nextShowDate)) return false;
		} catch (e) {}
		BootstrapDialog.show({
			title: CheeseI18n.t("shell.weekly.title"),
			message: render(weekly_popup_default),
			onshown(dialog) {
				const modalBody = dialog.getModalBody();
				const width = Math.floor(modalBody.width());
				const height = 400;
				const frameSrc = `https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fcheesefork.technion%2F&tabs=timeline&width=${width}&height=${height}&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=true&appId=863730240682785`;
				const frameElem = $("<iframe scrolling=\"no\" frameborder=\"0\" allowTransparency=\"true\" allow=\"encrypted-media\">").attr({
					src: frameSrc,
					title: CheeseI18n.t("shell.weekly.frameTitle")
				}).width(width).height(height);
				modalBody.find(".facebook-iframe-container").empty().append(frameElem);
			},
			buttons: [{
				label: CheeseI18n.t("shell.dialog.close"),
				action(dialog) {
					dialog.close();
				}
			}],
			onhide(dialog) {
				const nextShowDate = /* @__PURE__ */ new Date();
				if (document.getElementById("dont-show-thursday-graph-popup").checked) {
					gtag("event", "thursday-graph-dont-show");
					nextShowDate.setFullYear(nextShowDate.getFullYear() + 1);
				} else {
					if (nextShowDate.getHours() >= 8) nextShowDate.setDate(nextShowDate.getDate() + 1);
					nextShowDate.setHours(8, 0, 0, 0);
					while (nextShowDate.getDay() !== 4) nextShowDate.setDate(nextShowDate.getDate() + 1);
				}
				try {
					localStorage.setItem("nextShowThursdayGraphPopup", nextShowDate.valueOf().toString());
				} catch (e) {}
			}
		});
		return true;
	}
	function showTechnionScansPopup() {
		if (Object.keys(availableSemesters).some((semester) => {
			const now = Date.now();
			const item = availableSemesters[semester];
			const startDate = new Date(item.start);
			const endDate = new Date(item.end);
			endDate.setDate(endDate.getDate() - 7);
			return now >= startDate.getTime() && now <= endDate.getTime();
		})) return false;
		try {
			const dontShowDate = localStorage.getItem("dontShowTechnionScansPopup");
			if (dontShowDate) {
				if ((Date.now() - parseInt(dontShowDate, 10)) / 864e5 <= 30) return false;
			}
		} catch (e) {}
		BootstrapDialog.show({
			title: CheeseI18n.t("shell.scans.title"),
			message: render(scans_popup_default),
			buttons: [{
				label: CheeseI18n.t("shell.scans.open"),
				cssClass: "btn-primary",
				action(dialog) {
					gtag("event", "scans-click-button");
					const win = window.open("https://scans.cheesefork.cf/", "_blank", "noopener");
					if (win) win.focus();
				}
			}, {
				label: CheeseI18n.t("shell.dialog.close"),
				action(dialog) {
					dialog.close();
				}
			}],
			onhide(dialog) {
				if (document.getElementById("dont-show-technion-scans-popup").checked) {
					gtag("event", "scans-dont-show");
					try {
						localStorage.setItem("dontShowTechnionScansPopup", Date.now().toString());
					} catch (e) {}
				}
			}
		});
		return true;
	}
	// src/app/templates/export-calendar.html?cheesefork-template
	var export_calendar_default = "{{t:shell.export.explanation}}<br><br>\n{{t:shell.export.link}}<span class=\"calendar-link-placeholder\">{{t:shell.export.updating}}</span>.\n";
	// src/app/navbar.ts
	function navbarInit() {
		$("#top-navbar-print-section-title").text(semesterFriendlyName(currentSemester));
		$("#top-navbar-dropdown-semester-name").text(semesterFriendlyName(currentSemester));
		$("#top-navbar-guide").click((event) => {
			event.preventDefault();
			gtag("event", "navbar-guide");
			showWhatsNewPopup(() => {}, true);
		});
		if (!state.viewingSharedSchedule) {
			const semesterSelect = $("#top-navbar-semester").find(".dropdown-menu");
			Object.keys(availableSemesters).sort().reverse().forEach((semester) => {
				const link = $("<a class=\"dropdown-item\">").prop("href", shellUrl({ semester })).text(semesterFriendlyName(semester));
				if (semester === currentSemester) link.addClass("active");
				semesterSelect.append(link);
			});
			$("#top-navbar-changes").click((event) => {
				event.preventDefault();
				gtag("event", "navbar-changes");
				BootstrapDialog.show({
					title: CheeseI18n.t("shell.changes.title"),
					message: getPrettyMetadataDiff(),
					buttons: [{
						label: CheeseI18n.t("shell.changes.accept"),
						cssClass: "btn-primary",
						action(dialog) {
							gtag("event", state.metadataDiff ? "metadata-to-current" : "metadata-first-time");
							setMetadataToCurrent();
							dialog.close();
						}
					}, {
						label: CheeseI18n.t("shell.dialog.close"),
						action(dialog) {
							dialog.close();
						}
					}]
				});
			});
			$("#top-navbar-login").click((event) => {
				event.preventDefault();
				gtag("event", "navbar-login");
				if (state.loginDialog) {
					state.loginDialog.open();
					return;
				}
				state.loginDialog = BootstrapDialog.show({
					title: CheeseI18n.t("shell.login.title"),
					message: $("<div>").append($("#firebaseui-auth-container"), loginTermsNote()),
					buttons: [{
						label: CheeseI18n.t("shell.dialog.close"),
						action(dialog) {
							dialog.close();
						}
					}],
					autodestroy: false
				});
			});
			$("#top-navbar-logout").click(function(event) {
				event.preventDefault();
				gtag("event", "navbar-logout");
				$(this).find("[data-toggle=\"tooltip\"]").tooltip("hide");
				BootstrapDialog.show({
					title: CheeseI18n.t("shell.logout.title"),
					message: CheeseI18n.t("shell.logout.message"),
					buttons: [{
						label: CheeseI18n.t("shell.nav.logout"),
						cssClass: "btn-primary",
						action(dialog) {
							firebase.auth().signOut();
							dialog.close();
						}
					}, {
						label: CheeseI18n.t("shell.dialog.cancel"),
						action(dialog) {
							dialog.close();
						}
					}]
				});
			});
			$("#top-navbar-share").click(function(event) {
				event.preventDefault();
				if ($(this).find("a").hasClass("disabled")) return;
				gtag("event", "navbar-share");
				const url = shellUrl({
					semester: currentSemester,
					uid: firebase.auth().currentUser.uid
				});
				const urlElement = $("<a target=\"_blank\" rel=\"noopener\">").text(CheeseI18n.t("shell.share.open")).prop("href", url);
				const shareDialogContent = $("<div>").text(CheeseI18n.t("shell.share.link")).append(urlElement).append(".");
				BootstrapDialog.show({
					title: CheeseI18n.t("shell.nav.share"),
					message: shareDialogContent,
					buttons: [{
						label: CheeseI18n.t("shell.share.copy"),
						cssClass: "btn-primary",
						action(dialog) {
							copyToClipboard(url, () => {
								dialog.close();
							}, () => {
								alert(CheeseI18n.t("shell.error.copy"));
							});
						}
					}, {
						label: CheeseI18n.t("shell.dialog.close"),
						action(dialog) {
							dialog.close();
						}
					}]
				});
			});
			$("#top-navbar-api").click(function(event) {
				event.preventDefault();
				gtag("event", "navbar-api");
				$(this).find("[data-toggle=\"tooltip\"]").tooltip("hide");
				showApiKeyDialog();
			});
			$("#top-navbar-undo").click(function(event) {
				event.preventDefault();
				gtag("event", "navbar-undo");
				$(this).find("[data-toggle=\"tooltip\"]").tooltip("hide");
				makeUndo();
			});
			$("#top-navbar-redo").click(function(event) {
				event.preventDefault();
				gtag("event", "navbar-redo");
				$(this).find("[data-toggle=\"tooltip\"]").tooltip("hide");
				makeRedo();
			});
			initUndoRedoKeyboardShortcuts();
			$("#top-navbar-import").removeClass("d-none").click((event) => {
				event.preventDefault();
				gtag("event", "navbar-import");
				$("#import-ics-file").val("").trigger("click");
			});
			$("#import-ics-file").on("change", function() {
				const file = this.files && this.files[0];
				if (!file) return;
				const reader = new FileReader();
				reader.onload = () => {
					offerIcsImport(String(reader.result));
				};
				reader.onerror = () => {
					BootstrapDialog.show({
						title: CheeseI18n.t("shell.dialog.danger"),
						message: CheeseI18n.t("shell.importIcs.readError"),
						size: BootstrapDialog.SIZE_SMALL
					});
				};
				reader.readAsText(file);
			});
		}
		$("#top-navbar-export").click((event) => {
			event.preventDefault();
			gtag("event", "navbar-export");
			loadCalendarDaysOff((daysOff) => {
				const icsCal = buildScheduleCalendar(daysOff);
				const errorEmptySchedule = () => {
					BootstrapDialog.show({
						title: CheeseI18n.t("shell.export.emptyTitle"),
						message: CheeseI18n.t("shell.export.empty"),
						size: BootstrapDialog.SIZE_SMALL
					});
				};
				if (state.viewingSharedSchedule || typeof firebase === "undefined" || firebase.auth().currentUser === null) {
					if (!icsCal.download(semesterFriendlyNameForFileName(currentSemester))) errorEmptySchedule();
					return;
				}
				const calendar = icsCal.build();
				if (!calendar) {
					errorEmptySchedule();
					return;
				}
				const uid = firebase.auth().currentUser.uid;
				const calendarUrl = calendarFileUrl(uid);
				const exportCalendarDialog = BootstrapDialog.show({
					title: CheeseI18n.t("shell.export.title"),
					message: render(export_calendar_default),
					onshow(dialog) {
						dialog.getButton("copy-link").disable();
					},
					buttons: [{
						id: "copy-link",
						label: CheeseI18n.t("shell.share.copy"),
						cssClass: "btn-primary",
						action(dialog) {
							copyToClipboard(calendarUrl, () => {
								dialog.close();
							}, () => {
								alert(CheeseI18n.t("shell.error.copy"));
							});
						}
					}, {
						label: CheeseI18n.t("shell.dialog.close"),
						action(dialog) {
							dialog.close();
						}
					}]
				});
				uploadCalendarFile(uid, calendar).then(() => {
					state.calendarAutoUpload.uid = uid;
					state.calendarAutoUpload.exported = true;
					const urlElement = $("<a target=\"_blank\" rel=\"noopener\">").text(CheeseI18n.t("shell.export.download")).prop("href", calendarUrl);
					exportCalendarDialog.getModalBody().find(".calendar-link-placeholder").empty().append(urlElement);
					exportCalendarDialog.getButton("copy-link").enable();
				}, (error) => {
					alert(CheeseI18n.t("shell.error.saveCalendar", { error: error.message }));
				});
			}, () => {
				BootstrapDialog.show({
					title: CheeseI18n.t("shell.dialog.danger"),
					message: CheeseI18n.t("shell.export.holidaysError"),
					size: BootstrapDialog.SIZE_SMALL
				});
			});
		});
	}
	// src/app/init.ts
	function cheeseforkInit() {
		if (getScrollBarWidth() > .5) $("body").overlayScrollbars({}).removeClass("os-host-rtl");
		$("[data-toggle=\"tooltip\"]").tooltip();
		state.viewingSharedSchedule = scheduleSharingUserId ? true : false;
		if (!state.viewingSharedSchedule) state.collapsedLayerIds = collapsedLayersLoad();
		navbarInit();
		if (!state.viewingSharedSchedule) state.courseSelect = new CourseSelect($("#course-select"), {
			courseManager: state.courseManager,
			onItemAdd(course) {
				const layerId = state.courseButtonList.getActiveLayerId();
				state.courseButtonList.expandLayer(layerId);
				if (!state.courseButtonList.isCourseInList(course, layerId)) {
					state.courseButtonList.addCourse(course, layerId);
					if (isLayerVisible(layerId)) state.courseCalendar.addCourse(course, layerId);
					selectedCourseSave(course, layerId);
					updateGeneralInfoLine();
					state.courseExamInfo.renderCourses(getVisibleCourseNumbers());
					setTimeout(() => {
						state.courseSelect.filterApply();
					}, 0);
				}
			},
			onDropdownItemActivate(course) {
				const layerId = state.courseButtonList.getActiveLayerId();
				state.previewingFromSelectControl = course;
				state.previewingFromSelectControlLayerId = layerId;
				if (!state.courseButtonList.isCourseInList(course, layerId) && isLayerVisible(layerId)) {
					state.courseCalendar.addCourse(course, layerId);
					const courseNumbers = getVisibleCourseNumbers();
					if (!courseNumbers.includes(course)) courseNumbers.push(course);
					state.courseExamInfo.renderCourses(courseNumbers);
				}
				state.courseExamInfo.setHighlighted(course);
				state.courseCalendar.previewCourse(course, layerId);
				state.courseButtonList.setFloatingCourseInfo(course);
			},
			onDropdownItemDeactivate(course) {
				const layerId = state.previewingFromSelectControlLayerId;
				if (!state.courseButtonList.isCourseInList(course, layerId)) {
					state.courseCalendar.removeCourse(course, layerId);
					state.courseExamInfo.renderCourses(getVisibleCourseNumbers());
				} else {
					state.courseExamInfo.removeHighlighted(course);
					state.courseCalendar.unpreviewCourse(course, layerId);
				}
				state.previewingFromSelectControl = null;
			},
			getSelectedCoursesForFilter() {
				return getVisibleCourseNumbers();
			}
		});
		else {
			$("#top-navbar-home").removeClass("d-none");
			$("#top-navbar-share").addClass("d-none");
			$("#top-navbar-semester").addClass("d-none");
			$("#course-select").hide();
		}
		state.courseButtonList = new CourseButtonList($("#course-button-list"), {
			courseManager: state.courseManager,
			colorGenerator: courseColorGenerator,
			textColorGenerator: courseTextColorGenerator,
			readonly: state.viewingSharedSchedule,
			onHoverIn(course, layerId) {
				state.courseExamInfo.setHovered(course);
				if (state.previewingFromSelectControl) state.courseCalendar.unpreviewCourse(state.previewingFromSelectControl, state.previewingFromSelectControlLayerId);
				state.courseCalendar.previewCourse(course, layerId);
			},
			onHoverOut(course, layerId) {
				state.courseExamInfo.removeHovered(course);
				state.courseCalendar.unpreviewCourse(course, layerId);
				if (state.previewingFromSelectControl) state.courseCalendar.previewCourse(state.previewingFromSelectControl, state.previewingFromSelectControlLayerId);
			},
			onEnableCourse(course, layerId) {
				if (isLayerVisible(layerId)) {
					state.courseCalendar.addCourse(course, layerId);
					state.courseCalendar.previewCourse(course, layerId);
				}
				selectedCourseSave(course, layerId);
				updateGeneralInfoLine();
				state.courseExamInfo.renderCourses(getVisibleCourseNumbers());
				state.courseSelect.filterApply();
			},
			onDisableCourse(course, layerId) {
				state.courseCalendar.removeCourse(course, layerId);
				selectedCourseUnsave(course, layerId);
				updateGeneralInfoLine();
				state.courseExamInfo.renderCourses(getVisibleCourseNumbers());
				state.courseSelect.filterApply();
			},
			onReorder: coursesOrderSave,
			onCourseMove: layerCourseMove,
			onLayerCreate: layerCreate,
			onLayerDuplicate: layerDuplicate,
			onLayerRename: layerRename,
			onLayerDelete: layerDelete,
			onLayerVisibilityChange: layerVisibilityChange,
			onLayerCollapseChange: layerCollapseChange,
			onCustomEventHoverIn(eventId) {
				state.courseCalendar.setCustomEventHighlighted(eventId, true);
			},
			onCustomEventHoverOut(eventId) {
				state.courseCalendar.setCustomEventHighlighted(eventId, false);
			},
			onCustomEventMove: layerCustomEventMove,
			onCustomEventRemove: layerCustomEventRemove
		});
		state.courseExamInfo = new CourseExamInfo($("#course-exam-info"), {
			courseManager: state.courseManager,
			colorGenerator(course) {
				return courseColorGenerator(course, null, getLayerIdsOfCourse(course).filter(isLayerVisible)[0] || "");
			},
			textColorGenerator(course) {
				return courseTextColorGenerator(course, null, getLayerIdsOfCourse(course).filter(isLayerVisible)[0] || "");
			},
			onHoverIn(course) {
				const wrapper = $("#course-exam-info-wrapper");
				wrapper.css("flex", `0 0 ${wrapper.outerHeight()}px`);
				state.courseButtonList.setHovered(course);
				if (state.previewingFromSelectControl) state.courseCalendar.unpreviewCourse(state.previewingFromSelectControl, state.previewingFromSelectControlLayerId);
				getLayerIdsOfCourse(course).forEach((layerId) => {
					state.courseCalendar.previewCourse(course, layerId);
				});
			},
			onHoverOut(course) {
				state.courseButtonList.removeHovered(course);
				getLayerIdsOfCourse(course).forEach((layerId) => {
					state.courseCalendar.unpreviewCourse(course, layerId);
				});
				if (state.previewingFromSelectControl) state.courseCalendar.previewCourse(state.previewingFromSelectControl, state.previewingFromSelectControlLayerId);
				$("#course-exam-info-wrapper").css("flex", "");
			}
		});
		state.courseCalendar = new CourseCalendar($("#course-calendar"), {
			courseManager: state.courseManager,
			colorGenerator: courseColorGenerator,
			textColorGenerator: courseTextColorGenerator,
			readonly: state.viewingSharedSchedule,
			getActiveLayerId() {
				return state.courseButtonList.getActiveLayerId();
			},
			onCourseHoverIn(course, layerId) {
				state.courseButtonList.setHovered(course, layerId);
				state.courseExamInfo.setHovered(course);
			},
			onCourseHoverOut(course, layerId) {
				state.courseButtonList.removeHovered(course, layerId);
				state.courseExamInfo.removeHovered(course);
			},
			onCourseConflictedStatusChanged(course, conflicted, layerId) {
				if (conflicted) state.courseButtonList.setConflicted(course, layerId);
				else state.courseButtonList.removeConflicted(course, layerId);
			},
			onLessonTypesHidden(course, lessonTypesHidden, layerId) {
				state.courseButtonList.setLessonTypesHidden(course, lessonTypesHidden, layerId);
			},
			onLessonSelected(course, lessonNumber, lessonType, layerId) {
				selectedLessonSave(course, lessonNumber, lessonType, layerId);
			},
			onLessonUnselected(course, lessonNumber, lessonType, layerId) {
				selectedLessonUnsave(course, lessonNumber, lessonType, layerId);
			},
			onCustomEventAdded(eventId, eventData, layerId) {
				state.courseButtonList.expandLayer(layerId);
				state.courseButtonList.addCustomEvent(String(eventId), eventData.title, layerId);
				customEventSave(String(eventId), eventData, layerId);
			},
			onCustomEventUpdated(eventId, eventData, layerId) {
				state.courseButtonList.updateCustomEvent(eventId, eventData.title);
				customEventSave(eventId, eventData, layerId);
			},
			onCustomEventRemoved(eventId, layerId) {
				state.courseButtonList.removeCustomEvent(eventId);
				customEventUnsave(eventId, layerId);
			},
			onColorPickerClick(course, customEventId, layerId) {
				showColorPicker(customEventId || courseColorKey(course, layerId), courseColorGenerator(course, customEventId, layerId));
			}
		});
		$("#top-navbar-supported-content").removeClass("top-navbar-content-uninitialized");
		$("#right-content-bar").removeClass("invisible");
		if (state.viewingSharedSchedule) {
			firebaseInit();
			watchSharedSchedule(() => {
				$("#page-loader").hide();
			});
		} else {
			let firebaseAuthUIInitialized = false;
			if (typeof firebase !== "undefined") try {
				firebaseInit();
				firebaseAuthUIInit(() => {
					watchSavedSchedule(() => {
						$("#page-loader").hide();
						showExtraContentOnLoad();
					});
				});
				firebaseAuthUIInitialized = true;
			} catch (e) {}
			if (!firebaseAuthUIInitialized) watchSavedSchedule(() => {
				$("#page-loader").hide();
				showExtraContentOnLoad();
			});
		}
	}
	function start() {
		trackMarkedLinks(document);
		CheeseI18n.apply(document);
		moment.locale(CheeseI18n.getLocale());
		$("dark-mode-toggle").attr({
			light: CheeseI18n.t("shell.theme.toDark"),
			dark: CheeseI18n.t("shell.theme.toLight"),
			remember: CheeseI18n.t("shell.theme.remember")
		});
		$("#top-navbar-home a, #top-navbar .navbar-brand").prop("href", shellUrl({
			semester: currentSemester,
			uid: null,
			course: null,
			staff: null,
			room: null
		}));
		$("#course-list-crawler-link").prop("href", crawlerUrl({ course: "all" }));
		state.courseManager = new CourseManager(courses_from_rishum, CheeseI18n.getLocale() === "en" && typeof courses_english !== "undefined" ? courses_english : null);
		state.colorHash = new ColorHash();
		if (!crawlersInfo()) cheeseforkInit();
	}
	// src/entries/cheesefork.ts
	start();
})();
