// ===================================================
// ジェスチャーゲーム（Heads Up!）制御
// ===================================================

// 現在表示中のお題テキストを保持する変数
let currentGestureWordText = '';

document.getElementById('btn-gesture-start').addEventListener('click', async () => {
  // 1. タップされた瞬間に最優先でジャイロの許可・起動を行う
  const gyroStarted = await startGyroGame((action) => {
    handleGestureAction(action);
  });
  
  // 💡【追加】タッチ判定（ダブルタップ・上フリック）も同時に起動
  startTouchGame(gestureScreen, (action) => {
    handleGestureAction(action);
  });
  
  prepareWords();

  // ゲーム開始時に履歴をリセット
  resetGameHistory();

  showScreen(gestureScreen);
  renderNextGestureWord();

  startTimerBar(document.getElementById('gesture-timer-bar'), () => {
    // タイムアップ時の処理
    stopCommonGame();
    // タイムアップ時にリザルトモーダルを表示
    showResultModal();
  });
});

document.getElementById('btn-gesture-back').addEventListener('click', () => {
  stopCommonGame();
  showScreen(gestureSetupScreen);
});

function renderNextGestureWord() {
  const display = document.getElementById('gesture-word');
  const wordText = getNextWordText();
  
  if (!wordText) {
    currentGestureWordText = '';
    display.textContent = "全問終了！";
    return;
  }

  currentGestureWordText = wordText;
  display.textContent = wordText;
}

function handleGestureAction(action) {
  const display = document.getElementById('gesture-word');

  // 単語が表示されていない（全問終了時など）場合は記録しない
  if (!currentGestureWordText) return;

  if (action === 'correct') {
    // 2. 正解履歴を記録（common.jsの関数）
    recordGameResult(currentGestureWordText, 'correct');
    
    document.body.classList.add('correct');
    display.textContent = "正解！";
  } else {
    // 2. パス履歴を記録（common.jsの関数）
    recordGameResult(currentGestureWordText, 'pass');

    document.body.classList.add('pass');
    display.textContent = "パス！";
  }

  setTimeout(() => {
    document.body.classList.remove('correct', 'pass');
    renderNextGestureWord();
  }, 800);
}
