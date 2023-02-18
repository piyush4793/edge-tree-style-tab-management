import { createWindowManagementStore, addTabToStateManagementStore, removeTabFromStateManagementStore, restoreBrowserWindow } from './service/store-management-service.js';

chrome.runtime.onInstalled.addListener(() => {
  // create tree when extension is initialized or reloaded
  // browser is restarted
  console.log(chrome.sessions);
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
  // deal with URL change, collapsed/state change
  // console.log("tab updated", tabId, changeInfo, tab);
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
