class TTSService {

    constructor(ttsProvider) {
        this.ttsProvider = ttsProvider;
    }

    async speak(text) {

        return await this.ttsProvider.synthesize(
            text
        );
    }
}

module.exports = TTSService;    