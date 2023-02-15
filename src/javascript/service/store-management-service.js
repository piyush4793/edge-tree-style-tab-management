// Tab structure
class Tab {
    // id: unique id of the tab
    // parentTabId: id of the parent tab
    // childTabIds: ids of the children tabs
    // position: position of the tab

    // TODO might need to add more properties as per need
    constructor(id, parentTabId = null, childrenTabIds = [], position) {
        // use url as id, as Tab id changes between sessions (window open and close)
        this.id = id;
        this.parentTabId = parentTabId;
        this.childTabIds = childrenTabIds;
        this.position = position;
    }

    // used to update the tab information only when there is a change
    updateTab(tab) {
        if(!tab) return this;

        this.id = this.id || tab?.id;
        this.parentTabId = this.parentTabId || tab?.parentTabId;
        this.childTabIds = [...this.childTabIds, ...tab?.childTabIds];
        this.position = this.position || tab?.position;
    }
}

// State management store for the tab tree
let stateManagementStore = {} 

// Create a state management hash table and save it to local storage when the extension is installed
export function createStateManagementStore(tabs) {
    // Create nodes from browser tabs information
    // Create a map of Tabs, id -> Tab
    tabs.forEach((tab) => {
        // update the tab with the updated information in cases where the tab is already present in the map
        var tabNode = new Tab(tab.id, tab.openerTabId, [], tab.index);
        stateManagementStore[tab.id] = tabNode.updateTab(stateManagementStore[tab.id])
        
        // update the parent tab with the child tab id
        // updated with children tab id, incase any existing children it'll append to the existing children
        if (tab.openerTabId) {
            var parentTab = new Tab(tab.openerTabId, null, [tab.id], null);
            stateManagementStore[tab.openerTabId] = parentTab.updateTab(stateManagementStore[tab.openerTabId])
        }
    });

    console.log(stateManagementStore);
    chrome.storage.local.set({ stateManagementStore });
}

// add Tab to the state management store
export function addTabToStateManagementStore(tab) {
    // Create and Add the node to the map
    // update the position of the node
    // update the parent tab with the child tab id
    // Save the map to local storage

    // Create and Add the node to the map
    stateManagementStore[tab.id] = new Tab(tab.id, tab.openerTabId, [], tab.index);

    // update the position of the node
    // WIP
    
    // update the parent tab with the child tab id
    if (tab.openerTabId) {
        var parentTab = new Tab(tab.openerTabId, null, [tab.id], null);
        stateManagementStore[tab.openerTabId] = parentTab.updateTab(stateManagementStore[tab.openerTabId])
    }
    chrome.storage.local.set({ stateManagementStore });
}

// remove Tab from the state management store
export function removeTabFromStateManagementStore(tabId, withChildren = false) {
    // Get the node from the map
    // Remove the node from the parent node
    // update children nodes with the new parent and position
    // in case of withChildren = true, remove all the children nodes for that node recursively
    // Remove the node from the map

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
        deleteTree(tabNode)
    }

    chrome.storage.local.set({ stateManagementStore });
}

function deleteTree(tab) {
    // base case
    if (!tab?.id) return
    
    // Remove the node from the parent node
    // this will only exist for the root node
    if(stateManagementStore[tab.id]?.openerTabId) {
        var parentTab = stateManagementStore[tab.openerTabId]
        parentTab.childTabIds = parentTab.childTabIds.filter((childId) => childId !== tab.id)
    }
    delete stateManagementStore[tab.id]
    
    let children = getChildrenNodes(tab.id)
    // terminate the recursion
    if (children.length) return

    children.forEach((child) => {
        deleteTree(child)
    })
}

function getParentNode(tabId) {
    // Get the node from the map
    let parentTabId = stateManagementStore[tabId]?.parentTab

    // returns parentTab 
    // returns null if parentTabId is undefined
    return stateManagementStore[parentTabId]
}

function getChildrenNodes(nodeId) {
    // Get the node from the map
    // Return the children nodes
    let childrenIds = stateManagementStore[nodeId]?.childTabIds
    
    if (!childrenIds) return null
    
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
    // Save the map to local storage
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



