// 各部位の筋トレ種目データ
const exercises = {
  '胸': ['ベンチプレス', 'ダンベルフライ', 'プッシュアップ', 'インクラインプレス'],
  '腹筋': ['クランチ', 'レッグレイズ', 'プランク', 'アブローラー'],
  '腕': ['アームカール', '三頭筋プレスダウン', 'ハンマーカール'],
  '脚': ['バーベルスクワット', 'レッグプレス', 'ランジ', 'カーフレイズ'],
  '広背筋・肩甲骨周り': ['懸垂（チンニング）', 'ラットプルダウン', 'ベントオーバーロー', 'シーテッドロー'],
  '脊柱起立筋（背筋）': ['デッドリフト', 'バックエクステンション'],
  '臀部（お尻）': ['ヒップスラスト', 'ブルガリアンスクワット']
};

// 表裏の回転切り替え
function toggleFlip() {
  const container = document.getElementById('flip-container');
  container.classList.toggle('flipped');
}

// 部位タップ時の種目表示モーダル
function showExercises(part) {
  const modal = document.getElementById('exercise-modal');
  const title = document.getElementById('modal-title');
  const list = document.getElementById('exercise-list');

  title.innerText = `【 ${part} 】の推奨メニュー`;
  list.innerHTML = '';

  const partExercises = exercises[part] || [];
  partExercises.forEach(item => {
    const li = document.createElement('li');
    li.innerText = `・ ${item}`;
    list.appendChild(li);
  });

  modal.style.display = 'flex';
}

// モーダル閉じる
function closeModal() {
  document.getElementById('exercise-modal').style.display = 'none';
}
