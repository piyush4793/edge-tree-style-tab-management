/*
TODO:
  - Adjust the overflow of the button in the child tabs 
  - Add the functionality to expand and collapse the child tabs (need a reconstruct and destroy tree function) - done
    - send update tree (expand collapse) to the background script - done
  - Modify the folder structure to add tree generation to a helper file
  - tab on click to focus the tab to active tab
  - Add the functionality to close the tabs (partially done, need to reconstruct the associated tree)
  - get the updated tree from the background script (regeneration) needed ??

  - port this to react to make the state management easier (maybe)
*/

// state management store for tabs
let sms = {};
let currentWindowId = 0;

chrome.storage.local.get("windowTabManagementStore").then((store) => {
  chrome.windows.getCurrent((window) => {
    sms = store.windowTabManagementStore[window.id];
    currentWindowId = window.id;

    // array containing the tabs sorted by it's position in the sms storage for current window
    // sort the values of sms object by position and store it in sortedSms array
    let sortedSms = Object.values(sms).sort((a, b) => a.position - b.position);
    console.log("sorted tabs list based on position", sortedSms);

    generateTabTree(sortedSms);
  });
});

// tree creation functions

function generateTabTree(sortedSms) {
  // create a html element for each tab in the sortedSms array
  let popup = document.getElementById("tabs-container");
  sortedSms.forEach((tab) => {
    // don't add the tab if it's parent is collapsed
    let isTabHidden = isAncestorTabCollapsed(tab);
    if (isTabHidden) return;

    let tabElement = createTabElement(tab);
    // insert only when tabElement exsits
    if (!!tabElement) popup.appendChild(tabElement);
  });
}

function createTabElement(tab, level = 0) {
  //  tab should have the following structure
  //  tab (tC)
  //    - tabElement (tE)
  //      - expand collapse buttom
  //      - tab title text
  //      - close button
  //    - tC (child tab if exists)

  // if the tab is already added to the dom, skip creation
  if (document.getElementById(`${tab.id}`)) return;

  let tC = document.createElement("div");
  tC.classList.add("tab-container");
  tC.id = tab.id;
  // add current tab to the tab container
  let tE = createTabElementStructure(tab, level);
  tC.appendChild(tE);

  // add child tabs to the tab container recursively
  if (tab.childTabIds.length > 0 && !tab.isCollapsed) {
    tab.childTabIds.forEach((childTabId) => {
      let childTab = createTabElement(sms[parseInt(childTabId)], level + 1);
      console.log("added child", childTabId, childTab);
      tC.appendChild(childTab);
    });
  }

  return tC;
}

function createTabElementStructure(tab, level) {
  let tabElement = document.createElement("div");
  tabElement.classList.add("tab-element");
  if (tab.active) tabElement.classList.add("active-tab");

  if (tab.childTabIds.length > 0) {
    let expandCollapseButton = document.createElement("button");
    // add on click to expand collapse button
    expandCollapseButton.onclick = (e) => onclickExpandCollapseButton(e, sms);
    expandCollapseButton.classList.add("expand-collapse-button");
    expandCollapseButton.innerText = tab.isCollapsed ? "►" : "▼";
    tabElement.appendChild(expandCollapseButton);
  } else {
    tabElement.classList.add("no-child");
  }

  let tabTitle = document.createElement("span");
  tabTitle.classList.add("tab-title");
  // on tab click set it to active tab
  tabTitle.onclick = (e) => onclickTabTitle(e);

  // add favicon to the tab title
  let favicon = document.createElement("img");
  favicon.alt = "I";
  favicon.src = tab.faviconUrl;
  favicon.height = 16;
  favicon.width = 16;
  favicon.classList.add("favicon");
  tabTitle.appendChild(favicon);
 
  // add tab title text element to tabTitle
  let titleElement = document.createElement("span");
  titleElement.innerText = tab.title;
  tabTitle.appendChild(titleElement);

  // tabTitle.classList.add("tab-title");
  // tabTitle.innerText = tab.title;
  tabElement.appendChild(tabTitle);

  let tabButton = document.createElement("button");
  // add on click to close button
  tabButton.onclick = (e) => onclickCloseButton(e);
  tabButton.classList.add("close-button");
  tabButton.innerText = "x";
  tabElement.appendChild(tabButton);

  // add padding to the tab element based on the level ??

  return tabElement;
}

// tree helper functions

