// --- DOM AUTOMATION FOR GEMINI (Smart Image Polling) ---

let isRunning = false;
let promptsQueue = [];
let currentIdx = 0;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "START_AUTOMATION") {
    promptsQueue = msg.prompts;
    currentIdx = 0;
    isRunning = true;
    startTask();
    sendResponse({ status: "Started" });
  }
  if (msg.action === "STOP_AUTOMATION") {
    isRunning = false;
    sendResponse({ status: "Stopped" });
  }
  return true;
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const waitForElement = async (selector, timeout = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(500);
  }
  throw new Error(`Element ${selector} not found.`);
};

const simulateTyping = (element, text) => {
  element.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  document.execCommand('insertText', false, text);
};

// Helper: Safely filters and returns generated response images (ignores avatars & upload previews)
const getGeneratedImages = () => {
  const candidates = Array.from(document.querySelectorAll('single-image img, generated-image img, .response-container img, model-response img'));
  return candidates.filter(img => {
    const isAvatar = img.closest('user-profile-picture, bard-avatar, .avatar, [gem-open-account-menu]');
    const isInputPreview = img.closest('rich-textarea, .attachment-preview-wrapper, uploader-file-preview');
    const isIcon = img.width < 100 && img.height < 100;
    return !isAvatar && !isInputPreview && !isIcon && img.src;
  });
};

// Helper: Smart poller that waits until a NEW image is fully rendered
const waitForGeneratedImage = async (lastSeenSrc, timeout = 120000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (!isRunning) return null;
    
    const currentImages = getGeneratedImages();
    if (currentImages.length > 0) {
      const latestImg = currentImages[currentImages.length - 1];
      
      // Check if it's a new image and that it has finished loading in browser memory
      if (latestImg && latestImg.src && latestImg.src !== lastSeenSrc) {
        if (latestImg.complete && latestImg.naturalWidth > 0) {
          return latestImg;
        }
      }
    }
    await sleep(1000);
  }
  return null;
};

const startTask = async () => {
  try {
    for (currentIdx = 0; currentIdx < promptsQueue.length; currentIdx++) {
      if (!isRunning) break;
      
      const rawPrompt = promptsQueue[currentIdx];
      const match = rawPrompt.match(/^\[(.*?)\]\s*(.*)$/);
      const label = match ? match[1].trim() : `Image_${Date.now()}`;
      const text = match ? match[2].trim() : rawPrompt;

      console.log(`[Automator] Executing step ${currentIdx + 1}/${promptsQueue.length}: ${label}`);

      // Capture the current last image src before submitting new prompt
      const existingImages = getGeneratedImages();
      const lastSeenSrc = existingImages.length > 0 ? existingImages[existingImages.length - 1].src : null;

      if (currentIdx === 0) {
        // STEP 1: Type in main box and send
        const chatBox = await waitForElement('rich-textarea div[contenteditable="true"]');
        simulateTyping(chatBox, text);
        await sleep(1000);
        
        const sendBtns = Array.from(document.querySelectorAll('button')).filter(btn => 
          btn.querySelector('mat-icon[data-mat-icon-name="arrow_upward"], mat-icon[fonticon="arrow_upward"]') ||
          btn.closest('[data-test-id="send-button-container"]')
        );
        const sendBtn = sendBtns[sendBtns.length - 1];
        if (!sendBtn || sendBtn.disabled) throw new Error("Could not find active Send button.");
        
        sendBtn.click();
      } else {
        // STEP 1 (Loop): Edit the previous prompt
        let latestEditBtn = null;
        for (let i = 0; i < 10; i++) {
          const editBtns = Array.from(document.querySelectorAll('button')).filter(btn => {
            return btn.querySelector('mat-icon[data-mat-icon-name="edit"], mat-icon[fonticon="edit"]');
          });
          latestEditBtn = editBtns[editBtns.length - 1];
          if (latestEditBtn) break;
          await sleep(500);
        }
        
        if (!latestEditBtn) throw new Error("Could not find the Edit button.");
        latestEditBtn.click();
        
        console.log("[Automator] Waiting for Edit Text area...");
        const editBox = await waitForElement('.edit-mode textarea', 10000);
        
        editBox.focus();
        editBox.value = text;
        editBox.dispatchEvent(new Event('input', { bubbles: true }));
        editBox.dispatchEvent(new Event('change', { bubbles: true }));
        
        await sleep(500);
        
        const updateBtn = await waitForElement('.update-button, button.update-button', 5000);
        if (updateBtn) {
          updateBtn.click();
        } else {
          throw new Error("Could not find Update button");
        }
      }

      // STEP 2: Actively Poll for the Generated Image
      console.log("[Automator] Waiting for Gemini image generation to complete...");
      const generatedImg = await waitForGeneratedImage(lastSeenSrc, 120000); // 2 min max wait
      
      // STEP 3: Download the Image
      if (generatedImg) {
        const safeLabel = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        chrome.runtime.sendMessage({
          action: "DOWNLOAD_IMAGE",
          url: generatedImg.src,
          filename: `${safeLabel}.jpg`
        });
        console.log(`%c[Automator] Downloaded ${label}.jpg`, "color: green; font-weight: bold;");
      } else {
        console.warn(`[Automator] Timed out waiting for image: ${label}`);
      }

      // STEP 4: 20-Second Cooldown before next prompt
      if (currentIdx < promptsQueue.length - 1) {
        console.log("[Automator] Cooldown: Waiting 20 seconds before the next prompt...");
        for (let s = 0; s < 20; s++) {
          if (!isRunning) break;
          await sleep(1000);
        }
      }
    }
  } catch (err) {
    console.error("[Automator Error]", err);
    alert("Automator stopped: " + err.message + "\n\nSee console (F12) for details.");
  } finally {
    isRunning = false;
  }
};