const assert = require("assert");
const W = require("../public/wwk-core.js");
const meters = require("../public/data/meters.json");

// normalisation matches the Python builder
assert.strictEqual(W.norm("Ernest & Célestine"), "ernestandcelestine");
assert(meters.titles[W.norm("Ernest & Célestine")]);
assert.strictEqual(W.fmtRuntime(98), "1h 38m"); assert.strictEqual(W.fmtRuntime(120), "2h"); assert.strictEqual(W.fmtRuntime(25), "25 min"); assert.strictEqual(W.fmtRuntime(null), "");

// editorial wins per axis; year guards remakes
let m = W.meterFor(meters, { title: "Coco", year: 2017, cert: "PG", genres: [16, 10751], keywords: [] });
assert.deepStrictEqual([m.scare.src, m.sad.src, m.sad.lvl], ["ed", "ed", 2]);
m = W.meterFor(meters, { title: "The Addams Family", year: 1991, cert: "PG-13", genres: [35, 14], keywords: [] });
assert.strictEqual(m.scare.src, "est", "1991 must not take the 2019 rating");
m = W.meterFor(meters, { title: "The Addams Family", year: 2019, cert: "PG", genres: [16, 35], keywords: [] });
assert.strictEqual(m.scare.src, "ed");
// Halloween entries only rate scare; sad stays an estimate
m = W.meterFor(meters, { title: "Hocus Pocus", year: 1993, cert: "PG", genres: [14, 35, 10751], keywords: [] });
assert.deepStrictEqual([m.scare.src, m.sad.src], ["ed", "est"]);

// estimator sanity
const E = W.estimate;
assert.strictEqual(E({ cert: "G", genres: [16, 10751] }).scare, 0);
assert.strictEqual(E({ cert: "PG", genres: [16, 35, 10751] }).scare, 0);
assert.strictEqual(E({ cert: "PG", genres: [27, 35, 10751] }).scare, 1);          // kid horror-comedy
assert.strictEqual(E({ cert: "PG-13", genres: [27, 53] }).scare, 2);
assert.strictEqual(E({ cert: "PG-13", genres: [28, 12] }).scare, 1);
assert.strictEqual(E({ cert: "PG", genres: [18], keywords: ["death of mother", "grief"] }).sad, 2);
assert.strictEqual(E({ cert: "G", genres: [16, 35] }).sad, 0);
assert.strictEqual(E({ cert: "", genres: [] }).scare, 1, "unknown rating is cautious (medium)");

// details parsing: append_to_response shapes (movie + tv)
const mv = W.parseDetails("movie", { id: 1, title: "X", release_date: "2020-05-01", runtime: 98, genres: [{ id: 16 }],
  keywords: { keywords: [{ name: "ghost" }] }, release_dates: { results: [{ iso_3166_1: "US", release_dates: [{ certification: "" }, { certification: "PG" }] }] },
  "watch/providers": { results: { US: { link: "https://x", flatrate: [{ provider_name: "Netflix", logo_path: "/n.png" }] } } } });
assert.deepStrictEqual([mv.cert, mv.runtime, mv.year, mv.keywords[0], mv.providers[0].name], ["PG", 98, 2020, "ghost", "Netflix"]);
const tv = W.parseDetails("show", { id: 2, name: "S", first_air_date: "2019-01-01", episode_run_time: [22], content_ratings: { results: [{ iso_3166_1: "US", rating: "TV-Y7" }] }, keywords: { results: [{ name: "monster" }] } });
assert.deepStrictEqual([tv.cert, tv.runtime, tv.keywords[0], tv.providers.length], ["TV-Y7", 22, "monster", 0]);

// share link round trip + hostile input
const parsed = W.parseList("?i=m550,t1399,m550,x9,m<script>,m12&n=Fri%20night!&v=Sam.uud~Al%3Cex.udu~.ud");
assert.deepStrictEqual(parsed.items.map(x => x.token), ["m550", "t1399", "m12"]);
assert.strictEqual(parsed.name, "Fri night");
assert.deepStrictEqual(parsed.voters, { Sam: "uud", Alex: "udu" });
const url = W.buildListUrl("https://watchwithkids.com", parsed.items, "Fri night", { Sam: "uud", Alex: "udu" });
assert.strictEqual(url, "https://watchwithkids.com/list?i=m550,t1399,m12&n=Fri+night&v=Sam.uud~Alex.udu");
assert.deepStrictEqual(W.parseList("?" + url.split("?")[1]).items.length, 3);
const big = "m1," .repeat(60);
assert.strictEqual(W.parseList("?i=" + big).items.length, 1, "dupes dropped"); 
assert.strictEqual(W.parseList("?i=" + Array.from({length: 60}, (_, i) => "m" + (i + 1)).join(",")).items.length, W.MAX_ITEMS);

// tally
const t = W.tally(parsed.items, parsed.voters);
assert.deepStrictEqual(t.map(x => x.match), [true, false, false]);   // m550 both yes; show: u/d; m12: d/u
assert.deepStrictEqual(t[1].no, 1);
console.log("core tests ok");
