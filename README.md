# edge-tree-style-tab-management
Tab management made easy for edge browser


#### **Known Bugs**
- [x] Removing parent tab removes the openerId, and it's overriding it in the state management service also
- [ ] Removing tab dom logic is not working properly (parents are getting incorrectly getting updated in the dom)
- [ ] Expand collapse button poppinp up even when no childIds

#### **Ideas to explore**
- have a copy of the sessions store in the local storage in which we store the old id of the tab or the window, for easy restoration (just before removing the tab or the window, store the old tab/window id to the session store)