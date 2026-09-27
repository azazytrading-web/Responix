// Save data to chrome.storage.local
export function saveData(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export function loadData(keys) {
  return new Promise((resolve, reject) => {
    if (!keys) return reject("Key is undefined");
    chrome.storage.local.get(keys, result => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[keys]);
      }
    });
  });
}