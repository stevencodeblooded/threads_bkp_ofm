// Content script for Threads.net thread extraction and reposting
// Updated to support both English and Spanish languages

// Selectors based on the provided document
const THREAD_CONTAINER_SELECTOR =
  ".x1a6qonq.x6ikm8r.x10wlt62.xj0a0fe.x126k92a.x6prxxf.x7r5mf7";

// Language support - add Spanish translations
const BUTTON_TEXT = {
  CREATE: ["Create", "Crear", "New thread", "Nueva publicación", "Nuevo hilo"],
  POST: ["Post", "Publicar"],
  CLOSE: ["Close", "Cerrar"],
  CANCEL: ["Cancel", "Cancelar"],
};

// Track application state to handle context-dependent buttons
let appState = {
  isCreatingThread: false, // True when we're in the thread creation modal
  textAreaFound: false, // True when we've found the text area
};

// Enhanced logging function
function log(message, level = "info") {
  const levels = {
    info: console.log,
    warn: console.warn,
    error: console.error,
  };

  (levels[level] || console.log)(`[Threads Repost Extension] ${message}`);

  // For critical errors in text setting, show a visual indicator in the DOM
  if (level === "error" && message.includes("text")) {
    try {
      const errorDiv = document.createElement("div");
      errorDiv.style.position = "fixed";
      errorDiv.style.top = "10px";
      errorDiv.style.right = "10px";
      errorDiv.style.background = "rgba(255, 0, 0, 0.7)";
      errorDiv.style.color = "white";
      errorDiv.style.padding = "10px";
      errorDiv.style.borderRadius = "5px";
      errorDiv.style.zIndex = "9999";
      errorDiv.textContent = message;
      document.body.appendChild(errorDiv);

      // Remove after 5 seconds
      setTimeout(() => {
        document.body.removeChild(errorDiv);
      }, 5000);
    } catch (e) {
      // Ignore any errors in the visual error handling
    }
  }
}

// Function to extract threads from the current page
function extractThreads(count) {
  try {
    const threadElements = document.querySelectorAll(THREAD_CONTAINER_SELECTOR);
    const threads = [];

    log(`Found ${threadElements.length} potential threads`);

    for (let i = 0; i < Math.min(count, threadElements.length); i++) {
      // Extract text content, cleaning up any unnecessary whitespace
      const threadText = threadElements[i].innerText.trim();
      if (threadText) {
        threads.push(threadText);
        log(`Extracted thread ${i + 1}: ${threadText.substring(0, 100)}...`);
      }
    }

    return threads;
  } catch (error) {
    log(`Error extracting threads: ${error.message}`, "error");
    return [];
  }
}

// Function to check if a button contains any of the specified texts
function buttonContainsAnyText(button, textOptions) {
  const buttonText = button.textContent.trim().toLowerCase();
  return textOptions.some((text) => buttonText.includes(text.toLowerCase()));
}

