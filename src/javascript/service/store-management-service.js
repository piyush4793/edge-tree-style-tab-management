import { tabUpdateMessageHandler } from './message-service.js';

/*
WORKINGS OF THE EXTENSION

Case that needs to be handled: window restore, url changes, tab move

In background.js, add listener for expand/collapse of tabs and call updateTabForWindow()

Sample data structure:

windowTabManagementStore = {
    windowId: stateManagementStore
}

stateManagementStore = {
    tabId: tabNode(id, url, parentTabId, childrenTabIds, position, isCollapsed)
}

When browser session is open:
Get stateManagementStore from local storage using windowId
- Tab creation -> Add tab to stateManagementStore
- Tab update (url change, update collapse state, etc) -> Get the tab using tab id, make the update and save it to stateManagementStore
- Tab remove single -> Remove the tab from stateManagementStore based on tab id
- Tab remove tree -> Loop over all linked tabs and follow tab remove single


When tab is restored:
new tab is getting created but for existing windowId
We have existing stateManagementStore for the windowId
Tab creation -> Add tab to stateManagementStore
# No heirarchy is restrored
# TODO: When there is support to have oldTabId from recently closed tab

When browser is restored:
Restore the windowTabManagementStore using local storage
*/

// Tab structure
/*
    This is the structure of the tab that is stored in the stateManagementStore
    id: unique id of the tab
    url: url of the tab
    parentTabId: id of the parent tab
    childTabIds: ids of the children tabs
    position: position of the tab
    isCollapsed: is the tab collapsed or not
    title: title of the tab
    key: unique key for the tab
*/
class Tab {
    constructor(tabInfo) {
        const {
          id,
          url,
          parentTabId = null,
          childrenTabIds = [],
          position,
          isCollapsed = true,
          title = "",
          faviconUrl = "",
          active = false,
        } = tabInfo;
        
        this.id = id;
        this.url = url;
        this.parentTabId = parentTabId;
        this.childTabIds = childrenTabIds;
        this.position = position;
        this.isCollapsed = isCollapsed;
        this.title = title;
        this.faviconUrl = faviconUrl;
        this.active = active;
        this.key = this.getKey();
    }

    hashCode(str) {
        return str.split('').reduce((prevHash, currVal) => (((prevHash << 5) - prevHash) + currVal.charCodeAt(0))|0, 0);
    }

    // used to update the tab information only when there is a change
    updateTab(tab) {
        if(!tab) return this;

        this.id = this.id || tab?.id;
        this.url = this.url || tab?.url;
        this.parentTabId = this.parentTabId || tab?.parentTabId;
        this.childTabIds = [...this.childTabIds, ...tab?.childTabIds];
        this.position = this.position || tab?.position;
        this.isCollapsed = this.isCollapsed || tab?.isCollapsed;
        this.key = this.key || tab?.key || this.getKey();
        return this;
    }

    // Update the tab information using passed information
    updateTabInfo(tabInfo) {
        if (!tabInfo) return this;

        this.id = tabInfo?.id || this.id;
        this.url = tabInfo?.url || this.url;
        this.parentTabId = tabInfo?.parentTabId || this.parentTabId;
        this.childTabIds = tabInfo?.childTabIds || this.childTabIds;
        this.position = tabInfo?.position || this.position;
        this.isCollapsed = tabInfo?.isCollapsed || this.isCollapsed;
        this.title = tabInfo?.title || this.title;
        this.key = tabInfo?.key || this.key || this.getKey();
        return this;
    }

    // Get the key for the tab
    getKey() {
        return this.key || this.id
    }
}

// To store in local storage with key => windowId and value => stateManagementStore
let windowTabManagementStore = {};

