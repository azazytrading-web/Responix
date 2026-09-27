let showAddNew=!1;function chromeGetMessage(e,t){return null==t||isNaN(t)||(t+=""),chrome.i18n.getMessage(e,t)}function getMessage(e,t){if(e){if("undefined"!=typeof localeMessages&&null!=localeMessages){var n=localeMessages[e];if(n){var a=(a=n.message)&&a.replace(/\$\$/g,"$");if(null!=t)if(t instanceof Array)for(var i=0;i<t.length;i++)a=a.replace("$"+(i+1),t[i]);else a=a.replace("$1",t);return a}}return chromeGetMessage(e,t)}}function initFillUI(){var e=document.documentElement;e.dir=getMessage("dir"),e.lang=getMessage("lang"),document.title=getMessage("appName"),$("#password-layout .more-label").html(getMessage("advancedOptions")),$("#password-layout .copy-type").html(getMessage("copy_password")),$("#password-layout .generate-use").html(getMessage("use_generator_password")),$("#password-layout .length__title").html(getMessage("length")),$("#password-layout .generate-uppercase").html(getMessage("upper_case")),$("#password-layout .generate-number").html(getMessage("numWords")),$("#password-layout .button-refresh").attr("title",getMessage("new_password"));let t=getMessage("symbols");t=t.replace("%s","!@#$%^&*"),$("#password-layout .generate-symbols").html(t)}function $$(e){return document.getElementById(e)}function SplitFn(e,t){e=new RegExp("[^\n]{1,"+e+"}","g");return t.match(e).join(" ")}function clickStopPropagation(e){e=e||window.event;document.all?e.cancelBubble=!0:e.stopPropagation()}function doFillAnimation(e,t){e.classList.add("itop-animated-fill"),setTimeout(function(){e&&e.classList.remove("itop-animated-fill")},t)}function trim(e){return e.replace(/(^\s*)|(\s*$)/g,"")}function OpenURL(e,t){0==t?window.location=trim(e):1!=t&&2!=t||window.open(trim(e))}function findAncestors(e,t){for(;null!=e;){if(t.call(null,e))return e;e=e.parentNode}return null}function setIframe(e,t,n){var a=$(e+" .cardlayout-header").outerHeight(),i=$(e+" .cardmain-layout").outerHeight();let s=0;return s=0==n?$(e+" ."+t).outerHeight()+16:3==n?$(e+" ."+t).outerHeight():0,parseInt(a+i+s)}function isBlank(e){return null==e||"null"===e||""===e||void 0===e||"undefined"===e||"unknown"===e}async function logandlockColseClickEvent(){try{await handle.sendMessage("CLOSE_FILLBOX",{})}catch(e){}}function onLoginNotIn(){var e=`
    <div class="login-layout login-not-in">
            <header class="cardlayout-header">
                <span class="header-logo"></span>
                <span class="header-title"></span>
                <button id="loginNoneClose" type="button" class="fill-btn fill-close" aria-label="Close"
                    title="${getMessage("close")}">
                </button>
            </header>
            <main class="cardmain-layout">
                <div class="cardmain-none">
                    <div class="none-inner">
                        ${getMessage("signInAutoNow")}
                    </div>
                </div>
            </main>
            <footer class="cardmain-footer">
                <button id="fill-login-in"  type="button" class="btn cardmain-btn btn-in button-blue">
                     ${getMessage("signIn")}
                </button>
            </footer>
        </div>
  `;$$("ractive-container").innerHTML=e;let t=setIframe("#ractive-container","cardmain-footer",0);t=t<=100?150:setIframe("#ractive-container","cardmain-footer",0),handle.sendMessage("SET_FILLBOXSIZE",{width:-1,height:t}),$$("fill-login-in").onclick=e=>{!async function(){try{await handle.sendMessage("OPEN_LOGINTAB",{})}catch(e){}}()},$$("loginNoneClose").onclick=e=>{logandlockColseClickEvent()}}function onLock(){var e=`
    <div class="login-layout login-not-in">
            <header class="cardlayout-header">
                <span class="header-logo"></span>
                <span class="header-title"></span>
                <button id="lockNoneClose" type="button" class="fill-btn fill-close" aria-label="Close"
                    title="${getMessage("close")}">
                </button>
            </header>
            <main class="cardmain-layout">
                <div class="cardmain-none">
                    <div class="none-inner">
                        ${getMessage("unlockAutoNow")}
                    </div>
                </div>
            </main>
            <footer class="cardmain-footer">
                <button id="fill-login-in"  type="button" class="btn cardmain-btn btn-lock button-blue">
                    ${getMessage("unlock")}
                </button>
            </footer>
        </div>
  `;$$("ractive-container").innerHTML=e;let t=setIframe("#ractive-container","cardmain-footer",0);t=t<=100?150:setIframe("#ractive-container","cardmain-footer",0),handle.sendMessage("SET_FILLBOXSIZE",{width:-1,height:t}),$$("fill-login-in").onclick=e=>{!async function(){try{await handle.sendMessage("OPEN_LOGINTAB",{})}catch(e){}}()},$$("lockNoneClose").onclick=e=>{logandlockColseClickEvent()}}function noSave(){var e=`
        <div class="cardmain-none" style="min-height: 70px;">
            <div class="none-inner">
                ${getMessage("noSaved")}
            </div>
        </div>
    `;$$("loginLayout").querySelector(".cardmain-layout").innerHTML=e,$(".login-layout.login-in .cardmain-button").css("margin-top",0);let t=setIframe("#ractive-container","cardmain-button",3);t=t<=100?150:setIframe("#ractive-container","cardmain-button",3),handle.sendMessage("SET_FILLBOXSIZE",{width:-1,height:t})}function getRndInteger(e,t){return Math.floor(Math.random()*(t-e+1))+e}String.prototype.pxWidth=function(e){var t=(String.prototype.pxWidth.canvas||(String.prototype.pxWidth.canvas=document.createElement("canvas"))).getContext("2d");return t.font="normal "+e+"px Segoe UI",t.measureText(this).width};const avatarFillColor=["#00C6BC","#B7CBFB","#40908B","#3392FA","#7664E3","#E36464","#64B0E3","#E364A8","#736398","#EB6B0D","#DCA612","#0DC58D","#E5BC19","#37547B","#BE9BF3"];async function getFillUserIcon(n){try{let e,t="";for(var a in n.certifications){e=a;var i=await handle.sendMessage("GET_ICON",{index:e});isBlank(i)?(t=guid2color(n.certifications[a].id),$("#ractive-container li").eq(e).find(".website-icon").css({"background-image":"url('../img/ico_login_default.png')","background-color":t})):(t="#fff",$("#ractive-container li").eq(e).find(".website-icon").css({"background-image":"url("+i,"background-color":t}))}}catch(e){}}function getFillCardTypeIcon(){}function cardType(e){let t="";switch(e.replace(/\s+/g,"").toLowerCase()){case"visa":t='url("../../skin/common/icon_cardtype_visa_64.svg")';break;case"mastercard":t='url("../../skin/common/icon_cardtype_mastercard_64.svg")';break;case"americanexpress":t='url("../../skin/common/icon_cardtype_amex_64.svg")';break;case"dinersclub":t='url("../../skin/common/icon_cardtype_diners_64.svg")';break;case"carteblanche":t='url("../../skin/common/icon_cardtype_carte_64.svg")';break;case"discover":t='url("../../skin/common/icon_cardtype_discover_64.svg")';break;case"jcb":t='url("../../skin/common/icon_cardtype_jcb_64.svg")';break;case"maestro":t='url("../../skin/common/icon_cardtype_maestro_64.svg")';break;case"visaelectron":t='url("../../skin/common/icon_cardtype_visaelectron_64.svg")';break;case"unionpay":t='url("../../skin/common/icon_cardtype_unionpay_64.svg")';break;default:t='url("../../skin/common/icon_cardtype_other_64.svg")'}return t}function saveListItem(l){let c="",r="#fff",t="../img/ico_login_default.png";if(0<l.certifications.length){$(".login-layout.login-in .cardmain-button").css("margin-top",16);try{var d,u;for(u in l.certifications)if(d=u,"login"==l.certifications[u].icon.type?r=guid2color(l.certifications[u].id):t="payment"==l.certifications[u].icon.type?"../../skin/common/icon_cardtype_other_64.png":"personal"==l.certifications[u].icon.type?"../../skin/common/icon_persionl_info.png":"../img/ico_login_default.png","payment"==l.certifications[u].icon.type){let e="",t="",n,a=0,i="none",s="inline-block",o="none";isBlank(l.certifications[u].titlelst[0])&&isBlank(l.certifications[u].titlelst[1])?(t="-",i="none",s=" inline-block"):(i=" inline-block",s="none",t="-",!isBlank(l.certifications[u].titlelst[0])&&isBlank(l.certifications[u].titlelst[1])?(t="-",o="none"):isBlank(l.certifications[u].titlelst[0])&&!isBlank(l.certifications[u].titlelst[1])?(o="none",e="*"+l.certifications[u].titlelst[1].substring(l.certifications[u].titlelst[1].length-4,l.certifications[u].titlelst[1].length)):isBlank(l.certifications[u].titlelst[0])||isBlank(l.certifications[u].titlelst[1])||(o="inline-block",e="*"+l.certifications[u].titlelst[1].substring(l.certifications[u].titlelst[1].length-4,l.certifications[u].titlelst[1].length)),a=Math.ceil(e.pxWidth(13)+10));var g=l.certifications[u].icon.cardtype.trim().replace(/\s/gi,"").toLowerCase();n=cardType(g),c+=`
                        <li class="carditem" id="${l.certifications[u].id}" data-index="${d}" title="${getMessage("fill")}">
                            <div class="credential-inner">
                                <div class="credential-info-container">
                                    <div class="website-icon" style='background-color: ${r};background-image: ${n}'>
                                    </div>
                                </div>
                                <div class="credential-info-content">
                                    <p class="titleContainer webtitle">${isBlank(l.certifications[u].title)?"-":l.certifications[u].title}</p>
                                    <p class="subtitle name pay-subtitle">
                                        <span class="allpay-none" style="display: ${s}">${t}</span>
                                        <span class="allpay-name" style="display: ${isBlank(l.certifications[u].titlelst[0])?"none":" inline-block"}">
                                            ${isBlank(l.certifications[u].titlelst[0])?"":l.certifications[u].titlelst[0]}
                                        </span>
                                        <span class="allpay-comma" style="display: ${o}">,&nbsp;</span>
                                        <span class="allpay-card" style="display: ${isBlank(l.certifications[u].titlelst[1])?"none":" inline-block"}; max-width: ${a}px">
                                            ${e}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </li>
                    `}else c+=`
                        <li class="carditem" id="${l.certifications[u].id}" data-index="${d}" title="${getMessage("fill")}">
                            <div class="credential-inner">
                                <div class="credential-info-container">
                                    <div class="website-icon" style="background-color: ${r};background-image: url('${t}')">
                                    </div>
                                </div>
                                <div class="credential-info-content">
                                    <p class="titleContainer webtitle">${isBlank(l.certifications[u].title)?"-":l.certifications[u].title}</p>
                                    <em class="subtitle name">${isBlank(l.certifications[u].title2)?"-":l.certifications[u].title2}</em>
                                </div>
                            </div>
                        </li>
                    `;$$("loginLayout").querySelector(".cardmain-layout").innerHTML=`
                    <div id="login-password" class="cardmain-panel"><ul class="cardmain-list save-list">${c}</ul></div>`,$$("loginLayout").querySelector(".cardmain-button").classList.remove("totp"),$$("loginLayout").querySelector(".totp-tips").style.display="none",showAddNew?$$("loginLayout").querySelector(".cardmain-btn").style.display="inline-block":$$("loginLayout").querySelector(".cardmain-btn").style.display="none";let e=setIframe("#ractive-container","cardmain-button",0);e=e<=100?150:setIframe("#ractive-container","cardmain-button",0),handle.sendMessage("SET_FILLBOXSIZE",{width:-1,height:e}),$$("login-password").addEventListener("mousedown",function(e){let t=findAncestors(e.target,function(e){return e.classList&&e.classList.contains("carditem")});t&&!async function(){try{var e=t.getAttribute("data-index");await handle.sendMessage("CLOSE_FILLBOX",{}),await handle.sendMessage("FILL",{index:e,type:"certifications"})}catch(e){}}()})}catch(e){}}else showAddNew||($$("loginLayout").querySelector(".cardmain-btn").style.display="none"),$(".login-layout.login-in .cardmain-button").css("margin-top",0),noSave()}function InjuctCanvasLoading(a){let i=a[0].time,s=30-a[0].time;$("#onetime-password  .pie-num").html(i);for(var t of a)for(let e=0;e<s;e++)$("#onetime-password .carditem").eq(t.index).find(".slice").eq(e).hide();window.setInterval(async function(){if(i<=1){let e=!0;for(var t of a){s=0,$("#onetime-password .pie-num").html(30),$("#onetime-password  .slice").show();try{var n=await handle.sendMessage("GETTOTP",{index:t.dataindex});e&&(i=n.down,e=!1),$("#loginLayout .carditem").eq(t.index).find(".subtitle").text(SplitFn(3,n.totp))}catch(e){}}handle.sendMessage("FILL",{type:"updateTotp"})}else{i--,s++;for(var e of a)$("#onetime-password  .slice-"+s).hide(),$("#onetime-password .pie-num").html(i)}},1e3)}function totpListItem(r){!async function(){try{let t="",a="";if(0<r.certifications.length){var i,s,o=[],l=createFillTOTPHtml();for(s in r.certifications)if(i=s,r.certifications[s].containTotp){let e=await handle.sendMessage("GET_ICON",{index:i});var c=await handle.sendMessage("GETTOTP",{index:i});o.push({totp:c.totp,down:c.down,index:i}),a=isBlank(e)?(e="../img/ico_login_default.png",guid2color(r.certifications[s].id)):(e=e,"#fff"),t+=`
                        <li class="carditem" id="${r.certifications[s].id}" data-index="${i}"  title="Fill">
                            <div class="credential-inner">
                                <div class="credential-info-container">
                                    <div class="website-icon" style="background-image: url(${e});background-color:${a};">
                                    </div>
                                </div>
                                <div class="credential-info-content">
                                    <p class="titleContainer webtitle">${isBlank(r.certifications[s].title2)?"-":r.certifications[s].title2}</p>
                                    <em class="subtitle name"></em>
                                </div>
                                <div id="${i}fillTOTPCanvasBg" class="canvas-corners">${l}</div>
                            </div>
                        </li>
                    `}$$("loginLayout").querySelector(".cardmain-layout").innerHTML=`
                    <div id="onetime-password" class="cardmain-panel"><ul class="cardmain-list totp-list">${t}</ul></div>`,$$("loginLayout").querySelector(".cardmain-button").classList.add("totp"),$$("loginLayout").querySelector(".totp-tips").style.display="block",$$("loginLayout").querySelector(".cardmain-btn").style.display="none",$(".login-layout.login-in .cardmain-button").css("margin-top",16);var e=setIframe("#ractive-container","cardmain-button",0);handle.sendMessage("SET_FILLBOXSIZE",{width:-1,height:e});let n=[];o.forEach((e,t)=>{$("#loginLayout .carditem").eq(t).find(".subtitle").text(SplitFn(3,e.totp)),n.push({id:e.index+"fillTOTPCanvas",time:e.down,index:t,dataindex:e.index})}),$("#onetime-password .pie-num").html(30),InjuctCanvasLoading(n),$$("onetime-password").addEventListener("mousedown",function(t){let n=findAncestors(t.target,function(e){return e.classList&&e.classList.contains("carditem")});n&&!async function(){try{clickStopPropagation(t);var e=n.getAttribute("data-index");await handle.sendMessage("CLOSE_FILLBOX",{}),await handle.sendMessage("FILL",{index:e,type:"totp"})}catch(e){}}()})}else $(".login-layout.login-in .cardmain-button").css("margin-top",0),noSave()}catch(e){}}()}function onLoginIn(){var e=`
    <div id="loginLayout" class="login-layout login-in">
            <header class="cardlayout-header">
                <span class="header-logo"></span>
                <span class="header-title"></span>
            </header>
            <main class="cardmain-layout"></main>
            <footer class="cardmain-button">
                 <button id="addNewPwd" type="button" class="btn btn-link cardmain-btn btn-add">
                    ${getMessage("addNew")}
                </button>
                 <p class="totp-tips" style="display: none;"></p>
            </footer>
        </div>
  `;$$("ractive-container").innerHTML=e,$(".login-layout.login-in .cardmain-button").css("margin-top",16);let t=setIframe("#ractive-container","cardmain-button",0);t=t<=100?150:setIframe("#ractive-container","cardmain-button",0),handle.sendMessage("SET_FILLBOXSIZE",{width:-1,height:t})}function passwordContainer(i){$$("ractive-container").style.display="none",$$("password-layout").style.display="block";try{passwordGeneratorLoad();let t=0,n=$("#password-layout .cardlayout-header").outerHeight(),a=$("#password-layout .cardmain-layout").outerHeight();t=parseInt(n+a),handle.sendMessage("SET_FILLBOXSIZE",{width:-1,height:t});var s=document.getElementById("generate-settings");document.getElementById("ShowMore");$$("ShowMore").onclick=e=>{t=(a=(n=($$("ShowMore").classList.contains("on")?(s.classList.remove("on"),$$("ShowMore").classList.remove("on")):(s.classList.add("on"),$$("ShowMore").classList.add("on")),$("#password-layout .cardlayout-header").outerHeight()),$("#password-layout .cardmain-layout").outerHeight()),parseInt(n+a)),handle.sendMessage("SET_FILLBOXSIZE",{width:-1,height:t})},$$("fillGeneratePwd").onclick=e=>{!async function(){try{useOfStatistical("340");var e=$$("fillPassword").value;handle.sendMessage("ADD_GPWDHISTORY",{url:i.url,password:e,dm:i.dm}).then(e=>{}),await handle.sendMessage("CLOSE_FILLBOX",{}),await handle.sendMessage("FILL",{pwd:e,type:"generated"})}catch(e){}}()}}catch(e){}}handle.onReady(async function(n){if(initFillUI(),$$("ractive-container").style.display="block",$$("password-layout").style.display="none",$("#ractive-container .cardmain-button").css("margin-top",16),0==n.isLogin)onLoginNotIn();else if(1==n.isLock)onLock();else if(onLoginIn(),noSave(),$$("addNewPwd").onclick=e=>{!async function(){try{add=await handle.sendMessage("ADD_PWD",{}),await handle.sendMessage("CLOSE_FILLBOX",{})}catch(e){}}()},"login"==n.use)switch(n.type){case"login_password":showAddNew=!0;var e=await handle.sendMessage("GETLIST",{domain:n.dm});saveListItem(e),getFillUserIcon(e);break;case"totp":e=await handle.sendMessage("GETLIST",{domain:n.dm});totpListItem(e),getFillUserIcon(e)}else"register"==n.use?passwordContainer(n):"PAYMENT"!==n.use&&"PERSONINFO"!==n.use||saveListItem(await handle.sendMessage("GETLIST",{domain:n.dm}));handle.onChange(async function(e){if($$("ractive-container").style.display="block",$$("password-layout").style.display="none",$("#ractive-container .cardmain-button").css("margin-top",16),0==e.isLogin)onLoginNotIn();else if(1==e.isLock)onLock();else if(onLoginIn(),noSave(),$$("addNewPwd").onclick=e=>{!async function(){try{await handle.sendMessage("ADD_PWD",{}),await handle.sendMessage("CLOSE_FILLBOX",{})}catch(e){}}()},"login"==n.use)switch(n.type){case"login_password":showAddNew=!0;var t=await handle.sendMessage("GETLIST",{domain:n.dm});saveListItem(t),getFillUserIcon(t);break;case"totp":t=await handle.sendMessage("GETLIST",{domain:n.dm});totpListItem(t),getFillUserIcon(t)}else"register"==n.use?passwordContainer(n):"PAYMENT"!==n.use&&"PERSONINFO"!==n.use||saveListItem(await handle.sendMessage("GETLIST",{domain:n.dm}))})});