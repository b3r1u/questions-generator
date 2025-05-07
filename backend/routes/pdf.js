const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const PDFDocument = require("pdfkit");
const docx = require("docx");
const XLSX = require("xlsx");
const { Document, Packer, Paragraph, TextRun } = docx;
require("dotenv").config();

const router = express.Router();
const upload = multer();

const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

router.post("/extract-questions", upload.single("pdf"), async (req, res) => {
  try {
    const { difficulty, count } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }
    if (!difficulty || !count) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    const prompt = `
Gere ${count} questões de múltipla escolha de nível ${
      difficulty === "easy"
        ? "fácil"
        : difficulty === "medium"
        ? "médio"
        : "difícil"
    }, baseadas no texto abaixo.
Cada questão deve ter 4 alternativas, apenas uma correta.
Retorne SOMENTE um array JSON sem explicações ou comentários, como no exemplo abaixo:
[
  {
    "type": "multiple_choice",
    "text": "Enunciado da questão...",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": 0,
    "difficulty": "${difficulty}"
  }
]
Texto base:
"""${text.substring(0, 6000)}"""
`;

    const completion = await openai.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });
    let aiResponse = completion.choices[0].message.content;
    let questions;
    try {
      questions = JSON.parse(aiResponse);
    } catch (e) {
      const jsonMatch = aiResponse.match(/\[.*\]/s);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({
          error: "Não foi possível extrair as questões da resposta da IA.",
        });
      }
    }

    res.json({ questions });
  } catch (error) {
    console.error("Erro ao gerar questões:", error);
    res.status(500).json({ error: "Erro ao gerar questões." });
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

module.exports = router;