// Create a windowTabManagementStore hash table and save it to local storage when the extension is installed
export function createWindowManagementStore(tabs) {
    
    // register message handler
    // TODO - make it more generic
    tabUpdateMessageHandler(updateTabForWindow);

    // Create nodes from browser tabs information
    let stateManagementStore = {};
    tabs.forEach((tab) => {
        stateManagementStore = windowTabManagementStore[tab.windowId] || {};
        // update the tab with the updated information in cases where the tab is already present in the map
        let tabUrl = ["loading"].includes(tab.status) ? tab.pendingUrl : tab.url;
        // find opener tab url from the openerTabId, as the opener tab url is not available in the tab object
        // we only need to search for tabs in the same window
        let openerTab = tab.openerTabId ? Object.values(stateManagementStore).find(t => t.id === tab.openerTabId) : null;
        const tabInfo = {
            id: tab.id,
            url: tabUrl,
            parentTabId: tab.openerTabId,
            childrenTabIds: [],
            position: tab.index,
            isCollapsed: true,
            title: tab.title,
            faviconUrl: tab?.favIconUrl,
            active: tab.active,
        }
        let tabNode = new Tab(tabInfo);
        stateManagementStore[tabNode.getKey()] = tabNode.updateTab(stateManagementStore[tabNode.getKey()])

        // update the parent tab with the child tab id
        // updated with children tab id, incase any existing children it'll append to the existing children
        // Assumption: parentTab is present in the stateManagementStore
        if (tab.openerTabId) {
            let openerTabChildTabIds = openerTab.childTabIds;
            openerTabChildTabIds.push(tab.id);
            stateManagementStore[openerTab.getKey()] = openerTab.updateTabInfo({ childTabIds: openerTabChildTabIds, isCollapsed: false });
        }
        windowTabManagementStore[tab.windowId] = stateManagementStore;
    });

    console.log("#createWindowManagementStore - window tab management store is created", windowTabManagementStore);
    chrome.storage.local.set({ windowTabManagementStore });
}

// Check if all URLs in window1 are present in window2
function isWindowMatched(window1, window2) {
    if (window1.length === window2.length) {
        let intersection = window1.filter(x => window2.includes(x));
        return intersection.length === window1.length ? true : false;
    }
    return false;
}

/*
    Get the matchedWindowId from the windowTabManagementStore

    NOTE: We are not deleting stateManagementStore from the windowTabManagementStore when the window is closed

    Algorithm:
    1. Get newStateManagementStore from windowTabManagementStore
    2. Get list of all tab urls (restoredTabUrls) from newStateManagementStore
    3. Iterate over windowTabManagementStore and find the windowId whose tab urls are matched with the restoredTabUrls
*/
function getMatchedWindowId(newWindowId) {
    let newStateManagementStore = windowTabManagementStore[newWindowId];
    let restoredTabUrls = Object.values(newStateManagementStore).map(tab => tab.url);
    // restored tab urls are matched with existing windows in windowTabManagementStore
    // This is done to keep track of parentTabIds, childTabIds, position and isCollapsed while restoring the browser window
    return Object.keys(windowTabManagementStore).find((key) => {
        let store = windowTabManagementStore[key];
        if (key != newWindowId && isWindowMatched(Object.values(store).map(tab => tab.url), restoredTabUrls)) {
            return key;
        }
    });
}

export function restoreBrowserWindow(newWindowId, retry = 0) {
    if (retry === 2) return;

    let newStateManagementStore = windowTabManagementStore[newWindowId];

    // Find matching old window store
    let matchedWindowId = getMatchedWindowId(newWindowId);
    console.log(`#restoreBrowserWindow - matchedWindowId: ${matchedWindowId}`);

    // Restoration failed for the browser window
    // If match is not found, then retrigger restoration after 20 more milliseconds. Fallback to handle cache miss
    // Restoration can be slightly delayed, but it'll be better than not restoring at all
    // retry for 2 times
    if (!matchedWindowId) {
        setTimeout(() => {
            restoreBrowserWindow(newWindowId, retry + 1);
        }, 20);
        return;
    }

    // Create a map with URL as key and list of tabIds as value for matchedWindowId
    /*
        Example: URL: array of ids
        {
            abcd.com: [1, 2, 3],
            xyz.com: [4]
        }
    */
    let urlToIdsMap = {};
    let oldWindowStore = windowTabManagementStore[matchedWindowId];
    Object.values(oldWindowStore).forEach((tab) => {
        urlToIdsMap[tab.url] = urlToIdsMap[tab.url] || [];
        urlToIdsMap[tab.url].push(tab.id);
    });

    let oldTabIdToNewTabIdMap = {};
    // update old store with new window data and tab ids
    // Iterate over all tab objects for newStateManagementStore
    Object.values(newStateManagementStore).forEach((tab) => {
        // get the old tab id from the urlToIdsMap
        let oldTabId = urlToIdsMap[tab.url].length > 0 ? urlToIdsMap[tab.url].pop() : null;
        // if oldTabId is not found, then continue
        if (!oldTabId) return;

        // maintain a map of oldTabId and newTabId
        oldTabIdToNewTabIdMap[oldTabId] = tab.id;

        // get old tab from the oldWindowStore
        let oldTab = oldWindowStore[oldTabId]

        // update the newTab with the oldTab information for successful restoration
        tab = tab.updateTabInfo({ parentTabId: oldTab.parentTabId, childTabIds: oldTab.childTabIds, position: oldTab.position, isCollapsed: oldTab.isCollapsed });
    });

    // update all parentTabIds and childTabIds with newTabIds
    Object.values(newStateManagementStore).forEach((tab) => {
        tab.parentTabId = oldTabIdToNewTabIdMap[tab.parentTabId];
        tab.childTabIds = tab.childTabIds.map(childTabId => oldTabIdToNewTabIdMap[childTabId]);
    });

    // update the windowTabManagementStore with the new window data
    windowTabManagementStore[newWindowId] = newStateManagementStore;

    console.log('old store: ', oldWindowStore, ' and new store: ', newStateManagementStore);

    // delete the old window data from the windowTabManagementStore
    delete windowTabManagementStore[matchedWindowId];

    console.log(`#restoreBrowserWindow - Closed window is restored with windowId: ${newWindowId} and updated store: `, windowTabManagementStore);
    // save the updated windowTabManagementStore to local storage
    chrome.storage.local.set({ windowTabManagementStore });
}

