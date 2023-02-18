/*
TODO:
  - Adjust the overflow of the button in the child tabs
  - Add the functionality to expand and collapse the child tabs (need a reconstruct and destroy tree function)
  - tab on click to focus the tab to active tab
  - Add the functionality to close the tabs (partially done, need to reconstruct the associated tree)
  - send update tree (expand collapse) to the background script
  - get the updated tree from the background script (regeneration)

  
  - port this to react to make the state management easier (maybe)
*/

chrome.storage.local.get('windowTabManagementStore').then((store) => {
  chrome.windows.getCurrent((window) => {
    let sms = store.windowTabManagementStore[window.id]
    
    // array containing the tabs sorted by it's position in the sms storage for current window
    // sort the values of sms object by position and store it in sortedSms array
    let sortedSms = Object.values(sms).sort((a, b) => a.position - b.position)
    console.log(sortedSms)

    generateTabTree(sortedSms, sms);
    
  })
})

function generateTabTree(sortedSms, sms) {
  // create a html element for each tab in the sortedSms array
  let popup = document.getElementById('tabs-container')
  sortedSms.forEach((tab) => {
    let tabElement = createTabElement(tab, sms)
    popup.appendChild(tabElement)
  })
}


function createTabElement(tab, sms, level = 0) {
  //  tab should have the following structure
  //  tab (tC)
  //    - tabElement (tE)
  //      - expand collapse buttom
  //      - tab title text
  //      - close button
  //    - tC (child tab if exists)
  
  // if the tab is already added to the dom, skip creation
  if (document.getElementById(`${tab.id}`)) return;

  let tC = document.createElement('div')
  tC.classList.add('tab-container')
  // add current tab to the tab container
  let tE = createTabElementStructure(tab, level)
  tC.appendChild(tE)

  // add child tabs to the tab container recursively
  if (tab.childTabIds.length > 0 && !tab.isCollapsed) {
    tab.childTabIds.forEach((childTabId) => {
      console.log(sms, childTabId);
      let childTab = createTabElement(sms[parseInt(childTabId)], sms, level + 1);
      tC.appendChild(childTab)
    })
  }

  return tC
}

function createTabElementStructure(tab, level) {
  let tabElement = document.createElement('div')
  tabElement.classList.add('tab-element')
  tabElement.id = tab.id

  if (tab.childTabIds.length > 0) { 
    console.log('child tab exists', tab)
    let expandCollapseButton = document.createElement('button')
    // add on click to expand collapse button
    expandCollapseButton.onclick = (e) => onclickExpandCollapseButton(e)
    expandCollapseButton.classList.add('expand-collapse-button')
    expandCollapseButton.innerText = tab.collapsed ? '►' : '▼'
    tabElement.appendChild(expandCollapseButton)
  }
  else {
    tabElement.classList.add('no-child')
  }

  let tabTitle = document.createElement('span')
  tabTitle.classList.add('tab-title')
  tabTitle.innerText = tab.title
  tabElement.appendChild(tabTitle)

  let tabButton = document.createElement('button')
  // add on click to close button
  tabButton.onclick = (e) => onclickCloseButton(e)
  tabButton.classList.add('close-button')
  tabButton.innerText = 'x'
  tabElement.appendChild(tabButton)

  // add padding to the tab element based on the level

  return tabElement
}

function onclickExpandCollapseButton(event) {
  event.target.innerText = event.target.innerText === '►' ? '▼' : '►'
  // add the expanded child here
}

function onclickCloseButton(event) {
  // close the tab here
  try {
    // this will trigger a tree closed event in the background script
    chrome.tabs.remove(parseInt(event.target.parentNode.id));

    event.target.parentNode.remove();
    // redraw the tab parent element to adjust the padding
  }
  catch (e) {
    console.log('tab removal failed', e)
  }
}