const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const PDFDocument = require("pdfkit");
const docx = require("docx");
const XLSX = require("xlsx");
const { buildPrompt } = require("./prompt");
const { Document, Packer, Paragraph, TextRun } = docx;
const { jsonrepair } = require("jsonrepair");

require("dotenv").config();

const router = express.Router();
const upload = multer();

const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

async function generateQuestionsWithRetry({ prompt, maxAttempts = 3 }) {
  const disallowedWords = [
    "correctanswer",
    "difficulty",
    "type",
    "text",
    "options",
  ];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
      });

      let aiResponse = completion.choices[0].message.content;

      try {
        let questions = JSON.parse(aiResponse);
        return sanitizeOptions(questions, disallowedWords);
      } catch (e) {
        const repaired = jsonrepair(aiResponse);
        let questions = JSON.parse(repaired);
        return sanitizeOptions(questions, disallowedWords);
      }
    } catch (error) {
      console.warn(`⚠️ Tentativa ${attempt} falhou: ${error.message}`);
      if (attempt === maxAttempts) throw error;
    }
  }

  throw new Error("Falha ao gerar questões após várias tentativas.");
}

function sanitizeOptions(questions, disallowedWords) {
  return questions.map((q) => {
    const filteredOptions = q.options.filter(
      (opt) =>
        typeof opt === "string" &&
        !disallowedWords.includes(opt.trim().toLowerCase())
    );

    return {
      ...q,
      options: filteredOptions.length === 4 ? filteredOptions : q.options,
    };
  });
}

router.post("/extract-questions", upload.single("pdf"), async (req, res) => {
  try {
    const count = parseInt(req.body.count, 10);
    const difficulty = req.body.difficulty?.trim().toLowerCase();

    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }
    if (!difficulty || isNaN(count) || count <= 0) {
      return res.status(400).json({ error: "Dados inválidos." });
    }

    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;
    const prompt = buildPrompt(count, difficulty, text);

    const questions = await generateQuestionsWithRetry({ prompt });

    res.json({ questions });
  } catch (error) {
    console.error("Erro ao gerar questões:", error);
    res.status(500).json({
      error: "Erro ao gerar questões.",
      details: error.message,
    });
  }
});

