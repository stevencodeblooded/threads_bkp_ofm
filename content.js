// Content script for Threads.net thread extraction and reposting

// Selectors based on the provided document
const THREAD_CONTAINER_SELECTOR =
  ".x1a6qonq.x6ikm8r.x10wlt62.xj0a0fe.x126k92a.x6prxxf.x7r5mf7";
const CREATE_THREAD_BUTTON_SELECTOR = 'div[role="button"][aria-label="Create"]';
const NEW_THREAD_MODAL_SELECTOR = 'div[aria-hidden="false"] .xn2onr6 .xwyxwvj';
const NEW_THREAD_TEXT_SELECTOR = 'div[contenteditable="true"][role="textbox"]';
const POST_BUTTON_SELECTORS = [
  'div.x6s0dn4.x78zum5 div[role="button"][tabindex="0"] div.xc26acl',
  'div[role="button"][aria-label="Post"]',
  // Remove invalid contains selectors
  "div.xc26acl",
  'div[role="button"] div.xc26acl',
  'button[aria-label="Post"]',
  // More generic post button selectors
  'div[role="button"]:has(.xc26acl)',
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
    'div[role="button"][aria-label="Create"]',
    // Alternative selectors for post/create buttons
    'div[role="button"][aria-label="Post"]',
    // Alternative create button with SVG
    'div[role="button"] svg[aria-label="Create"]',
    // More generic button selectors
    'div[role="button"][aria-label="New thread"]',
    'div[role="button"]:has(svg[aria-label="Create"])',
  ];

  // Try each selector
  for (const selector of createButtonSelectors) {
    const createButton = document.querySelector(selector);
    if (createButton) {
      // If selector is for SVG, find the closest clickable parent
      const buttonToClick =
        createButton.closest('[role="button"]') ||
        createButton.parentElement?.closest('[role="button"]') ||
        createButton;

      try {
        buttonToClick.click();
        log(`Clicked create thread button with selector: ${selector}`, "info");
        return true;
      } catch (error) {
        log(
          `Error clicking button with selector ${selector}: ${error.message}`,
          "warn"
        );
      }
    }
  }

  log("Could not find create thread button", "error");
  return false;
}

// Function to find and click post button
function findAndClickPostButton() {
  // Add a manual check for text content
  const potentialPostButtons = Array.from(
    document.querySelectorAll('div[role="button"]')
  ).filter((el) => {
    const text = el.textContent.trim().toLowerCase();
    return text === "post" || text.includes("post");
  });

  // Combine predefined selectors with manually found buttons
  const allPostButtonSelectors = [
    ...POST_BUTTON_SELECTORS,
    ...potentialPostButtons.map((btn) => btn),
  ];

  for (const selector of allPostButtonSelectors) {
    const postButton =
      selector instanceof HTMLElement
        ? selector
        : document.querySelector(selector);

    if (postButton) {
      try {
        // Try multiple clicking methods
        const clickMethods = [
          () => postButton.click(),
          () => postButton.parentElement?.click(),
          () => {
            const clickEvent = new MouseEvent("click", {
              view: window,
              bubbles: true,
              cancelable: true,
            });
            postButton.dispatchEvent(clickEvent);
          },
        ];

        for (const method of clickMethods) {
          try {
            method();
            log(`Clicked post button successfully`, "info");
            return true;
          } catch (methodError) {
            log(`Clicking method failed: ${methodError.message}`, "warn");
          }
        }
      } catch (error) {
        log(`Error clicking post button: ${error.message}`, "warn");
      }
    }
  }

  log("Could not find post button", "error");
  return false;
}

// Function to wait for an element to appear
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    function checkForElement() {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      } else {
        setTimeout(checkForElement, 100);
      }
    }

    checkForElement();
  });
}

// Function to close the current thread modal
async function closeThreadModal() {
  try {
    const closeButton = document.querySelector(CLOSE_MODAL_BUTTON_SELECTOR);
    if (closeButton) {
      closeButton.click();
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    }
    return false;
  } catch (error) {
    log(`Error closing modal: ${error.message}`, 'error');
    return false;
  }
}

// Function to post a single thread with improved sequential posting
async function postThread(threadText) {
  try {
    // Ensure no open modals are interfering
    await closeThreadModal();

    // Ensure create thread button is clicked
    if (!clickCreateThreadButton()) {
      throw new Error("Could not open new thread modal");
    }

    // Wait for the text area to be available
    const textArea = await waitForElement(NEW_THREAD_TEXT_SELECTOR);

    // Set the thread text
    textArea.focus();

    // Use standard input method to ensure text is registered
    textArea.innerText = threadText;

    // Trigger input events to ensure text is registered
    const inputEvent = new Event("input", { bubbles: true });
    const changeEvent = new Event("change", { bubbles: true });
    textArea.dispatchEvent(inputEvent);
    textArea.dispatchEvent(changeEvent);

    // Wait a moment for the post button to become active
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Find and click the post button
    const postButton = document.querySelector(POST_BUTTON_SELECTOR);
    if (!postButton) {
      throw new Error("Post button not found");
    }

    // Click post button
    postButton.click();

    // Wait for the post to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Close the modal if it's still open
    await closeThreadModal();

    return true;
  } catch (error) {
    log(`Error posting thread: ${error.message}`, "error");

    // Attempt to close any open modals
    await closeThreadModal();

    return false;
  }
}

// Main message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractThreads") {
    const threads = extractThreads(request.count);
    sendResponse({ threads: threads });
  } else if (request.action === "repostThreads") {
    // Repost threads with specified delay
    async function repostAllThreads() {
      const successfulPosts = [];
      for (const thread of request.threads) {
        try {
          const success = await postThread(thread);
          successfulPosts.push(success);

          // Wait between posts
          await new Promise((resolve) =>
            setTimeout(resolve, request.delay * 1000)
          );
        } catch (error) {
          log(`Failed to post thread: ${error.message}`, "error");
          successfulPosts.push(false);
        }
      }

      // Send response after all posts
      sendResponse({
        success: successfulPosts.every((post) => post),
        successfulPosts: successfulPosts.filter(Boolean).length,
        totalPosts: successfulPosts.length,
      });
    }

    // Important: return true to make sendResponse work asynchronously
    repostAllThreads();
    return true;
  }
});

// Log when content script is loaded
log("Content script loaded successfully");
