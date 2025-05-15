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

📋 INSTRUÇÕES:

1. Retorne **apenas o array JSON**, sem explicações, comentários ou quebras de padrão.
2. Cada questão deve conter:
   - Um campo "text" com a pergunta.
   - Um array "options" com 4 alternativas como **strings puras** (sem letras ou números).
   - Um campo "correctAnswer" com o índice da alternativa correta (de 0 a 3).
   - Um campo "difficulty" com o valor: "${difficulty}".
3. As alternativas devem ser plausíveis, distintas e sem duplicatas. As alternativas corretas devem ser variadas (não sempre a primeira) e o conteúdo das opções não pode se repetir (ex: nada de ["1", "1", "2", "3"]).
4. A alternativa correta deve variar entre as posições (não sempre ser a primeira).
5. O JSON final deve ser estritamente válido (sem erros de formatação).

---

🧠 DIFERENCIAÇÃO POR DIFICULDADE:

- **fácil**: questão direta, com resposta clara e explícita no texto.
- **médio**: exige interpretação de dois ou mais trechos, comparação, ou raciocínio lógico.
- **difícil**: exige síntese de ideias, análise crítica ou inferência a partir do texto.

---

📄 TEXTO BASE:
"""
${text.substring(0, 6000)}
"""
  `;
}

module.exports = { buildPrompt };
