// Tab structure
class Tab {
    // id: unique id of the tab
    // url: url of the tab
    // parentTabId: id of the parent tab
    // childTabIds: ids of the children tabs
    // position: position of the tab
    // isCollapsed: is the tab collapsed or not

    // TODO might need to add more properties as per need
    constructor(id, url, parentTabId = null, parentTabUrl = null, childrenTabIds = [], position, isCollapsed = true) {
        // use url as id, as Tab id changes between sessions (window open and close)
        this.id = id;
        this.url = url;
        this.parentTabId = parentTabId;
        this.parentTabUrl = parentTabUrl;
        this.childTabIds = childrenTabIds;
        this.position = position;
        this.isCollapsed = isCollapsed;
        this.key = this.hashCode(`${this.url}~${this.position}`);
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

    getKey() {
        return this.key || this.hashCode(`${this.url}~${this.position}`);
    }
}

// To store in local storage with window id (Double check for something that won't get changed) as key and value as the state management store
let windowTabManagementStore = {};

/*
TODO: finalize the key for both the stores
Case that needs to be handled: window restore, url changes, tab move

In background.js, add listener for expand/collapse of tabs and call updateCollapsedState(windowId, tabId, isCollapsed)

Sample data structure:

windowTabManagementStore = {
    windowId: stateManagementStore
}

stateManagementStore = {
    tabId: tabNode(id, url, parentTabId, childrenTabIds, position, isCollapsed)
}
*/

// Create a window tab management hash table and save it to local storage when the extension is installed
export function createWindowManagementStore(tabs) {
    // Create nodes from browser tabs information
    let stateManagementStore = {};
    tabs.forEach((tab) => {
        stateManagementStore = windowTabManagementStore[tab.windowId] || {};
        // update the tab with the updated information in cases where the tab is already present in the map
        let tabUrl = tab.status === 'complete' ? tab.url : tab.pendingUrl;
        // find opener tab url from the openerTabId, as the opener tab url is not available in the tab object
        // we only need to search for tabs in the same window
        let openerTab = tab.openerTabId ? Object.values(stateManagementStore).find(t => t.id === tab.openerTabId) : null;
        let tabNode = new Tab(tab.id, tabUrl, tab.openerTabId, openerTab?.url, [], tab.index);
        stateManagementStore[tabNode.getKey()] = tabNode.updateTab(stateManagementStore[tabUrl])
        
        // update the parent tab with the child tab id
        // updated with children tab id, incase any existing children it'll append to the existing children
        // Assumption: parentTab is present in the stateManagementStore
        if (tab.openerTabId) {
            let parentTab = new Tab(tab.openerTabId, openerTab?.url, null, null, [tab.id], openerTab?.position);
            stateManagementStore[parentTab.getKey()] = parentTab.updateTab(stateManagementStore[parentTab.getKey()]);
        }
        windowTabManagementStore[tab.windowId] = stateManagementStore;
    });

    console.log("#createWindowManagementStore - window tab management store is created", windowTabManagementStore);
    chrome.storage.local.set({ windowTabManagementStore });
}

// add Tab to the state management store
export function addTabToStateManagementStore(windowId, tab) {
    // Create and Add the node to the map
    let stateManagementStore = windowTabManagementStore[windowId] || {};
    let tabUrl = tab.status === 'complete' ? tab.url : tab.pendingUrl;
    // find opener tab from the openerTabId, as the opener tab url is not available in the tab object
    let openerTab = tab.openerTabId ? Object.values(stateManagementStore).find(t => t.id === tab.openerTabId) : null;
    let tabNode = new Tab(tab.id, tabUrl, tab.openerTabId, openerTab?.url, [], tab.index);
    stateManagementStore[tabNode.getKey()] = tabNode;

    // update the position of the node
    // WIP
    
    // update the parent tab with the child tab id
    // Expand the parent tab when new tab is added from existing tab
    if (tab.openerTabId) {
        let parentTab = new Tab(tab.openerTabId, openerTab?.url, null, null, [tab.id], openerTab?.position, false);
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
    if (!tabNode.childTabIds) {
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

export function updateCollapsedState(windowId, tabId, isCollapsed) {
    let stateManagementStore = windowTabManagementStore[windowId] || {};
    // Get the node from the map
    let tabNode = stateManagementStore[tabId]
    if (!tabNode) return

    // update the collapsed state
    tabNode.isCollapsed = isCollapsed

    windowTabManagementStore[windowId] = stateManagementStore;
    // Save the object to local storage
    chrome.storage.local.set({ windowTabManagementStore });
}

function getParentNode(tabId) {
    // Get the node from the map
    let parentTabId = stateManagementStore[tabId]?.parentTab

    // returns parentTab 
    // returns null if parentTabId is undefined
    return stateManagementStore[parentTabId]
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



