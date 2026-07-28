import React, { useState, useEffect } from 'react';
import initialPromptsData from './prompts.json';

export default function App() {
  const [prompts, setPrompts] = useState([]);
  const [newPrompt, setNewPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  // Load prompts from Chrome Storage on popup open
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['savedPrompts'], (result) => {
        if (result.savedPrompts) {
          setPrompts(result.savedPrompts);
        } else {
          setPrompts(initialPromptsData);
        }
      });
    } else {
      setPrompts(initialPromptsData); // Fallback for local testing
    }
  }, []);

  // Save prompts to Chrome Storage whenever they change
  const savePrompts = (updatedPrompts) => {
    setPrompts(updatedPrompts);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ savedPrompts: updatedPrompts });
    }
  };

  const handleAddPrompt = () => {
    if (newPrompt.trim()) {
      savePrompts([...prompts, newPrompt]);
      setNewPrompt("");
    }
  };

  const handleUpdatePrompt = (index, value) => {
    const updated = [...prompts];
    updated[index] = value;
    savePrompts(updated);
  };

  const handleDeletePrompt = (index) => {
    savePrompts(prompts.filter((_, i) => i !== index));
  };

  const handleStart = () => {
    if (prompts.length === 0) return alert("Add at least one prompt!");
    setIsRunning(true);
    
    // Send message to the active Gemini Tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab.url.includes("gemini.google.com")) {
        chrome.tabs.sendMessage(activeTab.id, { action: "START_AUTOMATION", prompts }, (res) => {
          if (chrome.runtime.lastError) {
             alert("Error: Please refresh the Gemini page and try again.");
             setIsRunning(false);
          }
        });
      } else {
        alert("Please run this extension on https://gemini.google.com/");
        setIsRunning(false);
      }
    });
  };

  const handleStop = () => {
    setIsRunning(false);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "STOP_AUTOMATION" });
    });
  };

  return (
    // Restricted width/height because it's now a Chrome Extension Popup
    <div className="w-[450px] min-h-[500px] max-h-[600px] overflow-y-auto bg-gray-50 p-4 font-sans flex flex-col">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Nano Banana Automator</h1>
      <p className="text-xs text-gray-500 mb-4">
        1. Upload your image to Gemini manually.<br/>
        2. Click Start below to let the bot take over.
      </p>

      <div className="bg-white p-4 rounded-lg shadow space-y-4 flex-1">
        <h2 className="text-sm font-semibold">Prompts Queue</h2>
        <div className="space-y-2">
          {prompts.map((p, idx) => (
            <div key={idx} className="flex gap-2">
              <input 
                type="text"
                className="border border-gray-300 rounded px-2 py-1 flex-1 text-xs" 
                value={p} 
                onChange={(e) => handleUpdatePrompt(idx, e.target.value)} 
                disabled={isRunning}
              />
              <button 
                onClick={() => handleDeletePrompt(idx)}
                disabled={isRunning}
                className="bg-red-500 text-white px-2 rounded hover:bg-red-600 text-xs font-bold disabled:opacity-50"
              >X</button>
            </div>
          ))}
          
          <div className="flex gap-2 mt-4 pt-2 border-t">
            <input 
              type="text"
              className="border border-gray-300 rounded px-2 py-1 flex-1 text-xs" 
              placeholder="[Label] Prompt text..."
              value={newPrompt} 
              onChange={(e) => setNewPrompt(e.target.value)} 
              disabled={isRunning}
            />
            <button 
              onClick={handleAddPrompt}
              disabled={isRunning}
              className="bg-green-500 text-white px-3 rounded hover:bg-green-600 text-xs font-bold disabled:opacity-50"
            >Add</button>
          </div>
        </div>

        <div className="pt-4 mt-auto">
          {!isRunning ? (
            <button 
              onClick={handleStart} 
              className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition shadow"
            >
              Start Automation
            </button>
          ) : (
            <button 
              onClick={handleStop} 
              className="w-full bg-red-600 text-white font-bold py-2 rounded hover:bg-red-700 transition shadow animate-pulse"
            >
              Stop Automation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}