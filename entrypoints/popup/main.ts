const organizeButton = document.getElementById('organizeButton') as HTMLButtonElement;
const statusMessage = document.getElementById('statusMessage') as HTMLDivElement;

document.getElementById('organizeButton')!.addEventListener('click', async () => {
  // Disable the button to prevent multiple clicks
  organizeButton.disabled = true;
  statusMessage.textContent = 'Organizing your bookmarks...';
  statusMessage.classList.remove('success', 'error');

  // Send a message to the background script to organize bookmarks
  browser.runtime.sendMessage({ action: 'organizeBookmarks' });
});

// Listen for a message indicating completion
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'organizationComplete') {
    // Re-enable the button
    organizeButton.disabled = false;

    // Update the status message
    statusMessage.textContent = 'Bookmarks have been organized successfully!';
    statusMessage.classList.add('success');
  } else if (message.action === 'organizationError') {
    // Re-enable the button
    organizeButton.disabled = false;

    // Update the status message with the error
    statusMessage.textContent = 'An error occurred while organizing bookmarks.';
    statusMessage.classList.add('error');
  }
});
