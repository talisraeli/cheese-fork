"use strict";
(function() {
	// src/lib/template.ts
	function escapeHtml(value) {
		return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}
	function render(template, values) {
		return template.replace(/\s*\n\s*/g, "").replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}|\{\{t:([\w.-]+)\}\}/g, (match, raw, escaped, key) => {
			if (key) return escapeHtml(CheeseI18n.t(key));
			const name = raw || escaped;
			const value = values ? values[name] : void 0;
			if (value === void 0 || value === null) throw new Error(`Missing template value: ${name}`);
			return raw ? String(value) : escapeHtml(value);
		});
	}
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
				let text = semesterFriendlyName(semester);
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
			copyToClipboard(code, () => {
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
			semester: semesterFriendlyName(semester),
			category: categoryFriendlyName(category)
		})));
		element.find(".histogram-image-note").text(t("histogram.imageNote"));
	}
	function semesterFriendlyName(semester) {
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
	// src/entries/share-histograms-page.ts
	$("#share-guide").append(HistogramBrowser.createShareGuide());
	$("#top-navbar a[href=\".\"]").attr("href", CheeseI18n.withLocale("."));
})();
