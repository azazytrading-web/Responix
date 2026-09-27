document.addEventListener("DOMContentLoaded", () => {
    const closeBtn = document.getElementById("closeBtn");
    const manualMsg = document.getElementById("manual-msg");

    closeBtn.addEventListener("click", () => {
        window.close();
        setTimeout(() => {
            if (manualMsg) manualMsg.style.display = "block";
        }, 500);
    });
});
