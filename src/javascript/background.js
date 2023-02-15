import { createStateManagementStore, addTabToStateManagementStore, removeTabFromStateManagementStore } from './service/store-management-service.js';

chrome.runtime.onInstalled.addListener(() => {
  // create tree when extension is initialized or
  // browser is restarted
  chrome.sessions.getRecentlyClosed({ maxResults: 1 }, (sessions) => {
    // window tel
    console.log("recently closed", sessions)
  });

  chrome.tabs.query({}, (tabs) => {
    console.log("tree init", tabs)
    createStateManagementStore(tabs);
  });
});

// on tab create
chrome.tabs.onCreated.addListener((tab) => {
  console.log("tab created", tab);
  addTabToStateManagementStore(tab);
})

// on tab remove
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log("tab removed", tabId, removeInfo);
  // get to know if the tab is removed with children or not
  removeTabFromStateManagementStore(tabId, false);
})

// on tab move
