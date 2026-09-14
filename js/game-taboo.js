// ===================================================
// カタカナーシ 制御
// ===================================================
let currentTabooWordText = '';

document.getElementById('btn-taboo-start').addEventListener('click', async () => {
  // 5. パス回数の初期設定（無限か指定回数か）
  if (appState.settings.passLimit === "infinite") {
    appState.maxPassLimit = Infinity; // 💡 上限値を記憶
    appState.remainingPasses = Infinity;
  } else {
    appState.maxPassLimit = appState.settings.passLimit; // 💡 上限値を記憶
    appState.remainingPasses = appState.settings.passLimit;
  }
  updatePassCountDisplay('taboo');

  // 1. タップされた瞬間に最優先でジャイロの許可・起動を行う
  const gyroStarted = await startGyroGame((action) => {
    handleTabooAction(action);
  });
  
  // 💡 タッチ判定（ダブルタップ・上下フリック）も同時に起動
  startTouchGame(tabooScreen, (action) => {
    handleTabooAction(action);
  });
  
  prepareWords();

  // ゲーム開始時に履歴をリセット
  resetGameHistory();

  showScreen(tabooScreen);
  renderNextTabooWord();

  startTimerBar(document.getElementById('taboo-timer-bar'), () => {
    // タイムアップ時の処理
    stopCommonGame();
    // タイムアップ時にリザルトモーダルを表示（1. 内部で未解答の最新お題も自動補填されます）
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

    // 💡 正解が出たらパス回数をリセット（追加）
    if (appState.settings.passLimit !== "infinite") {
      appState.remainingPasses = appState.maxPassLimit;
      updatePassCountDisplay('taboo');
    }

    document.body.classList.add('correct');
    display.textContent = "正解！";
  } else {
    // 5. パス回数制限のチェック
    if (appState.settings.passLimit !== "infinite" && appState.remainingPasses <= 0) {
      // パス上限に達している場合は、デバイスを振る/フリックされても処理をスキップ
      return; 
    }
    
    // パス可能な場合は回数を減算して画面表示を更新
    if (appState.settings.passLimit !== "infinite") {
      appState.remainingPasses--;
      updatePassCountDisplay('taboo');
    }

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

/**
 * 5. 残りパス数を画面に表示するヘルパー関数
 */
function updatePassCountDisplay(gameType) {
  const passDisplay = document.getElementById(`${gameType}-pass-count`);
  if (!passDisplay) return;
  
  if (appState.remainingPasses === Infinity) {
    passDisplay.textContent = "パス: 無制限";
    passDisplay.style.color = '#fff';
  } else {
    passDisplay.textContent = `残りパス: ${appState.remainingPasses}回`;
    // 残り0回なら赤字で警告
    if (appState.remainingPasses <= 0) {
      passDisplay.style.color = '#ff1744';
    } else {
      passDisplay.style.color = '#fff';
    }
  }
}
