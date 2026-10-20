class ReportService {

    generatePdfBuffer(session) {

        try {
            // Optional PDFKit support if installed in the user's environment
            const PDFDocument = require("pdfkit");
            return this.generateWithPdfKit(PDFDocument, session);
        } catch (_) {
            // Fallback to built-in zero-dependency PDF 1.4 generator
            return Promise.resolve(
                this.generateNativePdfBuffer(session)
            );
        }
    }


    generateWithPdfKit(PDFDocument, session) {

        return new Promise((resolve, reject) => {

            const doc = new PDFDocument({ margin: 50 });
            const chunks = [];

            doc.on("data", chunk => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", err => reject(err));

            const summary = session.overallSummary || {};

            doc.fontSize(20).text("L1 Interview Performance Report", { align: "left" });
            doc.moveDown(0.5);

            doc.fontSize(11)
                .text(`Session ID: ${session.sessionId}`)
                .text(`Candidate: ${session.candidateName || "Candidate"}`)
                .text(`Interview Mode: ${session.interviewMode || "L1"} (Fundamental)`)
                .text(`Topic: ${session.topic || "JavaScript"}`)
                .text(`Status: ${session.status || "completed"}`)
                .text(`Average Score: ${session.averageScore ?? 0} / 10`)
                .text(`Readiness Level: ${summary.readinessLevel || "N/A"}`)
                .text(`Date: ${session.createdAt || new Date().toISOString()}`);

            doc.moveDown();

            if (summary.overallFeedback) {
                doc.fontSize(14).text("Executive Summary");
                doc.fontSize(11).text(summary.overallFeedback);
                doc.moveDown(0.5);
            }

            if (Array.isArray(summary.strongAreas) && summary.strongAreas.length > 0) {
                doc.fontSize(12).text("Key Strengths:");
                summary.strongAreas.forEach(item => doc.fontSize(10).text(`• ${item}`));
                doc.moveDown(0.5);
            }

            if (Array.isArray(summary.skillGaps) && summary.skillGaps.length > 0) {
                doc.fontSize(12).text("Identified Skill Gaps:");
                summary.skillGaps.forEach(item => doc.fontSize(10).text(`• ${item}`));
                doc.moveDown(0.5);
            }

            if (Array.isArray(summary.recommendedTopics) && summary.recommendedTopics.length > 0) {
                doc.fontSize(12).text("Recommended Revision Topics:");
                summary.recommendedTopics.forEach(item => doc.fontSize(10).text(`• ${item}`));
                doc.moveDown();
            }

            doc.fontSize(14).text("Question-by-Question Breakdown");
            doc.moveDown(0.5);

            for (const item of (session.history || [])) {
                doc.fontSize(12).text(
                    `Q${item.questionNumber} [${(item.difficulty || "easy").toUpperCase()}] — Score: ${item.score ?? "N/A"}/10`
                );
                doc.fontSize(11).text(`Question: ${item.question || ""}`);
                doc.fontSize(10).text(`Candidate Answer: ${item.answer || "No answer recorded"}`);
                doc.fontSize(10).text(`Feedback: ${item.feedback || "No feedback recorded"}`);

                if (Array.isArray(item.missingConcepts) && item.missingConcepts.length > 0) {
                    doc.fontSize(10).text(`Missing Concepts: ${item.missingConcepts.join(", ")}`);
                }

                doc.moveDown();
            }

            doc.end();
        });
    }


    generateNativePdfBuffer(session) {

        const summary = session.overallSummary || {};
        const lines = [];

        const pushWrapped = (text, maxChars = 84, prefix = "") => {
            const clean = this.sanitizePdfText(String(text || ""));
            const words = clean.split(/\s+/).filter(Boolean);
            if (words.length === 0) {
                lines.push({ text: prefix, bold: false, size: 10 });
                return;
            }
            let current = prefix;
            for (const word of words) {
                if ((current + " " + word).trim().length > maxChars) {
                    lines.push({ text: current.trim(), bold: false, size: 10 });
                    current = "   " + word;
                } else {
                    current = current ? `${current} ${word}` : word;
                }
            }
            if (current.trim()) {
                lines.push({ text: current.trim(), bold: false, size: 10 });
            }
        };

        lines.push({ text: "PERSONALIZED AI INTERVIEWER - L1 PERFORMANCE REPORT", bold: true, size: 15 });
        lines.push({ text: "====================================================================", bold: false, size: 10 });
        lines.push({ text: `Session ID: ${this.sanitizePdfText(session.sessionId)}`, bold: false, size: 10 });
        lines.push({ text: `Candidate: ${this.sanitizePdfText(session.candidateName || "Candidate")}`, bold: false, size: 10 });
        lines.push({ text: `Interview Mode: ${this.sanitizePdfText(session.interviewMode || "L1")} (Fundamental Interview)`, bold: false, size: 10 });
        lines.push({ text: `Topic: ${this.sanitizePdfText(session.topic || "JavaScript")}`, bold: false, size: 10 });
        lines.push({ text: `Average Score: ${session.averageScore ?? 0} / 10 (${this.sanitizePdfText(summary.readinessLevel || "Completed")})`, bold: true, size: 11 });
        lines.push({ text: `Date: ${this.sanitizePdfText(session.createdAt || new Date().toISOString())}`, bold: false, size: 10 });
        lines.push({ text: "", bold: false, size: 10 });

        if (summary.overallFeedback) {
            lines.push({ text: "OVERALL SUMMARY", bold: true, size: 12 });
            pushWrapped(summary.overallFeedback, 82);
            lines.push({ text: "", bold: false, size: 10 });
        }

        if (Array.isArray(summary.strongAreas) && summary.strongAreas.length > 0) {
            lines.push({ text: "KEY STRENGTHS", bold: true, size: 11 });
            summary.strongAreas.forEach(s => pushWrapped(s, 80, "- "));
            lines.push({ text: "", bold: false, size: 10 });
        }

        if (Array.isArray(summary.skillGaps) && summary.skillGaps.length > 0) {
            lines.push({ text: "SKILL GAPS TO ADDRESS", bold: true, size: 11 });
            summary.skillGaps.forEach(g => pushWrapped(g, 80, "- "));
            lines.push({ text: "", bold: false, size: 10 });
        }

        if (Array.isArray(summary.recommendedTopics) && summary.recommendedTopics.length > 0) {
            lines.push({ text: "RECOMMENDED REVISION TOPICS", bold: true, size: 11 });
            summary.recommendedTopics.forEach(t => pushWrapped(t, 80, "- "));
            lines.push({ text: "", bold: false, size: 10 });
        }

        lines.push({ text: "QUESTION-BY-QUESTION EVALUATION", bold: true, size: 12 });
        lines.push({ text: "--------------------------------------------------------------------", bold: false, size: 10 });

        for (const item of (session.history || [])) {
            lines.push({
                text: `Question ${item.questionNumber} [${String(item.difficulty || "easy").toUpperCase()}] - Score: ${item.score ?? "N/A"}/10`,
                bold: true,
                size: 11
            });
            pushWrapped(`Q: ${item.question || ""}`, 82);
            pushWrapped(`Answer: ${item.answer || "No answer recorded"}`, 82);
            pushWrapped(`Feedback: ${item.feedback || "No feedback recorded"}`, 82);

            if (Array.isArray(item.missingConcepts) && item.missingConcepts.length > 0) {
                pushWrapped(`Missing Concepts: ${item.missingConcepts.join(", ")}`, 82);
            }
            lines.push({ text: "", bold: false, size: 10 });
        }

        // Paginate at 44 lines per page
        const linesPerPage = 44;
        const pages = [];
        for (let i = 0; i < lines.length; i += linesPerPage) {
            pages.push(lines.slice(i, i + linesPerPage));
        }
        if (pages.length === 0) {
            pages.push([{ text: "No interview questions recorded.", bold: false, size: 11 }]);
        }

        return this.buildRawPdfDocument(pages);
    }


    sanitizePdfText(str) {

        return String(str || "")
            .replace(/[^\x20-\x7E]/g, " ")
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)");
    }


    buildRawPdfDocument(pages) {

        // Objects:
        // 1: Catalog
        // 2: Pages
        // 3: Font Regular (Helvetica)
        // 4: Font Bold (Helvetica-Bold)
        // 5..N: Page & Content pairs
        const objects = [];

        const addObject = (body) => {
            objects.push(body);
            return objects.length;
        };

        addObject("<< /Type /Catalog /Pages 2 0 R >>"); // 1
        addObject(""); // 2 placeholder for Pages
        addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"); // 3
        addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"); // 4

        const pageObjectIds = [];

        for (const pageLines of pages) {
            let streamOps = "BT\n";
            let y = 750;

            for (const line of pageLines) {
                const fontRef = line.bold ? "/F2" : "/F1";
                const fontSize = line.size || 10;
                streamOps += `${fontRef} ${fontSize} Tf\n`;
                streamOps += `1 0 0 1 50 ${y} Tm\n`;
                streamOps += `(${line.text}) Tj\n`;
                y -= fontSize + 6;
            }

            streamOps += "ET";
            const streamByteLength = Buffer.byteLength(streamOps, "utf8");

            const contentObjId = addObject(
                `<< /Length ${streamByteLength} >>\nstream\n${streamOps}\nendstream`
            );

            const pageObjId = addObject(
                `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
                `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
                `/Contents ${contentObjId} 0 R >>`
            );

            pageObjectIds.push(pageObjId);
        }

        const kidsArray = pageObjectIds.map(id => `${id} 0 R`).join(" ");
        objects[1] = `<< /Type /Pages /Kids [ ${kidsArray} ] /Count ${pageObjectIds.length} >>`;

        let pdf = "%PDF-1.4\n";
        const offsets = [0];

        for (let i = 0; i < objects.length; i++) {
            offsets.push(Buffer.byteLength(pdf, "utf8"));
            pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
        }

        const xrefOffset = Buffer.byteLength(pdf, "utf8");
        pdf += `xref\n0 ${objects.length + 1}\n`;
        pdf += "0000000000 65535 f \n";

        for (let i = 1; i <= objects.length; i++) {
            const offsetStr = String(offsets[i]).padStart(10, "0");
            pdf += `${offsetStr} 00000 n \n`;
        }

        pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
        pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

        return Buffer.from(pdf, "utf8");
    }
}


module.exports =
    ReportService;