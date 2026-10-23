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


/** One interview session. Never returns the same question (or a near-duplicate) twice. */
class Session {

    constructor(rec, base, {
        topicPenalty = 0.05,
        topK = 3,
        temperature = 0.05,
        seed = null
    } = {}) {
        this.rec = rec;
        this.base = base;
        this.topicPenalty = topicPenalty;
        this.topK = topK;
        this.temperature = temperature;
        this.rng = seed === null || seed === undefined ? Math.random : mulberry32(seed);
        this.asked = new Set();
        this.topicCounts = new Float64Array(rec.nTopics);
        this.history = [];
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
        const scores = new Float64Array(r.size);
        const best = [];   // top-k indices, highest score first

        for (let i = 0; i < r.size; i++) {
            if (this.asked.has(r.cluster[i])) {
                scores[i] = -Infinity;
                continue;
            }

            const s = this.base[i] - this.topicPenalty * this.topicCounts[r.topicId[i]];
            scores[i] = s;

            if (best.length < this.topK || s > scores[best[best.length - 1]]) {
                let pos = best.length;
                while (pos > 0 && scores[best[pos - 1]] < s) pos--;
                best.splice(pos, 0, i);
                if (best.length > this.topK) best.pop();
            }
        }

        if (best.length === 0) return null;   // question bank exhausted

        let chosen = best[0];

        if (best.length > 1 && this.temperature > 0) {
            const max = scores[best[0]];
            const weights = best.map((idx) => Math.exp((scores[idx] - max) / this.temperature));
            const total = weights.reduce((a, b) => a + b, 0);

            let u = this.rng() * total;
            chosen = best[best.length - 1];
            for (let j = 0; j < best.length; j++) {
                u -= weights[j];
                if (u <= 0) { chosen = best[j]; break; }
            }
        }

        this.asked.add(r.cluster[chosen]);
        this.topicCounts[r.topicId[chosen]] += 1;

        const row = r.rows[chosen];
        const out = {
            question: row.question,
            topic: row.topic,
            round: row.round,
            company: row.company,
            url: row.url,
            score: scores[chosen]
        };

        this.history.push(out);
        return out;
    }
}


module.exports = { Recommender, Session, makeQuery, makeDoc };