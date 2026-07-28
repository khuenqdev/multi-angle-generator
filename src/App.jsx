import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import initialPromptsData from './prompts.json';

// --- LOG STYLES FOR CHROMEDEV TOOLS / FIREFOX ---
const LOG_STYLES = {
  system: 'color: #8b5cf6; font-weight: bold;',   // Purple
  prompt: 'color: #3b82f6; font-weight: bold;',   // Blue
  apiReq: 'color: #0ea5e9; font-weight: bold;',   // Cyan
  apiRes: 'color: #10b981; font-weight: bold;',   // Green
  warn: 'color: #f59e0b; font-weight: bold;',     // Yellow/Orange
  error: 'color: #ef4444; font-weight: bold;',    // Red
  cancel: 'color: #ec4899; font-weight: bold;'    // Pink
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function App() {
  const [prompts, setPrompts] = useState(initialPromptsData);
  const [newPrompt, setNewPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [generatedImages, setGeneratedImages] = useState([]);
  const [countdown, setCountdown] = useState(0);

  const cancelRef = useRef(false);
  const abortControllerRef = useRef(null);

  // --- IMAGE SELECTION HANDLER ---
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('%c[Image Upload]', LOG_STYLES.system, {
        name: file.name,
        type: file.type,
        sizeInBytes: file.size,
        sizeInMB: (file.size / (1024 * 1024)).toFixed(2) + " MB"
      });
      setReferenceImage(file);
    }
  };

  // --- PROMPT MANAGEMENT (CRUD LOGS) ---
  const handleAddPrompt = () => {
    if (newPrompt.trim()) {
      console.log('%c[Prompt Manager] Added Prompt:', LOG_STYLES.prompt, newPrompt);
      setPrompts(prev => {
        const updated = [...prev, newPrompt];
        console.log('%c[Prompt Manager] Current Prompt List:', LOG_STYLES.prompt, updated);
        return updated;
      });
      setNewPrompt("");
    } else {
      console.warn('%c[Prompt Manager] Attempted to add an empty prompt.', LOG_STYLES.warn);
    }
  };

  const handleUpdatePrompt = (index, value) => {
    console.log(`%c[Prompt Manager] Editing Prompt #${index}:`, LOG_STYLES.prompt, value);
    setPrompts(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleDeletePrompt = (index) => {
    console.log(`%c[Prompt Manager] Deleted Prompt #${index}:`, LOG_STYLES.warn, prompts[index]);
    setPrompts(prev => prev.filter((_, i) => i !== index));
  };

  const parsePrompt = (rawString) => {
    const match = rawString.match(/^\[(.*?)\]\s*(.*)$/);
    if (match) {
      return { label: match[1].trim(), promptText: match[2].trim() };
    }
    return { label: `Image_${Date.now()}`, promptText: rawString };
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    console.log('%c[File] Converting Reference Image to Base64...', LOG_STYLES.system);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      console.log('%c[File] Base64 Conversion Complete. Length:', LOG_STYLES.system, reader.result.length, 'chars');
      resolve(reader.result);
    };
    reader.onerror = error => {
      console.error('%c[File] Base64 Conversion Failed:', LOG_STYLES.error, error);
      reject(error);
    };
  });

  // --- API CALL WITH DETAILED LOGS (UPGRADED TO PRO QUALITY) ---
  const callNanoBananaAPI = async (base64Image, promptText, signal) => {
    const apiKey = import.meta.env.VITE_NANO_BANANA_API_KEY;

    if (!apiKey) {
      console.error('%c[API Error] VITE_NANO_BANANA_API_KEY is undefined!', LOG_STYLES.error);
      throw new Error("API Key is missing!");
    }

    const base64DataOnly = base64Image.split(',')[1];

    // 👇 CHANGED: Swapped from 2.5-flash to 3-pro-image-preview for high quality!
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;

    console.log('%c[API Request] Preparing payload for Nano Banana PRO...', LOG_STYLES.apiReq, {
      promptText,
      base64Length: base64DataOnly.length,
      endpointUrl: endpoint.replace(apiKey, 'API_KEY_HIDDEN')
    });

    const startTime = performance.now();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inlineData: { mimeType: "image/jpeg", data: base64DataOnly } }
          ]
        }],
        generationConfig: {
          // Explicitly tell the Gemini 3 Pro model we want an image back, not text
          responseModalities: ["IMAGE"]
        }
      }),
      signal
    });

    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`%c[API Response] HTTP Status: ${response.status} ${response.statusText} (${duration}s)`,
      response.ok ? LOG_STYLES.apiRes : LOG_STYLES.error
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('%c[API Error Payload]', LOG_STYLES.error, errorData);
      throw new Error(errorData.error?.message || `HTTP ${response.status}: Failed to generate image.`);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Generation blocked by Google Safety/Policy restrictions.");
    }

    const parts = data.candidates[0].content?.parts || [];
    const imagePart = parts.find(p => p.inlineData || p.inline_data);

    if (!imagePart) {
      const textResponse = parts[0]?.text;
      if (textResponse) throw new Error(`API Refused: ${textResponse}`);
      throw new Error("No image data found in the response.");
    }

    const generatedBase64 = imagePart.inlineData?.data || imagePart.inline_data?.data;
    const mimeType = imagePart.inlineData?.mimeType || imagePart.inline_data?.mime_type || "image/jpeg";

    console.log('%c[API Success] High-Quality Image Extracted Successfully!', LOG_STYLES.apiRes);

    return `data:${mimeType};base64,${generatedBase64}`;
  };

  // --- CORE GENERATION TASK LOGS ---
  const handleGenerate = async () => {
    console.log('%c[Generator] Initializing task...', LOG_STYLES.system);

    if (!referenceImage) {
      console.warn('%c[Generator] Blocked: No reference image selected.', LOG_STYLES.warn);
      return alert("Please upload a reference image first!");
    }
    if (prompts.length === 0) {
      console.warn('%c[Generator] Blocked: Prompt list is empty.', LOG_STYLES.warn);
      return alert("Please add at least one prompt!");
    }

    setIsGenerating(true);
    setGeneratedImages([]);
    cancelRef.current = false;
    abortControllerRef.current = new AbortController();

    try {
      const base64Image = await fileToBase64(referenceImage);
      console.log(`%c[Generator] Processing ${prompts.length} prompts sequentially...`, LOG_STYLES.system);

      for (let i = 0; i < prompts.length; i++) {
        if (cancelRef.current) {
          console.warn('%c[Generator] Cancel flag detected before prompt start. Exiting loop.', LOG_STYLES.cancel);
          break;
        }

        const rawPrompt = prompts[i];
        const { label, promptText } = parsePrompt(rawPrompt);

        console.group(`%c[Generator] Step ${i + 1}/${prompts.length}: [${label}]`, LOG_STYLES.prompt);
        console.log("Raw Prompt:", rawPrompt);
        console.log("Parsed Label:", label);
        console.log("Parsed Prompt Text:", promptText);

        setProgress({ current: i + 1, total: prompts.length, label });

        let success = false;
        let attempts = 0;

        while (!success && attempts < 3) {
          if (cancelRef.current) {
            console.warn('%c[Generator] Cancel flag detected during retry loop. Exiting.', LOG_STYLES.cancel);
            break;
          }

          try {
            attempts++;
            console.log(`%c[Generator] Attempt ${attempts}/3 for [${label}]`, LOG_STYLES.system);

            const imageUrl = await callNanoBananaAPI(
              base64Image,
              promptText,
              abortControllerRef.current.signal
            );

            setGeneratedImages(prev => {
              const updated = [...prev, { label, url: imageUrl }];
              console.log('%c[Gallery] Updated Gallery State:', LOG_STYLES.system, updated);
              return updated;
            });

            success = true;
          } catch (error) {
            if (error.name === 'AbortError') {
              console.warn('%c[Generator] API Fetch request explicitly aborted by user.', LOG_STYLES.cancel);
              break;
            }

            console.error(`%c[Generator] Attempt ${attempts} failed for [${label}]:`, LOG_STYLES.error, error.message);

            if (error.message.toLowerCase().includes("quota") || error.message.includes("429")) {
              if (attempts >= 3) {
                console.error('%c[Generator] Max retries reached for quota error.', LOG_STYLES.error);
                throw new Error("Rate limit exceeded too many times.");
              }

              console.warn('%c[Cooldown] Rate limit hit. Initiating 10s retry cooldown...', LOG_STYLES.warn);
              for (let c = 10; c > 0; c--) {
                if (cancelRef.current) break;
                setCountdown(c);
                await sleep(1000);
              }
              setCountdown(0);
            } else {
              throw error; // Rethrow non-quota errors to abort loop
            }
          }
        }

        console.groupEnd(); // End step group console log

        if (cancelRef.current) break;

        // Cooldown between successful prompts
        if (i < prompts.length - 1) {
          console.log('%c[Cooldown] Waiting 10s before starting next prompt to comply with rate limits...', LOG_STYLES.warn);
          for (let c = 10; c > 0; c--) {
            if (cancelRef.current) {
              console.warn('%c[Cooldown] Cancelled during cooldown timer.', LOG_STYLES.cancel);
              break;
            }
            setCountdown(c);
            await sleep(1000);
          }
          setCountdown(0);
        }
      }

      if (!cancelRef.current) {
        console.log('%c[Generator] 🎉 ALL PROMPTS COMPLETED SUCCESSFULLY!', LOG_STYLES.apiRes);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('%c[Generator Fatal Error]', LOG_STYLES.error, error);
        alert(`Generation stopped: ${error.message}`);
      }
    } finally {
      console.log('%c[Generator] Cleaning up task states.', LOG_STYLES.system);
      setIsGenerating(false);
      setCountdown(0);
      cancelRef.current = false;
    }
  };

  // --- CANCEL LOGS ---
  const handleCancel = () => {
    console.warn('%c[Cancel] USER CLICKED CANCEL BUTTON!', LOG_STYLES.cancel);
    cancelRef.current = true;
    if (abortControllerRef.current) {
      console.log('%c[Cancel] Triggering AbortController.abort()...', LOG_STYLES.cancel);
      abortControllerRef.current.abort();
    }
  };

  // --- DOWNLOAD LOGS ---
  const handleDownloadAll = async () => {
    console.log('%c[ZIP Download] Starting ZIP archiving for', LOG_STYLES.system, generatedImages.length, 'images');
    const zip = new JSZip();

    for (const img of generatedImages) {
      const safeLabel = img.label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      console.log(`%c[ZIP Download] Adding file: "${safeLabel}.jpg"`, LOG_STYLES.system);

      const response = await fetch(img.url);
      const blob = await response.blob();
      zip.file(`${safeLabel}.jpg`, blob);
    }

    console.log('%c[ZIP Download] Generating blob and triggering browser download...', LOG_STYLES.system);
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'multi_angle_results.zip');
    console.log('%c[ZIP Download] Archive downloaded successfully!', LOG_STYLES.apiRes);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">

        <header>
          <h1 className="text-3xl font-bold text-gray-800">Nano Banana Multi-Angle Generator</h1>
          <p className="text-gray-500">Upload an image, configure your prompts, and generate variations safely.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow space-y-6">

            <div>
              <h2 className="text-xl font-semibold mb-3">1. Reference Image</h2>
              <input type="file" accept="image/*" onChange={handleImageChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={isGenerating}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-3">2. Prompts</h2>
              <div className="space-y-3">
                {prompts.map((p, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input type="text" className="border border-gray-300 rounded px-3 py-1 flex-1 text-sm" value={p} onChange={(e) => handleUpdatePrompt(idx, e.target.value)} disabled={isGenerating} />
                    <button onClick={() => handleDeletePrompt(idx)} disabled={isGenerating} className="bg-red-500 text-white px-3 rounded hover:bg-red-600 text-sm font-bold disabled:opacity-50">X</button>
                  </div>
                ))}

                <div className="flex gap-2 mt-4">
                  <input type="text" className="border border-gray-300 rounded px-3 py-2 flex-1 text-sm" placeholder="[Label] Prompt text..." value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} disabled={isGenerating} />
                  <button onClick={handleAddPrompt} disabled={isGenerating} className="bg-green-500 text-white px-4 rounded hover:bg-green-600 text-sm font-bold disabled:opacity-50">Add</button>
                </div>
              </div>
            </div>

            <div>
              {!isGenerating ? (
                <button onClick={handleGenerate} disabled={!referenceImage} className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 disabled:opacity-50 transition">
                  Generate Images
                </button>
              ) : (
                <button onClick={handleCancel} className="w-full bg-red-600 text-white font-bold py-3 rounded hover:bg-red-700 transition shadow-lg animate-pulse">
                  Stop / Cancel Generation
                </button>
              )}

              {isGenerating && (
                <div className="mt-4 p-4 border border-blue-100 bg-blue-50 rounded-lg">
                  <div className="flex justify-between text-sm mb-1 text-blue-800 font-medium">
                    <span>Generating: {progress.label}</span>
                    <span>{progress.current} / {progress.total}</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2.5 mb-2">
                    <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                  </div>
                  {countdown > 0 && (
                    <p className="text-xs text-blue-600 font-medium text-center mt-2">
                      API Cooldown... waiting {countdown} seconds to prevent quota errors.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Gallery</h2>
              {generatedImages.length > 0 && (
                <button onClick={handleDownloadAll} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-indigo-700 transition">
                  Download All (ZIP)
                </button>
              )}
            </div>

            {generatedImages.length === 0 && !isGenerating && (
              <p className="text-gray-400 text-center mt-10">No images generated yet.</p>
            )}

            <div className="grid grid-cols-2 gap-4">
              {generatedImages.map((img, idx) => (
                <div key={idx} className="border border-gray-200 p-2 rounded-lg bg-gray-50 flex flex-col items-center">
                  <img src={img.url} alt={img.label} className="w-full h-32 object-cover rounded shadow-sm" />
                  <span className="mt-2 text-sm font-bold text-gray-700 text-center">{img.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}