chrome.runtime.onInstalled.addListener(async () => {
    try {
        const response = await fetch(chrome.runtime.getURL('fixed_whitelist.txt'));
        const text = await response.text();
        const fixedWhitelist = text.split('\n').map(site => site.trim()).filter(site => site);
        await chrome.storage.local.set({ fixedWhitelist });
        console.log('Fixed Whitelist Initialized:', fixedWhitelist);
    } catch (error) {
        console.error('Error initializing fixed whitelist:', error);
    }

    try {
        await chrome.storage.sync.set({ userWhitelist: [], safeBrowsing: true });
        console.log('User Whitelist Initialized:', []);
    } catch (error) {
        console.error('Error initializing user whitelist:', error);
    }

    await updateRules();
});

function formatUrl(url) {
    try {
        let newUrl = new URL(url.includes('://') ? url : 'http://' + url);
        let domainParts = newUrl.hostname.split('.');
        let mainDomain = domainParts.length > 1 ? domainParts.slice(-2).join('.') : newUrl.hostname;
        return [`*://${mainDomain}/*`, `*://*.${mainDomain}/*`];
    } catch (error) {
        console.error('Error formatting URL:', url, error);
        return [];
    }
}

async function updateRules() {
    try {
        const { fixedWhitelist = [] } = await chrome.storage.local.get('fixedWhitelist');
        const { userWhitelist = [] } = await chrome.storage.sync.get('userWhitelist');
        const { safeBrowsing = true } = await chrome.storage.sync.get('safeBrowsing');

        console.log('Fixed Whitelist from storage:', fixedWhitelist);
        console.log('User Whitelist from storage:', userWhitelist);

        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: Array.from({ length: 10000 }, (_, i) => i + 1) });

        if (safeBrowsing) {
            const activeWhitelist = [...new Set([...fixedWhitelist, ...userWhitelist].flatMap(formatUrl).filter(Boolean))];
            console.log('Active Whitelist after formatting:', activeWhitelist);

            const rules = activeWhitelist.map((site, index) => ({
                id: index + 1,
                priority: 1,
                action: { type: 'allow' },
                condition: { urlFilter: site, resourceTypes: ['main_frame'] }
            }));

            rules.push({
                id: 10000,
                priority: 1,
                action: { type: 'block' },
                condition: { urlFilter: '*', resourceTypes: ['main_frame'] }
            });

            console.log('Rules to be applied:', rules);
            await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
        } else {
            // Allow all requests when unrestricted mode is on
            await chrome.declarativeNetRequest.updateDynamicRules({ 
                addRules: [
                    {
                        id: 1,
                        priority: 1,
                        action: { type: 'allow' },
                        condition: { urlFilter: '*', resourceTypes: ['main_frame'] }
                    }
                ]
            });
        }

        console.log('Rules updated successfully');
    } catch (error) {
        console.error('Error updating rules:', error);
    }
}




chrome.runtime.onConnect.addListener((port) => {
    console.assert(port.name === "popup-background");

    port.onMessage.addListener((msg) => {
        if (msg.command === "updateRules") {
            chrome.storage.sync.set({ safeBrowsing: msg.safeBrowsing }, () => {
                updateRules().then(() => {
                    port.postMessage({ result: "success" });
                }).catch(error => {
                    console.error("Error updating rules:", error);
                    port.postMessage({ result: "error", error });
                });
            });
        }
    });
});