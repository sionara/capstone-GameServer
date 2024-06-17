const determineWinner = (choice1, choice2) => {
  if (choice1 === choice2) {
    return "Draw";
  }
  if (
    (choice1 === "rock" && choice2 === "scissors") ||
    (choice1 === "scissors" && choice2 === "paper") ||
    (choice1 === "paper" && choice2 === "rock")
  ) {
    return "Player 1";
  } else {
    return "Player 2";
  }
};

module.exports = {
  determineWinner,
};
