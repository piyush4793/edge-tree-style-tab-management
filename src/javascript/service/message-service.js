// recieve message from popup

export function tabUpdateMessageHandler(tabUpdateCallback) {
  chrome.runtime.onMessage.addListener((request) => {
    console.log("message recieved", request);
    
    switch (request.type) {
      case "updateTab":
        tabUpdateCallback(request.windowId, request.tabId, request.changeInfo);
        console.log('tab updated', request.tabId)
        break;
      default:
        console.log("unknown message type", request.type);
    }
  });
}
