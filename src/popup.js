const enabledHostnames = new EnabledHostnamesList();
const linuxWindowsSpoofList = new LinuxWindowsSpoofList();

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length < 1) {
    throw new Error("could not get active tab");
  }

  return tabs[0];
}

async function updateUiState() {
  const activeTab = await getActiveTab();
  const currentUrl = new URL(activeTab.url);
  const currentProtocol = currentUrl.protocol;
  const currentHostname = currentUrl.hostname;
  const maskStatus = document.getElementById("maskStatus");
  const fancyContainer = document.querySelector("section.fancy_toggle_container");
  const checkbox = document.getElementById("mask_enabled");
  const linuxPlatformInfo = document.getElementById("linuxPlatformInfo");
  const webcompatLink = document.createElement("a");
  const supportMessage = document.getElementById("supportMessage");
  const breakageWarning = document.getElementById("breakageWarning");
  const reportBrokenSite = document.getElementById("reportBrokenSite");

  // Use unified platform info helper - reduces code duplication
  const platformInfo = await PlatformInfoHelper.getPlatformInfoWithRetry();

  // Get shared tooltip message from i18n
  const toggleDescription = chrome.i18n.getMessage("mainToggleDescription");

  // Show Linux platform info if on Linux
  if (platformInfo && platformInfo.actualPlatform === "linux") {
    linuxPlatformInfo.style.display = "block";

    const managePlatformLink = document.getElementById("managePlatformLink");
    const linuxToggleCheckbox = document.getElementById("linux_mask_enabled");
    const linuxToggleDescriptionText = document.getElementById("linuxToggleDescriptionText");

    // Set the state of the Linux/Windows toggle based on the spoof list.
    if (linuxToggleCheckbox) {
      linuxToggleCheckbox.checked = linuxWindowsSpoofList.contains(currentHostname);
    }

    // Set the tooltip text for the Linux toggle.
    if (linuxToggleDescriptionText) {
      linuxToggleDescriptionText.innerText = toggleDescription;
    }

    // Set the text for the manage platform link and add click handler
    if (managePlatformLink) {
      managePlatformLink.innerText = chrome.i18n.getMessage("managePlatformLinkText");
      managePlatformLink.addEventListener("click", async (e) => {
        e.preventDefault();
        await chrome.runtime.openOptionsPage();
      });
    }
  } else {
    linuxPlatformInfo.style.display = "none";
  }

  if (currentProtocol == "chrome-extension:" || currentHostname == "") {
    maskStatus.innerText = chrome.i18n.getMessage("maskStatusUnsupported");
    fancyContainer.style.display = "none";
  } else if (enabledHostnames.contains(currentHostname)) {
    maskStatus.innerText = chrome.i18n.getMessage("maskStatusOn");
    checkbox.checked = true;
  } else {
    maskStatus.innerText = chrome.i18n.getMessage("maskStatusOff");
    checkbox.checked = false;
  }

  // Update main toggle tooltip text
  const mainToggleDescriptionText = document.getElementById("mainToggleDescriptionText");
  if (mainToggleDescriptionText) {
    mainToggleDescriptionText.innerText = toggleDescription;
  }

  webcompatLink.href = linkWithSearch("https://webcompat.com/issues/new", [["url", activeTab.url]]);
  webcompatLink.innerText = chrome.i18n.getMessage("webcompatLinkText");

  // Create support link
  const supportLink = document.createElement("a");
  supportLink.href = "https://github.com/mr-september/chrome-mask-for-opera#readme";
  supportLink.innerText = "supporting its development";
  supportLink.target = "_blank";

  supportMessage.innerHTML = chrome.i18n.getMessage("supportMessage", [supportLink.outerHTML]);

  breakageWarning.innerText = chrome.i18n.getMessage("breakageWarning");

  reportBrokenSite.innerHTML = chrome.i18n.getMessage("reportBrokenSite", [webcompatLink.outerHTML]);

  // On Android, opening the options page programmatically has limitations,
  // so we display a fallback text for Android users.
  const platformInfoRuntime = await chrome.runtime.getPlatformInfo();
  if (platformInfoRuntime.os == "android") {
    document.getElementById("manageSites").style.display = "none";
    document.getElementById("manageSitesFallbackText").innerText = chrome.i18n.getMessage("manageSitesFallback");
    document.getElementById("manageSitesFallback").style.display = "block";
  } else {
    const manageSitesButton = document.getElementById("manageSitesButton");
    manageSitesButton.innerText = chrome.i18n.getMessage("manageSitesButton");
    manageSitesButton.addEventListener("click", async () => {
      await chrome.runtime.openOptionsPage();
    });
  }
}

function linkWithSearch(base, searchParamsInit) {
  const url = new URL(base);
  const searchParams = new URLSearchParams(searchParamsInit);
  url.search = searchParams.toString();
  return url.toString();
}

document.addEventListener("DOMContentLoaded", async () => {
  await enabledHostnames.load();
  await linuxWindowsSpoofList.load();
  await updateUiState();

  document.getElementById("mask_enabled").addEventListener("change", async (ev) => {
    const activeTab = await getActiveTab();
    const currentHostname = new URL(activeTab.url).hostname;

    if (!currentHostname) {
      ev.target.checked = false;
      return;
    }

    if (ev.target.checked) {
      await enabledHostnames.add(currentHostname);
    } else {
      await enabledHostnames.remove(currentHostname);
    }

    await updateUiState();
  });

  // Linux/Windows toggle event
  const linuxToggleCheckbox = document.getElementById("linux_mask_enabled");
  if (linuxToggleCheckbox) {
    linuxToggleCheckbox.addEventListener("change", async () => {
      const activeTab = await getActiveTab();
      const currentHostname = new URL(activeTab.url).hostname;

      if (linuxToggleCheckbox.checked) {
        // Add to spoof list if not present
        if (!linuxWindowsSpoofList.contains(currentHostname)) {
          await linuxWindowsSpoofList.add(currentHostname);
        }
      } else {
        // Remove from spoof list if present
        if (linuxWindowsSpoofList.contains(currentHostname)) {
          await linuxWindowsSpoofList.remove(currentHostname);
        }
      }
      await updateUiState();
    });
  }
});
