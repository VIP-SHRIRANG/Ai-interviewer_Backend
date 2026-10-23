const path = require("path");
const { Recommender, Session } = require("../recommender/recommender");

class QuestionRecommenderService {

    constructor({ artifactsDir = "artifacts", pooling = "mean", defaults = {} } = {}) {
        this.artifactsDir = path.resolve(process.cwd(), artifactsDir);
        this.pooling = pooling;
        this.defaults = defaults;
        this._ready = null;
    }

    init() {
        if (!this._ready) {
            this._ready = Recommender.load(this.artifactsDir, { pooling: this.pooling });
        }
        return this._ready;
    }

    async options() {
        const rec = await this.init();
        return {
            companies: rec.companies.filter(Boolean),
            rounds: [...new Set(rec.rows.map((r) => r.round).filter(Boolean))].sort()
        };
    }

    async recommend(context = {}) {
        const rec = await this.init();

        const session = await Session.create(
            rec,
            context.company || this.defaults.company,
            context.role || this.defaults.role,
            context.round || this.defaults.round
        );

        for (const q of context.previousQuestions || []) {
            session.markAsked(q);
        }

        return session.next();   // null when the bank is exhausted
    }
}

module.exports = QuestionRecommenderService;