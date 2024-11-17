
export default defineBackground(() => {

  let categorizationTabId: number | null = null;
  let contentScriptInjected = false;

  console.log('Background script is running.');

  interface PendingBookmark {
    timerId: NodeJS.Timeout;
    userInteracted: boolean;
  }

  const pendingBookmarks = new Map<string, PendingBookmark>();
  const bookmarksBeingMoved = new Set<string>();

  // Listener for bookmark creation
  browser.bookmarks.onCreated.addListener((bookmarkId, bookmark) => {
    if (!bookmark.url) {
      console.log(`Folder created: ID=${bookmarkId}, Title=${bookmark.title}`);
      return;
    }

    console.log(`Bookmark created: ID=${bookmarkId}`);
    console.log(`Title: ${bookmark.title}`);
    console.log(`URL: ${bookmark.url}`);

    // Start tracking the bookmark with a delay
    scheduleBookmarkProcessing(bookmarkId);
  });

  // Listener for bookmark changes (title or URL change)
  browser.bookmarks.onChanged.addListener((bookmarkId, changeInfo) => {
    console.log(`Bookmark changed: ID=${bookmarkId}`);
    console.log('Change Info:', changeInfo);

    // Mark that the user has interacted with the bookmark
    markUserInteraction(bookmarkId);
  });

  // Listener for bookmark moves
  browser.bookmarks.onMoved.addListener((bookmarkId, moveInfo) => {
    console.log(`Bookmark moved: ID=${bookmarkId}`);
    console.log('Move Info:', moveInfo);

    // Skip processing if the move was initiated by the extension
    if (bookmarksBeingMoved.has(bookmarkId)) {
      console.log(`Bookmark ${bookmarkId} move initiated by extension. Skipping reprocessing.`);
      return;
    }

    // Mark that the user has interacted with the bookmark
    markUserInteraction(bookmarkId);
  });

  // Function to schedule processing of a bookmark after a delay
  function scheduleBookmarkProcessing(bookmarkId: string) {
    // Clear any existing timeout for this bookmark
    if (pendingBookmarks.has(bookmarkId)) {
      clearTimeout(pendingBookmarks.get(bookmarkId)!.timerId);
    }

    // Initialize pending bookmark with interaction flag
    const timerId = setTimeout(() => {
      processBookmark(bookmarkId);
      pendingBookmarks.delete(bookmarkId);
    }, 1000); // Delay of 1 seconds

    pendingBookmarks.set(bookmarkId, {
      timerId,
      userInteracted: false,
    });
  }

  // Function to mark that the user has interacted with the bookmark
  function markUserInteraction(bookmarkId: string) {
    const pending = pendingBookmarks.get(bookmarkId);
    if (pending) {
      pending.userInteracted = true;
    }
  }

  // Function to process the bookmark
  async function processBookmark(bookmarkId: string) {
    try {
      const [bookmark] = await browser.bookmarks.get(bookmarkId);

      if (!bookmark.url) {
        console.log(`Bookmark ${bookmarkId} is a folder or has no URL. Skipping.`);
        return;
      }

      const pending = pendingBookmarks.get(bookmarkId);
      const userInteracted = pending?.userInteracted || false;

      if (userInteracted) {
        console.log(`User interacted with bookmark ${bookmarkId}. Skipping categorization.`);
        return;
      }

      console.log(`Processing bookmark: ID=${bookmarkId}`);
      console.log(`Final Title: ${bookmark.title}`);
      console.log(`Final URL: ${bookmark.url}`);

      // Categorize the bookmark
      const category = await categorizeBookmark(bookmark.title || '', bookmark.url);
      console.log(`Categorized under: ${category}`);

      // Place the bookmark into the appropriate folder
      await placeBookmarkInFolder(bookmarkId, category);
    } catch (error) {
      console.error(`Error processing bookmark ${bookmarkId}:`, error);
    }
  }

  // Function to place the bookmark into the category folder
  async function placeBookmarkInFolder(bookmarkId: string, categoryName: string) {
    try {
      const parentFolderId = await getParentFolderId();

      if (!parentFolderId) {
        console.error('Parent folder ID not found.');
        return;
      }

      let categoryFolderId: string | undefined;

      // Search for existing category folders under the parent
      const categoryFolders = await browser.bookmarks.getChildren(parentFolderId);

      for (const folder of categoryFolders) {
        if (folder.title === categoryName && !folder.url) {
          categoryFolderId = folder.id;
          break;
        }
      }

      // If the folder doesn't exist, create it
      if (!categoryFolderId) {
        const newFolder = await browser.bookmarks.create({
          parentId: parentFolderId,
          title: categoryName,
        });
        categoryFolderId = newFolder.id;
        console.log(`Created new folder: ${categoryName} (ID: ${categoryFolderId})`);
      }

      // Add bookmarkId to the set before moving
      bookmarksBeingMoved.add(bookmarkId);

      // Move the bookmark into the category folder
      await browser.bookmarks.move(bookmarkId, { parentId: categoryFolderId });
      console.log(`Moved bookmark to folder: ${categoryName}`);

      // Remove bookmarkId from the set after moving
      bookmarksBeingMoved.delete(bookmarkId);

      // Verify the bookmark's new parentId
      const [movedBookmark] = await browser.bookmarks.get(bookmarkId);
      if (movedBookmark.parentId === categoryFolderId) {
        console.log('Bookmark moved successfully.');
      } else {
        console.error('Bookmark move failed.');
      }
    } catch (error) {
      bookmarksBeingMoved.delete(bookmarkId); // Ensure removal in case of error
      console.error('Error in placeBookmarkInFolder:', error);
    }
  }

  // Function to get the ID of the parent folder where category folders are created
  async function getParentFolderId(): Promise<string | undefined> {
    const [tree] = await browser.bookmarks.getTree();
    const rootNodes = tree.children || [];
    for (const node of rootNodes) {
      if (node.title === 'Bookmarks Bar' || node.title === 'Other Bookmarks') {
        return node.id;
      }
    }
    return undefined;
  }

  // Listener for messages from the popup
  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'organizeBookmarks') {
      console.log('Organize Bookmarks action received.');
      try {
        await organizeAllBookmarks();

        // Send a success message back to the popup
        browser.runtime.sendMessage({ action: 'organizationComplete' });
      } catch (error) {
        console.error('Error organizing all bookmarks:', error);

        // Send an error message back to the popup
        browser.runtime.sendMessage({ action: 'organizationError' });
      }
    }
  });

  // Function to organize all bookmarks
  async function organizeAllBookmarks() {
    try {
      console.log('Starting to organize all bookmarks...');

      // Record the start time
      const startTime = Date.now();

      const allBookmarks = await getAllBookmarks();

      const totalBookmarks = allBookmarks.length;
      let processedCount = 0;

      const batchSize = 25; // Adjust based on testing and AI model limitations
      const batches: any[][] = [];

      // Create batches
      for (let i = 0; i < allBookmarks.length; i += batchSize) {
        batches.push(allBookmarks.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        try {
          // Categorize the batch of bookmarks
          const categories = await categorizeBookmarksBatch(batch);

          for (let i = 0; i < batch.length; i++) {
            const bookmark = batch[i];
            const category = categories[i];

            console.log(`Categorizing bookmark ID=${bookmark.id} under ${category}`);
            await placeBookmarkInFolder(bookmark.id, category);
            processedCount++;
            console.log(`Processed ${processedCount}/${totalBookmarks} bookmarks.`);
          }
        } catch (error) {
          console.error('Error processing batch:', error);
          // Handle batch error
        }
      }

      // Record the end time
      const endTime = Date.now();

      // Calculate the duration in seconds
      const durationSeconds = (endTime - startTime) / 1000;

      console.log(`Finished organizing all bookmarks in ${durationSeconds} seconds.`);

      // Send a success message back to the popup with the duration
      browser.runtime.sendMessage({
        action: 'organizationComplete',
        duration: durationSeconds,
      });
    } catch (error) {
      console.error('Error organizing all bookmarks:', error);

      // Send an error message back to the popup
      browser.runtime.sendMessage({ action: 'organizationError' });
    }
  }

  // Helper function to get all bookmarks
  async function getAllBookmarks(): Promise<any> {
    const bookmarkTreeNodes = await browser.bookmarks.getTree();
    const bookmarks: any[] = [];
    traverseBookmarks(bookmarkTreeNodes, bookmarks);
    return bookmarks;
  }

  // Recursive function to traverse the bookmark tree
  function traverseBookmarks(
    nodes: any[],
    bookmarks: any[]
  ) {
    for (const node of nodes) {
      if (node.children) {
        traverseBookmarks(node.children, bookmarks);
      } else if (node.url) {
        bookmarks.push(node);
      }
    }
  }

  async function categorizeBookmark(title: string, url: string): Promise<string> {
    try {
      // If we already have a categorization tab, check if it's still valid
      if (categorizationTabId !== null) {
        try {
          // Check if the tab is still open
          const tab = await browser.tabs.get(categorizationTabId);
          if (!tab || tab.status === 'unloaded') {
            // Reset if the tab is closed or not usable
            categorizationTabId = null;
            contentScriptInjected = false;
          }
        } catch (error) {
          // Reset if an error occurs (e.g., tab not found)
          categorizationTabId = null;
          contentScriptInjected = false;
        }
      }

      // Find a suitable tab if we don't have one
      if (categorizationTabId === null) {
        const tabs = await browser.tabs.query({});

        if (!tabs || tabs.length === 0) {
          throw new Error('No tabs found.');
        }

        for (const tab of tabs) {
          if (tab.id !== undefined && tab.url && tab.url.startsWith('http')) {
            // Try to inject a simple script to check if we can inject into this tab
            try {
              // await browser.tabs.executeScript(tab.id, { code: 'void 0;' });
              categorizationTabId = tab.id;
              contentScriptInjected = false;
              console.log(`added script in tab: ${tab.url}`)
              break;
            } catch (injectionError) {
              // Can't inject into this tab, try the next one
              continue;
            }
          }
        }

        if (categorizationTabId === null) {
          throw new Error('No suitable tab found for injecting content script.');
        }
      }

      // Inject the content script only if not already injected
      if (!contentScriptInjected) {
        await browser.scripting.executeScript({
          target: { tabId: categorizationTabId },
          files: ['content-scripts/content.js'],
        });
        contentScriptInjected = true;
      }

      // Send a message to the content script to perform AI categorization
      const response = await browser.tabs.sendMessage(categorizationTabId, {
        action: 'categorizeBookmarkAI',
        data: { title, url },
      });

      if (response.success) {
        console.log(`AI categorized bookmark as: ${response.category}`);
        return response.category;
      } else {
        console.error('AI categorization failed:', response.error);
        // Fallback to default categorization
        return defaultCategorizeBookmark(title, url);
      }
    } catch (error) {
      console.error('Error in categorizeBookmark:', error);

      // Fallback to default categorization
      return defaultCategorizeBookmark(title, url);
    }
  }

  function defaultCategorizeBookmark(title: string, url: string): string {
    // Your existing dummy categorization logic
    return 'Others';
  }

  // New function to categorize a batch of bookmarks
    async function categorizeBookmarksBatch(bookmarks: any[]): Promise<string[]> {
      // Prepare titles and URLs for the batch
      const titles = bookmarks.map((b) => b.title || 'Untitled');
      const urls = bookmarks.map((b) => b.url);

      // Send the batch to the content script for categorization
      try {
        const categories = await categorizeBookmarkBatchInContentScript(titles, urls);
        return categories;
      } catch (error) {
        console.error('Error in categorizeBookmarksBatch:', error);
        // Fallback to default categories
        return bookmarks.map(() => defaultCategorizeBookmark('', ''));
      }
    }

    // Function to communicate with the content script for batch categorization
    async function categorizeBookmarkBatchInContentScript(
      titles: string[],
      urls: string[]
    ): Promise<string[]> {
      try {
        // Ensure the categorization tab and content script are set up
        await setupCategorizationTabAndContentScript();

        // Send a message to the content script to perform AI batch categorization
        const response = await browser.tabs.sendMessage(categorizationTabId!, {
          action: 'categorizeBookmarkBatchAI',
          data: { titles, urls },
        });

        if (response.success) {
          console.log('AI categorized batch successfully.');
          return response.categories;
        } else {
          console.error('AI batch categorization failed:', response.error);
          // Fallback to default categories
          return titles.map(() => 'Others');
        }
      } catch (error) {
        console.error('Error in categorizeBookmarkBatchInContentScript:', error);
        // Fallback to default categories
        return titles.map(() => 'Others');
      }
    }

    async function setupCategorizationTabAndContentScript() {
      // If we already have a categorization tab, check if it's still valid
      if (categorizationTabId !== null) {
        try {
          // Check if the tab is still open
          const tab = await browser.tabs.get(categorizationTabId);
          if (!tab || tab.status === 'unloaded') {
            // Reset if the tab is closed or not usable
            categorizationTabId = null;
            contentScriptInjected = false;
          }
        } catch (error) {
          // Reset if an error occurs (e.g., tab not found)
          categorizationTabId = null;
          contentScriptInjected = false;
        }
      }

      // Find a suitable tab if we don't have one
      if (categorizationTabId === null) {
        const tabs = await browser.tabs.query({});

        if (!tabs || tabs.length === 0) {
          throw new Error('No tabs found.');
        }

        for (const tab of tabs) {
          if (tab.id !== undefined && tab.url && tab.url.startsWith('http')) {
            // Try to inject a simple script to check if we can inject into this tab
            try {
              // No-op script to check for injection
              // await browser.tabs.executeScript(tab.id, { code: 'void 0;' });
              categorizationTabId = tab.id;
              contentScriptInjected = false;
              console.log(`Using tab ${tab.id} (${tab.url}) for categorization.`);
              break;
            } catch (injectionError) {
              // Can't inject into this tab, try the next one
              continue;
            }
          }
        }

        if (categorizationTabId === null) {
          throw new Error('No suitable tab found for injecting content script.');
        }
      }

      // Inject the content script only if not already injected
      if (!contentScriptInjected) {
        await browser.scripting.executeScript({
          target: { tabId: categorizationTabId },
          files: ['content-scripts/content.js'],
        });
        contentScriptInjected = true;
        console.log('Content script injected.');
      }
    }
});
