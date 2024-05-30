document.addEventListener('DOMContentLoaded', async () => {
    const siteInput = document.getElementById('site');
    const addButton = document.getElementById('addButton');
    const whitelistDiv = document.getElementById('whitelist');
    const sliderContainer = document.getElementById('sliderContainer');
  
    let port = chrome.runtime.connect({ name: "popup-background" });
  
    siteInput.focus();
      const manifestData = chrome.runtime.getManifest();
      document.getElementById('version-number').textContent = manifestData.version;
  
    const { safeBrowsing = true } = await chrome.storage.sync.get('safeBrowsing');
  
    // Create and insert the slider dynamically with the correct initial state
    sliderContainer.innerHTML = `
      <label class="switch">
          <input type="checkbox" id="toggleSwitch" ${safeBrowsing ? 'checked' : ''}>
          <span class="slider round"></span>
      </label>
    `;
  
    const toggleSwitch = document.getElementById('toggleSwitch');
  
  try {
      const response = await fetch(chrome.runtime.getURL('fixed_whitelist.txt'));
      const lastModified = response.headers.get('last-modified');
      const lastModifiedDate = new Date(lastModified);
      document.getElementById('last-updated-date').textContent = lastModifiedDate.toLocaleDateString();
  } catch (error) {
      console.error('Could not fetch last modified date:', error);
  }
  
  async function updateWhitelist(site) {
      const { userWhitelist = [] } = await chrome.storage.sync.get('userWhitelist');
      if (!userWhitelist.includes(site)) {
          userWhitelist.push(site);
          await chrome.storage.sync.set({ userWhitelist });
      } else {
          showCustomAlert("Domain is already in the whitelist.");
      }
  }
  
  function showCustomAlert(message) {
      document.querySelector('.custom-alert-message').textContent = message;
      document.getElementById('custom-alert').style.display = "block";
  }
  
  document.querySelector('.custom-alert-close').addEventListener('click', () => {
      document.getElementById('custom-alert').style.display = "none";
  });
  
  document.querySelector('.custom-alert').addEventListener('click', () => {
      document.getElementById('custom-alert').style.display = "none";
  });
  
  document.querySelector('.custom-alert-content').addEventListener('click', (event) => {
      event.stopPropagation();
  });
  
  
  
      async function updateRules() {
          if (port.sender == null) {
              port = chrome.runtime.connect({ name: "popup-background" });
          }
          chrome.action.setIcon({
      path: {
          128: toggleSwitch.checked ? 'icons/icon_safe_128.png' : 'icons/icon_unsafe_128.png',
          256: toggleSwitch.checked ? 'icons/icon_safe_256.png' : 'icons/icon_unsafe_256.png',
          512: toggleSwitch.checked ? 'icons/icon_safe_512.png' : 'icons/icon_unsafe_512.png'
      }
  });
  
  
          port.postMessage({ command: "updateRules", safeBrowsing: toggleSwitch.checked });
      }
  
          function updateExportLinkVisibility() {
          const whitelist = document.getElementById('whitelist');
          const exportLink = document.getElementById('exportLink');
  
          if (whitelist.children.length > 0) {
              exportLink.style.display = 'block';
          } else {
              exportLink.style.display = 'none';
          }
      }
  
  function loadWhitelist() {
      chrome.storage.sync.get('userWhitelist', ({ userWhitelist = [] }) => {
          console.log('User Whitelist Loaded:', userWhitelist);
          whitelistDiv.innerHTML = '';
          if (userWhitelist.length > 0) {
              let title = document.createElement('div');
              title.innerText = "Additional whitelisted domains";
              title.style.fontSize = '14px';
              title.style.color = 'Black';
              title.style.marginBottom = '10px';
              title.style.marginTop = '15px';
              whitelistDiv.appendChild(title);
          }
          userWhitelist.forEach((site, index) => {
              let div = document.createElement('div');
              div.className = 'whitelist-item';
              div.innerHTML = `<span>${site}</span> <button class="remove-button" data-index="${index}" data-site="${site}">x</button>`;
              whitelistDiv.appendChild(div);
  
              // Add event listeners to highlight the text
              const removeButton = div.querySelector('.remove-button');
              const textSpan = div.querySelector('span');
              removeButton.addEventListener('mouseenter', () => {
                  textSpan.classList.add('highlight-text');
              });
              removeButton.addEventListener('mouseleave', () => {
                  textSpan.classList.remove('highlight-text');
              });
          });
          updateExportLinkVisibility();
      });
  }
  
  
  
  function exportWhitelist() {
      chrome.storage.sync.get('userWhitelist', ({ userWhitelist = [] }) => {
          const text = userWhitelist.join('\n');
          const blob = new Blob([text], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = 'whitelist.txt';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
      });
  }
  
  document.getElementById('exportLink').addEventListener('click', (event) => {
      event.preventDefault();
      exportWhitelist();
  });
  
      toggleSwitch.addEventListener('change', updateRules);
  
      addButton.addEventListener('click', async () => {
          const site = siteInput.value;
          await updateWhitelist(site);
          loadWhitelist();
          updateRules();
          siteInput.value = '';
          siteInput.focus();
      });
  document.getElementById('bulkWhitelistButton').addEventListener('click', () => {
      document.getElementById('bulkUpload').click();
  });
  
      document.getElementById('addCurrentDomainButton').addEventListener('click', async () => {
          chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
              const tabURL = tabs[0]?.url;
              if (tabURL) {
                  try {
                      const url = new URL(tabURL);
                      const site = url.hostname;
                      await updateWhitelist(site);
                      loadWhitelist();
                      updateRules();
                  } catch (e) {
                      console.error('Invalid URL:', tabURL, e);
                  }
              } else {
                  console.error('No active tab URL found');
              }
          });
      });
  
      document.getElementById('bulkUpload').addEventListener('change', async (event) => {
          const file = event.target.files[0];
          if (file) {
              const reader = new FileReader();
              reader.onload = async () => {
                  const sites = reader.result.split('\n').map(site => site.trim()).filter(site => site);
                  const { userWhitelist = [] } = await chrome.storage.sync.get('userWhitelist');
                  const newUserWhitelist = [...new Set([...userWhitelist, ...sites])];
                  await chrome.storage.sync.set({ userWhitelist: newUserWhitelist });
                  loadWhitelist();
                  updateRules();
              };
              reader.readAsText(file);
          }
      });
  
      whitelistDiv.addEventListener('click', async (e) => {
          if (e.target && e.target.matches('button.remove-button')) {
              const siteToRemove = e.target.getAttribute('data-site');
              const { userWhitelist = [] } = await chrome.storage.sync.get('userWhitelist');
              const newUserWhitelist = userWhitelist.filter(site => site !== siteToRemove);
              await chrome.storage.sync.set({ userWhitelist: newUserWhitelist });
              loadWhitelist();
              updateRules();
          }
      });
  
      port.onMessage.addListener((response) => {
          console.log(response.result);
      });
  
      window.addEventListener('unload', () => {
          port.disconnect();
      });
  
      loadWhitelist();
  
      siteInput.addEventListener('keyup', (e) => {
          if (e.key === 'Enter') {
              addButton.click();
          }
      });
  });