const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

function makeQuery(company, role, rnd = "") {
    const q = `company: ${company} | role: ${role}`;
    return rnd ? `${q} | round: ${rnd}` : q;
}

function makeDoc(topic, question) {
    return topic ? `${topic}. ${question}` : question;
}

function normalizeQuestion(text) {
    return String(text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Seeded RNG so a seed gives repeatable sessions (not identical to numpy's sequence)
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Minimal reader for 2-D C-order .npy files (float32 / float64)
function loadNpy(filePath) {
    const buf = fs.readFileSync(filePath);
    if (buf.toString("latin1", 1, 6) !== "NUMPY") {
        throw new Error(`${filePath} is not a valid .npy file`);
    }

    const major = buf[6];
    const headerStart = major === 1 ? 10 : 12;
    const headerLen = major === 1 ? buf.readUInt16LE(8) : buf.readUInt32LE(8);
    const header = buf.toString("latin1", headerStart, headerStart + headerLen);

    const descr = /'descr':\s*'([^']+)'/.exec(header)?.[1];
    const fortran = /'fortran_order':\s*(True|False)/.exec(header)?.[1] === "True";
    const shapeText = /'shape':\s*\(([^)]*)\)/.exec(header)?.[1] ?? "";
    const shape = shapeText.split(",").map((s) => s.trim()).filter(Boolean).map(Number);

    if (fortran || shape.length !== 2) {
        throw new Error("Unsupported .npy layout (need a 2-D C-order array)");
    }

    const [rows, dim] = shape;
    const count = rows * dim;
    const start = buf.byteOffset + headerStart + headerLen;

    let data;
    if (descr === "<f4") {
        data = new Float32Array(buf.buffer.slice(start, start + count * 4));
    } else if (descr === "<f8") {
        data = Float32Array.from(new Float64Array(buf.buffer.slice(start, start + count * 8)));
    } else {
        throw new Error(`Unsupported .npy dtype "${descr}" (need float32 or float64)`);
    }

    return { data, rows, dim };
}


class Recommender {

    constructor(artDir = "artifacts", { pooling = "mean" } = {}) {
        this.artDir = path.resolve(artDir);
        this.pooling = pooling;
        this.extractor = null;
        this._queryCache = new Map();

        const { data, rows, dim } = loadNpy(path.join(this.artDir, "corpus_emb.npy"));
        this.emb = data;
        this.dim = dim;

        this.rows = parse(
            fs.readFileSync(path.join(this.artDir, "corpus.csv"), "utf8"),
            { columns: true, skip_empty_lines: true, bom: true }
        );

        if (this.rows.length !== rows) {
            throw new Error(
                `corpus.csv has ${this.rows.length} rows but corpus_emb.npy has ${rows}`
            );
        }

        this.size = rows;
        this.cluster = this.rows.map((r) => String(r.cluster));
        this.companyLc = this.rows.map((r) => String(r.company ?? "").toLowerCase());

        const topicIndex = new Map();
        this.topicId = new Int32Array(this.size);
        this.rows.forEach((r, i) => {
            const t = String(r.topic ?? "");
            if (!topicIndex.has(t)) topicIndex.set(t, topicIndex.size);
            this.topicId[i] = topicIndex.get(t);
        });

        this.nTopics = topicIndex.size;
        this.nClusters = new Set(this.cluster).size;
        this.companies = [...new Set(this.rows.map((r) => r.company))].sort();

        // question text -> row index (used to rebuild session state from history)
        this.questionIndex = new Map();
        this.rows.forEach((r, i) => {
            const key = normalizeQuestion(r.question);
            if (!this.questionIndex.has(key)) this.questionIndex.set(key, i);
        });
    }

    static async load(artDir = "artifacts", options = {}) {
        const rec = new Recommender(artDir, options);
        await rec.init();
        return rec;
    }

    async init() {
        if (this.extractor) return this;

        const { pipeline, env } = await import("@huggingface/transformers");
        env.allowLocalModels = true;
        env.allowRemoteModels = false;
        env.localModelPath = this.artDir;   // loads <artDir>/model/onnx/model.onnx

        this.extractor = await pipeline("feature-extraction", "model", { dtype: "fp32" });
        return this;
    }

    async encodeQuery(company, role, rnd = "") {
        const text = makeQuery(company, role, rnd);

        if (this._queryCache.has(text)) return this._queryCache.get(text);
        if (!this.extractor) await this.init();

        const output = await this.extractor(text, {
            pooling: this.pooling,
            normalize: true
        });

        const vec = Float32Array.from(output.data);
        if (vec.length !== this.dim) {
            throw new Error(
                `Query embedding has ${vec.length} dims but corpus has ${this.dim}. ` +
                `Check the ONNX export and pooling setting.`
            );
        }

        this._queryCache.set(text, vec);
        return vec;
    }
}


/**
 * Remembers which questions (concepts) were recently shown to ANY candidate,
 * so that the next candidate is steered towards ones nobody has seen lately.
 * The memory fades over time (half-life), so old exposure stops mattering.
 * In-memory only: it resets when the server restarts.
 */
class ExposureTracker {

