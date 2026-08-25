document.addEventListener('DOMContentLoaded', () => {
  console.log('IRON CORE Muscular Model Initialized.');
  
  const saveBtn = document.querySelector('.inline-profile-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveBtn.textContent = '完了!';
      setTimeout(() => { saveBtn.textContent = '保存'; }, 1500);
    });
  }
});
