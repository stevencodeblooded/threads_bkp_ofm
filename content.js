// Content script for Threads.net thread extraction and reposting

// Selectors based on the provided document
const THREAD_CONTAINER_SELECTOR =
  ".x1a6qonq.x6ikm8r.x10wlt62.xj0a0fe.x126k92a.x6prxxf.x7r5mf7";
const CREATE_THREAD_BUTTON_SELECTOR = 'div[role="button"][aria-label="Create"]';
const NEW_THREAD_MODAL_SELECTOR = 'div[aria-hidden="false"] .xn2onr6 .xwyxwvj';
const NEW_THREAD_TEXT_SELECTOR = 'div[contenteditable="true"][role="textbox"]';
const POST_BUTTON_SELECTORS = [
  // Primary selector observed in screenshots
  'div[role="button"] div.xc26acl:contains("Post")',
  // Direct button selectors
  'div[role="button"][aria-label="Post"]',
  // Most specific selector for the post button container shown in your HTML
  'div.x6s0dn4.x9f619.x78zum5.x15zctf7 div[role="button"]',
  // Text content selectors
  'div[role="button"] div.xc26acl',
  // Fallback to any button with Post text
  'div[role="button"]:contains("Post")',
];
const CLOSE_MODAL_BUTTON_SELECTOR = 'div[role="button"][aria-label="Close"]';

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

// Function to click the create thread button with multiple selectors
function clickCreateThreadButton() {
  // Selectors for different create/post button variants
  const createButtonSelectors = [
    CREATE_THREAD_BUTTON_SELECTOR,
    // SVG Create button
    'div[role="button"] svg[aria-label="Create"]',
    // Direct parent of SVG
    'div[role="button"]:has(svg[aria-label="Create"])',
    // Alternative selectors for create buttons
    'div[role="button"][aria-label="New thread"]',
    // Most generic button selector with create text
    'div[role="button"]:contains("Create")',
  ];

  // Try each selector
  for (const selector of createButtonSelectors) {
    try {
      // First try querySelector for string selectors
      if (typeof selector === "string") {
        const createButton = document.querySelector(selector);
        if (createButton) {
          // If selector is for SVG, find the closest clickable parent
          const buttonToClick =
            createButton.closest('[role="button"]') ||
            createButton.parentElement?.closest('[role="button"]') ||
            createButton;

          buttonToClick.click();
          log(
            `Clicked create thread button with selector: ${selector}`,
            "info"
          );
          return true;
        }
      }
    } catch (error) {
      log(`Error with selector ${selector}: ${error.message}`, "warn");
    }
  }

  // Manual search as fallback
  try {
    // Look for buttons with "Create" text
    const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
    for (const button of buttons) {
      if (button.textContent.includes("Create")) {
        button.click();
        log(`Clicked create button with text-based search`, "info");
        return true;
      }
    }
  } catch (err) {
    log(`Error in fallback create button search: ${err.message}`, "warn");
  }

  log("Could not find create thread button", "error");
  return false;
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
    // Multiple selectors for close button
    const closeButtonSelectors = [
      'div[role="button"][aria-label="Close"]',
      'div[role="button"][aria-label="Cancel"]',
      'button[aria-label="Close"]',
      // Based on your screenshots
      'div.x6ikm8r.x10wlt62.xlyipyv:contains("Cancel")',
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

    // Fallback: look for any button with "Cancel" text
    const allButtons = document.querySelectorAll('div[role="button"]');
    for (const button of allButtons) {
      if (button.textContent.includes("Cancel")) {
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

// Improved function to find and click the Post button - FIXED to prevent double posts
function findAndClickPostButton() {
  log("Attempting to find and click post button...", "info");

  // Track if we've already clicked a button to prevent double-clicks
  let buttonClicked = false;

  // First try the most specific selectors
  for (const selector of POST_BUTTON_SELECTORS) {
    try {
      if (buttonClicked) break; // Skip if already clicked

      const postButton = document.querySelector(selector);
      if (postButton) {
        // Find the clickable element - either the element itself or its closest button parent
        const clickableElement =
          postButton.closest('[role="button"]') ||
          postButton.parentElement?.closest('[role="button"]') ||
          postButton;

        log(`Found post button with selector: ${selector}`, "info");

        // ONLY use one click method to prevent duplicates
        clickableElement.click();

        // Mark as clicked to prevent further clicks
        buttonClicked = true;

        log("Post button clicked", "info");
        return true;
      }
    } catch (error) {
      log(
        `Error with post button selector ${selector}: ${error.message}`,
        "warn"
      );
    }
  }

  // Only run fallback if no button has been clicked yet
  if (!buttonClicked) {
    // Fallback: Look for any button containing "Post" text
    try {
      log("Using fallback text-based button search", "info");

      // Find all button elements
      const allButtons = Array.from(
        document.querySelectorAll('div[role="button"]')
      );

      // First look for the specific post button based on your HTML
      const postContainer = document.querySelector(
        "div.x6s0dn4.x9f619.x78zum5.x15zctf7"
      );
      if (postContainer) {
        const postButton = postContainer.querySelector('div[role="button"]');
        if (postButton) {
          postButton.click();
          log("Clicked post button found in container", "info");
          return true;
        }
      }

      // Then try to find any button with "Post" text
      for (const button of allButtons) {
        if (button.textContent.trim().toLowerCase() === "post") {
          button.click();
          log("Clicked button with Post text", "info");
          return true;
        }
      }

      // Last resort: click any button with Post in it
      for (const button of allButtons) {
        if (button.textContent.toLowerCase().includes("post")) {
          button.click();
          log("Clicked button containing Post text", "info");
          return true;
        }
      }
    } catch (error) {
      log(`Error in fallback post button search: ${error.message}`, "error");
    }
  }

  if (!buttonClicked) {
    log("Could not find any post button", "error");
  }
  return buttonClicked;
}

// Function to post a single thread with improved sequential posting
async function postThread(threadText) {
  log(`Starting to post thread: ${threadText.substring(0, 50)}...`, "info");

  try {
    // Ensure no open modals are interfering
    await closeThreadModal();

    // Click create thread button
    log("Clicking create thread button", "info");
    if (!clickCreateThreadButton()) {
      throw new Error("Failed to click create thread button");
    }

    // Wait for the text area to appear with longer timeout
    log("Waiting for text area to appear", "info");
    let textArea = null;
    try {
      textArea = await waitForElement(NEW_THREAD_TEXT_SELECTOR, 15000);
      log("Text area found via selector", "info");
    } catch (err) {
      // Fallback: try to find by contenteditable attribute
      log("Trying fallback method to find text area", "warn");
      const editables = document.querySelectorAll(
        'div[contenteditable="true"]'
      );
      if (editables.length > 0) {
        textArea = editables[0];
        log("Found editable element via fallback", "info");
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
log("Content script loaded successfully");
