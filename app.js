const app = document.getElementById('app');
const loader = document.getElementById('loader');
const modal = document.getElementById('status-modal');

window.addEventListener('load', () => {
  setTimeout(() => {
    loader.classList.add('hide');
    app.classList.remove('hidden');
  }, 1300);
});

function showPage(pageId) {
  document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
  const nextPage = document.getElementById(pageId);
  nextPage.classList.add('active');
  window.location.hash = pageId;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-page]').forEach((button) => {
  button.addEventListener('click', () => showPage(button.dataset.page));
});

function showView(viewId) {
  document.querySelectorAll('#dashboard .view').forEach((view) => view.classList.remove('active'));
  document.querySelectorAll('#dashboard .side-link').forEach((link) => link.classList.remove('selected'));
  document.getElementById(viewId).classList.add('active');
  const current = document.querySelector(`#dashboard [data-view="${viewId}"]`);
  if (current) current.classList.add('selected');
  document.getElementById('view-label').textContent = current ? current.textContent.trim().replace(/\d+$/, '') : viewId;
}

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

function openModal() {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => modal.querySelector('textarea').focus(), 200);
}

function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

document.getElementById('new-status').addEventListener('click', openModal);
document.getElementById('queue-add').addEventListener('click', openModal);
document.querySelectorAll('.close-modal, .modal-backdrop').forEach((item) => item.addEventListener('click', closeModal));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

document.querySelector('.mobile-menu').addEventListener('click', () => {
  document.querySelector('#dashboard .sidebar').classList.toggle('open');
});

const paymentModal = document.getElementById('payment-modal');
const paymentNotice = document.getElementById('payment-notice');
const paymentForm = document.getElementById('payment-form');
const paymentButton = document.getElementById('save-payment-config');

function closePaymentModal() {
  paymentModal.classList.remove('open');
  paymentModal.setAttribute('aria-hidden', 'true');
}

async function loadPaymentStatus() {
  try {
    const response = await fetch('/api/admin/payment-configuration');
    if (!response.ok) throw new Error('Payment settings could not be loaded.');
    const { configured } = await response.json();
    Object.entries(configured).forEach(([key, isConfigured]) => {
      const status = document.getElementById(`${key}-status`);
      if (status) status.textContent = isConfigured ? 'Configured' : 'Not configured';
    });
  } catch {
    paymentNotice.textContent = 'Connect this screen to the Knot backend to load secure payment settings.';
    paymentNotice.className = 'payment-notice error';
  }
}

document.getElementById('open-payment-settings').addEventListener('click', () => {
  paymentModal.classList.add('open');
  paymentModal.setAttribute('aria-hidden', 'false');
  paymentNotice.textContent = '';
  loadPaymentStatus();
});

document.querySelectorAll('.close-payment-modal').forEach((item) => item.addEventListener('click', closePaymentModal));
document.querySelectorAll('.reveal-key').forEach((button) => button.addEventListener('click', () => {
  const input = button.previousElementSibling;
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  button.textContent = visible ? 'Reveal' : 'Hide';
}));

paymentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(paymentForm).entries());
  paymentButton.disabled = true;
  paymentButton.textContent = 'Saving…';
  paymentNotice.textContent = '';
  try {
    const response = await fetch('/api/admin/payment-configuration', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not save payment settings.');
    paymentForm.reset();
    paymentNotice.textContent = 'Configuration saved securely.';
    paymentNotice.className = 'payment-notice success';
    Object.entries(payload.configured).forEach(([key, isConfigured]) => {
      const status = document.getElementById(`${key}-status`);
      if (status) status.textContent = isConfigured ? 'Configured' : 'Not configured';
    });
  } catch (error) {
    paymentNotice.textContent = error.message;
    paymentNotice.className = 'payment-notice error';
  } finally {
    paymentButton.disabled = false;
    paymentButton.textContent = 'Save configuration';
  }
});

if (window.location.hash && document.getElementById(window.location.hash.slice(1))) {
  showPage(window.location.hash.slice(1));
}
