export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    console.log('Content script loaded.');

    let aiSession: any | null = null; // Store the AI session
    const sessionTokenBuffer = 1000; // Tokens buffer to avoid exhausting the session
    const maxRetries = 10; // Maximum number of retries per prompt

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
        // Create the AI session if it doesn't exist
        if (!aiSession) {
          aiSession = await createAiSession();
        }

        // Check if the session has enough tokens left
        if (aiSession.tokensLeft < sessionTokenBuffer) {
          console.log('Session tokens exhausted. Creating a new session.');
          aiSession.destroy();
          aiSession = await createAiSession();
        }

        const promptText = `
          Categorize the following into a single, one-word category based on your guess about the category.

          Title: "${title}"
          URL: "${url}"

          Provide only one word as the category (e.g., News, Sports, Technology) in English. Do not include any additional text, explanations, or formatting.
        `;

        let attempt = 0;
        let result: string;

        while (attempt < maxRetries) {
          attempt++;
          try {
            // Get the result from the AI model
            result = await aiSession.prompt(promptText);

            // Log tokens used
            console.log(`${aiSession.tokensSoFar}/${aiSession.maxTokens} tokens used in session. ${aiSession.tokensLeft} tokens left.`);

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

        // If all retries fail, throw an error
        throw new Error('Unable to categorize bookmark after multiple attempts.');
      } catch (error) {
        console.error('Error during AI categorization:', error);
        throw error;
      }
    }

    async function createAiSession() {
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
        console.log('New AI session created.');
        return session;
      } else {
        throw new Error('AI model is not available.');
      }
    }
  },
});
