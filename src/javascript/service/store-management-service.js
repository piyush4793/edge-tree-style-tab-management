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
class Tab {
    // id: unique id of the tab
    // url: url of the tab
    // parentTabId: id of the parent tab
    // childTabIds: ids of the children tabs
    // position: position of the tab
    // isCollapsed: is the tab collapsed or not

    // TODO might need to add more properties as per need
    constructor(id, url, parentTabId = null, parentTabUrl = null, childrenTabIds = [], position, isCollapsed = true, title = '') {
        // use url as id, as Tab id changes between sessions (window open and close)
        this.id = id;
        this.url = url;
        this.parentTabId = parentTabId;
        this.parentTabUrl = parentTabUrl;
        this.childTabIds = childrenTabIds;
        this.position = position;
        this.isCollapsed = isCollapsed;
        this.title = title;
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
        this.parentTabUrl = this.parentTabUrl || tab?.parentTabUrl;
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
        this.parentTabUrl = tabInfo?.parentTabUrl || this.parentTabUrl;
        this.childTabIds = tabInfo?.childTabIds || this.childTabIds;
        this.position = tabInfo?.position || this.position;
        this.isCollapsed = tabInfo?.isCollapsed || this.isCollapsed;
        this.key = tabInfo?.key || this.key || this.getKey();
        return this;
    }

    getKey() {
        return this.key || this.id
    }
}

// To store in local storage with window id (Double check for something that won't get changed) as key and value as the state management store
let windowTabManagementStore = {};

// Create a window tab management hash table and save it to local storage when the extension is installed
export function createWindowManagementStore(tabs) {
    // Create nodes from browser tabs information
    let stateManagementStore = {};
    tabs.forEach((tab) => {
        stateManagementStore = windowTabManagementStore[tab.windowId] || {};
        // update the tab with the updated information in cases where the tab is already present in the map
        let tabUrl = ["loading"].includes(tab.status) ? tab.pendingUrl : tab.url;
        // find opener tab url from the openerTabId, as the opener tab url is not available in the tab object
        // we only need to search for tabs in the same window
        let openerTab = tab.openerTabId ? Object.values(stateManagementStore).find(t => t.id === tab.openerTabId) : null;
        let tabNode = new Tab(tab.id, tabUrl, tab.openerTabId, openerTab?.url, [], tab.index, true, tab.title);
        stateManagementStore[tabNode.getKey()] = tabNode.updateTab(stateManagementStore[tabNode.getKey()])

        // update the parent tab with the child tab id
        // updated with children tab id, incase any existing children it'll append to the existing children
        // Assumption: parentTab is present in the stateManagementStore
        if (tab.openerTabId) {
            let parentTab = new Tab(tab.openerTabId, openerTab?.url, null, null, [tab.id], openerTab?.position, true, tab.title);
            stateManagementStore[parentTab.getKey()] = parentTab.updateTab(stateManagementStore[parentTab.getKey()]);
        }
        windowTabManagementStore[tab.windowId] = stateManagementStore;
    });

    console.log("#createWindowManagementStore - window tab management store is created", windowTabManagementStore);
    chrome.storage.local.set({ windowTabManagementStore });
}

function isWindowMatched(arr1, arr2) {
    if (arr1.length === arr2.length) {
        let intersection = arr1.filter(x => arr2.includes(x));
        return intersection.length === arr1.length ? true : false;
    }
    return false;
}

function getMatchedWindowId(newWindowId) {
    let newStateManagementStore = windowTabManagementStore[newWindowId];
    let restoredTabUrls = Object.values(newStateManagementStore).map(tab => tab.url);
    // restored tab urls are matched with existing windows in windowTabManagementStore
    // This is done to keep track of parentTabIds, childTabIds, position and isCollapsed while restoring the browser window
    return Object.keys(windowTabManagementStore).find((key) => {
        let store = windowTabManagementStore[key];
        if (isWindowMatched(Object.values(store).map(tab => tab.url), restoredTabUrls)) {
            return key;
        }
    });
}

