const boardElement = document.getElementById('board');
const cells = Array.from(document.querySelectorAll('.cell'));
const statusText = document.getElementById('statusText');
const scoreText = document.getElementById('scoreText');
const newRoundBtn = document.getElementById('newRoundBtn');
const resetBtn = document.getElementById('resetBtn');

const symbols = {
  X: '🐱',
  O: '🐶',
};

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

let board = Array(9).fill('');
let currentPlayer = 'X';
let isRoundOver = false;
let score = { X: 0, O: 0 };

function updateStatus(message) {
  statusText.textContent = message;
}

function updateScore() {
  scoreText.textContent = `Score — ${symbols.X}: ${score.X} | ${symbols.O}: ${score.O}`;
}

function switchPlayer() {
  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
}

function findWinner() {
  for (const line of winningLines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function isBoardFull() {
  return board.every((cell) => cell !== '');
}

function drawCell(index) {
  const cell = cells[index];
  const player = board[index];
  cell.textContent = symbols[player];
  cell.classList.toggle('x', player === 'X');
  cell.classList.toggle('o', player === 'O');
}

function endRoundWithWinner(winner) {
  isRoundOver = true;
  score[winner] += 1;
  updateScore();
  updateStatus(`🎉 ${symbols[winner]} wins this round!`);
}

function endRoundWithDraw() {
  isRoundOver = true;
  updateStatus('🤝 It\'s a draw! Start a new round!');
}

function handleCellClick(event) {
  const cell = event.target.closest('.cell');
  if (!cell || isRoundOver) {
    return;
  }

  const index = Number(cell.dataset.index);
  if (board[index]) {
    return;
  }

  board[index] = currentPlayer;
  drawCell(index);

  const winner = findWinner();
  if (winner) {
    endRoundWithWinner(winner);
    return;
  }

  if (isBoardFull()) {
    endRoundWithDraw();
    return;
  }

  switchPlayer();
  updateStatus(`Player ${symbols[currentPlayer]}'s turn`);
}

function clearBoard() {
  board = Array(9).fill('');
  isRoundOver = false;
  currentPlayer = 'X';
  cells.forEach((cell) => {
    cell.textContent = '';
    cell.classList.remove('x', 'o');
  });
  updateStatus(`Player ${symbols[currentPlayer]}'s turn`);
}

function resetScore() {
  score = { X: 0, O: 0 };
  updateScore();
  clearBoard();
}

boardElement.addEventListener('click', handleCellClick);
newRoundBtn.addEventListener('click', clearBoard);
resetBtn.addEventListener('click', resetScore);

updateScore();
updateStatus(`Player ${symbols[currentPlayer]}'s turn`);
