function work() {
  let pageLinks = document.querySelectorAll("#list-chapter > ul > li");
  let lastPageLink = null;
  for (let i = pageLinks.length - 1; i >= 0; --i) {
    if (pageLinks[i].classList.length == 0) {
      lastPageLink = pageLinks[i];
      break;
    }
  }
  if (!lastPageLink) {
    console.log("Can't find last page link. Stopping..");
    return;
  }
  let lastPageUrl = lastPageLink.firstElementChild.href;
  let pagesCount = lastPageUrl.substring(
    lastPageUrl.lastIndexOf("trang-") + "trang-".length,
    lastPageUrl.lastIndexOf("/")
  );
  let prefix = lastPageUrl.substring(0, lastPageUrl.lastIndexOf("trang-"));
  chrome.runtime.sendMessage({ type: "start", pagesCount, prefix });
}
function extensionClickListener(tab) {
  let origin = new URL(tab.url).origin + "/*/*";
  chrome.permissions.request(
    {
      origins: [origin],
    },
    (granted) => {
      if (granted) {
        console.log("Origin permission granted");
        injectWorker(tab.id, work);
      }
    }
  );
}
async function createWindowTab(url) {
  return await chrome.windows.create({ url, width: 768, height: 768 });
}
async function closeWindowTab(windowId) {
  await chrome.windows.remove(windowId);
}
function injectWorker(tabId, worker, argsArray) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: worker,
    args: argsArray,
  });
}
function getLinks() {
  let t = setInterval(() => {
    let ctner = document.querySelector("#list-chapter");
    if (!ctner) {
      return;
    }
    if (!globalThis.locked) {
      globalThis.locked = true;
      clearInterval(t);
      let links = Array.from(
        document.querySelectorAll("ul.list-chapter > li > a")
      ).map((elm) => elm.href);
      chrome.runtime.sendMessage({ type: "worker", links });
    }
  }, 100);
}
function printLinks(links) {
  let div = document.createElement("div");
  div.style.position = "fixed";
  div.style.top = "0px";
  div.style.right = "0px";
  div.style.width = "200px";
  div.style.height = "200px";
  div.style.zIndex = 1000;
  document.body.appendChild(div);
  let tarea = document.createElement("textarea");
  div.appendChild(tarea);
  tarea.innerHTML = links.join("\n");
}
async function onTabMessageListener(request, sender, respond) {
  console.log("Received request: ", request, sender);
  if (request.type == "start") {
    let { pagesCount, prefix } = request;
    console.log(pagesCount, prefix);
    batchSize = 4;
    globalThis.initTab = sender.tab.id;
    globalThis.links = [];
    let tabsList = (globalThis.tabsList = {});
    for (let i = 1; i <= pagesCount; i += batchSize) {
      tasks = [];
      for (let j = i; j <= Math.min(i + batchSize - 1, pagesCount); ++j) {
        let wt = await createWindowTab(prefix + `/trang-${j}/`);
        let tab = wt.tabs[0];
        // injectWorker(tab.id,getLinks);
        let resolver = null;
        let p = new Promise(
          (res) =>
            (resolver = () => {
              closeWindowTab(wt.id);
              res();
            })
        );
        tabsList[tab.id] = { isDone: null, resolver };
        tasks.push(p);
      }
      await Promise.all(tasks);
    }
    console.log(globalThis.links[0], globalThis.links.length);
    injectWorker(globalThis.initTab, printLinks, [globalThis.links]);
  } else if (request.type == "worker") {
    globalThis.links.push(...request.links);
    let target = globalThis.tabsList[sender.tab.id];
    target.isDone = true;
    target.resolver();
  }
}
function onTabUpdatedListener(tabId, changeInfo, tab) {
  let tabsList = globalThis.tabsList;
  if (tabsList[tabId] && tabsList[tabId].isDone == null) {
    tabsList[tabId].isDone = false;
    injectWorker(tabId, getLinks);
  }
}
// REGISTERING EVENTS
chrome.action.onClicked.addListener(extensionClickListener);
chrome.tabs.onUpdated.addListener(onTabUpdatedListener);
chrome.runtime.onMessage.addListener(function (req, s, res) {
  if (s.tab) {
    onTabMessageListener(req, s, res);
  }
  return true;
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "linksCrawlerStart",
    title: "Crawl",
    contexts: ["all"],
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if ("linksCrawlerStart" === info.menuItemId) {
    extensionClickListener(tab);
  }
});
