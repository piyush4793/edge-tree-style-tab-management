// recieve message from popup

export function tabUpdateMessageHandler(tabUpdateCallback) {
  chrome.runtime.onMessage.addListener((request, sender) => {
    console.log("message recieved", request, sender);
    
    switch (request.type) {
      case "updateTab":
        tabUpdateCallback(request.windowId, request.tabId, request.changeInfo);
        break;
      default:
        console.log("unknown message type", request.type);
    }
  });
}
