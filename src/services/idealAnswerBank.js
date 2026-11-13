const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

function normalize(text) {

    return String(text ?? "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}


/**
 * Finds the ideal (reference) answer for a question.
 * Source: a CSV with at least the columns  question, expected_answer.
 * A question that is not in the file (for example one written by the LLM
 * fallback) simply has no ideal answer, and get() returns null.
 */
class IdealAnswerBank {

    constructor(csvPath) {

        this.map = new Map();
        this.path = csvPath ? path.resolve(csvPath) : null;

        if (!this.path || !fs.existsSync(this.path)) {

            console.warn(
                `IdealAnswerBank: file not found (${this.path}). ` +
                `Answers will be evaluated without a reference answer.`
            );
            return;
        }

        const rows = parse(
            fs.readFileSync(this.path, "utf8"),
            { columns: true, skip_empty_lines: true, bom: true }
        );

        for (const row of rows) {

            const answer = String(row.expected_answer ?? "").trim();
            if (!answer) continue;

            const key = normalize(row.question);
            if (!this.map.has(key)) this.map.set(key, answer);
        }

        console.log(`IdealAnswerBank: ${this.map.size} ideal answers loaded`);
    }


    get size() {

        return this.map.size;
    }


    get(question) {

        return this.map.get(normalize(question)) || null;
    }
}


module.exports = IdealAnswerBank;