// Function to click the create thread button with multiple selectors
function clickCreateThreadButton() {
  log(
    "Looking for create button with options: " + BUTTON_TEXT.CREATE.join(", "),
    "info"
  );

  // Reset application state
  appState.isCreatingThread = false;
  appState.textAreaFound = false;

  try {
    // Try to find the plus icon by path - this is language-independent and most reliable
    const plusPaths = document.querySelectorAll('svg path[d="M6 2v8m4-4H2"]');
    if (plusPaths.length > 0) {
      for (const path of plusPaths) {
        const svg = path.closest("svg");
        const button = svg.closest('[role="button"]');
        if (button) {
          button.click();
          log("Clicked plus icon button (create thread)", "info");
          appState.isCreatingThread = true;
          return true;
        }
      }
    }

    // Try to find the SVG create button that works in both languages
    const svgButtons = document.querySelectorAll("svg[aria-label]");
    for (const svg of svgButtons) {
      const ariaLabel = svg.getAttribute("aria-label");
      if (BUTTON_TEXT.CREATE.includes(ariaLabel)) {
        const button = svg.closest('[role="button"]');
        if (button) {
          button.click();
          log(`Clicked create button with aria-label: ${ariaLabel}`, "info");
          appState.isCreatingThread = true;
          return true;
        }
      }
    }

    // Check for Spanish "Nuevo hilo" button specifically
    const nuevoHiloBtn = Array.from(
      document.querySelectorAll('[role="button"]')
    ).find((el) => el.textContent.includes("Nuevo hilo"));
    if (nuevoHiloBtn) {
      nuevoHiloBtn.click();
      log("Clicked 'Nuevo hilo' button", "info");
      appState.isCreatingThread = true;
      return true;
    }

    // Selectors for different create button variants
    const createButtonSelectors = [
      // Try all possible aria-label combinations
      ...BUTTON_TEXT.CREATE.map(
        (text) => `div[role="button"][aria-label="${text}"]`
      ),
      ...BUTTON_TEXT.CREATE.map((text) => `svg[aria-label="${text}"]`),
      // Specific class combinations that typically represent create buttons
      "div.x1i10hfl.x1qjc9v5.xjbqb8w.xjqpnuy",
      "div.x9f619.x6ikm8r.xtvsq51.xh8yej3",
    ];

    // Try each selector
    for (const selector of createButtonSelectors) {
      try {
        const createButton = document.querySelector(selector);
        if (createButton) {
          // Find the clickable element
          const buttonToClick =
            createButton.closest('[role="button"]') ||
            createButton.parentElement?.closest('[role="button"]') ||
            createButton;

          buttonToClick.click();
          log(
            `Clicked create thread button with selector: ${selector}`,
            "info"
          );
          appState.isCreatingThread = true;
          return true;
        }
      } catch (error) {
        log(`Error with selector ${selector}: ${error.message}`, "warn");
      }
    }

    // Manual search as fallback
    try {
      // Look for buttons with create text in any language
      const buttons = Array.from(
        document.querySelectorAll('div[role="button"]')
      );
      for (const button of buttons) {
        if (buttonContainsAnyText(button, BUTTON_TEXT.CREATE)) {
          button.click();
          log(`Clicked create button with text-based search`, "info");
          appState.isCreatingThread = true;
          return true;
        }
      }
    } catch (err) {
      log(`Error in fallback create button search: ${err.message}`, "warn");
    }

    log("Could not find create thread button", "error");
    return false;
  } catch (error) {
    log(`Error in create button function: ${error.message}`, "error");
    return false;
  }
}

// Wait for element with timeout
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const startTime = Date.now();

    // Create mutation observer to watch for element
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
        return;
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        obs.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also set a regular polling interval as backup
    const interval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        observer.disconnect();
        resolve(element);
        return;
      }

      if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }
    }, 100);
  });
}

