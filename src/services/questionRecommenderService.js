const path = require("path");
const {
    Recommender,
    Session,
    ExposureTracker
} = require("../recommender/recommender");

class QuestionRecommenderService {

    constructor({
        artifactsDir = "artifacts",
        pooling = "mean",
        defaults = {},
        sessionOptions = {},
        exposureHalfLifeHours = 6
    } = {}) {

        this.artifactsDir = path.resolve(process.cwd(), artifactsDir);
        this.pooling = pooling;
        this.defaults = defaults;
        this.sessionOptions = sessionOptions;
        this._ready = null;

        // Shared by every interview, so candidates are steered away from
        // questions other candidates were recently shown.
        this.exposure = new ExposureTracker({
            halfLifeMs: exposureHalfLifeHours * 60 * 60 * 1000
        });
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
            context.round || this.defaults.round,
            { ...this.sessionOptions, exposure: this.exposure }
        );

        // Rebuild this interview's state from the questions already asked
        for (const q of context.previousQuestions || []) {
            session.markAsked(q);
        }

        return session.next();   // null when the bank is exhausted
    }
}

module.exports = QuestionRecommenderService;