// update the position of all nodes with index greater than or equal to the given index
// NOTE: Skip the node with the given key
function updatePositionOfNodesWithIndexGreaterThan(stateManagementStore, key, index, incrementBy = 1) {
    Object.values(stateManagementStore).forEach((t) => {
        if (t.key != key && t.position >= index) {
            stateManagementStore[t.getKey()] = t.updateTabInfo({ position: t.position + incrementBy });
        }
    });
}

// add Tab to the state management store
export function addTabToStateManagementStore(windowId, tab) {
    // Create and Add the node to the map
    let stateManagementStore = windowTabManagementStore[windowId] || {};
    let tabUrl = ["loading"].includes(tab.status) ? tab.pendingUrl : tab.url;
    // find opener tab from the openerTabId, as the opener tab url is not available in the tab object
    let openerTab = tab.openerTabId ? Object.values(stateManagementStore).find(t => t.id === tab.openerTabId) : null;
    let tabInfo = {
        id: tab.id,
        url: tabUrl,
        openerTabId: tab.openerTabId,
        openerTabUrl: openerTab?.url,
        childTabIds: [],
        position: tab.index,
        isCollapsed: true,
        title: tab.title,
        faviconUrl: tab?.favIconUrl,
        active: tab.active,
    }
    let tabNode = new Tab(tabInfo);
    stateManagementStore[tabNode.getKey()] = tabNode;

    // increase position value by 1 for all nodes with position greater than or equal to the current tab index
    updatePositionOfNodesWithIndexGreaterThan(stateManagementStore, tabNode.getKey(), tab.index);
    
    // update the parent tab with the child tab id
    // Expand the parent tab when new tab is added from existing tab
    if (tab.openerTabId) {
        let openerTabChildTabIds = openerTab.childTabIds;
        openerTabChildTabIds.push(tab.id);
        stateManagementStore[openerTab.getKey()] = openerTab.updateTabInfo({ childTabIds: openerTabChildTabIds, isCollapsed: false });
    }
    windowTabManagementStore[windowId] = stateManagementStore;

    // Save the object to local storage
    console.log("#addTabToStateManagementStore - window tab management store is updated", windowTabManagementStore[windowId]);
    chrome.storage.local.set({ windowTabManagementStore });
}

