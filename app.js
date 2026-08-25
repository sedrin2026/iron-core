// アプリ起動時の簡易スクリプト
document.addEventListener('DOMContentLoaded', () => {
  console.log('IRON CORE System Initialized.');
  
  // 保存ボタンのアニメーション効果
  const saveBtn = document.querySelector('.inline-profile-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveBtn.textContent = '完了!';
      setTimeout(() => { saveBtn.textContent = '保存'; }, 1500);
    });
  }
});
