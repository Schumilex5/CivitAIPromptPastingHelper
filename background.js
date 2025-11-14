chrome.runtime.onInstalled.addListener(() => {
  console.log("[EXT] Background installed.");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Keep alive log
  console.log("[EXT] Background received:", msg);
  sendResponse({ ok: true });
});
