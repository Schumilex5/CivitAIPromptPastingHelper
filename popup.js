async function sendToTab(message) {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  for (let i = 0; i < 10; i++) {
    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (e) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  console.error("Message failed:", message);
}

// APPLY PROMPT BUTTON
document.getElementById("apply").addEventListener("click", async () => {
  const prompt = document.getElementById("prompt").value;
  await sendToTab({ type: "SET_PROMPT", prompt });
});

// AUTO MODEL BUTTON
document.getElementById("auto-model").addEventListener("click", async () => {
  await sendToTab({ type: "AUTO_MODEL_SETUP" });
});
