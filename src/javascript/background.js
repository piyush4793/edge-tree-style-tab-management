import { createWindowManagementStore, addTabToStateManagementStore, removeTabFromStateManagementStore, restoreBrowserWindow, updateTabForWindow } from './service/store-management-service.js';
import { tabUpdateMessageHandler } from './service/message-service.js';

chrome.runtime.onInstalled.addListener(() => {
  // create tree when extension is initialized or reloaded
  // browser is restarted
  chrome.sessions.getRecentlyClosed({ maxResults: 1 }, (sessions) => {
    // window tel
    console.log("recently closed", sessions)
  });

  chrome.tabs.query({}, (tabs) => {
    console.log("tree init", tabs)
    createWindowManagementStore(tabs);
  });
});

// on window create
chrome.windows.onCreated.addListener((window) => {
  setTimeout(() => {
    console.log("window created", window);
    // Trigger restore of the window
    restoreBrowserWindow(window.id);
  }, 20);
});

// on tab create
chrome.tabs.onCreated.addListener((tab) => {
  console.log("tab created", tab);
  addTabToStateManagementStore(tab.windowId, tab);
})

// on tab update
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log("tab updated", tabId, changeInfo, tab);

  // In loading state, title is not present for a new clicked tab
  // Update title when tab status is complete
  if (changeInfo?.status === "complete") {
    changeInfo.title = tab.title;
    changeInfo.favIconUrl = tab.favIconUrl;
  }
  // TODO: can we add debounce to avoid multiple updates?
  // In case of url changes - manual or using back/forward button continuously can trigger multiple updates
  updateTabForWindow(tab.windowId, tabId, changeInfo);
})


// on tab remove
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log("tab removed", tabId, removeInfo);
  // Don't remove the window info from store if the window is closing
  // NOTE: Done to be able to restore the window
  // ISSUE: window map will remain until local storage is cleared or reset
  if (removeInfo.isWindowClosing) return;
  // get to know if the tab is removed with children or not
  removeTabFromStateManagementStore(removeInfo.windowId, tabId, false);
})

// TODO: on tab move
