import { createWindowManagementStore, addTabToStateManagementStore, removeTabFromStateManagementStore } from './service/store-management-service.js';

chrome.runtime.onInstalled.addListener(() => {
  // create tree when extension is initialized or
  // browser is restarted
  console.log(chrome.sessions);
  chrome.sessions.getRecentlyClosed({ maxResults: 1 }, (sessions) => {
    // window tel
    console.log("recently closed", sessions)
  });

  // on window re-open/restore, create the store

  chrome.tabs.query({}, (tabs) => {
    console.log("tree init", tabs)
    createWindowManagementStore(tabs);
  });
});

// on tab create
chrome.tabs.onCreated.addListener((tab) => {
  console.log("tab created", tab);
  addTabToStateManagementStore(tab.windowId, tab);
})

// on tab remove
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log("tab removed", tabId, removeInfo);
  // get to know if the tab is removed with children or not
  removeTabFromStateManagementStore(removeInfo.windowId, tabId, false);
})

// on tab move