// Function to close the current thread modal
async function closeThreadModal() {
  try {
    log(
      "Looking for close/cancel button with options: " +
        [...BUTTON_TEXT.CLOSE, ...BUTTON_TEXT.CANCEL].join(", "),
      "info"
    );

    // Check for Spanish-specific "Cancelar" button
    const cancelarBtn = Array.from(
      document.querySelectorAll('[role="button"]')
    ).find((el) => el.textContent.trim() === "Cancelar");
    if (cancelarBtn) {
      cancelarBtn.click();
      log("Clicked 'Cancelar' button", "info");
      await new Promise((resolve) => setTimeout(resolve, 500));
      return true;
    }

    // Try to find X icons by SVG structure first (language-independent)
    const svgElements = document.querySelectorAll("svg");
    for (const svg of svgElements) {
      // Check if it has a relevant aria-label
      const ariaLabel = svg.getAttribute("aria-label");
      if (
        ariaLabel &&
        [...BUTTON_TEXT.CLOSE, ...BUTTON_TEXT.CANCEL].includes(ariaLabel)
      ) {
        const button = svg.closest('[role="button"]');
        if (button) {
          button.click();
          log(`Clicked close button with aria-label: ${ariaLabel}`, "info");
          await new Promise((resolve) => setTimeout(resolve, 500));
          return true;
        }
      }

      // Check X icon by path content - this is language-independent
      const paths = svg.querySelectorAll("path");
      for (const path of paths) {
        const d = path.getAttribute("d");
        // Common X icon path patterns
        if (
          d &&
          (d.includes("M18.7") ||
            d.includes("M24 6.4") ||
            d.includes("Z") ||
            d.includes("z") ||
            d.includes("M10"))
        ) {
          const button = svg.closest('[role="button"]');
          if (button) {
            button.click();
            log("Clicked X icon by path pattern", "info");
            await new Promise((resolve) => setTimeout(resolve, 500));
            return true;
          }
        }
      }
    }

    // Multiple selectors for close button
    const closeButtonSelectors = [
      // All possible aria-label combinations
      ...BUTTON_TEXT.CLOSE.map(
        (text) => `div[role="button"][aria-label="${text}"]`
      ),
      ...BUTTON_TEXT.CANCEL.map(
        (text) => `div[role="button"][aria-label="${text}"]`
      ),
      ...BUTTON_TEXT.CLOSE.map((text) => `button[aria-label="${text}"]`),
      // Common X icon classes
      'svg[class*="x1lliihq"]',
      'svg[data-visualcompletion="css-img"]',
      // Common close button classes
      "div.x6s0dn4.x78zum5.xdt5ytf",
      "div.x1i10hfl.x6umtig",
    ];

    for (const selector of closeButtonSelectors) {
      try {
        const closeButton = document.querySelector(selector);
        if (closeButton) {
          const buttonToClick =
            closeButton.closest('[role="button"]') ||
            closeButton.parentElement?.closest('[role="button"]') ||
            closeButton;

          buttonToClick.click();
          log(`Closed modal with selector: ${selector}`, "info");
          await new Promise((resolve) => setTimeout(resolve, 500));
          return true;
        }
      } catch (error) {
        log(`Error with close selector ${selector}: ${error.message}`, "warn");
      }
    }

    // Fallback: look for any button with close/cancel text in any language
    const allButtons = document.querySelectorAll('div[role="button"]');
    for (const button of allButtons) {
      if (
        buttonContainsAnyText(button, [
          ...BUTTON_TEXT.CLOSE,
          ...BUTTON_TEXT.CANCEL,
        ])
      ) {
        button.click();
        log("Closed modal with text-based search", "info");
        await new Promise((resolve) => setTimeout(resolve, 500));
        return true;
      }
    }

    return false;
  } catch (error) {
    log(`Unexpected error closing modal: ${error.message}`, "error");
    return false;
  }
}

