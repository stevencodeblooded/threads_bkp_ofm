document.addEventListener("DOMContentLoaded", () => {
  const extractThreadsBtn = document.getElementById("extractThreads");
  const repostThreadsBtn = document.getElementById("repostThreads");
  const clearThreadsBtn = document.getElementById("clearThreads");
  const threadCountInput = document.getElementById("threadCount");
  const repostDelayInput = document.getElementById("repostDelay");
  const threadsList = document.getElementById("threadsList");
  const successModal = document.getElementById("successModal");

  // ALL close buttons for the success modal
  const successModalCloseButtons = [
    document.getElementById("successModalClose"),
    document.querySelector("#successModal .modal-footer button"),
  ];

  // Add click event listeners to ALL close buttons
  successModalCloseButtons.forEach((closeButton) => {
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        successModal.classList.remove("show");
      });
    }
  });

  // Prevent default popup behavior
  window.addEventListener("blur", (e) => {
    window.focus();
  });

  // Disable context menu
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // Restore saved settings from chrome storage
  function restoreState() {
    chrome.storage.local.get(
      ["threadCount", "repostDelay", "extractedThreads"],
      (data) => {
        // Restore input values
        if (data.threadCount) {
          threadCountInput.value = data.threadCount;
        }
        if (data.repostDelay) {
          repostDelayInput.value = data.repostDelay;
        }

        // Restore extracted threads
        if (data.extractedThreads && data.extractedThreads.length > 0) {
          populateThreadsList(data.extractedThreads);
          repostThreadsBtn.disabled = false;
        }
      }
    );
  }

  // Clear all threads and reset to default state
  clearThreadsBtn.addEventListener("click", () => {
    // Clear threads list
    threadsList.innerHTML = "";

    // Disable repost button
    repostThreadsBtn.disabled = true;

    // Reset input values to defaults
    threadCountInput.value = 3;
    repostDelayInput.value = 5;

    // Clear stored data
    chrome.storage.local.remove(
      ["extractedThreads", "threadCount", "repostDelay"],
      () => {
        console.log("Extension state cleared");
      }
    );
  });

  // Populate threads list and save to storage
  function populateThreadsList(threads) {
    // Clear previous threads
    threadsList.innerHTML = "";

    // Populate threads list with checkboxes
    threads.forEach((thread, index) => {
      const threadItem = document.createElement("div");
      threadItem.className = "thread-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `thread-${index}`;
      checkbox.name = "selectedThreads";
      checkbox.value = thread;
      checkbox.checked = true; // Auto-check all threads

      const label = document.createElement("label");
      label.htmlFor = `thread-${index}`;
      label.textContent =
        thread.length > 100 ? thread.substring(0, 100) + "..." : thread;

      threadItem.appendChild(checkbox);
      threadItem.appendChild(label);
      threadsList.appendChild(threadItem);
    });

    // Save extracted threads to storage
    chrome.storage.local.set({ extractedThreads: threads });
  }

  // Save input values to storage when changed
  threadCountInput.addEventListener("change", () => {
    chrome.storage.local.set({ threadCount: threadCountInput.value });
  });

  repostDelayInput.addEventListener("change", () => {
    chrome.storage.local.set({ repostDelay: repostDelayInput.value });
  });

  // Extract threads when button is clicked
  extractThreadsBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // Ensure we have a valid tab
      if (!tabs || !tabs.length) {
        console.error("No active tab found");
        return;
      }

      try {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "extractThreads",
            count: parseInt(threadCountInput.value),
          },
          (response) => {
            // Check for chrome runtime errors
            if (chrome.runtime.lastError) {
              console.error("Runtime error:", chrome.runtime.lastError);
              return;
            }

            if (response && response.threads) {
              // Populate threads and save to storage
              populateThreadsList(response.threads);

              // Enable repost button
              repostThreadsBtn.disabled = false;
            }
          }
        );
      } catch (error) {
        console.error("Error sending message:", error);
      }
    });
  });

  // Repost selected threads
  repostThreadsBtn.addEventListener("click", () => {
    const selectedThreads = Array.from(
      document.querySelectorAll('input[name="selectedThreads"]:checked')
    ).map((checkbox) => checkbox.value);

    const delay = parseInt(repostDelayInput.value);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: "repostThreads",
          threads: selectedThreads,
          delay: delay,
        },
        (response) => {
          if (response) {
            console.log("Repost process completed", response);

            // Show success modal
            if (response.success) {
              const successDetails = document.getElementById("successDetails");
              successDetails.innerHTML = `
                <p>Successfully reposted ${response.successfulPosts} out of ${response.totalPosts} threads!</p>
              `;
              successModal.classList.add("show");
            }
          }
        }
      );
    });
  });

  // Restore state when popup loads
  restoreState();
});
