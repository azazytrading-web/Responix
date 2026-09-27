function chromeGetMessage(e,t){return null==t||isNaN(t)||(t+=""),chrome.i18n.getMessage(e,t)}function getMessage(e,t){if(e){if("undefined"!=typeof localeMessages&&null!=localeMessages){var n=localeMessages[e];if(n){var a=(a=n.message)&&a.replace(/\$\$/g,"$");if(null!=t)if(t instanceof Array)for(var o=0;o<t.length;o++)a=a.replace("$"+(o+1),t[o]);else a=a.replace("$1",t);return a}}return chromeGetMessage(e,t)}}function getQueryVariable(t){var n=window.location.search.substring(1).split("&");for(let e=0;e<n.length;e++){var a=n[e].split("=");if(a[0]==t)return a[1]}return!1}function OpenURL(e,t){0==t?window.location=trim(e):1!=t&&2!=t||window.open(trim(e))}function failLoadingLaunchAPP(e,t){e=`
                <div class="feature-icon retry-icon"><img src="./images/logo_120.svg" alt=""></div>
                <h2 class="fail-title">${getMessage("appName")}</h2>
                <div class="loader">
                    <div class="loader-inner ball-spin-fade-loader">
                        <div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>
                    </div>
                </div>
                <div class="retry-title">${getMessage("failedToOpenLoading_DPM")}</div>
                <p class="retry-desc">
                    ${e}
                </p>
                <div class="button-container">
                    <button id="retryAppButton" type="submit" class="button-css button-blue button-retry retry-loading">
                        <span class="open-txt retry-app">${getMessage("retry")}</span>
                    </button>
                </div>
            `;document.getElementById("ipsFailBody").querySelector(".fail-inner").innerHTML=e}function failLaunchAPP(e,t){e=`
                <div class="feature-icon retry-icon"><img src="./images/logo_120.svg" alt=""></div>
                <h2 class="fail-title">${getMessage("appName")}</h2>
                <div class="fail-icon"><img src="./images/icon_tools_launch_lose.svg" alt=""></div>
				<div class="retry-title">${getMessage("failedToOpen_DPM")}</div>
				 <p class="retry-desc">
                    ${e}
                </p>
                <div class="button-container">
                    <button id="retryAppButton" type="submit" class="button-css button-blue button-retry">
                        <span class="open-txt retry-app">${getMessage("retry")}</span>
                    </button>
                    <button id="DownAppButton" type="submit" class="button-css button-blue button-down">
                        <span class="open-txt down-app">${getMessage("downloadApp")}</span>
                    </button>
                </div>
            `;document.getElementById("ipsFailBody").querySelector(".fail-inner").innerHTML=e}function initFailUI(){var e=document.documentElement;e.dir=getMessage("dir"),e.lang=getMessage("lang"),document.title=getMessage("appName")}window.addEventListener("load",function(e){initFailUI();let n="";switch(product_open_name="",product_nameload_return="",product_nameopen_return="",product_nameopen_down="",down_link="",getQueryVariable("tooltype")){case"password-health":product_nameload_return=getMessage("failedToOpenLoading_Password_Health_Dec"),n=product_nameload_return.replace("%s",getMessage("retry")),product_nameopen_return=getMessage("failedToOpen_Password_Health_Dec"),product_nameopen_down=product_nameopen_return.replace("%s",getMessage("retry")),product_open_name=product_nameopen_down.replace("%d",getMessage("downloadApp")),down_link="PasswordHealth";break;case"import-and-export":product_nameload_return=getMessage("failedToOpenLoading_Import_Export_Dec"),n=product_nameload_return.replace("%s",getMessage("retry")),product_nameopen_return=getMessage("failedToOpen_Import_Export_Dec"),product_nameopen_down=product_nameopen_return.replace("%s",getMessage("retry")),product_open_name=product_nameopen_down.replace("%d",getMessage("downloadApp")),down_link="ImportPassword";break;case"emergency-contact":product_nameload_return=getMessage("failedToOpenLoading_Emergency_Contact_Dec"),n=product_nameload_return.replace("%s",getMessage("retry")),product_nameopen_return=getMessage("failedToOpen_Emergency_Contact_Dec"),product_nameopen_down=product_nameopen_return.replace("%s",getMessage("retry")),product_open_name=product_nameopen_down.replace("%d",getMessage("downloadApp")),down_link="EmergencyContact";break;default:product_nameload_return=getMessage("failedToOpenLoading_Dark_Web_Monitor_Dec"),n=product_nameload_return.replace("%s",getMessage("retry")),product_nameopen_return=getMessage("failedToOpen_Dark_Web_Monitor_Dec"),product_nameopen_down=product_nameopen_return.replace("%s",getMessage("retry")),product_open_name=product_nameopen_down.replace("%d",getMessage("downloadApp")),down_link="DarkWebMonitor"}!async function(){try{failLoadingLaunchAPP(n,down_link);var e=await openNativeApp(down_link);document.getElementById("retryAppButton"),document.getElementById("DownAppButton");!1===e?(failLaunchAPP(product_open_name,down_link),document.getElementById("retryAppButton").style.cursor="default",document.getElementById("DownAppButton").style.cursor="default",document.getElementById("retryAppButton").addEventListener("click",function(e){openNativeApp(down_link)}),document.getElementById("DownAppButton").onclick=e=>{try{let e=getQueryVariable("tooltype"),t="";switch(e){case"password-health":t="DownloadApp";break;case"import-and-export":t="DownloadApp2";break;case"emergency-contact":t="DownloadApp4";break;default:t="DownloadApp3"}n=n&&"";sendMsg({TYPE:"APPGOTO",appgoto:t})}catch(e){}}):(failLoadingLaunchAPP(n,down_link),document.getElementById("retryAppButton").addEventListener("click",e=>{openNativeApp(down_link)}))}catch(e){}}()});