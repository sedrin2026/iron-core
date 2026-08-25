document.addEventListener('DOMContentLoaded', () => {
  console.log('IRON CORE Real Body Model Loaded.');
  
  const saveBtn = document.querySelector('.inline-profile-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveBtn.textContent = '完了!';
      setTimeout(() => { saveBtn.textContent = '保存'; }, 1500);
    });
  }
});
