import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import exifr from 'exifr';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
// Use memoryStorage instead of disk dest for Vercel compatibility
const upload = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json());

// Hash check simulation (mock registry)
const KNOWN_HASHES = new Set([
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
]);

function calculateHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imageBuffer = req.file.buffer;

    // Stage 1: Hash Check
    const imageHash = calculateHash(imageBuffer);
    const hashMatch = KNOWN_HASHES.has(imageHash);

    // Extract EXIF
    let metadata = 'No metadata available';
    let hasRichExif = false;
    try {
      const exif = await exifr.parse(imageBuffer);
      if (exif) {
        const camera = exif.Make && exif.Model ? `${exif.Make} ${exif.Model}` : 'Unknown Camera';
        const aperture = exif.FNumber ? `f/${exif.FNumber}` : '';
        const iso = exif.ISO ? `ISO ${exif.ISO}` : '';
        const parts = [camera, aperture, iso].filter(Boolean);
        metadata = parts.join(' · ') || 'No metadata available';
        hasRichExif = !!(exif.Make && exif.Model);
      }
    } catch (err) {
      metadata = 'Unable to read metadata';
    }

    // If hash matches, skip Gemini
    if (hashMatch) {
      return res.json({
        stage1: 'pass',
        stage2: 'skipped',
        stage3: 'verified',
        trustScore: 94,
        escalated: false,
        metadata,
        hash: `${imageHash.substring(0, 4)}...${imageHash.substring(imageHash.length - 4)}`,
        geminiData: null
      });
    }

    // Stage 2: Gemini Multimodal Analysis
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

    const prompt = `You are a forensic media analyst. Analyze this image for signs of manipulation or AI generation.

Examine:
- Lighting consistency and shadow geometry
- Frequency domain artifacts (compression, GAN signatures)
- Anatomical proportions and texture patterns
- Audio-visual sync issues (if video)
- Semantic context coherence

Respond ONLY with valid JSON in this exact format:
{
  "findings": [
    {"domain": "LIGHTING", "finding": "description", "severity": "HIGH|MEDIUM|LOW"},
    {"domain": "FREQUENCY", "finding": "description", "severity": "HIGH|MEDIUM|LOW"}
  ],
  "probabilities": {
    "authentic": 0-100,
    "manipulated": 0-100,
    "synthetic": 0-100
  },
  "verdict": "one sentence summary with key evidence"
}

Be precise. Base severity on actual anomalies detected.`;

    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: req.file.mimetype
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid Gemini response format');
    }

    const geminiData = JSON.parse(jsonMatch[0]);

    // Calculate trust score based on probabilities
    const { authentic, manipulated, synthetic } = geminiData.probabilities;
    let trustScore;
    let stage3;

    if (authentic >= 70) {
      trustScore = 70 + (authentic - 70) * 0.8; // 70-94 range
      stage3 = 'verified';
    } else if (synthetic >= 60) {
      trustScore = Math.max(5, 40 - synthetic * 0.5); // 5-20 range
      stage3 = 'ai_generated';
    } else {
      trustScore = 30 + authentic * 0.5; // 30-65 range
      stage3 = 'suspicious';
    }

    trustScore = Math.round(trustScore);

    res.json({
      stage1: 'flagged',
      stage2: stage3 === 'verified' ? 'pass' : 'flagged',
      stage3,
      trustScore,
      escalated: true,
      metadata,
      hash: `${imageHash.substring(0, 4)}...${imageHash.substring(imageHash.length - 4)}`,
      geminiData
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      details: error.message
    });
  }
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`TrueTrace server running on port ${PORT}`);
  });
}

export default app;