    constructor({ halfLifeMs = 6 * 60 * 60 * 1000 } = {}) {
        this.halfLifeMs = halfLifeMs;
        this.map = new Map();   // cluster -> { value, at }
    }

    get(cluster) {
        const entry = this.map.get(cluster);
        if (!entry) return 0;
        return entry.value * Math.pow(0.5, (Date.now() - entry.at) / this.halfLifeMs);
    }

    record(cluster) {
        this.map.set(cluster, { value: this.get(cluster) + 1, at: Date.now() });
    }
}


/**
 * One interview session.
 *
 * Old behaviour: take the 3 best matches and pick almost always the best one,
 * so everyone with the same company/role got the same questions.
 *
 * New behaviour:
 *  1. take the best phrasing of each unasked concept (cluster) and keep the top `pool`
 *  2. score each as a z-score inside that pool (relevance stays the main signal)
 *  3. subtract a penalty for topics this session already used, and for concepts
 *     that other candidates were recently shown (shared ExposureTracker)
 *  4. pick randomly with a softmax over those scores
 * A bigger `pool` / `temperature` = more variety, a smaller one = more relevance.
 */
class Session {

    constructor(rec, base, {
        topicPenalty = 0.8,
        pool = 80,
        temperature = 1.0,
        exposure = null,
        exposurePenalty = 1.5,
        seed = null
    } = {}) {
        this.rec = rec;
        this.base = base;
        this.topicPenalty = topicPenalty;
        this.pool = pool;
        this.temperature = temperature;
        this.exposure = exposure;
        this.exposurePenalty = exposurePenalty;
        this.rng = seed === null || seed === undefined ? Math.random : mulberry32(seed);
        this.asked = new Set();
        this.topicCounts = new Float64Array(rec.nTopics);
        this.history = [];
        this._order = null;
    }

    // The Python constructor encoded the query synchronously; in Node it is async.
    static async create(rec, company, role, rnd = "", options = {}) {
        const { companyBoost = 0.15 } = options;

        const q = await rec.encodeQuery(company, role, rnd);
        const lc = String(company).toLowerCase();
        const { emb, dim, size, companyLc } = rec;

        const base = new Float64Array(size);
        for (let i = 0; i < size; i++) {
            let dot = 0;
            const off = i * dim;
            for (let j = 0; j < dim; j++) dot += emb[off + j] * q[j];
            // soft preference for the requested company (unknown companies get no boost)
            base[i] = dot + (companyLc[i] === lc ? companyBoost : 0);
        }

        return new Session(rec, base, options);
    }

    // Mark a previously asked question (used to rebuild state between requests)
    markAsked(question) {
        const idx = this.rec.questionIndex.get(normalizeQuestion(question));
        if (idx === undefined) return false;

        this.asked.add(this.rec.cluster[idx]);
        this.topicCounts[this.rec.topicId[idx]] += 1;
        return true;
    }

    next() {
        const r = this.rec;

        // Rows sorted by relevance (best first); computed once per session
        if (!this._order) {
            this._order = Array.from({ length: r.size }, (_, i) => i)
                .sort((a, b) => this.base[b] - this.base[a]);
        }

        // 1) best phrasing of each concept that has not been asked yet
        const candidates = [];
        const seen = new Set();

        for (const i of this._order) {
            const c = r.cluster[i];
            if (this.asked.has(c) || seen.has(c)) continue;

            seen.add(c);
            candidates.push(i);

            if (candidates.length >= this.pool) break;
        }

        if (candidates.length === 0) return null;   // question bank exhausted

        // 2) relevance as a z-score inside the pool
        let mean = 0;
        for (const i of candidates) mean += this.base[i];
        mean /= candidates.length;

        let variance = 0;
        for (const i of candidates) variance += (this.base[i] - mean) ** 2;
        const std = Math.sqrt(variance / candidates.length) || 1;

        // 3) penalties: topics already used here, concepts recently shown to others
        const adjusted = candidates.map((i) => {
            let z = (this.base[i] - mean) / std;
            z -= this.topicPenalty * this.topicCounts[r.topicId[i]];

            if (this.exposure) {
                z -= this.exposurePenalty * Math.log1p(this.exposure.get(r.cluster[i]));
            }

            return z;
        });

        // 4) random pick (softmax)
        const max = Math.max(...adjusted);
        const weights = adjusted.map((z) => Math.exp((z - max) / this.temperature));
        const total = weights.reduce((a, b) => a + b, 0);

        let u = this.rng() * total;
        let pick = candidates.length - 1;
        for (let j = 0; j < candidates.length; j++) {
            u -= weights[j];
            if (u <= 0) { pick = j; break; }
        }

        const chosen = candidates[pick];

        this.asked.add(r.cluster[chosen]);
        this.topicCounts[r.topicId[chosen]] += 1;
        if (this.exposure) this.exposure.record(r.cluster[chosen]);

        const row = r.rows[chosen];
        const out = {
            question: row.question,
            topic: row.topic,
            round: row.round,
            company: row.company,
            url: row.url,
            score: this.base[chosen]
        };

        this.history.push(out);
        return out;
    }
}


module.exports = { Recommender, Session, ExposureTracker, makeQuery, makeDoc };