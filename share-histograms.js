"use strict";
(function() {
	// \0rolldown/runtime.js
	var __create = Object.create;
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __getProtoOf = Object.getPrototypeOf;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod, mod.exports), cb = null), mod.exports);
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: ((k) => from[k]).bind(null, key),
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
		value: mod,
		enumerable: true
	}) : target, mod));
	/*!
	* A JavaScript implementation of the SHA family of hashes - defined in FIPS PUB 180-4, FIPS PUB 202,
	* and SP 800-185 - as well as the corresponding HMAC implementation as defined in FIPS PUB 198-1.
	*
	* Copyright 2008-2020 Brian Turek, 1998-2009 Paul Johnston & Contributors
	* Distributed under the BSD License
	* See http://caligatio.github.com/jsSHA/ for more information
	*
	* Two ECMAScript polyfill functions carry the following license:
	*
	* Copyright (c) Microsoft Corporation. All rights reserved.
	* Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
	* the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
	*
	* THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR IMPLIED,
	* INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
	* MERCHANTABLITY OR NON-INFRINGEMENT.
	*
	* See the Apache Version 2.0 License for specific language governing permissions and limitations under the License.
	*/
	// src/lib/template.ts
	var import_sha1 = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module, this$1) => {
		(function(t, r) {
			"object" == typeof exports && "undefined" != typeof module ? module.exports = r() : "function" == typeof define && define.amd ? define(r) : (t = t || self).jsSHA = r();
		})(this$1, (function() {
			"use strict";
			var t = function(r, n) {
				return (t = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(t, r) {
					t.__proto__ = r;
				} || function(t, r) {
					for (var n in r) r.hasOwnProperty(n) && (t[n] = r[n]);
				})(r, n);
			};
			var r = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
			function n(t, r, n, i) {
				var e, o, u, s = r || [0], f = (n = n || 0) >>> 3, h = -1 === i ? 3 : 0;
				for (e = 0; e < t.length; e += 1) o = (u = e + f) >>> 2, s.length <= o && s.push(0), s[o] |= t[e] << 8 * (h + i * (u % 4));
				return {
					value: s,
					binLen: 8 * t.length + n
				};
			}
			function i(t, i, e) {
				switch (i) {
					case "UTF8":
					case "UTF16BE":
					case "UTF16LE": break;
					default: throw new Error("encoding must be UTF8, UTF16BE, or UTF16LE");
				}
				switch (t) {
					case "HEX": return function(t, r, n) {
						return function(t, r, n, i) {
							var e, o, u, s;
							if (0 != t.length % 2) throw new Error("String of HEX type must be in byte increments");
							var f = r || [0], h = (n = n || 0) >>> 3, a = -1 === i ? 3 : 0;
							for (e = 0; e < t.length; e += 2) {
								if (o = parseInt(t.substr(e, 2), 16), isNaN(o)) throw new Error("String of HEX type contains invalid characters");
								for (u = (s = (e >>> 1) + h) >>> 2; f.length <= u;) f.push(0);
								f[u] |= o << 8 * (a + i * (s % 4));
							}
							return {
								value: f,
								binLen: 4 * t.length + n
							};
						}(t, r, n, e);
					};
					case "TEXT": return function(t, r, n) {
						return function(t, r, n, i, e) {
							var o, u, s, f, h, a, c, w, E = 0, v = n || [0], A = (i = i || 0) >>> 3;
							if ("UTF8" === r) for (c = -1 === e ? 3 : 0, s = 0; s < t.length; s += 1) for (u = [], 128 > (o = t.charCodeAt(s)) ? u.push(o) : 2048 > o ? (u.push(192 | o >>> 6), u.push(128 | 63 & o)) : 55296 > o || 57344 <= o ? u.push(224 | o >>> 12, 128 | o >>> 6 & 63, 128 | 63 & o) : (s += 1, o = 65536 + ((1023 & o) << 10 | 1023 & t.charCodeAt(s)), u.push(240 | o >>> 18, 128 | o >>> 12 & 63, 128 | o >>> 6 & 63, 128 | 63 & o)), f = 0; f < u.length; f += 1) {
								for (h = (a = E + A) >>> 2; v.length <= h;) v.push(0);
								v[h] |= u[f] << 8 * (c + e * (a % 4)), E += 1;
							}
							else for (c = -1 === e ? 2 : 0, w = "UTF16LE" === r && 1 !== e || "UTF16LE" !== r && 1 === e, s = 0; s < t.length; s += 1) {
								for (o = t.charCodeAt(s), !0 === w && (o = (f = 255 & o) << 8 | o >>> 8), h = (a = E + A) >>> 2; v.length <= h;) v.push(0);
								v[h] |= o << 8 * (c + e * (a % 4)), E += 2;
							}
							return {
								value: v,
								binLen: 8 * E + i
							};
						}(t, i, r, n, e);
					};
					case "B64": return function(t, n, i) {
						return function(t, n, i, e) {
							var o, u, s, f, h, a, c = 0, w = n || [0], E = (i = i || 0) >>> 3, v = -1 === e ? 3 : 0, A = t.indexOf("=");
							if (-1 === t.search(/^[a-zA-Z0-9=+/]+$/)) throw new Error("Invalid character in base-64 string");
							if (t = t.replace(/=/g, ""), -1 !== A && A < t.length) throw new Error("Invalid '=' found in base-64 string");
							for (o = 0; o < t.length; o += 4) {
								for (f = t.substr(o, 4), s = 0, u = 0; u < f.length; u += 1) s |= r.indexOf(f.charAt(u)) << 18 - 6 * u;
								for (u = 0; u < f.length - 1; u += 1) {
									for (h = (a = c + E) >>> 2; w.length <= h;) w.push(0);
									w[h] |= (s >>> 16 - 8 * u & 255) << 8 * (v + e * (a % 4)), c += 1;
								}
							}
							return {
								value: w,
								binLen: 8 * c + i
							};
						}(t, n, i, e);
					};
					case "BYTES": return function(t, r, n) {
						return function(t, r, n, i) {
							var e, o, u, s, f = r || [0], h = (n = n || 0) >>> 3, a = -1 === i ? 3 : 0;
							for (o = 0; o < t.length; o += 1) e = t.charCodeAt(o), u = (s = o + h) >>> 2, f.length <= u && f.push(0), f[u] |= e << 8 * (a + i * (s % 4));
							return {
								value: f,
								binLen: 8 * t.length + n
							};
						}(t, r, n, e);
					};
					case "ARRAYBUFFER": return function(t, r, i) {
						return function(t, r, i, e) {
							return n(new Uint8Array(t), r, i, e);
						}(t, r, i, e);
					};
					case "UINT8ARRAY": return function(t, r, i) {
						return n(t, r, i, e);
					};
					default: throw new Error("format must be HEX, TEXT, B64, BYTES, ARRAYBUFFER, or UINT8ARRAY");
				}
			}
			function e(t, n, i, e) {
				switch (t) {
					case "HEX": return function(t) {
						return function(t, r, n, i) {
							var e, o, u = "", s = r / 8, f = -1 === n ? 3 : 0;
							for (e = 0; e < s; e += 1) o = t[e >>> 2] >>> 8 * (f + n * (e % 4)), u += "0123456789abcdef".charAt(o >>> 4 & 15) + "0123456789abcdef".charAt(15 & o);
							return i.outputUpper ? u.toUpperCase() : u;
						}(t, n, i, e);
					};
					case "B64": return function(t) {
						return function(t, n, i, e) {
							var o, u, s, f, h, a = "", c = n / 8, w = -1 === i ? 3 : 0;
							for (o = 0; o < c; o += 3) for (f = o + 1 < c ? t[o + 1 >>> 2] : 0, h = o + 2 < c ? t[o + 2 >>> 2] : 0, s = (t[o >>> 2] >>> 8 * (w + i * (o % 4)) & 255) << 16 | (f >>> 8 * (w + i * ((o + 1) % 4)) & 255) << 8 | h >>> 8 * (w + i * ((o + 2) % 4)) & 255, u = 0; u < 4; u += 1) a += 8 * o + 6 * u <= n ? r.charAt(s >>> 6 * (3 - u) & 63) : e.b64Pad;
							return a;
						}(t, n, i, e);
					};
					case "BYTES": return function(t) {
						return function(t, r, n) {
							var i, e, o = "", u = r / 8, s = -1 === n ? 3 : 0;
							for (i = 0; i < u; i += 1) e = t[i >>> 2] >>> 8 * (s + n * (i % 4)) & 255, o += String.fromCharCode(e);
							return o;
						}(t, n, i);
					};
					case "ARRAYBUFFER": return function(t) {
						return function(t, r, n) {
							var i, e = r / 8, o = new ArrayBuffer(e), u = new Uint8Array(o), s = -1 === n ? 3 : 0;
							for (i = 0; i < e; i += 1) u[i] = t[i >>> 2] >>> 8 * (s + n * (i % 4)) & 255;
							return o;
						}(t, n, i);
					};
					case "UINT8ARRAY": return function(t) {
						return function(t, r, n) {
							var i, e = r / 8, o = -1 === n ? 3 : 0, u = new Uint8Array(e);
							for (i = 0; i < e; i += 1) u[i] = t[i >>> 2] >>> 8 * (o + n * (i % 4)) & 255;
							return u;
						}(t, n, i);
					};
					default: throw new Error("format must be HEX, B64, BYTES, ARRAYBUFFER, or UINT8ARRAY");
				}
			}
			function o(t) {
				var r = {
					outputUpper: !1,
					b64Pad: "=",
					outputLen: -1
				}, n = t || {}, i = "Output length must be a multiple of 8";
				if (r.outputUpper = n.outputUpper || !1, n.b64Pad && (r.b64Pad = n.b64Pad), n.outputLen) {
					if (n.outputLen % 8 != 0) throw new Error(i);
					r.outputLen = n.outputLen;
				} else if (n.shakeLen) {
					if (n.shakeLen % 8 != 0) throw new Error(i);
					r.outputLen = n.shakeLen;
				}
				if ("boolean" != typeof r.outputUpper) throw new Error("Invalid outputUpper formatting option");
				if ("string" != typeof r.b64Pad) throw new Error("Invalid b64Pad formatting option");
				return r;
			}
			function u(t, r) {
				return t << r | t >>> 32 - r;
			}
			function s(t, r, n) {
				return t ^ r ^ n;
			}
			function f(t, r, n) {
				return t & r ^ t & n ^ r & n;
			}
			function h(t, r) {
				var n = (65535 & t) + (65535 & r);
				return (65535 & (t >>> 16) + (r >>> 16) + (n >>> 16)) << 16 | 65535 & n;
			}
			function a(t, r, n, i, e) {
				var o = (65535 & t) + (65535 & r) + (65535 & n) + (65535 & i) + (65535 & e);
				return (65535 & (t >>> 16) + (r >>> 16) + (n >>> 16) + (i >>> 16) + (e >>> 16) + (o >>> 16)) << 16 | 65535 & o;
			}
			function c(t) {
				return [
					1732584193,
					4023233417,
					2562383102,
					271733878,
					3285377520
				];
			}
			function w(t, r) {
				var n, i, e, o, c, w, E, v, A = [];
				for (n = r[0], i = r[1], e = r[2], o = r[3], c = r[4], E = 0; E < 80; E += 1) A[E] = E < 16 ? t[E] : u(A[E - 3] ^ A[E - 8] ^ A[E - 14] ^ A[E - 16], 1), w = E < 20 ? a(u(n, 5), (v = i) & e ^ ~v & o, c, 1518500249, A[E]) : E < 40 ? a(u(n, 5), s(i, e, o), c, 1859775393, A[E]) : E < 60 ? a(u(n, 5), f(i, e, o), c, 2400959708, A[E]) : a(u(n, 5), s(i, e, o), c, 3395469782, A[E]), c = o, o = e, e = u(i, 30), i = n, n = w;
				return r[0] = h(n, r[0]), r[1] = h(i, r[1]), r[2] = h(e, r[2]), r[3] = h(o, r[3]), r[4] = h(c, r[4]), r;
			}
			function E(t, r, n, i) {
				for (var e, o = 15 + (r + 65 >>> 9 << 4), u = r + n; t.length <= o;) t.push(0);
				for (t[r >>> 5] |= 128 << 24 - r % 32, t[o] = 4294967295 & u, t[o - 1] = u / 4294967296 | 0, e = 0; e < t.length; e += 16) i = w(t.slice(e, e + 16), i);
				return i;
			}
			return function(r) {
				function n(t, n, e) {
					var o = this;
					if ("SHA-1" !== t) throw new Error("Chosen SHA variant is not supported");
					var u = e || {};
					return (o = r.call(this, t, n, e) || this).t = !0, o.i = o.o, o.u = -1, o.s = i(o.h, o.v, o.u), o.A = w, o.p = function(t) {
						return t.slice();
					}, o.l = c, o.R = E, o.U = [
						1732584193,
						4023233417,
						2562383102,
						271733878,
						3285377520
					], o.T = 512, o.m = 160, o.F = !1, u.hmacKey && o.B(function(t, r, n, e) {
						var o = t + " must include a value and format";
						if (!r) {
							if (!e) throw new Error(o);
							return e;
						}
						if (void 0 === r.value || !r.format) throw new Error(o);
						return i(r.format, r.encoding || "UTF8", n)(r.value);
					}("hmacKey", u.hmacKey, o.u)), o;
				}
				return function(r, n) {
					function i() {
						this.constructor = r;
					}
					t(r, n), r.prototype = null === n ? Object.create(n) : (i.prototype = n.prototype, new i());
				}(n, r), n;
			}(function() {
				function t(t, r, n) {
					var i = n || {};
					if (this.h = r, this.v = i.encoding || "UTF8", this.numRounds = i.numRounds || 1, isNaN(this.numRounds) || this.numRounds !== parseInt(this.numRounds, 10) || 1 > this.numRounds) throw new Error("numRounds must a integer >= 1");
					this.g = t, this.Y = [], this.I = 0, this.C = !1, this.H = 0, this.L = !1, this.N = [], this.S = [];
				}
				return t.prototype.update = function(t) {
					var r, n = 0, i = this.T >>> 5, e = this.s(t, this.Y, this.I), o = e.binLen, u = e.value, s = o >>> 5;
					for (r = 0; r < s; r += i) n + this.T <= o && (this.U = this.A(u.slice(r, r + i), this.U), n += this.T);
					this.H += n, this.Y = u.slice(n >>> 5), this.I = o % this.T, this.C = !0;
				}, t.prototype.getHash = function(t, r) {
					var n, i, u = this.m, s = o(r);
					if (this.F) {
						if (-1 === s.outputLen) throw new Error("Output length must be specified in options");
						u = s.outputLen;
					}
					var f = e(t, u, this.u, s);
					if (this.L && this.i) return f(this.i(s));
					for (i = this.R(this.Y.slice(), this.I, this.H, this.p(this.U), u), n = 1; n < this.numRounds; n += 1) this.F && u % 32 != 0 && (i[i.length - 1] &= 16777215 >>> 24 - u % 32), i = this.R(i, u, 0, this.l(this.g), u);
					return f(i);
				}, t.prototype.setHMACKey = function(t, r, n) {
					if (!this.t) throw new Error("Variant does not support HMAC");
					if (this.C) throw new Error("Cannot set MAC key after calling update");
					var e = i(r, (n || {}).encoding || "UTF8", this.u);
					this.B(e(t));
				}, t.prototype.B = function(t) {
					var r, n = this.T >>> 3, i = n / 4 - 1;
					if (1 !== this.numRounds) throw new Error("Cannot set numRounds with MAC");
					if (this.L) throw new Error("MAC key already set");
					for (n < t.binLen / 8 && (t.value = this.R(t.value, t.binLen, 0, this.l(this.g), this.m)); t.value.length <= i;) t.value.push(0);
					for (r = 0; r <= i; r += 1) this.N[r] = 909522486 ^ t.value[r], this.S[r] = 1549556828 ^ t.value[r];
					this.U = this.A(this.N, this.U), this.H = this.T, this.L = !0;
				}, t.prototype.getHMAC = function(t, r) {
					var n = o(r);
					return e(t, this.m, this.u, n)(this.o());
				}, t.prototype.o = function() {
					var t;
					if (!this.L) throw new Error("Cannot call getHMAC without first setting MAC key");
					var r = this.R(this.Y.slice(), this.I, this.H, this.p(this.U), this.m);
					return t = this.A(this.S, this.l(this.g)), t = this.R(r, this.m, this.T, t, this.m);
				}, t;
			}());
		}));
	})))(), 1);
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
	// src/bookmarklet/templates/category-cell.html?cheesefork-template
	var category_cell_default = "<td class=\"{{category}}\" title=\"{{loading}}\">...</td>\n";
	// src/bookmarklet/templates/course-row.html?cheesefork-template
	var course_row_default = "<tr class=\"{{className}}\">\n    <td>{{semester}}</td>\n    <td>{{course}}</td>\n    <td>{{name}}</td>\n    <td class=\"Staff\" title=\"{{loading}}\">...</td>\n    {{{categoryCells}}}\n</tr>\n";
	// src/bookmarklet/templates/header-cell.html?cheesefork-template
	var header_cell_default = "<th scope=\"col\">{{label}}</th>\n";
	// src/bookmarklet/templates/overlay.html?cheesefork-template
	var overlay_default = "<button type=\"button\" id=\"grabber_close_button\" style=\"float:{{closeSide}};\">{{close}}</button>\n<div class=\"HeaderWarp\"><div id=\"grabber_title\" role=\"status\" aria-live=\"polite\">{{title}}</div></div><br>\n<button type=\"button\" class=\"btn btn-default btn-sm histogram\" id=\"grabber_submit_button\" style=\"background-color:#a5cd4e;display:none;\">{{share}}</button> <button type=\"button\" class=\"btn btn-default btn-sm histogram\" id=\"grabber_try_again_button\" style=\"background-color:#a5cd4e;display:none;\">{{retry}}</button>\n<div style=\"overflow-x:auto;\"><table class=\"tab tablesorter-ice\" style=\"direction:inherit;\">\n    <thead><tr>{{{headers}}}</tr></thead>\n    <tbody>{{{rows}}}</tbody>\n</table></div>\n";
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
	// src/bookmarklet/share-histograms.ts
	function shareHistograms() {
		const currentScript = document.currentScript;
		const scriptUrl = currentScript && currentScript.src;
		const requestedLocale = scriptUrl ? new URL(scriptUrl).searchParams.get("lang") : null;
		const locale = requestedLocale === "en" || requestedLocale === "ar" ? requestedLocale : "he";
		const rtl = locale !== "en";
		const messages = {
			he: {
				"sharing.overlay.heading": "שיתוף היסטוגרמות",
				"sharing.overlay.title": "שיתוף היסטוגרמות: {status}",
				"sharing.overlay.loading": "טוען נתונים...",
				"sharing.overlay.share": "לחצו כאן לשיתוף ההיסטוגרמות",
				"sharing.overlay.retry": "נסה שוב",
				"sharing.overlay.close": "סגירת חלון השיתוף",
				"sharing.overlay.semester": "סמסטר",
				"sharing.overlay.course": "קורס",
				"sharing.overlay.courseName": "שם קורס",
				"sharing.overlay.staff": "סגל",
				"sharing.overlay.examA": "מבחן מועד א'",
				"sharing.overlay.finalA": "סופי מועד א'",
				"sharing.overlay.examB": "מבחן מועד ב'",
				"sharing.overlay.finalB": "סופי מועד ב'",
				"sharing.overlay.examC": "מבחן מועד ג'",
				"sharing.overlay.finalC": "סופי מועד ג'",
				"sharing.overlay.finals": "סופי",
				"sharing.overlay.available": "קיים מידע לשיתוף",
				"sharing.overlay.unavailable": "אין מידע לשיתוף",
				"sharing.overlay.ready": "מוכן",
				"sharing.overlay.sharing": "משתף...",
				"sharing.overlay.error": "שגיאה",
				"sharing.overlay.errorDetails": "שגיאה: {message}",
				"sharing.overlay.complete": "השיתוף הושלם",
				"sharing.overlay.uploading": "משתף מידע...",
				"sharing.overlay.exists": "המידע כבר קיים",
				"sharing.overlay.success": "המידע שותף בהצלחה",
				"sharing.overlay.failed": "שיתוף המידע נכשל",
				"sharing.overlay.getTreeFailed": "קריאת רשימת הקבצים מ-GitHub החזירה שגיאה {status}",
				"sharing.overlay.putFileFailed": "שמירת קובץ ב-GitHub החזירה שגיאה {status}",
				"sharing.overlay.fetchFailed": "טעינת {resource} החזירה שגיאה {status}",
				"sharing.overlay.resource.coursePage": "עמוד הקורס",
				"sharing.overlay.resource.histogramPage": "עמוד ההיסטוגרמה",
				"sharing.overlay.resource.histogramImage": "תמונת ההיסטוגרמה",
				"sharing.overlay.semester.winter": "חורף {year}–{nextYear}",
				"sharing.overlay.semester.spring": "אביב {year}",
				"sharing.overlay.semester.summer": "קיץ {year}"
			},
			en: {
				"sharing.overlay.heading": "Share histograms",
				"sharing.overlay.title": "Histogram sharing: {status}",
				"sharing.overlay.loading": "Loading data...",
				"sharing.overlay.share": "Share histograms",
				"sharing.overlay.retry": "Try again",
				"sharing.overlay.close": "Close sharing window",
				"sharing.overlay.semester": "Semester",
				"sharing.overlay.course": "Course",
				"sharing.overlay.courseName": "Course name",
				"sharing.overlay.staff": "Staff",
				"sharing.overlay.examA": "Exam A",
				"sharing.overlay.finalA": "Final grade A",
				"sharing.overlay.examB": "Exam B",
				"sharing.overlay.finalB": "Final grade B",
				"sharing.overlay.examC": "Exam C",
				"sharing.overlay.finalC": "Final grade C",
				"sharing.overlay.finals": "Final grade",
				"sharing.overlay.available": "Data available to share",
				"sharing.overlay.unavailable": "No data to share",
				"sharing.overlay.ready": "Ready",
				"sharing.overlay.sharing": "Sharing...",
				"sharing.overlay.error": "Error",
				"sharing.overlay.errorDetails": "Error: {message}",
				"sharing.overlay.complete": "Sharing complete",
				"sharing.overlay.uploading": "Sharing data...",
				"sharing.overlay.exists": "Data already exists",
				"sharing.overlay.success": "Data shared successfully",
				"sharing.overlay.failed": "Could not share the data",
				"sharing.overlay.getTreeFailed": "Reading the file list from GitHub returned status {status}",
				"sharing.overlay.putFileFailed": "Saving a file to GitHub returned status {status}",
				"sharing.overlay.fetchFailed": "Loading {resource} returned status {status}",
				"sharing.overlay.resource.coursePage": "the course page",
				"sharing.overlay.resource.histogramPage": "the histogram page",
				"sharing.overlay.resource.histogramImage": "the histogram image",
				"sharing.overlay.semester.winter": "Winter {year}–{nextYear}",
				"sharing.overlay.semester.spring": "Spring {year}",
				"sharing.overlay.semester.summer": "Summer {year}"
			},
			ar: {
				"sharing.overlay.heading": "مشاركة مخططات العلامات",
				"sharing.overlay.title": "مشاركة مخططات العلامات: {status}",
				"sharing.overlay.loading": "جارٍ تحميل البيانات...",
				"sharing.overlay.share": "مشاركة مخططات العلامات",
				"sharing.overlay.retry": "إعادة المحاولة",
				"sharing.overlay.close": "إغلاق نافذة المشاركة",
				"sharing.overlay.semester": "الفصل الدراسي",
				"sharing.overlay.course": "المساق",
				"sharing.overlay.courseName": "اسم المساق",
				"sharing.overlay.staff": "الطاقم",
				"sharing.overlay.examA": "امتحان موعد أ",
				"sharing.overlay.finalA": "العلامة النهائية موعد أ",
				"sharing.overlay.examB": "امتحان موعد ب",
				"sharing.overlay.finalB": "العلامة النهائية موعد ب",
				"sharing.overlay.examC": "امتحان موعد ج",
				"sharing.overlay.finalC": "العلامة النهائية موعد ج",
				"sharing.overlay.finals": "العلامة النهائية",
				"sharing.overlay.available": "توجد بيانات للمشاركة",
				"sharing.overlay.unavailable": "لا توجد بيانات للمشاركة",
				"sharing.overlay.ready": "جاهز",
				"sharing.overlay.sharing": "جارٍ المشاركة...",
				"sharing.overlay.error": "خطأ",
				"sharing.overlay.errorDetails": "خطأ: {message}",
				"sharing.overlay.complete": "اكتملت المشاركة",
				"sharing.overlay.uploading": "جارٍ مشاركة البيانات...",
				"sharing.overlay.exists": "البيانات موجودة مسبقًا",
				"sharing.overlay.success": "تمت مشاركة البيانات بنجاح",
				"sharing.overlay.failed": "تعذّرت مشاركة البيانات",
				"sharing.overlay.getTreeFailed": "قراءة قائمة الملفات من GitHub أعادت الحالة {status}",
				"sharing.overlay.putFileFailed": "حفظ ملف في GitHub أعاد الحالة {status}",
				"sharing.overlay.fetchFailed": "تحميل {resource} أعاد الحالة {status}",
				"sharing.overlay.resource.coursePage": "صفحة المساق",
				"sharing.overlay.resource.histogramPage": "صفحة مخطط العلامات",
				"sharing.overlay.resource.histogramImage": "صورة مخطط العلامات",
				"sharing.overlay.semester.winter": "شتاء {year}–{nextYear}",
				"sharing.overlay.semester.spring": "ربيع {year}",
				"sharing.overlay.semester.summer": "صيف {year}"
			}
		};
		let sharingRoot = null;
		function uiElement(selector) {
			return sharingRoot.querySelector(selector);
		}
		function t(key, params = {}) {
			return messages[locale][key].replace(/\{([^{}]+)\}/g, (placeholder, name) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder);
		}
		const histogramCategories = [
			"Exam_A",
			"Final_A",
			"Exam_B",
			"Final_B",
			"Exam_C",
			"Final_C",
			"Finals"
		];
		const histogramUploadQueue = [];
		function semesterFriendlyName(semester) {
			const year = parseInt(semester.slice(0, 4), 10);
			switch (semester.slice(4)) {
				case "01": return t("sharing.overlay.semester.winter", {
					year,
					nextYear: year + 1
				});
				case "02": return t("sharing.overlay.semester.spring", { year: year + 1 });
				case "03": return t("sharing.overlay.semester.summer", { year: year + 1 });
				default: return semester;
			}
		}
		function uiCreateTable(courses) {
			const columns = [
				"semester",
				"course",
				"courseName",
				"staff",
				"examA",
				"finalA",
				"examB",
				"finalB",
				"examC",
				"finalC",
				"finals"
			];
			const loading = t("sharing.overlay.loading");
			const html = render(overlay_default, {
				closeSide: rtl ? "left" : "right",
				close: t("sharing.overlay.close"),
				title: t("sharing.overlay.title", { status: loading }),
				share: t("sharing.overlay.share"),
				retry: t("sharing.overlay.retry"),
				headers: columns.map((column) => render(header_cell_default, { label: t("sharing.overlay." + column) })).join(""),
				rows: courses.map((course) => render(course_row_default, {
					className: "grabber_course_" + course.semester + "_" + course.course,
					semester: semesterFriendlyName(course.semester),
					course: course.course,
					name: course.name,
					loading,
					categoryCells: histogramCategories.map((category) => render(category_cell_default, {
						category,
						loading
					})).join("")
				})).join("")
			});
			if (!sharingRoot) {
				sharingRoot = document.createElement("section");
				sharingRoot.id = "cheesefork-histogram-sharing";
				sharingRoot.lang = locale;
				sharingRoot.dir = rtl ? "rtl" : "ltr";
				sharingRoot.setAttribute("role", "region");
				sharingRoot.setAttribute("aria-label", t("sharing.overlay.heading"));
				sharingRoot.style.cssText = "position:fixed;top:12px;right:12px;bottom:12px;left:12px;z-index:2147483647;overflow:auto;background:#fff;color:#212529;border:1px solid #777;padding:20px;text-align:" + (rtl ? "right" : "left") + ";font:14px Arial,sans-serif;box-sizing:border-box;";
				document.body.appendChild(sharingRoot);
			}
			const root = sharingRoot;
			root.innerHTML = html;
			uiElement("#grabber_close_button").onclick = () => {
				root.style.display = "none";
			};
		}
		function uiUpdateTitle(title) {
			uiElement("#grabber_title").textContent = t("sharing.overlay.title", { status: title });
		}
		function uiUpdateItemStatus(semester, course, category, status, statusText) {
			const node = uiElement("tr." + ("grabber_course_" + semester + "_" + course) + " td." + category);
			node.textContent = status;
			node.title = statusText;
			node.setAttribute("aria-label", statusText);
		}
		function uiAddCourseCategories(semester, course, categories) {
			let status = "📁";
			let statusText = t("sharing.overlay.available");
			uiUpdateItemStatus(semester, course, "Staff", status, statusText);
			for (const category of histogramCategories) {
				if (categories.includes(category)) {
					status = "📁";
					statusText = t("sharing.overlay.available");
				} else {
					status = "➖";
					statusText = t("sharing.overlay.unavailable");
				}
				uiUpdateItemStatus(semester, course, category, status, statusText);
			}
		}
		function uiOnFirstLoadingDone() {
			uiUpdateTitle(t("sharing.overlay.ready"));
			const submitButton = uiElement("#grabber_submit_button");
			submitButton.style.display = "inline-block";
			submitButton.onclick = () => {
				submitButton.style.display = "none";
				uiUpdateTitle(t("sharing.overlay.sharing"));
				submitHistograms().catch((reason) => uiOnError(reason.message));
				return false;
			};
		}
		function uiOnError(message) {
			alert(t("sharing.overlay.errorDetails", { message }));
			if (!sharingRoot) uiCreateTable([]);
			uiUpdateTitle(t("sharing.overlay.error"));
			const tryAgainButton = uiElement("#grabber_try_again_button");
			tryAgainButton.style.display = "inline-block";
			tryAgainButton.onclick = () => {
				tryAgainButton.style.display = "none";
				uiUpdateTitle(t("sharing.overlay.loading"));
				run().catch((reason) => uiOnError(reason.message));
				return false;
			};
		}
		function uiOnSubmitDone() {
			uiUpdateTitle(t("sharing.overlay.complete"));
		}
		function getCourses() {
			const courses = [];
			for (const node of Array.from(document.querySelectorAll("a.ga-course"))) {
				const url = node.href.replace(/\/contentEng\.aspx\b/, "/content.aspx");
				const semesterPretty = node.getAttribute("data-sem");
				const semesterArray = semesterPretty.split("/", 2);
				const semester = semesterArray[1] + semesterArray[0];
				const match = /^\s*\d+\s+(\d+)\s+(.*?)\s*$/.exec(node.textContent || "");
				const courseMatched = match[1];
				const course = ("0000000" + courseMatched).slice(-8);
				const name = match[2];
				courses.push({
					url,
					semesterPretty,
					semester,
					courseMatched,
					course,
					name
				});
			}
			return courses;
		}
		function getCourseHistogramsFromHtml(html) {
			const doc = new DOMParser().parseFromString(html, "text/html");
			const histograms = [];
			for (const node of Array.from(doc.querySelectorAll("table#cBody_GV_StudentGrade tbody tr"))) {
				const category = node.children[4].textContent || "";
				if (histogramCategories.includes(category)) {
					const histogramLink = node.querySelector("a[data-histogram]");
					if (histogramLink) {
						const url = histogramLink.href.replace(/&lang=[a-z]+$/, "");
						histograms.push({
							category,
							url
						});
					}
				}
			}
			if (histograms.every((x) => x.category !== "Finals")) for (const node of Array.from(doc.querySelectorAll("#cBody_PanelCourseStatistic tbody tr"))) {
				const taskName = node.children[3].textContent;
				const category = node.children[4].textContent || "";
				if (taskName === "ציון סופי במחשב המרכזי" && category === "Finals") {
					const histogramLink = node.querySelector("a[data-histogram]");
					if (histogramLink) {
						const url = histogramLink.href.replace(/&lang=[a-z]+$/, "");
						histograms.push({
							category,
							url
						});
					}
				}
			}
			histograms.sort((a, b) => histogramCategories.indexOf(a.category) - histogramCategories.indexOf(b.category));
			return histograms;
		}
		function getStaffFromHtml(html) {
			const doc = new DOMParser().parseFromString(html, "text/html");
			const staff = [];
			for (const node of Array.from(doc.querySelectorAll("table#cBody_GridView_Advisors tbody tr"))) staff.push({
				name: (node.children[2].textContent || "").trim(),
				email: (node.children[3].textContent || "").trim(),
				title: (node.children[4].textContent || "").trim()
			});
			return staff;
		}
		function getCourseHistogramFromHtml(html) {
			const doc = new DOMParser().parseFromString(html, "text/html");
			const match = /^בקורס - (.*?) במשימה : (.*)$/.exec((doc.querySelector("title").textContent || "").trim());
			const courseName = match ? match[1].trim() : null;
			const categoryRaw = match ? match[2].trim() : null;
			const category = categoryRaw === "ציון סופי במחשב המרכזי" ? "Finals" : categoryRaw;
			const imgSrc = doc.querySelector("img#CourseChart").src;
			const n = doc.querySelectorAll("table#gvChart tbody td");
			return {
				courseName,
				category,
				imgSrc,
				properties: {
					students: n[5] ? n[5].textContent || "" : "",
					passFail: n[6] ? n[6].textContent || "" : "",
					passPercent: n[7] ? n[7].textContent || "" : "",
					min: n[9] ? n[9].textContent || "" : "",
					max: n[10] ? n[10].textContent || "" : "",
					average: n[11] ? n[11].textContent || "" : "",
					median: n[12] ? n[12].textContent || "" : ""
				}
			};
		}
		async function submitToGithub(course, semester, category, suffix, buffer, options = {}) {
			var _options$commitMetada;
			function calcGitFileSha(content) {
				const shaObj = new import_sha1.default("SHA-1", "ARRAYBUFFER");
				shaObj.update(new TextEncoder().encode("blob " + content.byteLength + "\0").buffer);
				shaObj.update(content);
				return shaObj.getHash("HEX");
			}
			function getGithubToken() {
				const tokens = [
					atob("Y2ViMTY5ZWM2YzAyYzY5ZDVmOTk2NjA5MmVkZWZkOTRiZGY2YjI2Yw=="),
					atob("NTNjNzA3MDc2NzM5MDJkYjI5ZGMzZTkxN2JlODdmNWI4YTMzZDdjNg=="),
					atob("MTA4MjQxYTJkYmNkYmZkZDQ2YWI0NDliZTJkZTVmMTYxZGZiZThhZQ=="),
					atob("NTllNTJhNTg1NTZiMWEzZjJmYmZjZjYyMjU3ZGM0OGY1YWQwY2ZkZg=="),
					atob("OWE4MmYzNjMwZjBlODQ1MWE2MDkwZjZhNjlkOWU3ZGQ4YmQ4MmYyYg==")
				];
				return tokens[Math.floor(Math.random() * tokens.length)];
			}
			async function getGitFileSha(path, filename, token) {
				const url = "https://api.github.com/repos/michael-maltsev/technion-histograms/git/trees/main:" + encodeURIComponent(path) + "?t=" + Date.now();
				const response = await fetch(url, { headers: { Authorization: "token " + token } });
				if (response.status === 200) {
					const item = (await response.json()).tree.find(function(item) {
						return item.path === filename;
					});
					return item ? item.sha : null;
				} else if (response.status === 404) return null;
				else throw new Error(t("sharing.overlay.getTreeFailed", { status: response.status }));
			}
			function arrayBufferToBase64(buffer) {
				let binary = "";
				const bytes = new Uint8Array(buffer);
				const len = bytes.byteLength;
				for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
				return window.btoa(binary);
			}
			const fileSha = calcGitFileSha(buffer);
			if (fileSha === options.skipIfSha) return "skipped";
			const filename = category + suffix;
			const path = course + "/" + semester;
			const token = getGithubToken();
			const serverSha = await getGitFileSha(path, filename, token);
			if (serverSha && (options.skipIfExists || serverSha === fileSha)) return "exists";
			const url = "https://api.github.com/repos/michael-maltsev/technion-histograms/contents/" + path + "/" + filename;
			let message = `${serverSha ? "Update" : "Add"} ${path}/${filename}`;
			const commitMetadata = (_options$commitMetada = options.commitMetadata) !== null && _options$commitMetada !== void 0 ? _options$commitMetada : {};
			if (Object.keys(commitMetadata).length > 0) message += "\n\n" + Object.entries(commitMetadata).map(([k, v]) => `${k}: ${v}`).join("\n");
			const data = {
				message,
				content: arrayBufferToBase64(buffer),
				branch: "main"
			};
			if (serverSha) data.sha = serverSha;
			let attemptNum = 0;
			while (true) {
				attemptNum++;
				if (attemptNum >= 4) await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 5e3)));
				const response = await fetch(url, {
					method: "PUT",
					headers: {
						"Content-Type": "application/json; charset=utf-8",
						Authorization: "token " + token
					},
					body: JSON.stringify(data)
				});
				if (response.status === 409) {} else if (response.status === 200) return "updated";
				else if (response.status === 201) return "created";
				else throw new Error(t("sharing.overlay.putFileFailed", { status: response.status }));
			}
		}
		async function fetchValidResponse(url, name) {
			let lastStatus;
			for (let i = 0; i < 4; i++) {
				const result = await fetch(url, { redirect: "error" });
				if (result.ok) return result;
				lastStatus = result.status;
			}
			throw new Error(t("sharing.overlay.fetchFailed", {
				resource: t(name),
				status: lastStatus
			}));
		}
		async function fetchValidResponseAsText(url, name, encoding) {
			const response = await fetchValidResponse(url, name);
			if (!encoding) return await response.text();
			const buffer = await response.arrayBuffer();
			return new TextDecoder(encoding).decode(buffer);
		}
		async function submitHistograms() {
			for (const { courseMatched, course, semester, url: courseUrl, name: courseName, histograms } of histogramUploadQueue) {
				const commitMetadata = {
					course: courseMatched,
					courseName
				};
				uiUpdateItemStatus(semester, course, "Staff", "...", t("sharing.overlay.uploading"));
				const staffArray = getStaffFromHtml(await fetchValidResponseAsText(courseUrl, "sharing.overlay.resource.coursePage", "windows-1255"));
				const staff = new TextEncoder().encode(JSON.stringify(staffArray, null, 2)).buffer;
				if (await submitToGithub(course, semester, "Staff", ".json", staff, {
					commitMetadata,
					skipIfExists: staffArray.length === 0
				}) === "exists") uiUpdateItemStatus(semester, course, "Staff", "⚌", t("sharing.overlay.exists"));
				else uiUpdateItemStatus(semester, course, "Staff", "✔", t("sharing.overlay.success"));
				for (const { category, url: histogramUrl } of histograms) {
					uiUpdateItemStatus(semester, course, category, "...", t("sharing.overlay.uploading"));
					const histogram = getCourseHistogramFromHtml(await fetchValidResponseAsText(histogramUrl, "sharing.overlay.resource.histogramPage", "windows-1255"));
					const histogramCourseNameMissing = !histogram.courseName;
					const histogramCourseNameMismatch = histogram.courseName !== courseName;
					const histogramCategoryMissing = !histogram.category;
					const histogramCategoryMismatch = (histogram.category === "ציון סופי במערכת האקדמית במחשב המרכזי" ? "Finals" : histogram.category).toLowerCase() !== category.toLowerCase();
					let courseToCommit = course;
					if (histogramCourseNameMismatch && !histogramCourseNameMissing || histogramCategoryMismatch && !histogramCategoryMissing) courseToCommit = "_mismatch_" + courseToCommit;
					const histogramCommitMetadata = _objectSpread2(_objectSpread2({}, commitMetadata), {}, {
						category,
						histogramCourseName: histogram.courseName,
						histogramCategory: histogram.category,
						histogramCourseNameMissing,
						histogramCourseNameMismatch,
						histogramCategoryMissing,
						histogramCategoryMismatch
					});
					const skipIfExists = Object.values(histogram.properties).every((x) => !x);
					const properties = new TextEncoder().encode(JSON.stringify(histogram.properties, null, 2)).buffer;
					const propertiesResult = await submitToGithub(courseToCommit, semester, category, ".json", properties, {
						commitMetadata: histogramCommitMetadata,
						skipIfExists
					});
					const skipIfSha = "76b85c3ecefcb57e8856889dbb44b31c52b50fc3";
					const image = await (await fetchValidResponse(histogram.imgSrc, "sharing.overlay.resource.histogramImage")).arrayBuffer();
					const imageResult = await submitToGithub(courseToCommit, semester, category, ".png", image, {
						commitMetadata: histogramCommitMetadata,
						skipIfSha
					});
					if (propertiesResult === "skipped" || imageResult === "skipped") uiUpdateItemStatus(semester, course, category, "⚠", t("sharing.overlay.failed"));
					else if (propertiesResult === "exists" && imageResult === "exists") uiUpdateItemStatus(semester, course, category, "⚌", t("sharing.overlay.exists"));
					else uiUpdateItemStatus(semester, course, category, "✔", t("sharing.overlay.success"));
				}
			}
			uiOnSubmitDone();
		}
		async function run() {
			const courses = getCourses();
			uiCreateTable(courses);
			for (const { courseMatched, course, semester, url, name } of courses) {
				const histograms = getCourseHistogramsFromHtml(await fetchValidResponseAsText(url, "sharing.overlay.resource.coursePage", "windows-1255"));
				histogramUploadQueue.push({
					courseMatched,
					course,
					semester,
					url,
					name,
					histograms
				});
				uiAddCourseCategories(semester, course, histograms.map((x) => x.category));
			}
			uiOnFirstLoadingDone();
		}
		run().catch((reason) => uiOnError(reason.message));
	}
	// src/entries/share-histograms.ts
	if (!window.cheeseForkShareHistogramsLoaded) {
		window.cheeseForkShareHistogramsLoaded = true;
		shareHistograms();
	}
})();
