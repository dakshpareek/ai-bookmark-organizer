
export default defineBackground(() => {
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
      const allBookmarks = await getAllBookmarks();

      for (const bookmark of allBookmarks) {
        if (bookmark.url) {
          // Categorize and move the bookmark
          const category = await categorizeBookmark(bookmark.title || '', bookmark.url);
          console.log(`Categorizing bookmark ID=${bookmark.id} under ${category}`);
          await placeBookmarkInFolder(bookmark.id, category);
        }
      }

      console.log('Finished organizing all bookmarks.');
    } catch (error) {
      console.error('Error organizing all bookmarks:', error);
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
      // Get all tabs
      const tabs = await browser.tabs.query({});
      console.log(tabs)

      // Find a suitable tab
      let targetTab;

      for (const tab of tabs) {
        if (tab.id !== undefined && tab.url && tab.url.startsWith('http')) {
          // Attempt to inject content script and send message
          try {
            await browser.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content-scripts/content.js'],
            });

            targetTab = tab;
            break;
          } catch (injectionError) {
            console.log(injectionError)
            // Skip tabs where script injection fails (e.g., due to CSP)
            continue;
          }
        }
      }

      if (!targetTab || !targetTab.id) {
        throw new Error('No suitable tab found for injecting content script.');
      }

      // Send a message to the content script to perform AI categorization
      const response = await browser.tabs.sendMessage(targetTab.id, {
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
});
