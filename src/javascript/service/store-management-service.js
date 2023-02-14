// Node
class Node {
    constructor(id, parentNode, children, position) {
        this.id = id;
        this.parentNode = parentNode;
        this.children = children;
        this.position = position;
    }
}

stateManagementStore = {} // Check if this is the right way to create a global variable
// Create a state management hash table and save it to local storage
createStateManagementStore = () => {
    // Create nodes from browser tabs information
    // Create a map of nodes, id -> node
    // Save the map to local storage
}

getParentNode = (nodeId) => {
    // Get the node from the map
    // Return the parent node
    stateManagementStore[nodeId]?.parentNode
}

getChildrenNodes = (nodeId) => {
    // Get the node from the map
    // Return the children nodes
    stateManagementStore[nodeId]?.children
}

getCurrentPosition = (nodeId) => {
    // Get the node from the map
    // Return the position
    stateManagementStore[nodeId]?.position
}

// should update ancestors and siblings position (Children position should be relative to parent automatically)
updatePositionOfNode = (nodeId, newPosition) => {
    // Get the node from the map
    // Update the position
    // Update the position of the ancestors
    // Update the position of the siblings
    // Save the map to local storage
}

// recursive calls to update all ancestors
// should be called after updating the position of the node
// Check if this is the right way to do it and if this is needed
UpdatePositionOfAncestors = (nodeId, nodePosition) => {
    // Get the node from the map
    // Update the position of the all ancestors of the given node
}

UpdatePositionOfSiblings = (nodeId, nodePosition) => {
    // Get the node from the map
    // Update the position of the all siblings of the given node
}



