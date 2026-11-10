# Gnani Voice Billing

A prototype voice-assisted billing app. Speak an order into the browser, send the recording to a Node.js API, convert the speech into a billing item, and hear an optional spoken confirmation.

## Features

- Records microphone audio in the browser.
- Sends the recording to the backend for speech-to-text using the Gnani Vachana API.
- Parses a transcript into an item, quantity, unit, unit price, and total.
- Shows the latest transcript and accumulated invoice items in the UI.
- Requests an optional Hindi text-to-speech confirmation.

## How it works

1. The React frontend records audio and uploads it as multipart form data.
2. The Express backend sends the audio to Gnani Vachana STT, configured for `hi-IN`.
3. A simple keyword-and-number parser converts the transcript to billing data.
4. The backend requests a TTS confirmation and returns the billing data and audio to the frontend.

## Tech stack

- **Frontend:** React, Vite, Axios
- **Backend:** Node.js, Express, Multer
- **Speech services:** Gnani Vachana STT and TTS APIs

## Prerequisites

- Node.js and npm
- A Gnani Vachana API key for live speech-to-text and text-to-speech
- A modern browser with microphone access

## Getting started

Clone the repository, then install dependencies in both app folders:

```bash
cd backend
npm install
```

In a second terminal, from the repository root:

```bash
cd frontend
npm install
```

Create `backend/.env` and add your API key:

```dotenv
GNANI_API_KEY=your_gnani_api_key
```

Do not commit your `.env` file or expose the API key in frontend code.

Start the backend from the `backend` folder:

```bash
node server.js
```

Start the frontend from the `frontend` folder in another terminal:

```bash
npm run dev
```

Open the local URL printed by Vite. Allow microphone access when prompted. The frontend currently sends API requests to `http://localhost:5000`.

## Using the app

1. Select **Start Voice Command** and say an order.
2. Select **Stop & Add to Bill** to upload and process the recording.
3. Review the transcript and generated invoice row. If TTS succeeds, the confirmation plays automatically.

For example, the interface suggests: `5 kg chawal aur 2 liter tel add karo`.

## API

### `POST /api/process-voice-order`

Accepts `multipart/form-data` with an `audio` file field.

Successful responses include:

```json
{
  "success": true,
  "data": {
    "rawTranscript": "5 kg rice",
    "item": "Rice (चावल/ચોખા)",
    "quantity": 5,
    "unit": "kg",
    "pricePerUnit": 60,
    "totalAmount": 300
  },
  "audioBase64": "optional base64-encoded audio",
  "confirmationText": "..."
}
```

The backend returns HTTP `400` if no audio file is provided. Speech recognition and TTS depend on the configured Gnani API key and network access.

## Current prototype limitations

- Item recognition uses a small hard-coded keyword list: rice, oil, sugar, milk, and atta, with selected Hindi/Gujarati spellings and transliterations.
- The parser detects a single item and the first numeric quantity in a transcript; it does not yet reliably split multi-item orders.
- Every item currently uses a fixed unit price of ₹60. Prices are not looked up from a catalog.
- Invoice items are held in frontend memory and are lost when the page is refreshed.
- If STT fails, the backend currently uses a sample transcript for local testing. This can produce a sample invoice instead of reporting the transcription failure.
- TTS failure does not prevent invoice data from being returned; the audio confirmation may be absent.
- The backend requires `GNANI_API_KEY` at startup, even when testing the STT fallback.

## Development

Run the frontend linter from `frontend`:

```bash
npm run lint
```

Create and save a TTS test response from `backend`:

```bash
node test-api.js
```

The TTS test requires a valid `GNANI_API_KEY` in `backend/.env`.