// remove Tab from the state management store
export function removeTabFromStateManagementStore(windowId, tabId, withChildren = false) {
    // Get the node from the map
    // Remove the node from the parent node
    // update children nodes with the new parent and position
    // in case of withChildren = true, remove all the children nodes for that node recursively
    // Remove the node from the map

    let stateManagementStore = windowTabManagementStore[windowId] || {};
    // Get the node from the map
    var tabNode = stateManagementStore[tabId]
    if (!tabNode) return

    // update children nodes with the new parent and position
    if (!withChildren) {
        // delete the node from the map
        delete stateManagementStore[tabId]

        // Remove the node from the parent node
        let parentTab = stateManagementStore[tabNode.parentTabId]
        if (parentTab) {
            parentTab.childTabIds = parentTab.childTabIds.filter((childId) => childId !== tabId)
            // add tabNode childTabIds to the parentTab childTabIds
            parentTab = parentTab.updateTabInfo({ childTabIds: [...parentTab.childTabIds, ...tabNode.childTabIds] });
        }

        tabNode.childTabIds.forEach((childId) => {
            let childTab = stateManagementStore[childId];
            if (childTab) {
                // update the child tab with the new parent tab id and url
                if (parentTab) {
                    childTab.parentTabId = tabNode.parentTabId;
                } else {
                    // If top most tab is removed, then the child tab will not have parentTabId
                    childTab.parentTabId = null;
                }
            }
        })

        // decrease position value by 1 for all the nodes with position greater than the removed node
        updatePositionOfNodesWithIndexGreaterThan(stateManagementStore, tabNode.getKey(), tabNode.position, -1);
    }
    // in case of withChildren = true, remove all the children nodes for that node recursively
    // updates the parentNode and then deletes the node with all the children
    else {
        deleteTree(tabNode, stateManagementStore)
    }

    windowTabManagementStore[windowId] = stateManagementStore;

    // Save the object to local storage
    console.log("#removeTabFromStateManagementStore - window tab management store is updated", windowTabManagementStore[windowId]);
    chrome.storage.local.set({ windowTabManagementStore });
}

function deleteTree(tab, stateManagementStore) {
    // base case
    if (!tab?.id) return
    
    // Remove the node from the parent node
    // this will only exist for the root node
    if(stateManagementStore[tab.url]?.openerTabId) {
        var parentTab = stateManagementStore[tab.openerTabId]
        parentTab.childTabIds = parentTab.childTabIds.filter((childId) => childId !== tab.id)
    }
    delete stateManagementStore[tab.url]
    
    let children = getChildrenNodes(tab.id, stateManagementStore)
    // terminate the recursion
    if (children.length) return

    children.forEach((child) => {
        deleteTree(child, stateManagementStore)
    })
}

export function updateTabForWindow(windowId, tabId, tabInfo) {
    let stateManagementStore = windowTabManagementStore[windowId] || {};
    // Get the node from the map
    let tabNode = stateManagementStore[tabId]
    if (!tabNode) return;

    let isChanged = false;
    if (tabInfo?.url && tabInfo?.url !== tabNode.url) {
        // update the url for the node
        tabNode.url = tabInfo.url;
        isChanged = true;
    }
    if (tabInfo?.title && tabInfo?.title !== tabNode.title) {
        // When new tabs are opened, in loading state title of the tab is missing
        // We need to update title when the tab status is completed
        // update the title for the node
        tabNode.title = tabInfo.title;
        isChanged = true;
    }
    if (tabInfo?.favIconUrl && tabInfo?.favIconUrl !== tabNode.faviconUrl) {
        // When new tabs are opened, in loading state favIconUrl of the tab is missing
        // We need to update favIconUrl when the tab status is completed
        // update the favIconUrl for the node
        tabNode.faviconUrl = tabInfo.favIconUrl;
        isChanged = true;
    }
    if (String(tabInfo?.isCollapsed) && tabInfo?.isCollapsed !== tabNode.isCollapsed) {
        // String(true || false) will return non empty string to check presence of the value
        // update the isCollapsed for the node
        tabNode.isCollapsed = tabInfo.isCollapsed;
        isChanged = true;
    }
    if (String(tabInfo?.active) && tabInfo?.active !== tabNode.isActive) {
        // String(true || false) will return non empty string to check presence of the value
        // update the isActive for the node
        tabNode.isActive = tabInfo.active;
        isChanged = true;
    }

    // No attribute for tabNode got changed then return
    if (!isChanged) return;

    // update the tab info
    stateManagementStore[tabId] = tabNode

    windowTabManagementStore[windowId] = stateManagementStore;
    // Save the object to local storage
    console.log("#updateTabForWindow - window tab management store is updated", windowTabManagementStore[windowId]);
    chrome.storage.local.set({ windowTabManagementStore });
}

function getChildrenNodes(tabId, stateManagementStore) {
    // Get the node from the map
    // Return the children nodes
    let childrenIds = stateManagementStore[tabId]?.childTabIds
    
    if (!childrenIds) return [];
    
    // Get the children nodes from the map
    let childrenNodes = []
    childrenIds.forEach((childId) => {
        childrenNodes.push(stateManagementStore[childId])
    })
    return childrenNodes
}
