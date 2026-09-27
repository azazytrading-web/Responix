let audio = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "playAudio") {
        if (!audio) {
            audio = new Audio(chrome.runtime.getURL(message.sound));
            audio.volume = message.volume ?? 1;
        }
        audio.play();
        sendResponse({ success: true });
    } else if (message.type === "pauseAudio") {
        if (audio) {
            audio.pause();
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: "No audio to pause" });
        }
    } else if (message.type === "hasAudio") {
        sendResponse({ exists: audio !== null });
    }
    return true; // keep sendResponse async
});