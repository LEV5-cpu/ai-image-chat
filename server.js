require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { InferenceClient } = require('@huggingface/inference');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static('public'));

const HF_TOKEN = process.env.HF_TOKEN;
if (!HF_TOKEN) {
  console.warn('⚠️  HF_TOKEN is not set. Copy .env.example to .env and add your token.');
}

const client = new InferenceClient(HF_TOKEN);

// ---- Model routing -----------------------------------------------------
// Swap any of these for other models on huggingface.co/models
const MODELS = {
  textToImage: 'black-forest-labs/FLUX.1-schnell', // fast + free-tier friendly
  imageToImage: 'timbrooks/instruct-pix2pix',       // text-guided edit of an uploaded image
};

// ---- Helpers -------------------------------------------------------------

// The client returns a Blob (browser-style) — convert to a data URI so the
// frontend can display it directly with no extra file storage/hosting needed.
async function blobToDataUri(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mime = blob.type || 'image/png';
  return `data:${mime};base64,${base64}`;
}

// ---- Routes ---------------------------------------------------------------

// Text -> Image
app.post('/api/text-to-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    if (!HF_TOKEN) return res.status(500).json({ error: 'Server is missing HF_TOKEN. Add it to your .env file.' });

    const blob = await client.textToImage({
      model: MODELS.textToImage,
      inputs: prompt,
    });

    res.json({ url: await blobToDataUri(blob) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: friendlyError(err) });
  }
});

// Image -> Image (edit an uploaded image with a text instruction)
app.post('/api/image-to-image', upload.single('image'), async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    if (!req.file) return res.status(400).json({ error: 'image file is required' });
    if (!HF_TOKEN) return res.status(500).json({ error: 'Server is missing HF_TOKEN. Add it to your .env file.' });

    const blob = await client.imageToImage({
      model: MODELS.imageToImage,
      inputs: req.file.buffer,
      parameters: { prompt },
    });

    res.json({ url: await blobToDataUri(blob) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: friendlyError(err) });
  }
});

// Image -> Video: not reliably available on Hugging Face's free tier yet.
// Kept as a clear stub so the UI doesn't silently fail.
app.post('/api/image-to-video', upload.single('image'), async (req, res) => {
  res.status(501).json({
    error: 'Video generation needs a paid provider (Replicate, Runway, Kling) — free tiers don\'t reliably support it yet.',
  });
});

function friendlyError(err) {
  const msg = err.message || String(err);
  if (msg.includes('rate limit') || msg.includes('429')) {
    return 'Hit the free-tier rate limit — wait a minute and try again, or add billing on Hugging Face for higher limits.';
  }
  if (msg.includes('loading') || msg.includes('503')) {
    return 'Model is warming up on the server (cold start) — try again in ~20 seconds.';
  }
  return msg;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasToken: !!HF_TOKEN });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI image chat server running on http://localhost:${PORT}`));
