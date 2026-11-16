const popup = document.getElementById('popup');
const overlay = document.getElementById('overlay');
const openBtn = document.getElementById('openBtn');
const closeBtn = document.getElementById('closeBtn');

function open() { overlay.classList.add('active'); popup.classList.add('active'); }
function close() { overlay.classList.remove('active'); popup.classList.remove('active'); }

openBtn.addEventListener('click', open);
closeBtn.addEventListener('click', close);
overlay.addEventListener('click', close);
document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });