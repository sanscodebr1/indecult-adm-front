export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateMathChallenge() {
  const operator = Math.random() < 0.65 ? "+" : "*";
  const operandLeft = operator === "+" ? randomInt(2, 20) : randomInt(2, 9);
  const operandRight = operator === "+" ? randomInt(2, 20) : randomInt(2, 9);
  const answerValue = operator === "+" ? operandLeft + operandRight : operandLeft * operandRight;

  return {
    operandLeft,
    operator,
    operandRight,
    answerValue,
    prompt: `${operandLeft} ${operator} ${operandRight}`
  };
}
