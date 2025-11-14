console.log("[EXT] content.js loaded");

// Sleep helper
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function deepAll(selector) {
  const out = [];
  const nodes = [document, ...document.querySelectorAll("*")];

  for (const n of nodes) {
    try {
      n.querySelectorAll(selector).forEach((e) => out.push(e));
      if (n.shadowRoot)
        n.shadowRoot.querySelectorAll(selector).forEach((e) => out.push(e));
    } catch (_) {}
  }
  return out;
}

function deepOne(selector) {
  const nodes = [document, ...document.querySelectorAll("*")];
  for (const n of nodes) {
    try {
      const e = n.querySelector(selector);
      if (e) return e;
      if (n.shadowRoot) {
        const e2 = n.shadowRoot.querySelector(selector);
        if (e2) return e2;
      }
    } catch (_) {}
  }
  return null;
}

async function waitForDeep(selector, timeout = 15000) {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const e = deepOne(selector);
      if (e) return resolve(e);
      if (performance.now() - start > timeout)
        return reject("Timeout: " + selector);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function popupOpen() {
  return !!deepOne("section[data-modal-content='true']");
}

async function waitPopupClose(maxWait = 15000) {
  const start = performance.now();
  while (popupOpen()) {
    if (performance.now() - start > maxWait) return false;
    await sleep(50);
  }
  return true;
}


// ---------------------
// RECEIVE MESSAGES
// ---------------------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SET_PROMPT") fillPrompts(msg.prompt);
  if (msg.type === "AUTO_MODEL_SETUP") autoModelSetup();
});


// ---------------------------------------------------
// REAL EDIT DETECTION — NEW, BULLETPROOF
// ---------------------------------------------------
function getRealEditButtons() {
  const parents = document.querySelectorAll(
    "div.flex.flex-col.gap-3.p-3"
  );

  const result = [];

  for (const parent of parents) {

    // must contain a visible image
    const img = parent.querySelector("img.EdgeImage_image__iH4_q");
    if (!img) continue;
    if (!img.complete || img.naturalWidth === 0) continue;
    if (img.offsetParent === null) continue; // hidden

    // must contain a prompt card
    const promptHeader = parent.querySelector("h3");
    if (!promptHeader) continue;
    if (promptHeader.textContent.trim() !== "Prompt") continue;

    // find the edit label in this exact parent only
    const editSpan = [...parent.querySelectorAll("span.m_811560b9.mantine-Button-label")]
      .find(s => s.textContent.trim() === "EDIT");

    if (!editSpan) continue;

    const editBtn = editSpan.closest("button");
    if (!editBtn) continue;

    result.push(editBtn);
  }

  return result;
}




// ---------------------------------------------------
// APPLY PROMPTS
// ---------------------------------------------------
async function fillPrompts(prompt) {
  console.log("[EXT] Detecting EDIT buttons…");

  const editButtons = getRealEditButtons();

  console.log("[EXT] FOUND EDIT BUTTONS =", editButtons.length);

  for (let i = 0; i < editButtons.length; i++) {
    console.log(`[EXT] Editing ${i + 1}/${editButtons.length}`);

    const btn = editButtons[i];
    btn.click();

    let textarea;
    try {
      textarea = await waitForDeep("textarea#input_prompt", 15000);
    } catch (e) {
      console.warn("[EXT] Popup failed:", e);
      continue;
    }

    textarea.value = prompt;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    let saveButton = null;
    for (let t = 0; t < 40; t++) {
      const spans = deepAll("span.m_811560b9.mantine-Button-label");
      const found = spans.find((s) => s.innerText.trim() === "Save");
      if (found) {
        saveButton = found.closest("button");
        break;
      }
      await sleep(100);
    }

    if (!saveButton) continue;

    await sleep(200);
    saveButton.click();

    await waitPopupClose();
    await sleep(300);
  }

  console.log("[EXT] DONE applying prompts");
}


// ---------------------------------------------------
// AUTO MODEL SETUP — FIXED
// ---------------------------------------------------
async function autoModelSetup() {
  console.log("[EXT] Auto Model Setup START");

  const baseInput = await waitForDeep("#input_baseModel");
  baseInput.click();
  await sleep(400);

  let illuOption = null;
  for (let i = 0; i < 40; i++) {
    const opts = deepAll("div[data-combobox-option] span");
    illuOption = opts.find((x) => x.textContent.trim() === "Illustrious");
    if (illuOption) break;
    await sleep(200);
  }

  if (!illuOption) {
    console.error("[EXT] Illustrious not found!");
    return;
  }

  illuOption.click();
  await sleep(800);

  // Add 3 resources
  for (let i = 1; i <= 3; i++) {
    console.log(`[EXT] Adding resource ${i}`);

    const addSpan = deepAll("span.m_811560b9.mantine-Button-label")
      .find((x) => x.innerText.trim() === "Add resource");

    if (!addSpan) {
      console.error("[EXT] No Add resource button");
      return;
    }

    addSpan.closest("button").click();
    await sleep(1000);

    let selectBtns = [];
    for (let t = 0; t < 40; t++) {
      selectBtns = deepAll("span.m_811560b9.mantine-Button-label")
        .filter((x) => x.innerText.trim() === "Select")
        .map((x) => x.closest("button"));

      if (selectBtns.length >= i) break;
      await sleep(300);
    }

    if (selectBtns.length < i) {
      console.error("[EXT] Not enough Select buttons");
      return;
    }

    await sleep(500);
    selectBtns[i - 1].click();

    await sleep(1500);
  }

  console.log("[EXT] Auto Model Setup DONE");
}
