export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    console.log('Content script loaded.');

    // Listen for messages from the background script
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'categorizeBookmarkAI') {
        const { title, url } = message.data;
        categorizeBookmarkAI(title, url)
          .then((category) => {
            sendResponse({ success: true, category });
          })
          .catch((error) => {
            console.error('Error in categorizeBookmarkAI:', error);
            sendResponse({ success: false, error: error.message });
          });

        // Indicate that the response will be sent asynchronously
        return true;
      }
    });

    async function categorizeBookmarkAI(title: string, url: string): Promise<string> {
      // Check if `window.ai` is available
      // @ts-expect-error: Suppress error about 'ai' not existing on 'window'
      if (!window.ai || !window.ai.languageModel) {
        throw new Error('AI capabilities are not available in this context.');
      }

      try {
        // Get the AI model's capabilities
        // @ts-expect-error: Suppress error about 'ai' not existing on 'window'
        const { available, defaultTemperature, defaultTopK } = await window.ai.languageModel.capabilities();

        if (available !== 'no') {
          // Create an AI session
          // @ts-expect-error: Suppress error about 'ai' not existing on 'window'
          const session = await window.ai.languageModel.create({
            systemPrompt: 'You are an assistant that categorizes bookmarks into appropriate categories.',
            temperature: defaultTemperature,
            topK: defaultTopK,
          });

          // Prepare the prompt for the AI
          const promptText = `
            Categorize the following into a single, one-word category.

            Title: "${title}"
            URL: "${url}"

            Provide only one word as the category (e.g., News, Sports, Technology) in English. Do not include any additional text, explanations, or formatting.
          `;

          const maxRetries = 5;
          let attempt = 0;
          let result: string;

          while (attempt < maxRetries) {
            attempt++;
            try {
              // Get the result from the AI model
              result = await session.prompt(promptText);
              // If successful, break out of the retry loop
              return result.trim();
            } catch (error) {
              console.error(`Attempt ${attempt} failed:`, error);

              if (attempt >= maxRetries) {
                // Rethrow the error after max retries
                throw new Error(`Failed to categorize bookmark after ${maxRetries} attempts.`);
              }

              // Optionally, add a delay before retrying
              await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms
            }
          }
        } else {
          throw new Error('AI model is not available.');
        }
      } catch (error) {
        console.error('Error during AI categorization:', error);
        throw error;
      }
    }
  },
});
