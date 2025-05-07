const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const PDFDocument = require("pdfkit");
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
Quero que você crie ${count} questões de múltipla escolha de nível ${
      difficulty === "easy"
        ? "fácil"
        : difficulty === "medium"
        ? "médio"
        : "difícil"
    }, baseadas no texto abaixo. 
Cada questão deve ter 4 alternativas, apenas uma correta. 
Retorne em formato JSON, como exemplo:
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
"""${text.substring(0, 6000)}"""`;

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

module.exports = router;
