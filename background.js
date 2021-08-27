function work(){
    let pageLinks = document.querySelectorAll('#list-chapter > ul > li');
    let lastPageLink = null;
    for(let i = pageLinks.length-1; i>=0; --i){
        if(pageLinks[i].classList.length==0){
            lastPageLink = pageLinks[i];
            break;
        }
    }
    if(!lastPageLink){
        console.log("Can't find last page link. Stopping..");
        return;
    }
    let lastPageUrl = lastPageLink.firstElementChild.href;
    let pagesCount = lastPageUrl.substring(lastPageUrl.lastIndexOf('trang-')+'trang-'.length,lastPageUrl.lastIndexOf('/'));
    let prefix = lastPageUrl.substring(0,lastPageUrl.lastIndexOf('trang-'));
    chrome.runtime.sendMessage({pagesCount,prefix});

}
function extensionClickListener(tab){
    let origin = new URL(tab.url).origin+'/*/*';
    chrome.permissions.request({
        origins: [origin]
      }, (granted) => {
        if (granted) {
            console.log('Origin permission granted');
            chrome.scripting.executeScript({
                target: {tabId: tab.id},
                func:work
            });
        }
      });
}
async function createWindowTab(url){
    return await chrome.windows.create({url,'width':768,'height':768});
}
async function closeWindowTab(windowId){
    await chrome.windows.remove(windowId);
}
function onTabMessageListener(request, sender, respond){
    let {pagesCount,prefix} = request;
    console.log(pagesCount,prefix);
}
// REGISTERING EVENTS
chrome.action.onClicked.addListener(extensionClickListener);
chrome.runtime.onMessage.addListener(function(req,s,res){
    if(s.tab){
        onTabMessageListener(req,s,res);
    }
    return true;
});