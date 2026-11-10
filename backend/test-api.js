// backend/test-api.js
const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const axios = require('axios');

async function testGnaniTts() {
  const apiKey = process.env.GNANI_API_KEY?.trim();
  if (!apiKey) {
    console.error('GNANI_API_KEY is missing. Add it to backend/.env and run this script again.');
    process.exitCode = 1;
    return;
  }

  try {
    const response = await axios.post(
      'https://api.vachana.ai/api/v1/tts/inference',
      {
        text: 'नमस्ते, टेस्ट सफल रहा।',
        voice: 'Nalini',
        model: 'timbre-v2.5',
        language: 'hi-IN',
        audio_config: {
          sample_rate: 16000,
          encoding: 'linear_pcm',
          num_channels: 1,
          sample_width: 2,
          container: 'wav'
        }
      },
      {
        headers: {
          'X-API-Key-ID': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json, audio/*'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    const contentType = (response.headers['content-type'] || '').split(';')[0].toLowerCase();
    const responseBuffer = Buffer.from(response.data);

    if (contentType.startsWith('audio/') || contentType === 'application/octet-stream') {
      const extensions = {
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/mp4': 'm4a',
        'application/octet-stream': 'bin'
      };
      const outputPath = path.join(__dirname, `tts-test-output.${extensions[contentType] || 'audio'}`);
      await fs.writeFile(outputPath, responseBuffer);
      console.log(`TTS request succeeded (HTTP ${response.status}). Audio saved to ${outputPath}`);
      return;
    }

    const responseText = responseBuffer.toString('utf8');
    let responseBody = responseText;
    if (contentType === 'application/json' || contentType.endsWith('+json')) {
      responseBody = JSON.stringify(JSON.parse(responseText), null, 2);
    }
    console.log(`TTS request succeeded (HTTP ${response.status}, ${contentType || 'unknown content type'}).`);
    console.log('API response:', responseBody);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      console.error(`TTS request failed${status ? ` (HTTP ${status})` : ''}: ${error.message}`);

      if (status === 401 || status === 403) {
        console.error('Authentication was rejected. Verify the key is active and confirm the required auth header in the Vachana API docs.');
      } else if (status === 404) {
        console.error('The API endpoint was not found. Verify the TTS URL in the Vachana API docs.');
      }

      if (error.response?.data) {
        const detail = Buffer.from(error.response.data).toString('utf8').slice(0, 1000);
        console.error('API error response:', detail);
      }
    } else {
      console.error('TTS request failed:', error.message);
    }
    process.exitCode = 1;
  }
}

testGnaniTts();
