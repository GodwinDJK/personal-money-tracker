// Groundwork — a small, local-only spending and recovery tracker.
const STORAGE_KEY = 'groundwork-transactions-v1';
const amountDisplay = document.querySelector('#amount-display');
const descriptionInput = document.querySelector('#description');
const errorMessage = document.querySelector('#form-error');
const historyList = document.querySelector('#history-list');
const balanceDisplay = document.querySelector('#balance');
const dialog = document.querySelector('#confirm-dialog');
let amountText = '';
let transactions = loadTransactions();
let pendingAction = null;

function loadTransactions() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(t => t && typeof t.id === 'string' && ['spent', 'made'].includes(t.type) && Number.isSafeInteger(t.pence) && t.pence > 0 && typeof t.description === 'string' && t.description.trim() && Number.isFinite(t.timestamp));
  } catch { return []; }
}

function saveTransactions() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); }
  catch { showError('Could not save. Check your browser storage settings.'); }
}

function money(pence, signed = false) {
  const formatted = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Math.abs(pence) / 100);
  if (pence < 0) return `−${formatted}`;
  return signed && pence > 0 ? `+${formatted}` : formatted;
}

function render() {
  const spent = transactions.filter(t => t.type === 'spent').reduce((sum, t) => sum + t.pence, 0);
  const made = transactions.filter(t => t.type === 'made').reduce((sum, t) => sum + t.pence, 0);
  const balance = made - spent;
  balanceDisplay.textContent = money(balance, balance > 0);
  balanceDisplay.classList.toggle('negative', balance < 0);
  balanceDisplay.classList.toggle('positive', balance > 0);
  document.querySelector('#balance-message').textContent = balance < 0 ? `You need to make ${money(-balance)} to break even.` : balance > 0 ? `You're ${money(balance)} above break even.` : "You're at break even.";
  document.querySelector('#total-spent').textContent = money(spent);
  document.querySelector('#total-made').textContent = money(made);
  historyList.replaceChildren();
  if (!transactions.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    const title = document.createElement('strong'); title.textContent = 'Your story starts here.';
    empty.append(title, document.createTextNode('Log your first transaction to see the full picture.'));
    historyList.append(empty); return;
  }
  [...transactions].sort((a, b) => b.timestamp - a.timestamp).forEach(t => {
    const row = document.createElement('article'); row.className = `transaction is-${t.type}`;
    const icon = document.createElement('span'); icon.className = 'transaction-icon'; icon.textContent = t.type === 'spent' ? '−' : '+';
    const main = document.createElement('div');
    const desc = document.createElement('div'); desc.className = 'transaction-description'; desc.textContent = t.description;
    const date = document.createElement('div'); date.className = 'transaction-date'; date.textContent = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(t.timestamp);
    main.append(desc, date);
    const right = document.createElement('div'); right.className = 'transaction-right';
    const amount = document.createElement('div'); amount.className = 'transaction-amount'; amount.textContent = `${t.type === 'spent' ? '−' : '+'}${money(t.pence)}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'transaction-delete'; remove.textContent = 'DELETE'; remove.setAttribute('aria-label', `Delete ${t.description}`); remove.addEventListener('click', () => confirmDelete(t.id));
    right.append(amount, remove); row.append(icon, main, right); historyList.append(row);
  });
}

function showError(message) { errorMessage.textContent = message; }
function updateAmount() { amountDisplay.textContent = amountText || '0'; }
function addDigit(key) {
  if (key === '.' && amountText.includes('.')) return;
  if (amountText.includes('.') && amountText.split('.')[1].length >= 2) return;
  if (key === '.' && !amountText) amountText = '0';
  if (amountText === '0' && key !== '.') amountText = '';
  if (amountText.replace('.', '').length >= 9) return;
  amountText += key; updateAmount(); errorMessage.textContent = '';
}
function submit(type) {
  const pence = Math.round(Number(amountText) * 100);
  const description = descriptionInput.value.trim();
  if (!Number.isSafeInteger(pence) || pence <= 0) return showError('Enter an amount greater than £0.');
  if (!description) { showError('Add a description before saving.'); descriptionInput.focus(); return; }
  transactions.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, type, pence, description, timestamp: Date.now() });
  saveTransactions(); render(); amountText = ''; updateAmount(); descriptionInput.value = ''; errorMessage.textContent = '';
}
function confirmDelete(id) {
  pendingAction = () => { transactions = transactions.filter(t => t.id !== id); saveTransactions(); render(); };
  document.querySelector('#dialog-kicker').textContent = 'REMOVE ENTRY';
  document.querySelector('#dialog-title').textContent = 'Delete this transaction?';
  document.querySelector('#dialog-copy').textContent = 'Your balance and totals will recalculate straight away.';
  document.querySelector('#dialog-confirm').textContent = 'Delete entry'; dialog.showModal();
}

document.querySelectorAll('[data-key]').forEach(button => button.addEventListener('click', () => addDigit(button.dataset.key)));
document.querySelector('#delete-digit').addEventListener('click', () => { amountText = amountText.slice(0, -1); updateAmount(); });
document.querySelector('#clear-button').addEventListener('click', () => { amountText = ''; updateAmount(); errorMessage.textContent = ''; });
document.querySelector('#spent-button').addEventListener('click', () => submit('spent'));
document.querySelector('#made-button').addEventListener('click', () => submit('made'));
document.querySelector('#reset-button').addEventListener('click', () => {
  if (!transactions.length) return;
  pendingAction = () => { transactions = []; saveTransactions(); render(); };
  document.querySelector('#dialog-kicker').textContent = 'START FRESH';
  document.querySelector('#dialog-title').textContent = 'Reset all your data?';
  document.querySelector('#dialog-copy').textContent = 'This permanently deletes every transaction and resets your balance to £0.';
  document.querySelector('#dialog-confirm').textContent = 'Reset everything'; dialog.showModal();
});
document.querySelector('#dialog-confirm').addEventListener('click', event => { event.preventDefault(); pendingAction?.(); pendingAction = null; dialog.close(); });
document.addEventListener('keydown', event => {
  if (event.target === descriptionInput) return;
  if (/^[0-9.]$/.test(event.key)) addDigit(event.key);
  else if (event.key === 'Backspace') { amountText = amountText.slice(0, -1); updateAmount(); }
});
render();
