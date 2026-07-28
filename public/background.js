chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "DOWNLOAD_IMAGE") {
      console.log("[Background] Initiating download for:", request.filename, request.url);
      
      chrome.downloads.download({
        url: request.url,
        filename: `multi_angle_results/${request.filename}`,
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("[Background Download Error]", chrome.runtime.lastError);
        } else {
          console.log("[Background Download Started] ID:", downloadId);
        }
      });
      sendResponse({ status: "Downloading" });
    }
    return true;
  });