router.post(
  "/generate-pdf",
  express.json({ limit: "5mb" }),
  async (req, res) => {
    try {
      const { questions, title } = req.body;

      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "Nenhuma questão fornecida." });
      }

      const doc = new PDFDocument({ margin: 50 });
      let buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        res.writeHead(200, {
          "Content-Length": Buffer.byteLength(pdfData),
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${(
            title || "Questionario"
          ).replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`,
        });
        res.end(pdfData);
      });

      doc
        .fontSize(20)
        .text(title || "Questionário Gerado", { align: "center" })
        .moveDown(2);

      questions.forEach((q, i) => {
        doc
          .fontSize(13)
          .text(
            `Questão ${i + 1}${q.difficulty ? ` [${q.difficulty}]` : ""}:`,
            { underline: true }
          );
        doc.moveDown(0.2);
        doc.fontSize(12).text(q.text);
        doc.moveDown(0.2);

        if (q.options && Array.isArray(q.options)) {
          q.options.forEach((option, j) => {
            const letter = String.fromCharCode(97 + j);
            doc.text(`${letter}) ${option}`, { indent: 20 });
          });
          doc.moveDown(0.2);
        }
        doc.moveDown(1);
      });

      doc.end();
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      res.status(500).json({ error: "Erro ao gerar PDF." });
    }
  }
);

router.post(
  "/generate-quiz-and-answer-key",
  express.json({ limit: "10mb" }),
  async (req, res) => {
    try {
      const { questions, title, format } = req.body;
      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "Nenhuma questão fornecida." });
      }
      let quizBuffer, answerKeyBuffer, quizMime, answerKeyMime, ext;

      if (format === "pdf") {
        quizBuffer = await createPdfBuffer(questions, title, false);
        answerKeyBuffer = await createPdfBuffer(questions, title, true);
        quizMime = answerKeyMime = "application/pdf";
        ext = "pdf";
      } else if (format === "docx") {
        quizBuffer = await createDocxBuffer(questions, title, false);
        answerKeyBuffer = await createDocxBuffer(questions, title, true);
        quizMime = answerKeyMime =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        ext = "docx";
      } else if (format === "xlsx") {
        quizBuffer = createXlsxBuffer(questions, title, false);
        answerKeyBuffer = createXlsxBuffer(questions, title, true);
        quizMime = answerKeyMime =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        ext = "xlsx";
      } else {
        return res.status(400).json({ error: "Formato inválido." });
      }

      res.status(200).json({
        quiz: quizBuffer.toString("base64"),
        answerKey: answerKeyBuffer.toString("base64"),
        ext,
        quizMime,
        answerKeyMime,
      });
    } catch (err) {
      console.error("Erro ao gerar arquivos:", err);
      res.status(500).json({ error: "Erro ao gerar arquivos." });
    }
  }
);

function createPdfBuffer(questions, title, showAnswers) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    doc
      .fontSize(20)
      .text(title || "Questionário Gerado", { align: "center" })
      .moveDown(2);

    questions.forEach((q, i) => {
      doc
        .fontSize(13)
        .text(`Questão ${i + 1}${q.difficulty ? ` [${q.difficulty}]` : ""}:`, {
          underline: true,
        });
      doc.moveDown(0.2);
      doc.fontSize(12).text(q.text);
      doc.moveDown(0.2);

      if (q.options && Array.isArray(q.options)) {
        q.options.forEach((option, j) => {
          const letter = String.fromCharCode(97 + j);
          doc.text(`${letter}) ${option}`, { indent: 20 });
        });
        doc.moveDown(0.2);
        if (
          showAnswers &&
          typeof q.correctAnswer !== "undefined" &&
          q.correctAnswer !== null &&
          q.options[q.correctAnswer]
        ) {
          const letter = String.fromCharCode(97 + Number(q.correctAnswer));
          doc
            .font("Helvetica-Bold")
            .fillColor("green")
            .text(
              `Resposta correta: ${letter}) ${q.options[q.correctAnswer]}`,
              { indent: 10 }
            )
            .fillColor("black")
            .font("Helvetica");
        }
      }
      doc.moveDown(1);
    });

    doc.end();
  });
}

async function createDocxBuffer(questions, title, showAnswers) {
  const paragraphs = [];

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: title || "Questionário Gerado",
          bold: true,
          size: 36,
        }),
      ],
      alignment: docx.AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  questions.forEach((q, i) => {
    paragraphs.push(
      new Paragraph({
        text: `Questão ${i + 1}${q.difficulty ? ` [${q.difficulty}]` : ""}:`,
        bold: true,
        spacing: { after: 100 },
      })
    );
    paragraphs.push(new Paragraph({ text: q.text, spacing: { after: 100 } }));
    if (q.options && Array.isArray(q.options)) {
      q.options.forEach((option, j) => {
        const letter = String.fromCharCode(97 + j);
        paragraphs.push(
          new Paragraph({
            text: `${letter}) ${option}`,
            spacing: { after: 50 },
          })
        );
      });
    }
    if (
      showAnswers &&
      typeof q.correctAnswer !== "undefined" &&
      q.correctAnswer !== null &&
      q.options[q.correctAnswer]
    ) {
      const letter = String.fromCharCode(97 + Number(q.correctAnswer));
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Resposta correta: ${letter}) ${
                q.options[q.correctAnswer]
              }`,
              bold: true,
              color: "008000",
            }),
          ],
          spacing: { before: 100, after: 100 },
        })
      );
    }
    paragraphs.push(new Paragraph({}));
  });

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

function createXlsxBuffer(questions, title, showAnswers) {
  const wsData = [
    [
      "Nº",
      "Enunciado",
      "Alternativa A",
      "B",
      "C",
      "D",
      ...(showAnswers ? ["Correta"] : []),
    ],
  ];
  questions.forEach((q, i) => {
    const row = [
      i + 1,
      q.text,
      ...(q.options || []).slice(0, 4),
      ...(showAnswers
        ? [String.fromCharCode(65 + Number(q.correctAnswer))]
        : []),
    ];
    wsData.push(row);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Questionário");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function fixCorruptedOptionsArray(jsonString) {
  return jsonString.replace(
    /("options"\s*:\s*\[)([^\]]*)\]/g,
    (match, start, inner) => {
      const cleaned = inner
        .replace(/"correctAnswer"\s*:\s*\d+,?/g, "")
        .replace(/"difficulty"\s*:\s*"[^"]*",?/g, "");
      const cleaned2 = cleaned.replace(/,\s*$/, "");
      return `${start}${cleaned2}]`;
    }
  );
}

function fixBrokenOptionStrings(jsonString) {
  return jsonString.replace(
    /("options"\s*:\s*\[([^\]]*?))((?:[^\"])\])/g,
    (match, start, inner, end) => {
      const fixedInner = inner.replace(
        /,?\s*([^\"]+)\s*\]$/,
        (m, p1) => `,"${p1.trim()}"]`
      );
      return start + fixedInner + end;
    }
  );
}

module.exports = router;
