document.addEventListener("DOMContentLoaded", () => {
  const extractThreadsBtn = document.getElementById("extractThreads");
  const repostThreadsBtn = document.getElementById("repostThreads");
  const threadCountInput = document.getElementById("threadCount");
  const repostDelayInput = document.getElementById("repostDelay");
  const threadsList = document.getElementById("threadsList");

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
              // Clear previous threads
              threadsList.innerHTML = "";

              // Populate threads list with checkboxes
              response.threads.forEach((thread, index) => {
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
                  thread.length > 100
                    ? thread.substring(0, 100) + "..."
                    : thread;

                threadItem.appendChild(checkbox);
                threadItem.appendChild(label);
                threadsList.appendChild(threadItem);
              });

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
          }
        }
      );
    });
  });
});