// determines if the tab is a child of a collapsed tab
function isAncestorTabCollapsed(tab) {
  if (!tab.parentTabId) return false;
  let parentTab = sms[tab.parentTabId];
  if (parentTab.isCollapsed) return true;
  return isAncestorTabCollapsed(parentTab);
}

// expand collapse tree helper
function expandCollapseTree(tab, collapse) {
  // expand or collapse the tree based on the tab.isCollapsed property
  // if the tab is collapsed, remove the child tabs from the dom
  // if the tab is expanded, add the child tabs to the dom

  // if the tab is collapsed, remove the child tabs from the dom
  if (collapse) {
    if (tab.childTabIds.length > 0) {
      tab.childTabIds.forEach((childTabId) => {
        let cTC = document.getElementById(`${childTabId}`);
        cTC.remove();
      });
    }
  }
  // if the tab is expanded, add the child tabs to the dom
  else {
    if (tab.childTabIds.length > 0) {
      // add the child tabs to the dom
      let tC = document.getElementById(`${tab.id}`);
      tab.childTabIds.forEach((childTabId) => {
        // createTabElement for each child and add to the parent tab element
        let cTC = createTabElement(sms[childTabId]);
        tC.appendChild(cTC);
      });
    }
  }
}

// update the parent tab of the child tabs in the dom
function updateParentOfTabs(tabs, parentTab) {
  // add the child tabs to the parent tab or the tabs-container if the parent tab is not present
  // assumes that current tab if collapsed, child aren't present in the dom and hence not added to it's parent
  let pTC =
    document.getElementById(`${parentTab?.id}`) ||
    document.getElementById("tabs-container");
  tabs.forEach((tab) => {
    // create the child tab in case it needs to be added to the parent tab in the use arises
    let cTC = document.getElementById(`${tab.id}`);
    // dont update the child tab position if it's not in the dom
    if (!cTC) return;

    pTC.appendChild(cTC);
  });
}

function removeTab(tab, removeTree) {
  // incase of a single tab, trigger remove tab event
  if (!removeTree) {
    chrome.tabs.remove(tab.id);
    console.log("removed tab", tab.id, removeTree);
  }
  // incase of a tree, remove the child tabs recursively
  else {
    chrome.tabs.remove(tab.id);
    console.log("removed tab", tab.id);
    tab.childTabIds.forEach((childTabId) => {
      let childTab = sms[childTabId];
      removeTab(childTab, true);
    });
  }
}

// Click event handlers
// - onclickExpandCollapseButton
// - onclickCloseButton

function onclickExpandCollapseButton(event, sms) {
  event.target.innerText = event.target.innerText === "►" ? "▼" : "►";

  // expand or collapse the tree based on the tab.isCollapsed property
  let tab = sms[parseInt(event.target?.parentNode?.parentNode.id)];
  expandCollapseTree(tab, event.target.innerText === "►");

  // send isCollapsed tab property to the background script
  chrome.runtime.sendMessage({
    type: "updateTab",
    tabId: tab.id,
    windowId: currentWindowId,
    changeInfo: {
      isCollapsed: event.target.innerText === "►",
    },
  });
}

function onclickCloseButton(event) {
  // close the tab here
  try {
    // button -> tabElement -> tabContainer
    // in case of collapsed tab, remove the child tabs also
    let tab = sms[parseInt(event.target?.parentNode?.parentNode.id)];
    removeTab(tab, tab.isCollapsed);

    // before removing add the children of the removed tab to the removed tab's parent in the dom
    let childTabsIds =
      sms[parseInt(event.target?.parentNode?.parentNode.id)].childTabIds;
    let childTabs = childTabsIds.map((childTabId) => sms[childTabId]);
    let parentTab =
      sms[sms[parseInt(event.target?.parentNode?.parentNode.id)].parentTabId];
    updateParentOfTabs(childTabs, parentTab);

    // remove the tab from the dom
    // button -> tabElement -> tabContainer
    event.target?.parentNode?.parentNode.remove();
  } catch (e) {
    console.log("tab removal failed", e);
  }
}

function onclickTabTitle(event) {
  // open the tab here
  try {
    let tab = sms[parseInt(event.target?.parentNode?.parentNode?.parentNode.id)];
    chrome.tabs.update(tab.id, { active: true });
  } catch (e) {
    console.log("tab opening failed", e);
  }
}
