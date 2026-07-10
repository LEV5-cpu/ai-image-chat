const chat = document.getElementById('chat');
const emptyState = document.getElementById('emptyState');
const composer = document.getElementById('composer');
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const thumbPreview = document.getElementById('thumbPreview');
const thumbImg = document.getElementById('thumbImg');
const removeThumb = document.getElementById('removeThumb');
const statusEl = document.getElementById('status');
const modeButtons = document.querySelectorAll('.mode-btn');

let mode = 'text-to-image';
let attachedFile = null;

// ---- Mode switching ----
modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    modeButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.mode;
    promptInput.placeholder = {
      'text-to-image': 'A neon-lit alley in the rain, cinematic…',
      'image-to-image': 'Attach an image, then describe the edit — "make it a watercolor painting"',
      'image-to-video': 'Attach an image, then describe the motion — "slow zoom in, wind in the hair"',
    }[mode];
  });
});

// ---- Attachment handling ----
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  attachedFile = file;
  thumbImg.src = URL.createObjectURL(file);
  thumbPreview.hidden = false;
});

removeThumb.addEventListener('click', () => {
  attachedFile = null;
  fileInput.value = '';
  thumbPreview.hidden = true;
});

// ---- Autosize textarea ----
promptInput.addEventListener('input', () => {
  promptInput.style.height = 'auto';
  promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
});
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

// ---- Health check ----
fetch('/api/health')
  .then((r) => r.json())
  .then((d) => {
    if (d.hasToken) {
      statusEl.textContent = 'ready';
      statusEl.className = 'status ok';
    } else {
      statusEl.textContent = 'no API token set — see .env';
      statusEl.className = 'status err';
    }
  })
  .catch(() => {
    statusEl.textContent = 'server unreachable';
    statusEl.className = 'status err';
  });

// ---- Message rendering ----
function addUserMessage(text, imageUrl) {
  emptyState.remove();
  const el = document.createElement('div');
  el.className = 'msg user';
  el.innerHTML = `
    ${imageUrl ? `<img class="attachment-thumb" src="${imageUrl}" />` : ''}
    ${text ? `<div class="bubble">${escapeHtml(text)}</div>` : ''}
  `;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

function addLoadingMessage() {
  const el = document.createElement('div');
  el.className = 'msg assistant';
  el.innerHTML = `<div class="spinner-row"><div class="spinner"></div><span>generating…</span></div>`;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function renderResult(el, { url, kind, error }) {
  if (error) {
    el.innerHTML = `<div class="bubble error-bubble">${escapeHtml(error)}</div>`;
    return;
  }
  const mediaTag = kind === 'video'
    ? `<video class="result-media" src="${url}" controls autoplay loop muted></video>`
    : `<img class="result-media" src="${url}" />`;
  el.innerHTML = `
    <div class="result-card">
      ${mediaTag}
      <div class="result-actions">
        <a href="${url}" target="_blank" rel="noopener">Open</a>
        <a href="${url}" download>Download</a>
      </div>
    </div>
  `;
  chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Submit handler ----
composer.addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = promptInput.value.trim();

  if (mode !== 'text-to-image' && !attachedFile) {
    alert('Attach an image first for this mode.');
    return;
  }
  if (!prompt && mode !== 'image-to-video') {
    return;
  }

  const previewUrl = attachedFile ? URL.createObjectURL(attachedFile) : null;
  addUserMessage(prompt, previewUrl);

  promptInput.value = '';
  promptInput.style.height = 'auto';
  sendBtn.disabled = true;

  const loadingEl = addLoadingMessage();

  try {
    let res, data;
    if (mode === 'text-to-image') {
      res = await fetch('/api/text-to-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
    } else {
      const form = new FormData();
      form.append('image', attachedFile);
      form.append('prompt', prompt);
      const endpoint = mode === 'image-to-image' ? '/api/image-to-image' : '/api/image-to-video';
      res = await fetch(endpoint, { method: 'POST', body: form });
    }

    data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation failed');

    renderResult(loadingEl, { url: data.url, kind: mode === 'image-to-video' ? 'video' : 'image' });
  } catch (err) {
    renderResult(loadingEl, { error: err.message });
  } finally {
    sendBtn.disabled = false;
    attachedFile = null;
    fileInput.value = '';
    thumbPreview.hidden = true;
  }
});
