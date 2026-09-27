const util=require("../content/util.js")["util"];function chromeGetMessage(e,t){return null==t||isNaN(t)||(t+=""),chrome.i18n.getMessage(e,t)}function getMessage(e,t){if(e){if("undefined"!=typeof localeMessages&&null!=localeMessages){var a=localeMessages[e];if(a){var s=(s=a.message)&&s.replace(/\$\$/g,"$");if(null!=t)if(t instanceof Array)for(var l=0;l<t.length;l++)s=s.replace("$"+(l+1),t[l]);else s=s.replace("$1",t);return s}}return chromeGetMessage(e,t)}}function delElement(e){let t=!0;var a;return e&&(a=e.parentNode,t=!!a&&a.removeChild(e)===e),t}exports.onSaved=e=>{let t=document.createElement("div");t.className="noSaved",t.setAttribute("id","noSaved"),document.body.appendChild(t),t.style=`
        position: fixed;top:0px;right: 0px;z-index: 2147483647;background: rgba(77, 86, 112, .6);border-radius: 6px;
        padding: 8px 16px;
        min-height: 40px;
        text-align: left;
        display: flex;
        align-items: center;
        justify-content: flex-start;
    `,0==e?t.innerHTML=`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" >
  <g id="ico_bottom_error" transform="translate(-1458 -604)">
    <circle cx="9.5" cy="9.5" r="9.5" transform="translate(1461 607)" fill="#ffac30"/>
    <path id="ico_bottom_error-2" data-name="ico_bottom_error" d="M75.3,63.3a12,12,0,1,0,12,12A12.034,12.034,0,0,0,75.3,63.3Zm5.734,16.134a1.127,1.127,0,0,1,0,1.533,1.1,1.1,0,0,1-.8.334,1.227,1.227,0,0,1-.8-.334L75.567,77.1,71.7,80.967a1.084,1.084,0,0,1-1.533-1.533l3.866-3.866L70.168,71.7a1.1,1.1,0,0,1-.334-.8,1.227,1.227,0,0,1,.334-.8,1.127,1.127,0,0,1,1.533,0l3.866,3.866L79.434,70.1a1.1,1.1,0,0,1,.8-.334,1.227,1.227,0,0,1,.8.334,1.1,1.1,0,0,1,.334.8,1.227,1.227,0,0,1-.334.8l-3.866,3.866Z" transform="translate(1394.7 540.7)" fill="#fff"/>
  </g>
</svg>

			<span id="noSavedSpan"  style="font-size: 14px; line-height: 20px;color: #fff; padding-left: 8px;">${getMessage("updateFailed")}</span>
        `:1==e?t.innerHTML=`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <g id="ico_bottom_successful" transform="translate(-44 -579)">
    <rect width="24" height="24" transform="translate(44 579)" fill="#fff" opacity="0"/>
    <rect width="16" height="14" transform="translate(48 584)" fill="#08c145"/>
    <path d="M107.328,111.368l-2.121-2.121a1.5,1.5,0,0,0-2.119,2.121l2.121,2.121,1.061,1.061a1.5,1.5,0,0,0,2.121,0l6.361-6.361a1.5,1.5,0,0,0-2.121-2.121Zm1.569,10.824a12,12,0,1,1,12-12A12,12,0,0,1,108.9,122.192Z" transform="translate(-52.895 480.8)" fill="#fff"/>
  </g>
</svg>
			<span id="noSavedSpan"  style="font-size: 14px; line-height: 20px;color: #fff; padding-left: 8px;">${getMessage("updateSuccessfully")}</span>
        `:2==e?t.innerHTML=`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <g id="ico_bottom_successful" transform="translate(-44 -579)">
    <rect width="24" height="24" transform="translate(44 579)" fill="#fff" opacity="0"/>
    <rect width="16" height="14" transform="translate(48 584)" fill="#08c145"/>
    <path d="M107.328,111.368l-2.121-2.121a1.5,1.5,0,0,0-2.119,2.121l2.121,2.121,1.061,1.061a1.5,1.5,0,0,0,2.121,0l6.361-6.361a1.5,1.5,0,0,0-2.121-2.121Zm1.569,10.824a12,12,0,1,1,12-12A12,12,0,0,1,108.9,122.192Z" transform="translate(-52.895 480.8)" fill="#fff"/>
  </g>
</svg>
			<span id="noSavedSpan"  style="font-size: 14px; line-height: 20px;color: #fff; padding-left: 8px;">${getMessage("savedSuccessfully")}</span>
        `:11==e?t.innerHTML=`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <g id="ico_bottom_successful" transform="translate(-44 -579)">
    <rect width="24" height="24" transform="translate(44 579)" fill="#fff" opacity="0"/>
    <rect width="16" height="14" transform="translate(48 584)" fill="#08c145"/>
    <path d="M107.328,111.368l-2.121-2.121a1.5,1.5,0,0,0-2.119,2.121l2.121,2.121,1.061,1.061a1.5,1.5,0,0,0,2.121,0l6.361-6.361a1.5,1.5,0,0,0-2.121-2.121Zm1.569,10.824a12,12,0,1,1,12-12A12,12,0,0,1,108.9,122.192Z" transform="translate(-52.895 480.8)" fill="#fff"/>
  </g>
</svg>
			<span id="noSavedSpan"  style="font-size: 14px; line-height: 20px;color: #fff; padding-left: 8px;">${getMessage("deletedSuccessfully")}</span>
        `:12==e&&(t.innerHTML=`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" >
  <g id="ico_bottom_error" transform="translate(-1458 -604)">
    <circle cx="9.5" cy="9.5" r="9.5" transform="translate(1461 607)" fill="#ffac30"/>
    <path id="ico_bottom_error-2" data-name="ico_bottom_error" d="M75.3,63.3a12,12,0,1,0,12,12A12.034,12.034,0,0,0,75.3,63.3Zm5.734,16.134a1.127,1.127,0,0,1,0,1.533,1.1,1.1,0,0,1-.8.334,1.227,1.227,0,0,1-.8-.334L75.567,77.1,71.7,80.967a1.084,1.084,0,0,1-1.533-1.533l3.866-3.866L70.168,71.7a1.1,1.1,0,0,1-.334-.8,1.227,1.227,0,0,1,.334-.8,1.127,1.127,0,0,1,1.533,0l3.866,3.866L79.434,70.1a1.1,1.1,0,0,1,.8-.334,1.227,1.227,0,0,1,.8.334,1.1,1.1,0,0,1,.334.8,1.227,1.227,0,0,1-.334.8l-3.866,3.866Z" transform="translate(1394.7 540.7)" fill="#fff"/>
  </g>
</svg>

			<span id="noSavedSpan"  style="font-size: 14px; line-height: 20px;color: #fff; padding-left: 8px;">${getMessage("failedToDelete")}</span>
        `),setTimeout(()=>{delElement(t)},3e3)},exports.createQrIcon=(e,t=100)=>{t-=50;let a=util.createElement("div","DualSafe-Icon-QRCode DualSafe-element",{});function s(e){return a.querySelector("#"+e)}return a.innerHTML=`
        <img alt="dpm" class = "DualSafe-qr-icon" id="${e}">
        <p style="max-width:${t}px" class = "DualSafe-qr-p" >${getMessage("add_to_onetime_pwd")}</p>
        <span id="closeBtn_posi" class = "DualSafe-qr-closebtn closeBtn_posi"></span>
    `,a.showCloseBtn=function(e,t){s("closeBtn_posi").style.left=util.Px(e-12),s("closeBtn_posi").style.top=util.Px(-12)},a.CloseBtnOn=function(e){s("closeBtn_posi").onclick=e},a},self.onpreomotion=exports.onpreomotion=(e,t,a)=>{let s=util.createElement("div","DualSafe__purchase",{});document.body.appendChild(s);let l="",n="",i="",r="";switch(n=getMessage(1==e?"updateSuccessfully":"savedSuccessfully"),t){case 1:l=chrome.runtime.getURL("inject/images/data_breaches_pic.png"),i=getMessage("No_Worries_Title"),r=getMessage("No_Worries_Desc");break;case 2:l=chrome.runtime.getURL("inject/images/keep_safe_pic.png"),i=getMessage("Keep_Safe_Title"),r=getMessage("Keep_Safe_Desc");break;case 3:l=chrome.runtime.getURL("inject/images/emergency_pic.png"),i=getMessage("Emergency_Title"),r=getMessage("Emergency_Desc");break;case 4:l=chrome.runtime.getURL("inject/images/unlimited_pic.png"),i=getMessage("Unlimited_Title"),r=getMessage("Unlimited_Desc")}s.innerHTML=`
        <div class="DualSafe__purchase_content">
            <div class="DualSafe__purchase_header">
                <h5 class="DualSafe__purchase_title">${n}</h5>
                <button type="button" class="button-css DualSafe__purchase_close" title="${getMessage("Close")}"></button>
            </div>
            <div class="DualSafe__purchase_body">
                <div class="DualSafe__purchase_pic">
                    <img src="${l}" width="74" height="74" alt="DualSafe__purchase">
                </div>
                <div class="DualSafe__purchase_cont">
                    <h3 class="DualSafe__purchase_name">${i}</h3>
                    <p class="DualSafe__purchase_desc">${r}</p>
                </div>
            </div>
            <div class="DualSafe__purchase_footer">
                <button type="button" class="button-css button-link DualSafe__purchase_thank">${getMessage("No_thanks")}</button>
                <button type="button" class="button-css DualSafe__purchase_enable">${getMessage("Enable_Now")}</button>
            </div>
        </div>
    `,document.querySelector(".DualSafe__purchase_thank").addEventListener("click",()=>{delElement(s),a.onNoThanks()}),document.querySelector(".DualSafe__purchase_enable").addEventListener("click",()=>{delElement(s),a.onUpgrand()}),document.querySelector(".DualSafe__purchase_close").addEventListener("click",()=>{delElement(s),a.onXX()})};