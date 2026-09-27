let cnt411=!1,cnt412=!1;function cont411_412(){cnt411&&useOfStatistical("411"),cnt412&&useOfStatistical("412")}function chromeGetMessage(e,t){return null==t||isNaN(t)||(t+=""),chrome.i18n.getMessage(e,t)}function initConfirmUI(){var e=document.documentElement;e.dir=getMessage("dir"),e.lang=getMessage("lang"),document.title=getMessage("appName")}function getMessage(e,t){if(e){if("undefined"!=typeof localeMessages&&null!=localeMessages){var a=localeMessages[e];if(a){var n=(n=a.message)&&n.replace(/\$\$/g,"$");if(null!=t)if(t instanceof Array)for(var o=0;o<t.length;o++)n=n.replace("$"+(o+1),t[o]);else n=n.replace("$1",t);return n}}return chromeGetMessage(e,t)}}function isBlank(e){return null==e||"null"===e||""===e||void 0===e||"undefined"===e||"unknown"===e}function $$(e){return document.getElementById(e)}function setOverflowHint(e,t){var a=parseInt(t.pxWidth(16));"ru"==getMessage("lang")?211<a?$$("confirm-container").querySelector(e).setAttribute("title",t):$$("confirm-container").querySelector(e).removeAttribute("title"):208<a?$$("confirm-container").querySelector(e).setAttribute("title",t):$$("confirm-container").querySelector(e).removeAttribute("title")}function confirmTooltip(){$(".dpmtooltip").tooltipster({trigger:"custom",delay:[300,0],distance:0,triggerOpen:{mouseenter:!0,touchstart:!0},triggerClose:{mouseleave:!0,originClick:!1,touchleave:!0}})}function findAncestors(e,t){for(;null!=e;){if(t.call(null,e))return e;e=e.parentNode}return null}function checkBlankSpace(e){return 0!=e.trim().length&&null!=e}function clickStopPropagation(e){e=e||window.event;document.all?e.cancelBubble=!0:e.stopPropagation()}function showPasswordsCheck(e){var e=e.target,t=findAncestors(e,function(e){return e.classList&&e.classList.contains("from-all-inner")}).querySelector("input"),e=(e.classList.contains("on")?(e.classList.remove("on"),t.setAttribute("type","text"),e.setAttribute("title",getMessage("hidePass"))):(e.classList.add("on"),t.setAttribute("type","password"),e.setAttribute("title",getMessage("showPass"))),t.value);t.focus(),t.value="",t.value=e,$(".from-all-text").off("click").on("click",function(e){clickStopPropagation(e)}),$(".from-all-inner").off("click").on("click",function(e){clickStopPropagation(e)})}String.prototype.pxWidth=function(e){var t=(String.prototype.pxWidth.canvas||(String.prototype.pxWidth.canvas=document.createElement("canvas"))).getContext("2d");return t.font="normal "+e+"px Segoe UI",t.measureText(this).width},handle.onReady(function(e){"addtotp"==e.from&&(cnt411=!0,cnt412=!0),initConfirmUI();var t=$("#confirm-container .cardlayout-header").outerHeight(),a=$("#confirm-container .cardmain-layout").outerHeight(),n=$("#confirm-container .cardmain-footer").outerHeight(),t=Math.ceil(t+a+n);handle.sendMessage("SET_CONFIRIFRAMESTYPE",{style:"height",value:t}),load(e)});let confirm_html="",confirmtagshtml=`
    <div class="from-all-inner  from-none from-show from-tags">
        <label class="fromAllContainer from-tags-label"><span class="label-text">${getMessage("tags")}</span></label>
        <div class="from-all-text from-tags">
            <input class="tags-input"  value ="" placeholder="">
        </div>
    </div>
`;function addContainer(n){let e=getMessage("notes_placeholder"),t=(e=e.replace("%s",5e3),""),a="";t=isBlank(n.static.ico)?(a="../img/ico_login_default.png",guid2color(n.static.id)):(a=n.static.ico,"#fff"),confirm_html="";var o=autoPwdHtml("save");confirm_html=`
            <div class="confirm-layout tag-layout">
            <header class="cardlayout-header d-flex align-items-center">
                <span class="header-logo" ></span>
                    <div class="header-titleContainer"><span>${getMessage("saveIn_DPM")}</span></div>
                    <button id="confirmClose" type="button" class="confirm-btn confirm-close" aria-label="Close"
                        title="${getMessage("close")}"></button>
            </header>
            <main class="cardmain-layout">
                <form id="save-password-form" class="cardmain-form" novalidate="">
                    <div class="avatar-container">
                        <div class="avatar-icon website-icon" style="background-image: url('${a}');background-color: ${t};">
                        </div>
                        <div id="savePwdTitle" class="avatar-details">
                            <input class="avatar-text form-control all-input placeholder-css edit-title on" spellcheck="false"  autocomplete="off"
                                maxlength="250"  type="text" value="" style='cursor:default' placeholder="${getMessage("title_placeholder")}">
                        </div>
                    </div>
                    <div class="from-all-container">
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("username")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css"
                                    id="saveLoginUsername"
                                    placeholder="${getMessage("username_placeholder")}"
                                    type="text" value="">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <div class="from-inner">
                                <label class="fromAllContainer"><span class="label-text">${getMessage("password")}</span></label>
                                <div class="from-all-text">
                                    <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css"
                                        placeholder="Password"
                                        id="saveLoginPassword" type="password" placeholder="${getMessage("password")}" value="">
                                    <div class="ui-components">
                                        <button class="inputButton showpassword on" type="button" title="${getMessage("showPass")}"></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="from-all-inner from-show">
                            <div class="from-inner">
                                <label class="fromAllContainer d-flex justify-content-between">
                                    <span class="label-text">${getMessage("one_time_Password")}</span>
                                    <a class="learnmore" type="button">${getMessage("learn_more")}</a>
                                </label>
                                <div class="from-all-text">
                                    <input spellcheck="false"  autocomplete="off"  maxlength="2000"
                                        class="form-control all-input placeholder-css"
                                        placeholder="${getMessage("TOTP_placeholder")}"
                                        data-invalid = "false"
                                        name="totp"
                                        id="saveLoginOneTimePwd" type="text" placeholder="">
                                    <div class="ui-components">
                                        <button class="inputButton btn-scan dpmtooltip" type="button" title="${getMessage("scan_web_page_QRCode")}"></button>
                                    </div>
                                </div>
                                <div class="otpauth-tips" style="opacity: 0;">${getMessage("invalid_secret_key")}</div>
                            </div>
                        </div>
                        <div class="from-all-inner  from-show from-none">
                            <label class="fromAllContainer">
                                <span class="label-text">${getMessage("notes")}</span>
                                <textarea class="form-control label-textarea text-textarea  placeholder-css"
                                    placeholder="${e}"
                                    spellcheck="false"  autocomplete="off"
                                    id="saveLoginArea" placeholder="" 
                                    name="notes"
                                    maxlength="5000"></textarea>
                                <div class="characters-tips hidden">${getMessage("notes_characters_tips")}</div>
                            </label>
                        </div>
                        ${confirmtagshtml}
                    </div>
                    <div class="savemore">
                        <a id="showmore" class="btn-link btn-more showmore">
                            <span class="more-label">${getMessage("advancedOptions")}</span>
                            <i class="more-icon"></i>
                        </a>
                    </div>
                </form>
            </main>
            <footer class="cardmain-footer">
                <div class="d-flex justify-content-end align-items-end">
                    <a id="notSavePassword" class="btn-link btn-notnow" style="display: ${"addnew"===n.from||"addtotp"===n.from?"flex":"none"};">
                         ${getMessage("notNow")}
                    </a>
                    <div class="notnow-list" style="display: ${"addnew"===n.from||"addtotp"===n.from?"none":"block"};">
                        <a class="btn-link btn-notnow add-notnow btn-reverse">
                            <span class="more-label">${getMessage("notNow")}</span>
                            <i class="more-icon"></i>
                        </a>
	                    <ul class="notnow-menu" style="display: none;">
                            <li key='now'>${getMessage("notNow")}</li>
                            <li key='day'>${getMessage("remind_me_tomorrow")}</li>
                            <li key='week'>${getMessage("remind_me_after_days")}</li>
                             <li key='blacklist'>${getMessage("Exclude_website_new")}</li>
                        </ul>
                    </div>
                    <button id="savePassword" class="button-css button-blue button-save">
                        <span>${getMessage("save")}</span>
                    </button>
                </div>
            </footer>
            ${o}
        </div>
        `,$$("confirm-container").innerHTML=confirm_html,setOverflowHint(".button-save",getMessage("save")),autosize(document.querySelectorAll("textarea"));let s=$$("confirm-container").querySelectorAll(".from-show"),i=void($$("savePwdTitle").querySelector(".form-control").value=n.static.title,$$("saveLoginUsername").value=n.static.username,$$("saveLoginPassword").value=n.static.password,autoPwdGetEvent("save",n),autoPwdSendEvent("save")),l,r,c=0,d=getMessage("notes_characters_tips"),u=void(d=d.replace("%s",'<span class="characters-num"></span>'),$("#confirm-container .cardmain-layout  .characters-tips").html(d),confirmTooltip(),btnScanClickEvent("confirm-container"),$("#confirm-container textarea.form-control").on("input propertychange keyup change",function(e){noshow_header=$("#confirm-container .cardlayout-header").outerHeight(),noshow_main=$("#confirm-container .cardmain-layout").outerHeight(),noshow_footer=$("#confirm-container .cardmain-footer").outerHeight(),noshow_auto=0,noshow_auto="none"===$$("confirm-container").querySelector(".autoPassword").style.display||""===$$("confirm-container").querySelector(".autoPassword").style.display?0:$("#confirm-container .autoPassword").outerHeight(),noshow_iframe=Math.ceil(noshow_header+noshow_main+noshow_footer+noshow_auto),handle.sendMessage("SET_CONFIRIFRAMESTYPE",{style:"height",value:noshow_iframe}),i=parseInt($(this).val().length),l=parseInt($(this).attr("maxlength"))-100,i>=l?(c=(c=parseInt($(this).attr("maxlength"))-i)<=0?0:parseInt($(this).attr("maxlength"))-i,$(this).parent(".fromAllContainer").find(".characters-tips").removeClass("hidden"),$(this).parent(".fromAllContainer").find(".characters-num").html(c)):($(this).parent(".fromAllContainer").find(".characters-tips").addClass("hidden"),$(this).parent(".fromAllContainer").find(".characters-num").html(""))}),$("#confirm-container .form-control[name='totp']").on("input propertychange keyup change",function(e){confirmInvalidTOTP(r=$(this).val()),$(this).attr("data-change",!0)}),document.querySelector(".learnmore").onclick=e=>{handle.sendMessage("APPGOTO",{appgoto:"LearnMoreTOTP"})},1==n.static.expand?addContainerExpand(s,n):addSetConfirmContainerHeight(n),initConfirmTagify(n,-1),$("#showmore").off("click").on("click",function(){addContainerExpand(s,n)}),document.querySelectorAll(".showpassword").forEach(e=>e.addEventListener("click",showPasswordsCheck.bind(this))),$$("savePwdTitle").onclick=e=>{$$("savePwdTitle").querySelector("input").classList.remove("on"),$$("savePwdTitle").querySelector("input").style.cursor="text";var t=$("#savePwdTitle").find("input").val();$("#savePwdTitle").find("input").val(t)},$$("confirmClose").onclick=e=>{isBlank($("#savePwdTitle input").val())?($("#savePwdTitle input").addClass("is-invalid"),$("#savePwdTitle input").focus()):(handle.sendMessage("CONFIRM",{cancel:!0},"*"),handle.sendMessage("CLOSE_CFIRMBOX",{}))},$$("notSavePassword").onclick=e=>{handle.sendMessage("CONFIRM",{cancel:!0},"*"),handle.sendMessage("CLOSE_CFIRMBOX",{})},$("#savePwdTitle input").on("input propertychange keyup change",function(){$("#savePwdTitle input").attr("placeholder",getMessage("title_placeholder")),$("#savePwdTitle input").hasClass("is-invalid")&&(isBlank($("#savePwdTitle input").val())?($("#savePwdTitle input").addClass("is-invalid"),$("#savePwdTitle input").focus()):$("#savePwdTitle input").removeClass("is-invalid"))})),m="",p="",f,g=($$("savePassword").onclick=async e=>{if(checkBlankSpace(u=$$("savePwdTitle").querySelector("input").value)){let e="",t=void($("#savePwdTitle input").attr("placeholder",getMessage("title_placeholder")),$("#savePwdTitle input").removeClass("is-invalid")),a="";t=$("#saveLoginOneTimePwd").attr("data-invalid"),a=(1==t||"true"==t)&&checkBlankSpace($("#saveLoginOneTimePwd").val())?$("#saveLoginOneTimePwd").val():"",checkBlankSpace($$("saveLoginUsername").value)&&(m=$$("saveLoginUsername").value),checkBlankSpace($$("saveLoginPassword").value)&&(p=$$("saveLoginPassword").value),checkBlankSpace($$("saveLoginArea").value)&&(e=$$("saveLoginArea").value),f=confirmGetTags(),(await handle.sendMessage("CONFIRM",{do:"store",id:n.static.id,title:u,uri:n.static.uri,uname:m,pwd:p,totp:a,note:e,taglist:f})).succ&&""!=a&&("addtotp"!=n.from&&"scan"!=$(".btn-scan").attr("data-type")||(cnt411=!0,cnt412=!0),"true"==$(".form-control[name='totp']").attr("data-change")&&(cnt411=!0),cont411_412()),handle.sendMessage("CLOSE_CFIRMBOX",{})}else $("#savePwdTitle").find("input").focus(),$("#savePwdTitle input").addClass("is-invalid"),$("#savePwdTitle input").attr("placeholder",getMessage("title_placeholder"))},$$("confirm-container").querySelector(".notnow-menu")),v;$$("confirm-container").querySelector(".add-notnow").onclick=e=>{clickStopPropagation(e),"none"===g.style.display||""===g.style.display?(v=e.target.offsetHeight+10,g.style.bottom=v+"px",g.style.display="block",$$("confirm-container").querySelector(".add-notnow").classList.add("on"),$("#confirm-container .notnow-menu li").off("click").on("click",function(e){clickStopPropagation(e);let t=$(this).attr("key"),a="";a="blacklist"==t?n.uri[0]:"",handle.sendMessage("CONFIRM",{do:"donotshow",for:t,uri:[a]}),handle.sendMessage("CLOSE_CFIRMBOX",{})}),document.onclick=function(){g.style.display="none",$$("confirm-container").querySelector(".add-notnow").classList.remove("on")}):($$("confirm-container").querySelector(".add-notnow").classList.remove("on"),g.style.display="none")}}function hasOwn(e,t){return Object.prototype.hasOwnProperty.call(e,t)}function addContainerUpdateExpend(t,e){e.forEach(function(e){e.classList.add("on"),e.classList.contains("from-tags")&&"addtotp"!=t.from&&t.from}),$$("showmoreUpdate").remove();let n;setTimeout(()=>{var e=$("#confirm-container .cardlayout-header").outerHeight(),t=$("#confirm-container .cardmain-layout").outerHeight(),a=$("#confirm-container .cardmain-footer").outerHeight();n=Math.ceil(e+t+a),handle.sendMessage("SET_CONFIRIFRAMESTYPE",{style:"height",value:n})},0)}function addContainerUpdate(l,e){let t=getMessage("notes_placeholder"),a=(t=t.replace("%s",5e3),""),n="",o=(a=isBlank(l.static.ico)?(n="../img/ico_login_default.png",guid2color(l.static.id)):(n=l.static.ico,"#fff"),confirm_html="");o="autoSaveEdit"==l.from?getMessage("editInfo"):getMessage("saveIn_DPM")+getMessage("questionMark"),confirm_html=`
            <div class="confirm-layout tag-layout">
            <header class="cardlayout-header d-flex align-items-center">
                <span class="header-logo" ></span>
                <div class="header-titleContainer">
                    <span>${o}</span>
                </div>
                <button id="confirmClose" type="button" class="confirm-btn confirm-close" aria-label="Close"
                    title="${getMessage("close")}">
                </button>
				<button type="button" class="confirm-btn confirm-close confirm-opmodel"
                    style="display: none;"
					data-bs-toggle="modal" data-bs-target="#confirmEditModalPopovers" title="${getMessage("close")}">
				</button>
            </header>
            <main class="cardmain-layout">
                <form id="save-password-form" class="cardmain-form" novalidate="">
                    <div class="avatar-container">
                        <div class="avatar-icon website-icon" style="background-image: url('${n}');background-color: ${a};">
                        </div>
                        <div id="updatePwdTitle" class="avatar-details">
                            <input class="avatar-text form-control all-input placeholder-css edit-title on" spellcheck="false"
                                maxlength="250" type="text" value=""
                                name = "title"
                                style='cursor:default' placeholder="${getMessage("title_placeholder")}">
                        </div>
                    </div>
                    <div class="from-all-container">
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("username")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css"
                                    placeholder="${getMessage("username_placeholder")}"
                                    name = "username"
                                    id="saveLoginUsername" type="text" value="">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <div class="from-inner">
                                <label class="fromAllContainer"><span class="label-text">${getMessage("password")}</span></label>
                                <div class="from-all-text">
                                    <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css"
                                        placeholder="${getMessage("password")}"
                                        name = "password"
                                        id="saveLoginPassword" type="password" value="">
                                    <div class="ui-components">
                                        <button class="inputButton showpassword  on" type="button" title="${getMessage("showPass")}"></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="from-all-inner from-show">
                            <div class="from-inner">
                                <label class="fromAllContainer d-flex justify-content-between">
                                    <span class="label-text">${getMessage("one_time_Password")}</span>
                                    <a class="learnmore" type="button">${getMessage("learn_more")}</a>
                                </label>
                                <div class="from-all-text">
                                    <input spellcheck="false"  autocomplete="off"  maxlength="2000"
                                        class="form-control all-input placeholder-css"
                                        placeholder="${getMessage("TOTP_placeholder")}"
                                        name="totp"
                                        data-invalid = "false"
                                        id="saveLoginOneTimePwd" type="text" placeholder="">
                                    <div class="ui-components">
                                        <button class="inputButton btn-scan dpmtooltip" type="button" title="${getMessage("scan_web_page_QRCode")}"></button>
                                    </div>
                                </div>
                                <div class="otpauth-tips" style="opacity: 0;">${getMessage("invalid_secret_key")}</div>
                            </div>
                        </div>
                        <div class="from-all-inner  from-show from-none">
                            <label class="fromAllContainer">
                                <span class="label-text">${getMessage("notes")}</span>
                                <textarea class="form-control label-textarea text-textarea  placeholder-css"
                                    placeholder="${t}"
                                    id="saveUpdateLoginArea" placeholder="" 
                                    name="notes"
                                    maxlength="5000"></textarea>
                                <div class="characters-tips hidden">${getMessage("notes_characters_tips")}</div>
                            </label>
                        </div>
                         ${confirmtagshtml}
                    </div>
                    <div class="savemore">
                        <a id="showmoreUpdate" class="btn-link btn-more showmore">
                            <span class="more-label">${getMessage("advancedOptions")}</span>
                            <i class="more-icon"></i>
                        </a>
                    </div>
                </form>
            </main>
            <footer class="cardmain-footer">
                <div class="d-flex justify-content-end">
                    <a id="notSavePassword" class="btn-link btn-notnow" style="display: ${"autoSaveEdit"==l.from?"none":"flex"}">
                       ${getMessage("notNow")}
                    </a>
                    <button type="button" class="button-css button-blue button-delete" 
                        style="display: ${"autoSaveEdit"==l.from?"flex":"none"}" title="${getMessage("delete")}"
                        data-bs-toggle="modal" data-bs-target="#confirmDeletePopovers">
                        <span>${getMessage("delete")}</span>
				    </button>
                    <button id="addsaveUpdatePassword" class="button-css button-blue button-save" ${"autoSaveEdit"==l.from?"disabled":""}>
                        <span>${getMessage("save")}</span>
                    </button>
                </div>
            </footer>
        </div>
        `,$$("confirm-container").innerHTML=confirm_html,setOverflowHint(".button-save",getMessage("save")),$$("confirm-container").querySelector('.form-control[name="title"]').value=l.static.title,$$("confirm-container").querySelector('.form-control[name="username"]').value=l.static.username,$$("confirm-container").querySelector('.form-control[name="password"]').value=l.static.password,isBlank(l.static.totp)||($$("confirm-container").querySelector('.form-control[name="totp"]').value=l.static.totp,confirmInvalidTOTP(l.static.totp));autosize(document.querySelectorAll("textarea"));let s=$$("confirm-container").querySelectorAll(".from-show"),i,r=$("#confirm-container .cardlayout-header").outerHeight(),c=$("#confirm-container .cardmain-layout").outerHeight(),d=$("#confirm-container .cardmain-footer").outerHeight();i=Math.ceil(r+c+d);hasOwn(l,"static");handle.sendMessage("SET_CONFIRIFRAMESTYPE",{style:"height",value:i}),confirmTooltip(),btnScanClickEvent("confirm-container"),document.querySelector(".learnmore").onclick=e=>{handle.sendMessage("APPGOTO",{appgoto:"LearnMoreTOTP"})},$("#showmoreUpdate").off("click").on("click",function(e){addContainerUpdateExpend(l,s)}),"autoSaveEdit"==l.from?(addContainerUpdateExpend(l,s),$("#deleteConfirmButton").attr("controls-id",l.static.id)):"addtotp"==l.from&&1==l.static.expand&&addContainerUpdateExpend(l,s);let u=getMessage("notes_characters_tips"),m=void(u=u.replace("%s",'<span class="characters-num"></span>')),p,f=0,g=void($("#confirm-container .cardmain-layout  .characters-tips").html(u),$("#confirm-container textarea.form-control").on("input propertychange keyup change",function(e){r=$("#confirm-container .cardlayout-header").outerHeight(),c=$("#confirm-container .cardmain-layout").outerHeight(),d=$("#confirm-container .cardmain-footer").outerHeight(),i=Math.ceil(r+c+d),handle.sendMessage("SET_CONFIRIFRAMESTYPE",{style:"height",value:i}),m=parseInt($(this).val().length),p=parseInt($(this).attr("maxlength"))-100,m>=p?(f=(f=parseInt($(this).attr("maxlength"))-m)<=0?0:parseInt($(this).attr("maxlength"))-m,$(this).parent(".fromAllContainer").find(".characters-tips").removeClass("hidden"),$(this).parent(".fromAllContainer").find(".characters-num").html(f)):($(this).parent(".fromAllContainer").find(".characters-tips").addClass("hidden"),$(this).parent(".fromAllContainer").find(".characters-num").html(""))}),"init"==e?initConfirmTagify(l,0):"addnew"==e?initConfirmTagify(l,-10):"auto"==e?initConfirmTagify(l,-4):initConfirmTagify(l,-1),$$("updatePwdTitle").onclick=e=>{$$("updatePwdTitle").querySelector('.form-control[name="title"]').classList.remove("on"),$$("updatePwdTitle").querySelector("input").style.cursor="text";var t=$("#updatePwdTitle").find("input").val();$("#updatePwdTitle").find("input").val(t),$$("updatePwdTitle").classList.remove("on")},document.querySelectorAll(".showpassword").forEach(e=>e.addEventListener("click",showPasswordsCheck.bind(this))),$$("confirmClose").onclick=e=>{isBlank($("#updatePwdTitle input").val())?$("#updatePwdTitle input").addClass("is-invalid"):(handle.sendMessage("CONFIRM",{cancel:!0},"*"),handle.sendMessage("CLOSE_CFIRMBOX",{}))},$$("notSavePassword").onclick=e=>{handle.sendMessage("CONFIRM",{cancel:!0},"*"),handle.sendMessage("CLOSE_CFIRMBOX",{})}),v;$("#updatePwdTitle").on("propertychange change keyup",function(e){$("#updatePwdTitle input").hasClass("is-invalid")&&(isBlank($("#updatePwdTitle input").val())?$("#updatePwdTitle input").addClass("is-invalid"):$("#updatePwdTitle input").removeClass("is-invalid"))}),$("#confirm-container .form-control[name='totp']").on("input propertychange keyup change",function(e){"totp"==$(this).attr("name")&&(confirmInvalidTOTP(v=$(this).val()),$(this).attr("data-change",!0))}),$$("addsaveUpdatePassword").onclick=async e=>{let a="",n="",o="",s;if(checkBlankSpace(g=$$("updatePwdTitle").querySelector("input").value)){$("#updatePwdTitle input").removeClass("is-invalid");let e,t="";e=$("#saveLoginOneTimePwd").attr("data-invalid"),t=(1==e||"true"==e)&&checkBlankSpace(g)?$$("saveLoginOneTimePwd").value:"",a=checkBlankSpace($$("saveUpdateLoginArea").value)?$$("saveUpdateLoginArea").value:"",n=checkBlankSpace($$("saveLoginUsername").value)?$$("saveLoginUsername").value:"",o=checkBlankSpace($$("saveLoginPassword").value)?$$("saveLoginPassword").value:"";l.static.id;s=confirmGetTags();var i=await handle.sendMessage("CONFIRM",{do:"store",id:l.static.id,title:g,uri:l.static.uri,uname:n,pwd:o,totp:t,note:a,from:l.from,taglist:s});i.succ&&""!=t&&("addtotp"==l.from||"scan"==$(".btn-scan").attr("data-type")?(cnt411=!0,cnt412=!0):1!=$(".form-control[name='totp']").attr("data-change")&&"true"!=$(".form-control[name='totp']").attr("data-change")||(cnt411=!0,cnt412=!1),cont411_412()),handle.sendMessage("CLOSE_CFIRMBOX",{})}else $("#updatePwdTitle").find("input").focus(),$("#updatePwdTitle input").addClass("is-invalid")},"autoSaveEdit"==l.from&&(autoConfirmInputChange(l),missConfirmBtnEvent(),deleteConfirmButtonEvent())}function addContainerExpand(e,t){e.forEach(function(e){e.classList.add("on"),e.classList.contains("from-tags")&&"addtotp"==t.from&&($$("confirm-container").querySelector(".form-control[name='totp']").value=t.static.totp,confirmInvalidTOTP(t.static.totp))}),$$("showmore").remove(),addSetConfirmContainerHeight(t)}function updateContainerExpand(e,t){e.forEach(function(e){e.classList.add("on"),e.classList.contains("from-tags")}),$$("upshowmore").remove(),setConfirmContainerHeight(t)}function confirmInvalidTOTP(e){isBlank(e)?($("#confirm-container .form-control[name='totp']").attr("data-invalid",!1),$("#confirm-container  .otpauth-tips").css("opacity","0")):checkTotp(e)?($("#confirm-container .otpauth-tips").css("opacity","0"),$("#confirm-container .form-control[name='totp']").attr("data-invalid",!0)):($("#confirm-container  .otpauth-tips").css("opacity","1"),$("#confirm-container .form-control[name='totp']").attr("data-invalid",!1))}function updateContainer(t){let e="",a="",n="",o="../img/ico_login_default.png",s="";if(s=0<t.option.length?isBlank(t.option[0].ico)?(ption_bgimage="../img/ico_login_default.png",guid2color(t.option[0].id)):(o=t.option[0].ico,"#fff"):isBlank(t.static.ico)?(o="../img/ico_login_default.png",guid2color(t.static.id)):(o=t.static.ico,"#fff"),1<t.option.length){for(var i in t.option)n=checkBlankSpace(t.option[i].username)?t.option[i].username:"-",a+=`<option value="${i}">${n}</option>`;e=`
            <select class="form-control form-select select-update placeholder-css" id="updateUsername"
                data-username="${t.option[0].id}">${a}</select>
        `}else n=checkBlankSpace(t.option[0].username)?t.option[0].username:"-",e=`
            <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css"
                    placeholder="${getMessage("username_placeholder")}"
                                    id="updateUsername" type="text" placeholder="" data-value="" disabled data-username="${t.option[0].id}">
        `;let l="",r=(l=0<t.option.length?checkBlankSpace(t.option[0].title)?t.option[0].title:"-":checkBlankSpace(t.static.title)?t.static.title:"-",getMessage("notes_placeholder")),c=void(r=r.replace("%s",5e3),confirm_html=`
            <div class="update-layout tag-layout">
            <header class="cardlayout-header d-flex align-items-center">
                <span class="header-logo" ></span>
                <div class="header-titleContainer">
                    <span>${getMessage("updateLogins")}</span>
                </div>
                <button id="updateClose" type="button" class="confirm-btn confirm-close" aria-label="Close"
                    title="${getMessage("close")}">
                </button>
            </header>
            <main class="cardmain-layout">
                <form id="update-password-form" class="cardmain-form" data-ico="${o}" novalidate="">
                    <div class="avatar-container" style="min-height: 60px;">
                        <div id="avatarIcon" class="avatar-icon website-icon" style="background-image: url('${o}');background-color: ${s};">
                        </div>
                        <div  class="avatar-details update">
                            <div id="updateComfirmPwdTitle">
                                <input class="avatar-text form-control all-input placeholder-css edit-title on" spellcheck="false"  autocomplete="off"
                                maxlength="250" name="title"  type="text" value="" style='cursor:default' placeholder="${getMessage("title_placeholder")}">
                            </div>
                            <div class="from-all-inner from-up" style="display:${!1===t.showAddNew?"none":"block"}">
                                <a id="addNewAccount" class="btn-link btn-newuser btn-up" style='margin-top: -14px;'>
                                    ${getMessage("addNewAccount")}
                                </a>
                            </div>
                        </div>
                    </div>
                    <div class="from-all-container">
                        <div class="from-all-inner from-margin">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("username")}</span></label>
                            <div class="from-all-text">${e}</div>
                        </div>
                        <div class="from-all-inner">
                            <div class="from-inner">
                                <label class="fromAllContainer"><span class="label-text">${getMessage("password")}</span></label>
                                <div class="from-all-text">
                                    <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css"
                                        placeholder="${getMessage("password")}"
                                        id="updateLoginPassword" type="password" placeholder="" value="">
                                    <div class="ui-components">
                                        <button class="inputButton showpassword  on" type="button" title="${getMessage("showPass")}"></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="from-all-inner from-show">
                            <div class="from-inner from-up">
                                <label class="fromAllContainer d-flex justify-content-between">
                                    <span class="label-text">${getMessage("one_time_Password")}</span>
                                    <a class="learnmore" type="button">${getMessage("learn_more")}</a>
                                </label>
                                <div class="from-all-text">
                                    <input spellcheck="false"  autocomplete="off"  maxlength="2000"
                                        class="form-control all-input placeholder-css"
                                        placeholder="${getMessage("TOTP_placeholder")}"
                                        data-invalid = "false"
                                        name="totp"
                                        id="upLoginOneTimePwd" type="text" placeholder="">
                                    <div class="ui-components">
                                        <button class="inputButton btn-scan dpmtooltip" type="button" title="${getMessage("scan_web_page_QRCode")}"></button>
                                    </div>
                                </div>
                                <div class="otpauth-tips" style="opacity: 0;">${getMessage("invalid_secret_key")}</div>
                            </div>
                            <div class="from-all-inner  from-show from-none">
                                <label class="fromAllContainer">
                                    <span class="label-text">${getMessage("notes")}</span>
                                    <textarea class="form-control label-textarea text-textarea  placeholder-css"
                                        placeholder="${r}"
                                        spellcheck="false"  autocomplete="off"
                                        id="upLoginArea" placeholder="" 
                                        name="notes"
                                        maxlength="5000"></textarea>
                                    <div class="characters-tips hidden">${getMessage("notes_characters_tips")}</div>
                                </label>
                            </div>
                           <div class="update-tags from-up">${confirmtagshtml}</div>
                        </div>
                        <div class="savemore">
                            <a id="upshowmore" class="btn-link btn-more showmore">
                                <span class="more-label">${getMessage("advancedOptions")}</span>
                                <i class="more-icon"></i>
                            </a>
                        </div>
                </form>
            </main>
            <footer class="cardmain-footer">
                <div class="d-flex justify-content-end">
                    <a id="notSaveUpdatePassword" class="btn-link btn-notnow">
                        ${getMessage("cancel")}
                    </a>
                    <button id="saveUpdatePassword" class="button-css button-blue button-save">
                        <span>${getMessage("update")}</span>
                    </button>
                </div>
            </footer>
        </div>
        `,$$("confirm-container").innerHTML=confirm_html,setOverflowHint(".button-save",getMessage("update")),$("#updateComfirmPwdTitle").find(".form-control").val(l)),d;1<t.option.length?($$("updateLoginPassword").value=t.option[0].password,$$("updateUsername").onchange=function(e){$("#updateComfirmPwdTitle input").removeClass("is-invalid"),$$("updateComfirmPwdTitle").querySelector(".form-control").value=t.option[e.target.selectedIndex].title,$$("updateLoginPassword").value=t.option[e.target.selectedIndex].password,$$("upLoginArea").value=t.option[e.target.selectedIndex].notes,$$("upLoginOneTimePwd").value=t.option[e.target.selectedIndex].totp,$$("update-password-form").setAttribute("data-ico",t.option[e.target.selectedIndex].ico),$$("updateUsername").setAttribute("data-username",t.option[e.target.selectedIndex].id),c=guid2color(t.option[e.target.selectedIndex].id),isBlank(t.option[e.target.selectedIndex].ico)?$("#avatarIcon").css({"background-image":"../img/ico_login_default.png","background-color":c}):$("#avatarIcon").css({"background-image":"url("+t.option[e.target.selectedIndex].ico,"background-color":"#fff"}),d=e.target.selectedIndex,$(".update-tags").html(""),$(".update-tags").html(confirmtagshtml),$(".update-tags .from-tags").show(),initConfirmTagify(t,d)}):($$("updateUsername").value=t.option[0].username,$$("updateLoginPassword").value=t.option[0].password),$$("confirm-container").querySelector('.form-control[name="totp"]').value=t.option[0].totp,confirmInvalidTOTP(t.option[0].totp),$$("confirm-container").querySelector('.form-control[name="notes"]').value=t.option[0].notes,initConfirmTagify(t,0),confirmTooltip(),btnScanClickEvent("confirm-container"),document.querySelectorAll(".showpassword").forEach(e=>e.addEventListener("click",showPasswordsCheck.bind(this)));let u=$$("confirm-container").querySelectorAll(".from-show"),m=(1==t.static.expand?updateContainerExpand(u,t):setConfirmContainerHeight(t),$("#upshowmore").off("click").on("click",function(){updateContainerExpand(u,t)}),$$("updateClose").onclick=e=>{isBlank($("#updateComfirmPwdTitle input").val())?($("#updateComfirmPwdTitle input").addClass("is-invalid"),$("#updateComfirmPwdTitle input").focus()):(handle.sendMessage("CONFIRM",{cancel:!0},"*"),handle.sendMessage("CLOSE_CFIRMBOX",{}))},$$("notSaveUpdatePassword").onclick=e=>{handle.sendMessage("CONFIRM",{cancel:!0},"*"),handle.sendMessage("CLOSE_CFIRMBOX",{})},$("#updateComfirmPwdTitle input").on("input propertychange keyup change",function(){$("#updateComfirmPwdTitle input").hasClass("is-invalid")&&($("#updateComfirmPwdTitle input").attr("placeholder",getMessage("title_placeholder")),isBlank($("#updateComfirmPwdTitle input").val())?$("#updateComfirmPwdTitle input").addClass("is-invalid"):$("#updateComfirmPwdTitle input").removeClass("is-invalid"))}),$$("updateComfirmPwdTitle").onclick=e=>{$$("updateComfirmPwdTitle").querySelector(".form-control[name='title']").classList.remove("on"),$$("updateComfirmPwdTitle").querySelector("input").style.cursor="text";var t=$("#updateComfirmPwdTitle").find("input").val();$("#updateComfirmPwdTitle").find("input").val(t),$$("updateComfirmPwdTitle").classList.remove("on"),$$("addNewAccount").style.marginTop=0},""),p="",f="",g=[];$(" .form-control[name='totp']").on("input propertychange keyup change",function(e){$(this).attr("data-change",!0)}),1<t.option.length?$$("saveUpdatePassword").onclick=async e=>{checkBlankSpace(m=$$("updateComfirmPwdTitle").querySelector("input").value)?($("#updateComfirmPwdTitle input").removeClass("is-invalid"),p=checkBlankSpace($$("updateLoginPassword").value)?$$("updateLoginPassword").value:"",f=checkBlankSpace($$("updateUsername").getAttribute("data-username"))?$$("updateUsername").getAttribute("data-username"):"",g=confirmGetTags(),(await handle.sendMessage("CONFIRM",{do:"restore",id:f,pwd:p,title:$$("updateComfirmPwdTitle").querySelector("input").value,totp:$$("confirm-container").querySelector('.form-control[name="totp"]').value,notes:$$("confirm-container").querySelector('.form-control[name="notes"]').value,taglist:g})).succ&&""!=$$("confirm-container").querySelector('.form-control[name="totp"]').value&&("addtotp"==t.from||"scan"==$(".btn-scan").attr("data-type")?(cnt411=!0,cnt412=!0):1!=$(".form-control[name='totp']").attr("data-change")&&"true"!=$(".form-control[name='totp']").attr("data-change")||(cnt411=!0,cnt412=!1),cont411_412()),handle.sendMessage("CLOSE_CFIRMBOX",{})):($$("updateComfirmPwdTitle").querySelector("input").classList.add("is-invalid"),$("#updateComfirmPwdTitle input").focus())}:$$("saveUpdatePassword").onclick=async e=>{checkBlankSpace(m=$$("updateComfirmPwdTitle").querySelector("input").value)?($("#updateComfirmPwdTitle input").removeClass("is-invalid"),p=checkBlankSpace($$("updateLoginPassword").value)?$$("updateLoginPassword").value:"",f=checkBlankSpace($$("updateUsername").getAttribute("data-username"))?$$("updateUsername").getAttribute("data-username"):"",g=confirmGetTags(),(await handle.sendMessage("CONFIRM",{do:"restore",id:f,pwd:p,totp:$$("confirm-container").querySelector('.form-control[name="totp"]').value,notes:$$("confirm-container").querySelector('.form-control[name="notes"]').value,title:$$("updateComfirmPwdTitle").querySelector("input").value,taglist:g})).succ&&cont411_412(),handle.sendMessage("CLOSE_CFIRMBOX",{})):($("#updateComfirmPwdTitle").find("input").focus(),$$("updateComfirmPwdTitle").querySelector("input").classList.add("is-invalid"))},$$("addNewAccount").addEventListener("click",function(){addContainerUpdate(t,"addnew")}),document.querySelector(".learnmore").onclick=e=>{handle.sendMessage("APPGOTO",{appgoto:"LearnMoreTOTP"})}}function siteIsSafe(){confirm_html="",confirm_html=`
        <div class="safe-layout">
            <header class="safe-header">iTop Password Manager</header>
            <main class="cardmain-layout">
                <div class="avatar-container d-flex align-items-center">
                    <div class="avatar-icon safe-icon"></div>
                    <div class="safe-desc avatar-details">
                        This site is safe
                    </div>
                </div>
            </main>
        </div>
    `,$$("confirm-container").innerHTML=confirm_html}function autoPwdHtml(e){return`
        <div class="autoPassword" style="display: none;">
            <div class="form-switch d-flex justify-content-between">
                <div class="form-check-label">
                    <h3 data-properties="auto_save_passwords">${getMessage("auto_save_passwords")}</h3>
                    <p data-properties="auto_save_confirm_desc">${getMessage("auto_save_confirm_desc")}</p>
                </div>
                <input class="form-check-input" spellcheck="false" type="checkbox" role="switch" id='${e}AutoPwd'>
            </div>
        </div>
    `}async function autoPwdGetEvent(e,t){try{var a=await handle.sendMessage("GET_PREF",{});t.showAutoSave?($$("confirm-container").querySelector(".autoPassword").style.display="block",a.Auto.AutoSavePrompt||(input_send=await handle.sendMessage("SET_PREF",{pref:!0}),a.Auto.AutoSavePrompt=!0)):$$("confirm-container").querySelector(".autoPassword").style.display="none",$$(e+"AutoPwd").checked=a.Auto.AutoSavePrompt}catch(e){}}function autoPwdSendEvent(t){$("#"+t+"AutoPwd").on("change",function(){!async function(){var e;try{(e=$$(t+"AutoPwd").checked)||useOfStatistical("415"),await handle.sendMessage("SET_PREF",{pref:e})}catch(e){}}()})}function autoSavePwdHtml(e){let t="",a="";return a=isBlank(e.ico)?(t="../img/ico_login_default.png",guid2color(e.id)):(t=e.ico,"#fff"),`
		<div id="confirm-auto">
            <header class="cardlayout-header d-flex align-items-center">
                <span class="header-logo"></span>
                <div class="header-titleContainer">
                    <span>${getMessage("auto_saved_successfully")}</span>
                </div>
                <button id="${e.id}AutoClose" type="button" class="confirm-btn confirm-close auto-close time" title="">5s</button>
            </header>
            <main class="cardmain-layout">
                <ul class="confirm-list">
                    <li controls-id="${e.id}" class="list-item">
                        <div class="credential-inner">
                            <div class="credential-info-container">
                                <div class="website-icon" style="background-color: ${a}; background-image: url(${t});"></div>
                            </div>
                            <div class="credential-info-content">
                                <p class="titleContainer user">${e.title}</p>
                                <em class="subtitle name">${e.username}</em>
                            </div>
                        </div>
                        <div class="itemContainer">
                            <div class="delete-view dropstart">
                                <button type="button" class="action-button delete-button dpmtooltip"
                                    title="${getMessage("delete")}"
                                    data-bs-toggle="dropdown" aria-expanded="true">
                                </button>
                                <div class="dropdown-menu dropdown-menu-more">
						            <button type="button" class="action-button action-delete"
                                            action-type="delete" controls-url="${e.uri}"
                                            controls-id="${e.id}">
                                        <span>${getMessage("delete")}</span>
                                    </button>
                                    <button type="button" class="action-button action-delete"
                                            action-type="exclude" controls-id="${e.uri}"
                                            controls-id="${e.id}">
                                        <span>${getMessage("Delete_Exclude_website")}</span>
                                    </button>
					            </div>
                            </div>
                            <button type="button" class="action-button edit-button dpmtooltip" title="${getMessage("edit")}" controls-id="${e.id}"></button>
                        </div>
                    </li>
                </ul>
            </main>
        </div>
	`}function countDown(t,e){let a=Math.floor(e%60);countDownTimer=setInterval(function(){a<=1?(clearInterval(countDownTimer),handle.sendMessage("CONFIRM",{cancel:!0},"*"),handle.sendMessage("CLOSE_CFIRMBOX",{}),handle.sendMessage("AUTOSAVE_CLOSE",{})):(a--,$$(t.id+"AutoClose").innerHTML=a+"s",$$("confirm-auto").onmouseover=e=>{clearInterval(countDownTimer),$$(t.id+"AutoClose").classList.remove("time"),$$(t.id+"AutoClose").setAttribute("title",getMessage("close")),$$(t.id+"AutoClose").onclick=e=>{handle.sendMessage("CLOSE_CFIRMBOX",{}),handle.sendMessage("CONFIRM",{cancel:!0},"*"),handle.sendMessage("AUTOSAVE_CLOSE",{})}})},1e3)}async function autoSavePwdDelEvent(t,a){try{let e="";e="exclude"==a?t.static.uri:"",await handle.sendMessage("CLOSE_CFIRMBOX",{}),await handle.sendMessage("CONFIRM",{for:"blacklist",uri:[e]},"*");await handle.sendMessage("DELETE_ITEM",{id:t.static.id})}catch(e){}}async function autoSavePwdEditEvent(e,t){try{clearInterval(countDownTimer),addContainerUpdate(e,"auto")}catch(e){}}function autoSavePwdScreen(t){var e=autoSavePwdHtml(t.static),e=($$("confirm-container").innerHTML=e,$("#confirm-container .cardlayout-header").outerHeight()),a=$("#confirm-container .cardmain-layout").outerHeight(),e=Math.ceil(e+a);handle.sendMessage("SET_CONFIRIFRAMESTYPE",{style:"height",value:e}),countDown(t.static,5),confirmTooltip(),$(".confirm-list .list-item").each(function(e,t){210<Math.ceil($(t).find(".subtitle").html().pxWidth(13))?$(t).find(".subtitle").attr("title",$(t).find(".subtitle").html()):$(t).find(".subtitle").attr("title",""),210<Math.ceil($(t).find(".titleContainer").html().pxWidth(16))?$(t).find(".titleContainer").attr("title",$(t).find(".titleContainer").html()):$(t).find(".titleContainer").attr("title","")}),$$("confirm-container").querySelector(".edit-button").onclick=e=>{clickStopPropagation(e),useOfStatistical("418"),autoSavePwdEditEvent(t,"edit")},document.querySelectorAll(".action-delete").forEach(e=>e.addEventListener("click",function(e){clickStopPropagation(e),useOfStatistical("417");e=findAncestors(e.target,function(e){return e.classList&&e.classList.contains("action-delete")});e&&("exclude"==e.getAttribute("action-type")?autoSavePwdDelEvent(t,"exclude"):autoSavePwdDelEvent(t,""))},!1))}function load(n){if(confirm_html="",$("[data-properties]").each(function(){var e=$(this),t=$(this).attr("data-properties");e.html(getMessage(t))}),"store"==n.type)addContainer(n);else if("restore"==n.type)updateContainer(n);else if("lock"==n.type||"nologin"==n.type){confirm_html="lock"==n.type?`
            <div class="update-confirm">
            <header class="cardlayout-header d-flex align-items-center">
                <span class="header-logo" ></span>
                <div class="header-titleContainer">
                    <span>${getMessage("unlockDPM")}</span>
                </div>
                <button id="updateConfirmClose" type="button" class="confirm-btn confirm-close" aria-label="Close"
                    title="${getMessage("close")}">
                </button>
            </header>
            <main class="cardmain-layout">
                <div class="confirm-pic">
                    <img src="../images/DPM-min.gif" width="380" height="220" alt="" />
                </div>
                <div class="confirm-desc">
                    ${getMessage("unlockDPM_Desc")}
                </div>
            </main>
            <footer class="cardmain-footer">
                <div class="d-flex justify-content-end align-items-end">
                    <div class="notnow-list">
                        <a class="btn-link btn-notnow btn-reverse">
                            <span class="more-label">${getMessage("notNow")}</span>
                            <i class="more-icon"></i>
                        </a>
                        <ul class="notnow-menu" style="display: none;">
		                    <li id="notSaveConfirmPassword" key='now'>${getMessage("notNow")}</li>
		                    <li id="remindTmrConfirmPassword" key='day'>${getMessage("remind_me_tomorrow")}</li>
		                    <li id="remindDayConfirmPassword" key='week'>${getMessage("remind_me_after_days")}</li>
                            <li id="excludeWebsite" key='blacklist'>${getMessage("Exclude_website_new")}</li>
	                    </ul>
                    </div>
                    <button id="confirmPassword" class="button-css button-blue button-save">
                        <span>${getMessage("unlockSave")}</span>
                    </button>
                </div>
            </footer>
        </div>
        `:`
            <div class="update-confirm">
            <header class="cardlayout-header d-flex align-items-center">
               <span class="header-logo" ></span>
                <div class="header-titleContainer">
                    <span>${getMessage("signIn_DPM")}</span>
                </div>
                <button id="updateConfirmClose" type="button" class="confirm-btn confirm-close" aria-label="Close"
                    title="${getMessage("close")}">
                </button>
            </header>
            <main class="cardmain-layout">
                <div class="confirm-pic">
                    <img src="../images/DPM-min.gif" width="380" height="220" alt="" />
                </div>
                <div class="confirm-desc">
                    ${getMessage("signIn_Desc")}
                </div>
            </main>
            <footer class="cardmain-footer">
                <div class="d-flex justify-content-end align-items-end">
                    <div class="notnow-list">
                        <a class="btn-link btn-notnow btn-reverse">
                            <span class="more-label">${getMessage("notNow")}</span>
                            <i class="more-icon"></i>
                        </a>
                        <ul class="notnow-menu" style="display: none;">
		                    <li id="notSaveConfirmPassword" key='now'>${getMessage("notNow")}</li>
		                    <li id="remindTmrConfirmPassword" key='day'>${getMessage("remind_me_tomorrow")}</li>
		                    <li id="remindDayConfirmPassword" key='week'>${getMessage("remind_me_after_days")}</li>
	                    </ul>
                    </div>
                    <button id="confirmPassword" class="button-css button-blue button-save">
                        <span>${getMessage("signInSave")}</span>
                    </button>
                </div>
            </footer>
        </div>
        `,$$("confirm-container").innerHTML=confirm_html,isBlank(n.static.title)?$("#confirm-container").find(".btn-name").html(n.option[0].title):$("#confirm-container").find(".btn-name").html(n.static.title),"lock"==n.type?setOverflowHint(".button-save",getMessage("unlockSave")):setOverflowHint(".button-save",getMessage("signInSave"));var o=getMessage("remind_me_after_days");let e=parseInt(o.pxWidth(13));e=340<=e?340:parseInt(o.pxWidth(13))+40,$$("confirm-container").querySelector(".notnow-menu").style.minWidth=e+"px";var o=$("#confirm-container .cardlayout-header").outerHeight(),s=$("#confirm-container .cardmain-layout").outerHeight()+20,i=$("#confirm-container .cardmain-footer").outerHeight(),o=Math.ceil(o+s+i);handle.sendMessage("SET_CONFIRIFRAMESTYPE",{style:"height",value:o}),$$("updateConfirmClose").onclick=e=>{handle.sendMessage("CONFIRM",{cancel:!0},"*"),handle.sendMessage("CLOSE_CFIRMBOX",{})};let t=$$("confirm-container").querySelector(".notnow-menu"),a;$$("confirm-container").querySelector(".btn-notnow").onclick=e=>{clickStopPropagation(e),"none"===t.style.display||""===t.style.display?(a=e.target.offsetHeight+10,t.style.bottom=a+"px",t.style.display="block",$$("confirm-container").querySelector(".btn-notnow").classList.add("on"),$("#confirm-container .notnow-menu li").off("click").on("click",function(e){clickStopPropagation(e);let t=$(this).attr("key"),a="";a="blacklist"==t&&"lock"==n.type?n.uri[0]:"",handle.sendMessage("CONFIRM",{do:"donotshow",for:t,uri:[a]}),handle.sendMessage("CLOSE_CFIRMBOX",{})}),document.onclick=function(){$$("confirm-container").querySelector(".btn-notnow").classList.remove("on"),t.style.display="none"}):($$("confirm-container").querySelector(".btn-notnow").classList.remove("on"),t.style.display="none")},$$("confirmPassword").onclick=e=>{handle.sendMessage("OPEN_LOGINTAB",{}),handle.sendMessage("CLOSE_CFIRMBOX",{})}}else"saved"==n.type&&autoSavePwdScreen(n)}countDownTimer=0;