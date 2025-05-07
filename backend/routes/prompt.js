function buildPrompt(count, difficulty, text) {
  return `
Gere exatamente ${count} questões de múltipla escolha de nível ${
    difficulty === "easy"
      ? "fácil"
      : difficulty === "medium"
      ? "médio"
      : "difícil"
  }, baseadas no texto abaixo.
Cada questão deve ter 4 alternativas, apenas uma correta, todas em português (Brasil).

IMPORTANTE:
- Retorne APENAS um array JSON válido, sem nenhum texto, comentário ou explicação antes ou depois do array.
- O JSON deve ser estritamente válido, com todas as aspas, colchetes e chaves corretamente fechados.
- O array "options" deve conter apenas as alternativas como strings, **sem letras ou números no início** (ex: apenas "Rio de Janeiro", não "A) Rio de Janeiro").
- O campo "correctAnswer" deve ser um número de 0 a 3, indicando o índice da alternativa correta no array "options", e deve vir FORA do array.
- As alternativas corretas devem ser variadas (não sempre a primeira).
- NÃO escreva nada antes ou depois do array JSON. NÃO adicione comentários. NÃO coloque explicações.
- Exemplo do formato esperado:
[
  {
    "type": "multiple_choice",
    "text": "Qual a capital do Brasil?",
    "options": ["Rio de Janeiro", "São Paulo", "Brasília", "Salvador"],
    "correctAnswer": 2,
    "difficulty": "${difficulty}"
  }
]

Sobre NÍVEIS DE DIFICULDADE:
- "fácil": pergunta direta, resposta óbvia e clara no texto.
- "médio": pergunta exige interpretação, análise de mais de um trecho ou comparação, mas ainda assim está explícita no texto.
- "difícil": demanda raciocínio, síntese de informações, análise crítica, ou envolve detalhes menos evidentes/ocultos no texto, podendo exigir conhecimento prévio ou inferência.

Se o nível for "médio" ou "difícil", **crie uma questão que realmente exija maior complexidade, análise, comparação ou inferência, e que não seja respondida apenas com leitura superficial.**

Texto base:
"""${text.substring(0, 6000)}"""
  `;
}

module.exports = { buildPrompt };