export function restoreBrowserWindow(newWindowId) {
    let newStateManagementStore = windowTabManagementStore[newWindowId];

    // Find matching old window store
    let matchedWindowId = getMatchedWindowId(newWindowId);
    console.log("#restoreBrowserWindow - matchedWindowId", matchedWindowId);

    // Return when no matchedWindowId is found
    // Restoration failed for the browser window
    if (!matchedWindowId) return;

    // Create a map with URL as key and list of tabIds as value for matchedWindowId
    /*
        Example: URL: array of ids
        {
            abcd.com: [1, 2] [3],
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
        tab = tab.updateTabInfo({ parentTabId: oldTab.parentTabId, parentTabUrl: oldTab.parentTabUrl, childTabIds: oldTab.childTabIds, position: oldTab.position, isCollapsed: oldTab.isCollapsed });
    });

    // update all parentTabIds and childTabIds with newTabIds
    Object.values(newStateManagementStore).forEach((tab) => {
        tab.parentTabId = oldTabIdToNewTabIdMap[tab.parentTabId];
        tab.childTabIds = tab.childTabIds.map(childTabId => oldTabIdToNewTabIdMap[childTabId]);
    });

    // update the windowTabManagementStore with the new window data
    windowTabManagementStore[newWindowId] = newStateManagementStore;

    // delete the old window data from the windowTabManagementStore
    delete windowTabManagementStore[matchedWindowId];

    console.log("#restoreBrowserWindow - Closed window is restored", windowTabManagementStore);
    // save the updated windowTabManagementStore to local storage
    chrome.storage.local.set({ windowTabManagementStore });
}

// add Tab to the state management store
export function addTabToStateManagementStore(windowId, tab) {
    // Create and Add the node to the map
    let stateManagementStore = windowTabManagementStore[windowId] || {};
    let tabUrl = ["loading"].includes(tab.status) ? tab.pendingUrl : tab.url;
    // find opener tab from the openerTabId, as the opener tab url is not available in the tab object
    let openerTab = tab.openerTabId ? Object.values(stateManagementStore).find(t => t.id === tab.openerTabId) : null;
    let tabNode = new Tab(tab.id, tabUrl, tab.openerTabId, openerTab?.url, [], tab.index, true, tab.title);
    stateManagementStore[tabNode.getKey()] = tabNode;

    // update the position of the node
    // WIP
    
    // update the parent tab with the child tab id
    // Expand the parent tab when new tab is added from existing tab
    if (tab.openerTabId) {
        let parentTab = new Tab(tab.openerTabId, openerTab?.url, null, null, [tab.id], openerTab?.position, true, tab.title);
        stateManagementStore[parentTab.getKey()] = parentTab.updateTab(stateManagementStore[parentTab.getKey()])
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
        var parentTab = stateManagementStore[tabNode.parentTabId]
        if (parentTab) {
            parentTab.childTabIds = parentTab.childTabIds.filter((childId) => childId !== tabId)
        }

        tabNode.childTabIds.forEach((childId) => {
            var childTab = stateManagementStore[childId]
            childTab.parentTabId = tabNode.parentTabId
        }) // WIP position
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

    // update the tab info
    stateManagementStore[tabId] = tabNode.updateTabInfo(tabInfo)

    windowTabManagementStore[windowId] = stateManagementStore;
    // Save the object to local storage
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

function getParentNode(tabId) {
    // Get the node from the map
    let parentTabId = stateManagementStore[tabId]?.parentTab

    // returns parentTab
    // returns null if parentTabId is undefined
    return stateManagementStore[parentTabId]
}

function getCurrentPosition(nodeId) {
    // Get the node from the map
    // Return the position
    stateManagementStore[nodeId]?.position
}

// should update ancestors and siblings position (Children position should be relative to parent automatically)
function updatePositionOfNode(nodeId, newPosition) {
    // Get the node from the map
    // Update the position
    // Update the position of the ancestors
    // Update the position of the siblings
    // Save the object to local storage
}

// recursive calls to update all ancestors
// should be called after updating the position of the node
// Check if this is the right way to do it and if this is needed
function updatePositionOfAncestors(nodeId, nodePosition) {
    // Get the node from the map
    // Update the position of the all ancestors of the given node
}

function updatePositionOfSiblings(nodeId, nodePosition) {
    // Get the node from the map
    // Update the position of the all siblings of the given node
}
