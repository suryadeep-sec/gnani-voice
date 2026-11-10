import React, { useState, useRef } from 'react';
import axios from 'axios';
import './App.css';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [invoiceItems, setInvoiceItems] = useState([]);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // 1. Start Recording Microphone Audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = handleAudioUpload;
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied or not available!");
      console.error(err);
    }
  };

  // 2. Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // 3. Send Recorded Audio Blob to the same-origin Express API
  const handleAudioUpload = async () => {
    setLoading(true);
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    try {
      const res = await axios.post('/api/process-voice-order', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        const { data, audioBase64 } = res.data;
        setTranscript(data.rawTranscript);
        
        // Add parsed item to Invoice List
        setInvoiceItems((prev) => [...prev, data]);

        // Play TTS Confirmation Audio if returned
        if (audioBase64) {
          const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
          audio.play();
        }
      }
    } catch (err) {
      console.error("Voice process error:", err);
      alert("Failed to process voice command.");
    } finally {
      setLoading(false);
    }
  };

  const grandTotal = invoiceItems.reduce((sum, item) => sum + item.totalAmount, 0);

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'Arial, sans-serif', padding: '0 20px' }}>
      <h2>🎙️ Multilingual Voice-to-JSON Billing Assistant</h2>
      <p style={{ color: '#666' }}>
        Press the button below, speak your order (e.g., <i>"5 kg chawal aur 2 liter tel add karo"</i>), and stop recording.
      </p>

      {/* Recording Control Button */}
      <div style={{ margin: '25px 0' }}>
        {!isRecording ? (
          <button 
            onClick={startRecording} 
            disabled={loading}
            style={{ padding: '12px 24px', fontSize: '16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            🎤 Start Voice Command
          </button>
        ) : (
          <button 
            onClick={stopRecording} 
            style={{ padding: '12px 24px', fontSize: '16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            ⏹️ Stop & Add to Bill
          </button>
        )}
        {loading && <span style={{ marginLeft: '15px', color: '#d97706' }}>Processing audio with Gnani AI...</span>}
      </div>

      {/* Live Transcript Display */}
      {transcript && (
        <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
          <strong>Last Detected Speech:</strong> "{transcript}"
        </div>
      )}

      {/* Generated Invoice Table */}
      <h3>🧾 Invoice Items</h3>
      <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            <th>#</th>
            <th>Item Name</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoiceItems.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', color: '#9ca3af' }}>No items added yet. Speak to generate items!</td>
            </tr>
          ) : (
            invoiceItems.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{item.item}</td>
                <td>{item.quantity} {item.unit}</td>
                <td>₹{item.pricePerUnit}</td>
                <td>₹{item.totalAmount}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {invoiceItems.length > 0 && (
        <h3 style={{ textAlign: 'right', marginTop: '20px', color: '#16a34a' }}>
          Grand Total: ₹{grandTotal}
        </h3>
      )}
    </div>
  );
}