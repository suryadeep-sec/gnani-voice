// backend/server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

// Memory storage for incoming audio recordings from React
const upload = multer({ storage: multer.memoryStorage() });

const GNANI_API_KEY = process.env.GNANI_API_KEY?.trim();

if (!GNANI_API_KEY) {
  console.error("CRITICAL: GNANI_API_KEY missing in backend/.env!");
  process.exit(1);
}

// Helper 1: Simple Regex NLP Parser to extract Item, Quantity, Unit from Speech
function parseSpeechToBillingJSON(transcript) {
  const lowerText = transcript.toLowerCase();
  
  // Example keywords map for Gujarati/Hinglish
  const itemsList = [
    { name: 'Rice (चावल/ચોખા)', keywords: ['rice', 'chawal', 'chokha', 'चावल', 'ચોખા'] },
    { name: 'Oil (तेल/તેલ)', keywords: ['oil', 'tel', 'तेल', 'તેલ'] },
    { name: 'Sugar (चीनी/ખાંડ)', keywords: ['sugar', 'chini', 'khand', 'चीनी', 'ખાંડ'] },
    { name: 'Milk (दूध/દૂધ)', keywords: ['milk', 'doodh', 'dudh', 'दूध', 'દૂધ'] },
    { name: 'Atta (आटा/લોટ)', keywords: ['atta', 'aata', 'lot', 'आटा', 'લોટ'] }
  ];

  let detectedItem = "General Item";
  for (const item of itemsList) {
    if (item.keywords.some(kw => lowerText.includes(kw))) {
      detectedItem = item.name;
      break;
    }
  }

  // Extract numbers (e.g. "5", "2", "dus", "paanch")
  const numMatch = lowerText.match(/\d+/);
  const quantity = numMatch ? parseInt(numMatch[0], 10) : 1;

  // Extract units (kg, liter, packet)
  let unit = "pcs";
  if (lowerText.includes("kg") || lowerText.includes("kilo") || lowerText.includes("किलो")) unit = "kg";
  else if (lowerText.includes("liter") || lowerText.includes("litre") || lowerText.includes("लीटर")) unit = "L";
  else if (lowerText.includes("packet") || lowerText.includes("pkt")) unit = "pkt";

  // Estimated unit price for billing calculation
  const pricePerUnit = 60;
  const totalAmount = quantity * pricePerUnit;

  return {
    rawTranscript: transcript,
    item: detectedItem,
    quantity,
    unit,
    pricePerUnit,
    totalAmount
  };
}

// Route 1: Voice Billing Core Pipeline
app.post('/api/process-voice-order', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided' });
    }

    console.log(`[1/3] Processing audio upload (${req.file.size} bytes)...`);

    // --- STEP A: Call Gnani Speech-to-Text (STT) ---
    // Forward recorded audio binary stream to Gnani Vachana STT
    let transcript = "5 kg rice and 2 liter oil add karo"; // Default fallback for local testing
    
    try {
      const sttResponse = await axios.post(
        'https://api.vachana.ai/api/v1/stt/transcribe',
        req.file.buffer,
        {
          headers: {
            'X-API-Key-ID': GNANI_API_KEY,
            'Content-Type': req.file.mimetype || 'audio/wav',
            'language': 'hi-IN'
          },
          timeout: 15000
        }
      );
      if (sttResponse.data?.transcript) {
        transcript = sttResponse.data.transcript;
      }
    } catch (sttErr) {
      console.warn("STT Call Warning (Using fallback parser mock):", sttErr.message);
    }

    console.log(`[2/3] Transcript Received: "${transcript}"`);

    // --- STEP B: Parse Transcript into Billing JSON ---
    const parsedInvoice = parseSpeechToBillingJSON(transcript);

    // --- STEP C: Call Gnani Text-to-Speech (TTS) for Audio Confirmation ---
    const confirmationText = `${parsedInvoice.quantity} ${parsedInvoice.unit} ${parsedInvoice.item.split(' ')[0]} bill me add ho gaya. Total amount ${parsedInvoice.totalAmount} rupees.`;
    
    console.log(`[3/3] Generating TTS confirmation: "${confirmationText}"`);

    let ttsAudioBase64 = null;
    try {
      const ttsResponse = await axios.post(
        'https://api.vachana.ai/api/v1/tts/inference',
        {
          text: confirmationText,
          voice: 'Nalini',
          model: 'timbre-v2.5',
          language: 'hi-IN',
          audio_config: { sample_rate: 16000, encoding: 'linear_pcm', container: 'wav' }
        },
        {
          headers: {
            'X-API-Key-ID': GNANI_API_KEY,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 15000
        }
      );

      ttsAudioBase64 = Buffer.from(ttsResponse.data).toString('base64');
    } catch (ttsErr) {
      console.warn("TTS Audio Generation warning:", ttsErr.message);
    }

    // Return structured response to Frontend
    return res.json({
      success: true,
      data: parsedInvoice,
      audioBase64: ttsAudioBase64,
      confirmationText
    });

  } catch (error) {
    console.error("Pipeline Error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(` Gnani Voice Billing Backend Running on Port ${PORT}`);
  console.log(` Endpoint: http://localhost:${PORT}/api/process-voice-order`);
  console.log(`==================================================\n`);
});