// Improved function to find and click the Post button - supports both languages and context-aware
function findAndClickPostButton() {
  // If we're in the thread creation context and have found the text area,
  // then we should look for the submit/post button, not the create button
  if (!appState.isCreatingThread || !appState.textAreaFound) {
    log("Error: Not in correct state to post", "error");
    return false;
  }

  log(
    "Attempting to find and click post button with options: " +
      BUTTON_TEXT.POST.join(", "),
    "info"
  );

  try {
    // For Spanish UI - Look specifically for "Publicar" at the bottom right
    // This is a special case for the Spanish interface where both create and submit use "Publicar"
    const publicarButtons = Array.from(
      document.querySelectorAll('div[role="button"]')
    ).filter((button) => button.textContent.trim() === "Publicar");

    // If we found multiple "Publicar" buttons, we want the one at the bottom of the modal
    if (publicarButtons.length > 0) {
      // Get the one with the highest vertical position (typically the submit button)
      let bottomButton = publicarButtons[0];
      let maxY = getButtonPosition(bottomButton).y;

      for (let i = 1; i < publicarButtons.length; i++) {
        const pos = getButtonPosition(publicarButtons[i]);
        if (pos.y > maxY) {
          maxY = pos.y;
          bottomButton = publicarButtons[i];
        }
      }

      bottomButton.click();
      log("Clicked bottom 'Publicar' button (Spanish UI)", "info");
      return true;
    }

    // 1. Try to find specific post button elements
    const postElements = document.querySelectorAll("div.xc26acl");
    for (const element of postElements) {
      const text = element.textContent.trim();
      if (BUTTON_TEXT.POST.includes(text)) {
        const button = element.closest('[role="button"]');
        if (button) {
          button.click();
          log(`Clicked post button with text: ${text}`, "info");
          return true;
        }
      }
    }

    // 2. Look for position - the post button is typically at the bottom right of modal
    // First check for buttons in the typical submit position
    const submitPositionButtons = document.querySelectorAll(
      'div.x6s0dn4.x9f619.x78zum5.x15zctf7 div[role="button"]'
    );
    if (submitPositionButtons.length > 0) {
      submitPositionButtons[0].click();
      log("Clicked submit button by position", "info");
      return true;
    }

    // 3. Try all aria-label selectors
    const postButtonSelectors = BUTTON_TEXT.POST.map(
      (text) => `div[role="button"][aria-label="${text}"]`
    );

    for (const selector of postButtonSelectors) {
      const postButton = document.querySelector(selector);
      if (postButton) {
        postButton.click();
        log(`Found post button with selector: ${selector}`, "info");
        return true;
      }
    }

    // 4. Look for enabled buttons - the post button is typically enabled when text is entered
    const enabledButtons = Array.from(
      document.querySelectorAll('div[role="button"][aria-disabled="false"]')
    );
    if (enabledButtons.length > 0) {
      // Choose the rightmost (typically submit) button
      let rightmostButton = enabledButtons[0];
      let maxX = getButtonPosition(rightmostButton).x;

      for (let i = 1; i < enabledButtons.length; i++) {
        const pos = getButtonPosition(enabledButtons[i]);
        if (pos.x > maxX) {
          maxX = pos.x;
          rightmostButton = enabledButtons[i];
        }
      }

      rightmostButton.click();
      log("Clicked rightmost enabled button", "info");
      return true;
    }

    // 5. Final fallback: Look for any button with post text
    const allButtons = Array.from(
      document.querySelectorAll('div[role="button"]')
    );

    // Check for buttons with exact post text
    for (const button of allButtons) {
      const buttonText = button.textContent.trim();
      if (BUTTON_TEXT.POST.includes(buttonText)) {
        button.click();
        log(`Clicked button with exact post text: ${buttonText}`, "info");
        return true;
      }
    }

    // Then try partial match
    for (const button of allButtons) {
      if (buttonContainsAnyText(button, BUTTON_TEXT.POST)) {
        button.click();
        log("Clicked button containing post text", "info");
        return true;
      }
    }

    log("Could not find any post button", "error");
    return false;
  } catch (error) {
    log(`Error finding post button: ${error.message}`, "error");
    return false;
  }
}

