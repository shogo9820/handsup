// ===================================================
// カタカナーシ 制御
// ===================================================

// 現在表示中のお題テキストを保持する変数
let currentTabooWordText = '';

document.getElementById('btn-taboo-start').addEventListener('click', async () => {
  // 1. タップされた瞬間に最優先でジャイロの許可・起動を行う
  // 💡 【修正】ジェスチャー用（handleGestureAction）になっていた部分を、カタカナーシ用（handleTabooAction）に変更
  const gyroStarted = await startGyroGame((action) => {
    handleTabooAction(action);
  });
  
  prepareWords();

  // 1. ゲーム開始時に履歴をリセット（common.jsの関数）
  resetGameHistory();

  await startGyroGame((action) => {
    handleTabooAction(action);
  });

  showScreen(tabooScreen);
  renderNextTabooWord();

  startTimerBar(document.getElementById('taboo-timer-bar'), () => {
    // タイムアップ時の処理
    stopCommonGame();
    // 3. タイムアップ時にリザルトモーダルを表示（common.jsの関数）
    showResultModal();
  });
});

document.getElementById('btn-taboo-back').addEventListener('click', () => {
  stopCommonGame();
  showScreen(tabooSetupScreen);
});

function renderNextTabooWord() {
  const display = document.getElementById('taboo-word');
  const wordText = getNextWordText();
  
  if (!wordText) {
    currentTabooWordText = '';
    display.textContent = "全問終了！";
    return;
  }

  currentTabooWordText = wordText;
  display.textContent = wordText;
}

function handleTabooAction(action) {
  const display = document.getElementById('taboo-word');

  // 単語が表示されていない（全問終了時など）場合は記録しない
  if (!currentTabooWordText) return;

  if (action === 'correct') {
    // 2. 正解履歴を記録（common.jsの関数）
    recordGameResult(currentTabooWordText, 'correct');

    document.body.classList.add('correct');
    display.textContent = "正解！";
  } else {
    // 2. パス履歴を記録（common.jsの関数）
    recordGameResult(currentTabooWordText, 'pass');

    document.body.classList.add('pass');
    display.textContent = "パス！";
  }

  setTimeout(() => {
    document.body.classList.remove('correct', 'pass');
    renderNextTabooWord();
  }, 800);
}
