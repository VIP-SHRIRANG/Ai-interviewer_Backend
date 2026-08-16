class SentenceBuffer {

    constructor() {
        this.buffer = "";
    }

    add(token) {

        this.buffer += token;

        const match =
            this.buffer.match(
                /^([\s\S]*?[.!?])(?:\s|$)/
            );

        if (!match) {
            return null;
        }

        const sentence =
            match[1].trim();

        this.buffer =
            this.buffer.slice(
                match[0].length
            );

        return sentence;
    }

    flush() {

        const remaining =
            this.buffer.trim();

        this.buffer = "";

        return remaining || null;
    }
}

module.exports = SentenceBuffer;