// Helper function to get a button's position
function getButtonPosition(button) {
  const rect = button.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

// Function to post a single thread with improved sequential posting
async function postThread(threadText) {
  log(`Starting to post thread: ${threadText.substring(0, 50)}...`, "info");

  try {
    // Ensure no open modals are interfering
    await closeThreadModal();

    // Reset application state
    appState.isCreatingThread = false;
    appState.textAreaFound = false;

    // Click create thread button
    log("Clicking create thread button", "info");
    if (!clickCreateThreadButton()) {
      throw new Error("Failed to click create thread button");
    }

    // Wait for the text area to appear with longer timeout
    log("Waiting for text area to appear", "info");
    let textArea = null;
    try {
      // This selector works in both languages
      textArea = await waitForElement(
        'div[contenteditable="true"][role="textbox"]',
        15000
      );
      log("Text area found via selector", "info");
      appState.textAreaFound = true;
    } catch (err) {
      // Fallback: try to find by contenteditable attribute
      log("Trying fallback method to find text area", "warn");
      const editables = document.querySelectorAll(
        'div[contenteditable="true"]'
      );
      if (editables.length > 0) {
        textArea = editables[0];
        log("Found editable element via fallback", "info");
        appState.textAreaFound = true;
      } else {
        throw new Error("Could not find any editable text area");
      }
    }

    if (!textArea) {
      throw new Error("Text area not found");
    }

    // Direct DOM manipulation to ensure text is set
    log("Setting text using direct DOM methods", "info");

    // Focus the element first
    textArea.focus();

    // Clear existing content (important)
    textArea.innerHTML = "";

    // Wait briefly for the clear to take effect
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Set the content - Using a SINGLE method to prevent issues
    document.execCommand("insertText", false, threadText);

    // Dispatch input events to ensure the text change is recognized
    textArea.dispatchEvent(new Event("input", { bubbles: true }));
    textArea.dispatchEvent(new Event("change", { bubbles: true }));

    // Wait for the text to be set
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify that text was actually set
    if (!textArea.textContent || textArea.textContent.trim() === "") {
      log(
        "WARNING: Text verification failed - no text content detected",
        "error"
      );

      // Try one more method as fallback
      textArea.innerHTML = "";
      textArea.focus();
      textArea.textContent = threadText;

      // Dispatch event to ensure recognition
      textArea.dispatchEvent(new Event("input", { bubbles: true }));
      textArea.dispatchEvent(new Event("change", { bubbles: true }));

      // Wait a bit longer
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Final verification
    log(
      `Current text in editor: "${textArea.textContent.substring(0, 50)}..."`,
      "info"
    );

    // Wait for the UI to update
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Find and click the post button
    log("Attempting to find and click post button", "info");
    if (!findAndClickPostButton()) {
      throw new Error("Failed to click post button");
    }

    // Add a longer wait after posting to ensure completion before next post
    log("Waiting for post to complete", "info");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return true;
  } catch (error) {
    log(`Error posting thread: ${error.message}`, "error");

    // Try to close any open modals on error
    try {
      await closeThreadModal();
    } catch (e) {
      // Ignore errors from closing modal
    }

    return false;
  }
}

// Track which threads we've already processed to prevent duplicates
const processedThreads = new Set();

// Main message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log(`Received message: ${request.action}`, "info");

  if (request.action === "extractThreads") {
    const threads = extractThreads(request.count);
    log(`Extracted ${threads.length} threads`, "info");
    sendResponse({ threads: threads });
  } else if (request.action === "repostThreads") {
    // Process threads sequentially with specified delay
    async function repostAllThreads() {
      const results = [];
      log(`Starting to repost ${request.threads.length} threads`, "info");

      for (let i = 0; i < request.threads.length; i++) {
        const thread = request.threads[i];

        // Generate a simple hash for this thread to track duplicates
        const threadHash = thread.slice(0, 50).trim();

        // Skip if we've already processed this thread in this session
        if (processedThreads.has(threadHash)) {
          log(`Skipping duplicate thread: ${threadHash}...`, "warn");
          results.push(false);
          continue;
        }

        log(`Processing thread ${i + 1}/${request.threads.length}`, "info");

        // Close any open modals before starting
        await closeThreadModal();

        // Post the thread
        const success = await postThread(thread);

        if (success) {
          // Mark this thread as processed
          processedThreads.add(threadHash);
        }

        results.push(success);
        log(`Thread ${i + 1} posting result: ${success}`, "info");

        // Only wait between posts if there are more to come
        if (i < request.threads.length - 1) {
          log(`Waiting ${request.delay} seconds before next post`, "info");
          await new Promise((resolve) =>
            setTimeout(resolve, request.delay * 1000)
          );
        }
      }

      // Send back the final results
      const response = {
        success: results.some((result) => result), // At least one success
        successfulPosts: results.filter(Boolean).length,
        totalPosts: results.length,
      };

      log(`Repost process complete: ${JSON.stringify(response)}`, "info");
      sendResponse(response);
    }

    // Start the async process and keep messaging channel open
    repostAllThreads();
    return true; // Keep the message channel open for async response
  }
});

// Log when content script is loaded
log(
  "Content script loaded successfully with improved Spanish language support"
);
