/* WatchWithKids shared helpers: scare/sad meters, runtime, one-call title details,
   and the shareable shortlist link format. Plain script, no dependencies.
   Used by index.html and list.html. Pure functions are exported for tests via module.exports. */
(function (root) {
  "use strict";
  var API = "/api/tmdb";
  var LEVELS = ["Low", "Medium", "High"];

  /* ---------- text + time ---------- */
  function norm(t) {
    return String(t || "").toLowerCase().replace(/&/g, "and")
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtRuntime(min) {
    min = Math.round(Number(min) || 0);
    if (!min) return "";
    if (min < 60) return min + " min";
    var h = Math.floor(min / 60), m = min % 60;
    return h + "h" + (m ? " " + m + "m" : "");
  }

  /* ---------- meters ---------- */
  var metersP = null;
  function loadMeters() {
    if (!metersP) {
      metersP = fetch("/data/meters.json").then(function (r) { return r.ok ? r.json() : { titles: {} }; })
        .catch(function () { return { titles: {} }; });
    }
    return metersP;
  }
  function editorial(meters, title, year) {
    var r = meters && meters.titles && meters.titles[norm(title)];
    if (!r) return null;
    if (r.year && year && Number(r.year) !== Number(year)) return null; // remakes with the same title
    return r;
  }

  var CERT_SCARE = { "G": 0, "TV-Y": 0, "TV-G": 0, "TV-Y7": 0.5, "TV-Y7-FV": 1, "PG": 1, "TV-PG": 1, "PG-13": 2, "TV-14": 2, "R": 3, "TV-MA": 3, "NC-17": 3 };
  var SCARY_WORDS = /\b(monster|ghost|haunted|zombie|demon|vampire|witch|skeleton|serial killer|murder|kidnapp|slasher|supernatural|nightmare|possession|creepy|scary|horror|evil spirit|werewolf)/i;
  var SAD_WORDS = /\b(death|dies|grief|loss of|orphan|funeral|cancer|terminal|sacrifice|tragedy|bereave|heartbreak|mourning|widow|abandon)/i;

  function count(words, list) { var n = 0; (list || []).forEach(function (k) { if (words.test(k)) n++; }); return n; }
  function lvl(score, lo, hi) { return score <= lo ? 0 : score <= hi ? 1 : 2; }

  // info: { cert, genres:[tmdb genre ids], keywords:[names] }  ->  { scare:0-2, sad:0-2 }
  function estimate(info) {
    var g = info.genres || [], has = function (id) { return g.indexOf(id) !== -1; };
    var cert = String(info.cert || "").toUpperCase();
    var base = Object.prototype.hasOwnProperty.call(CERT_SCARE, cert) ? CERT_SCARE[cert] : 1;
    var soft = (has(16) ? 0.5 : 0) + (has(10751) ? 0.5 : 0) + (has(35) ? 0.5 : 0) + (has(10762) ? 0.5 : 0);
    var s = base;
    if (has(27)) s += 1.5;
    if (has(53)) s += 1;
    if (has(9648)) s += 0.5;
    if (has(10752)) s += 1;
    if (has(80)) s += 0.5;
    if (base <= 1) s -= Math.min(1, soft);
    var ks = count(SCARY_WORDS, info.keywords);
    s += ks >= 2 ? 1 : ks === 1 ? 0.5 : 0;
    var d = 0;
    if (has(18)) d += 1;
    if (has(10749)) d += 0.5;
    if (has(10752)) d += 1;
    if (has(36)) d += 0.5;
    var kd = count(SAD_WORDS, info.keywords);
    d += kd >= 2 ? 1.5 : kd === 1 ? 1 : 0;
    if (d > 0) d -= Math.min(0.5, soft / 2);
    return { scare: lvl(s, 0.75, 2.25), sad: lvl(d, 0.75, 1.75) };
  }

  // Combine our editorial rating (preferred, per axis) with the estimate.
  function meterFor(meters, info) {
    var ed = editorial(meters, info.title, info.year);
    var es = estimate(info);
    function axis(k) {
      if (ed && typeof ed[k] === "number") return { lvl: ed[k], src: "ed" };
      return { lvl: es[k], src: "est" };
    }
    return { scare: axis("scare"), sad: axis("sad") };
  }

  function pips(n) { return [0, 1, 2].map(function (i) { return "<i" + (i <= n ? ' class="on"' : "") + "></i>"; }).join(""); }
  function meterRow(label, a) {
    var tip = a.src === "ed" ? "Our rating, from our guides." : "Estimated from age rating, genre and themes. We have not reviewed this one yet.";
    return '<span class="m-row ' + (a.src === "ed" ? "ed" : "est") + ' lv' + a.lvl + '" title="' + esc(tip) + '">' +
      '<span class="m-label">' + label + '</span><span class="m-pips" aria-hidden="true">' + pips(a.lvl) + '</span>' +
      '<span class="m-lv">' + LEVELS[a.lvl] + (a.src === "est" ? ' <small>(est.)</small>' : "") + '</span></span>';
  }
  function meterHtml(m) {
    var anyEd = m.scare.src === "ed" || m.sad.src === "ed";
    return '<div class="wwk-meter' + (anyEd ? " has-ed" : "") + '" role="group" aria-label="Scary: ' + LEVELS[m.scare.lvl] + ', Sad: ' + LEVELS[m.sad.lvl] + '">' +
      meterRow("Scary", m.scare) + meterRow("Sad", m.sad) + "</div>";
  }

  /* ---------- one-call title details ---------- */
  var cache = new Map();
  function tmdbType(t) { return t === "movie" ? "movie" : "tv"; } // site uses "show" for TV

  function pickUS(list, key) {
    var r = (list || []).filter(function (x) { return x.iso_3166_1 === "US"; })[0];
    return r || null;
  }

  // Works on both an append_to_response payload and the legacy shape.
  function parseDetails(type, d) {
    d = d || {};
    var out = { id: d.id, title: d.title || d.name || "", poster: d.poster_path || null, vote: d.vote_average || 0,
      overview: d.overview || "", genres: (d.genres || []).map(function (g) { return g.id; }).concat(d.genre_ids || []) };
    var date = d.release_date || d.first_air_date || "";
    out.year = date ? Number(date.slice(0, 4)) : null;
    out.runtime = type === "movie" ? (d.runtime || null) : ((d.episode_run_time || [])[0] || null);
    var kw = d.keywords || {};
    out.keywords = (kw.keywords || kw.results || []).map(function (k) { return k.name; });
    var cert = null;
    if (type === "movie") {
      var rel = pickUS((d.release_dates || {}).results);
      if (rel) (rel.release_dates || []).some(function (x) { if (x.certification) { cert = x.certification; return true; } return false; });
    } else {
      var cr = pickUS((d.content_ratings || {}).results);
      if (cr && cr.rating) cert = cr.rating;
    }
    out.cert = cert;
    var wp = ((d["watch/providers"] || {}).results || {}).US;
    out.watchLink = wp && wp.link || null;
    out.providers = wp ? (wp.flatrate || []).slice(0, 4).map(function (p) {
      return { name: p.provider_name || "Watch", logo: p.logo_path ? "https://image.tmdb.org/t/p/w45" + p.logo_path : null, link: wp.link || "#", isAmazon: /amazon|prime/i.test(p.provider_name || "") };
    }) : [];
    if (!out.providers.length && wp) {
      var fb = (wp.rent && wp.rent[0]) || (wp.buy && wp.buy[0]);
      if (fb) out.fallbackProvider = { name: fb.provider_name, logo: null, link: wp.link || "#", isAmazon: /amazon|prime/i.test(fb.provider_name || "") };
    }
    return out;
  }

  function getJson(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  function fetchDetails(type, id) {
    var key = type + "-" + id;
    if (cache.has(key)) return cache.get(key);
    var ep = tmdbType(type);
    var extra = ep === "movie" ? "keywords,release_dates,watch/providers" : "keywords,content_ratings,watch/providers";
    var p = getJson(API + "/" + ep + "/" + id + "?append_to_response=" + encodeURIComponent(extra))
      .then(function (d) { return parseDetails(type, d); })
      .catch(function () { return null; });
    cache.set(key, p);
    return p;
  }

  /* ---------- shareable shortlist link ----------
     /list?i=m550,t1399&n=Friday%20night&v=Sam.uud~Alex.udu
       i = ids (m = movie, t = show), n = list name,
       v = votes per person, "Name.codes" joined by "~"; codes: u yes, d no, - no vote  */
  var MAX_ITEMS = 30;
  function cleanName(s, max) { return String(s || "").replace(/[^A-Za-z0-9 '\-]/g, "").trim().slice(0, max || 16); }

  function parseList(search) {
    var p = new URLSearchParams(search || "");
    var items = [];
    String(p.get("i") || "").split(",").forEach(function (tok) {
      var m = /^([mt])(\d{1,8})$/.exec(tok.trim());
      if (m && items.length < MAX_ITEMS && !items.some(function (x) { return x.token === tok.trim(); })) {
        items.push({ token: tok.trim(), type: m[1] === "m" ? "movie" : "show", id: m[2] });
      }
    });
    var voters = {};
    String(p.get("v") || "").split("~").slice(0, 8).forEach(function (part) {
      var dot = part.indexOf(".");
      if (dot < 1) return;
      var name = cleanName(part.slice(0, dot));
      var codes = part.slice(dot + 1).replace(/[^ud\-]/g, "").slice(0, items.length);
      if (name && codes) voters[name] = codes;
    });
    return { items: items, name: cleanName(p.get("n"), 40), voters: voters };
  }

  function buildListUrl(origin, items, name, voters) {
    var p = new URLSearchParams();
    p.set("i", items.map(function (x) { return x.token; }).join(","));
    if (name) p.set("n", cleanName(name, 40));
    var v = Object.keys(voters || {}).map(function (k) { return cleanName(k) + "." + voters[k]; });
    if (v.length) p.set("v", v.join("~"));
    return origin + "/list?" + p.toString().replace(/%2C/g, ",").replace(/%7E/g, "~");
  }

  // Everyone who voted said yes -> "match"; any "no" -> vetoed.
  function tally(items, voters) {
    var names = Object.keys(voters);
    return items.map(function (it, idx) {
      var yes = 0, no = 0;
      names.forEach(function (n) { var c = voters[n][idx] || "-"; if (c === "u") yes++; else if (c === "d") no++; });
      return { token: it.token, yes: yes, no: no, voters: names.length, match: names.length > 0 && no === 0 && yes === names.length };
    });
  }

  var api = { norm: norm, esc: esc, fmtRuntime: fmtRuntime, loadMeters: loadMeters, editorial: editorial, estimate: estimate,
    meterFor: meterFor, meterHtml: meterHtml, parseDetails: parseDetails, fetchDetails: fetchDetails,
    parseList: parseList, buildListUrl: buildListUrl, tally: tally, cleanName: cleanName, MAX_ITEMS: MAX_ITEMS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WWK = api;
})(typeof window !== "undefined" ? window : this);
