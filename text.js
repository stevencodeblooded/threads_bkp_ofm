// Improved function to extract threads while preserving line breaks and blank lines
function extractThreads(count) {
  try {
    const threadElements = document.querySelectorAll(THREAD_CONTAINER_SELECTOR);
    const threads = [];

    log(`Found ${threadElements.length} potential threads`, "info");

    for (let i = 0; i < Math.min(count, threadElements.length); i++) {
      // Get the thread element
      const threadElement = threadElements[i];

      // Use more direct DOM approach to extract text with line breaks
      // Look for paragraph elements or text nodes inside the thread container
      const paragraphs = [];

      // First try to find specific content paragraphs and filter out UI elements
      const paragraphElements = Array.from(
        threadElement.querySelectorAll('div[dir="auto"]')
      ).filter((el) => {
        // Filter out UI elements like "Traducir" button by checking for common UI classes
        // or parent elements that might indicate it's a UI component
        const isUiElement =
          el.classList.contains("x1q0g3np") || // Common UI class
          el.closest('[role="button"]') || // Is or is inside a button
          el.getAttribute("data-lexical-text") === "true" || // Lexical editor UI element
          el.textContent.trim() === "Traducir"; // Explicitly filter out "Traducir"

        return !isUiElement;
      });

      if (paragraphElements.length > 0) {
        // If we find paragraph elements, extract text from each one
        paragraphElements.forEach((para) => {
          const text = para.textContent.trim();
          // Important: Include empty paragraphs as well (with a special marker)
          if (text || text === "") {
            // Check if this paragraph contains emojis or other special content that might need preservation
            const hasSpecialContent =
              para.querySelector("img") ||
              para.querySelector("span[aria-label]") ||
              /[^\x00-\x7F]/.test(text); // Contains non-ASCII characters (like emojis)

            // If it has special content, try to preserve it with the original HTML
            if (hasSpecialContent) {
              log(
                `Preserving special content in paragraph: ${text.substring(
                  0,
                  30
                )}...`,
                "info"
              );
              paragraphs.push({
                text: text,
                hasSpecialContent: true,
                originalHTML: para.innerHTML,
                isBlankLine: text === "",
              });
            } else {
              paragraphs.push({
                text: text,
                hasSpecialContent: false,
                isBlankLine: text === "",
              });
            }
          }
        });
        log(
          `Found ${paragraphs.length} paragraph elements with content`,
          "info"
        );
      } else {
        // Fallback to using innerText which should preserve line breaks
        const rawText = threadElement.innerText;

        // Split by newlines and preserve empty lines but filter out UI elements
        const lines = rawText.split(/\r?\n/);
        let lastLineWasEmpty = false;

        for (let j = 0; j < lines.length; j++) {
          const line = lines[j];
          // Skip UI elements but keep empty lines
          if (line.trim() === "Traducir") continue;

          // Detect consecutive blank lines and mark them
          const isBlankLine = line.trim() === "";

          // Add line to paragraphs array
          paragraphs.push({
            text: line.trim(),
            hasSpecialContent: /[^\x00-\x7F]/.test(line), // Check for emojis
            isBlankLine: isBlankLine,
          });

          lastLineWasEmpty = isBlankLine;
        }

        log(
          `Used innerText fallback, found ${paragraphs.length} lines`,
          "info"
        );
      }

      // Build the thread text with proper spacing
      let threadText = "";
      let paragraphTexts = [];

      // Process paragraphs to include blank lines properly
      paragraphs.forEach((para, idx) => {
        // For normal text paragraphs
        if (!para.isBlankLine) {
          paragraphTexts.push(para.text);
        } else {
          // For blank lines, add an empty string
          paragraphTexts.push("");
        }

        // Log for debugging
        log(
          `Paragraph ${idx + 1}: ${
            para.isBlankLine
              ? "(blank line)"
              : para.text.substring(0, 50) +
                (para.text.length > 50 ? "..." : "")
          }`,
          "info"
        );
      });

      // Join with newlines to preserve all spacing including blank lines
      threadText = paragraphTexts.join("\n");

      if (threadText) {
        log(
          `Extracted thread ${i + 1} with ${paragraphs.length} paragraphs`,
          "info"
        );

        // Also store the original paragraphs with their special content info
        // This will be used by the postThread function to better preserve formatting
        threads.push({
          text: threadText,
          paragraphs: paragraphs,
        });
      }
    }

    return threads;
  } catch (error) {
    log(`Error extracting threads: ${error.message}`, "error");
    return [];
  }
}
