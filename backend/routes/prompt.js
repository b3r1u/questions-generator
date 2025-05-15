function buildPrompt(count, difficulty, text) {
  const difficultyText = {
    easy: "fácil",
    medium: "médio",
    hard: "difícil",
  };

  return `
Você é um gerador de questões de múltipla escolha em português (Brasil), baseadas em textos técnicos. Gere exatamente ${count} questões de dificuldade "${
    difficultyText[difficulty]
  }" com base no texto abaixo.

---

📌 FORMATO DE SAÍDA (JSON estritamente válido):

[
  {
    "type": "multiple_choice",
    "text": "Texto da pergunta...",
    "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
    "correctAnswer": 2,
    "difficulty": "${difficulty}"
  },
  ...
]

---

📋 INSTRUÇÕES IMPORTANTES:

1. Retorne **somente** o array JSON — sem explicações, comentários ou quebras de padrão.
2. Cada questão deve conter:
   - Um campo "text" com a pergunta.
   - Um array "options" com 4 alternativas como **strings puras** (sem letras, números ou prefixos como "A)", "1." etc).
   - Um campo "correctAnswer" com o índice da alternativa correta (de 0 a 3).
   - Um campo "difficulty" com o valor: "${difficulty}".
3. As alternativas devem ser plausíveis, distintas e sem duplicatas.
4. **Nunca use palavras como "correctAnswer", "difficulty", "type", "text", "options" ou qualquer chave do JSON como alternativas.**
5. A alternativa correta deve variar entre as posições.
6. O JSON final deve ser estritamente válido (sem erros de formatação).
7. JAMAIS repita questões ou alternativas, sempre alternativas diferentes contendo apenas uma correta entre elas.

---

🧠 DIFERENCIAÇÃO POR DIFICULDADE:

- **fácil**: resposta clara no texto.
- **médio**: exige interpretação de dois ou mais trechos.
- **difícil**: exige análise crítica, inferência ou síntese.

---

📄 TEXTO BASE:
"""
${text.substring(0, 6000)}
"""
  `;
}

module.exports = { buildPrompt };
