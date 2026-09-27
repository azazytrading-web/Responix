function chromeGetMessage(e,t){return null==t||isNaN(t)||(t+=""),chrome.i18n.getMessage(e,t)}function getMessage(e,t){if(e){if("undefined"!=typeof localeMessages&&null!=localeMessages){var s=localeMessages[e];if(s){var n=(n=s.message)&&n.replace(/\$\$/g,"$");if(null!=t)if(t instanceof Array)for(var i=0;i<t.length;i++)n=n.replace("$"+(i+1),t[i]);else n=n.replace("$1",t);return n}}return chromeGetMessage(e,t)}}function $$(e){return document.getElementById(e)}function GPCopyToClipboard(e){var t;navigator.clipboard&&window.isSecureContext?navigator.clipboard.writeText(e).then(()=>{}):((t=document.createElement("textarea")).value=e,t.style.position="absolute",t.style.opacity="0",t.style.left="-999999px",t.style.top="-999999px",document.body.appendChild(t),t.focus(),t.select(),document.execCommand("copy"),t.remove())}let parentId=$$("dpmLogin"),loginicon='<i class="login-icon" style="display: none;"></i>',logindot='<div class="dot-stage"><span class="dot-pulse"></span></div>',desktopicon='<i class="desk-icon"></i>',authbar='<div class="auth-progress"><div class="progress-bar"></div></div>';function threeLoginHtml(){return`
        <div class="three-container">
			<h5 class="three-title"><span >${getMessage("sign_in_with")}</span></h5>
			<div class="three-list">
				<button type="button" id="loginGoogle" class="button-three button-google" anchor="google" title="${getMessage("sign_in_with_google")}"></button>
				<button type="button" id="loginFacebook" class="button-three button-fb" anchor="facebook" title="${getMessage("sign_in_with_facebook")}"></button>
                <button type="button" id="loginDesktop" class="button-three button-desktop" anchor="desktop" title="${getMessage("sign_in_with_app")}" style="display: none;"></button>
			</div>
		</div>
    `}function signInBtnHtml(){return`
        <button type="button" class="button-css button-load button-sign">
			${getMessage("signIn")}
		</button>
    `}function lockBtnHtml(){return`
        <button class="button-css signout-button" type="button" title="${getMessage("signOut")}">
			<i class="svg-css svg-out"></i>
		</button>
    `}function continueBtnHtml(){return`
        <button type="button" class="button-css button-blue button-continue" disabled>
			<span class="login-txt">${getMessage("continue")}</span>
            ${loginicon}
		</button>
    `}function changeBtnHtml(){return`
        <button type="button" class="button-css button-blue button-change" disabled>
			<span class="login-txt">${getMessage("change_now")}</span>
		</button>
    `}function successBtnHtml(e){return`
        <button type="button" class="button-css button-blue button-success">
			<span class="login-txt">${getMessage("set"==e?"signIn":"ok")}</span>
		</button>
    `}function codeNotBtnHtml(){return`
        <button type="button" class="button-link button-not">${getMessage("not_have_code")}</button>
    `}function backBtnHtml(){return`
        <button class="button-link button-back" type="button">
			<i class="auth-back"></i>
			<span></span>
		</button>
    `}var is_email=function(e){return/^\w[-\w.+]*@([A-Za-z0-9][-A-Za-z0-9]*\.)+[A-Za-z]{2,14}$/.test(e)};function savepdfBtnHtml(){return`
        <div class='pdf-action'>
            <button type="button" class="button-css button-small button-blue button-pdf">
			    <span class="login-txt">${getMessage("save_as_pdf")}</span>
		    </button>
            <button type="button" class="button-css button-small button-blue send-email"
                title="${getMessage("send_email_hint")}"
                            data-bs-delay = '100'
                            data-bs-toggle="tooltip" data-bs-placement="top" data-bs-offset="0,0" data-bs-trigger="hover"></button>
        </div>
    `}function alreadyBtnHtml(e){return`
        <button type="button" class="button-css button-small button-already">
			${getMessage("already_saved")}
		</button>
    `}function copyBtnHtml(){return`
        <button class="button-copy" type="button" title="${getMessage("copy")}" style="display: none;"></button>
    `}function welcomeHtml(){var e=signInBtnHtml(),t=threeLoginHtml(),e=`
        <div id="ipsLoad" class="load-container app-container">
		    <div class="content-inner">
			    <div class="logo-image"><img src="./images/logo.svg" width="88" height="88" alt="${getMessage("appName")}"></div>
			    <h4 class="wel-title">${getMessage("welcomeTo")}</h4>
			    <h2 class="title">${getMessage("appName")}</h2>
			    <div class="input-container">
				    <div class="input-account">
					    <p class="already-tips" style="opacity: 0;">${getMessage("alreadyAccount")}</p>
					    <button type="submit" class="button-css  button-blue button-create">
						    <span>${getMessage("createNewAccount")}</span>
					    </button>
				    </div>
                    ${e}
			    </div>
			    ${t}
		    </div>
	    </div>
    `;$$("dpmLogin").innerHTML=e}let lockhead=`
    <header class="login-header">
        <div class="logo-image"><img src="./images/logo_20.png" width="20" height="20" alt="${getMessage("appName")}"></div>
		<h5 class="header-title">${getMessage("appName")}</h5>
    </header>
`,lockwhitehead=`
    <header class="login-header">
        <div class="logo-image">
			<img src="./images/logo_64.png" width="64" height="64" alt="${getMessage("appName")}">
		</div>
		<h5 class="header-title">${getMessage("appName")}</h5>
    </header>
`;function appHeaderHtml(e){let t="";0==e?t=`
            <div class="logo-image"><img src="./images/logo_20.png" width="20" height="20" alt="${getMessage("appName")}"></div>
			<h5 class="header-title">${getMessage("appName")}</h5>
        `:1==e&&(t=`
            <div class="logo-image">
				<img src="./images/logo_64.png" width="64" height="64" alt="${getMessage("appName")}">
			</div>
			<h5 class="header-title">${getMessage("appName")}</h5>
        `),document.querySelector(".login-header").innerHTML=t}function forgotPwdHtml(){return`
        <button type="button" class="button-link button-forgot">
			${getMessage("forgotYourPass")}
		</button>
    `}function usernameInput(){return`
        <input spellcheck="false" autocomplete="off" name="username" class="form-input" type="text"
						            placeholder="${getMessage("enter_your_email_address")}" value="" maxlength = "250">
    `}function passwordInput(e){let t="";return`
        <input spellcheck="false" autocomplete="off" name="password" class="form-input pass-input" type="password"
                                    data-cid = '${e}' data-canvas = ''
						            placeholder="${t=getMessage("ipsSetPass"==e||"ipsChangePass"==e||"ipsRmasterPass"==e||"ipsLock"==e?"enterMasterNewPass":"ipsVerifyPass"==e||2==e?"enterMasterPass":"enterYourPass")}" value="" maxlength = "250">
    `}function codeInput(){return`
        <input name="code" spellcheck="false" autocomplete="off" class="form-input" type="text" 
                value="DPMC-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" disabled maxlength = "250">
    `}function recoverycodeInput(){return`
        <input spellcheck="false" autocomplete="off" name="recoverycode" class="form-input pass-input" type="text"
					placeholder="${getMessage("enterRecoveryCass")}" value="" maxlength = "250">
    `}function passwordCurrentInput(){return`
        <input name="current" spellcheck="false" autocomplete="off"  class="form-input pass-input" type="password"
						placeholder="${getMessage("currentMasterPass")}" value="" maxlength = "250">
    `}function passwordConfirmInput(){return`
        <input name="confirm" spellcheck="false" autocomplete="off"  class="form-input pass-input" type="password"
						placeholder="${getMessage("confirmMasterNewPass")}" value="" maxlength = "250">
    `}function showhideEyes(){return`
        <button class="showpassword" type="button" title="${getMessage("showPass")}" tabindex="-1"></button>
    `}function inputTipsStr(){return`
        <div id="inputTips" class="input-tips" style="display: none;">
			${getMessage("emailOrPassIncorrect")}
		</div>
    `}function passTipsStr(){return`
        <div class="password-tip" style="display: none;">
            <div class="pwd-checklist">
                <ul class="pwd-list">
                    <li class="pwd-checklist-item" key="length">${getMessage("password_tip_one")}</li>
				    <li class="pwd-checklist-item" key="number">${getMessage("password_tip_two")}</li>
				    <li class="pwd-checklist-item" key="symbol">${getMessage("password_tip_three")}</li>
			    </ul>
                <p class="password-note">${getMessage("password_tip_note")}</p>
            </div>
        </div>
    `}function passImportantTipsStr(){return`
        <p class="set-tips" style="opacity: 1; visibility: visible;">
			${getMessage("set_master_tips")}
		</p>
    `}function progresStr(){return`
        <div class="progress" style="opacity: 0;">
            <span class="score-segment"></span>
			<span class="score-segment"></span>
			<span class="score-segment"></span>
			<span class="score-segment"></span>
		</div>
    `}function toastHtml(){return`
        <div id="saveCodeToast" class="toast save-toast align-items-center" role="alert" aria-live="assertive" 
                aria-atomic="true" data-bs-delay="3000">
		    <div class="toast-body">
			    <i class="toast-icon success"></i>
			    <p class="toast-span"></p>
		    </div>
	    </div>
    `}function modelHtml(){var e=`
        <div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header">
					<div class="confirm-icon">
						<div class="website-icon" style="background-image: url(./images/ico_window_info.svg)"></div>
					</div>
					<div class="confirm-info">
						<div class="modal-title">${getMessage("token_invalid_desc")}</div>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" 
                            class="button-css button-blue button-token"
						    data-bs-dismiss="modal">${getMessage("ok")}</button>
				</div>
		    </div>
		</div>
    `;$$("loglockTokenModal").innerHTML=e}function loginAndLockLoading(e,t){threeLoginHtml();let s="",n="";n="ipsLogin"==e?(s=getMessage("login_waiting_title"),getMessage("sign_in_now")):(s=getMessage("login_waiting_title"),getMessage("unlock_now")),0==t&&appHeaderHtml(0);e=`
        <div id="ipsLoginLoading" class="loading-container app-container">
            ${0==t?"":lockwhitehead}
		    <main class="auth-main">
			    <h3 class="auth-subtitle">${s}</h3>
			    <div class="auth-progress"><div class="progress-bar"></div></div>
		    </main>
		    <button type="button" class="button-link button-independ">
			    ${n}
		    </button>
	    </div>
    `;$$("dpmLogin").innerHTML=e}function loginLockConfirmation(e,t){let s="",n="",i="",o=getMessage("login_comfirm_desc");"login"==e?(n=getMessage("login_comfirm_btn"),s=getMessage("signIn"),appHeaderHtml(0),i=loinlogKeepSignHtml("loginkeepsign")):(s=getMessage("unlock"),n=getMessage("lock_comfirm_btn"));var a=`
        <div id="logLockComfirm" class="comfirm-container app-container">
            ${"lock"==e&&"popup"==t?lockwhitehead:""}
		    <main class="comfirm-main">
                <h3 class="comfirm-subtitle" style="display: ${"newtab"==t?"block":"none"}">${s}</h3>
                <p class="comfirm-desc ${"newtab"==t?"newtab":""}">${o}</p>
                <div class="input-container">
                    <button type="button" class="button-css button-comfirm">
                        <i class="icon-user"></i>
                        <span class="comfirm-email">example@gmail.com</span>
                        <i class="icon-desk"></i>
                    </button>
                    ${"login"==e?i:""}
                </div>
                <div class="action-container ${"login"==e?"sign-container":""}">
                    <button type="button" class="button-link button-manually">
			            ${n}
		            </button>
                </div>
		    </main>
	    </div>
    `;$$("dpmLogin").innerHTML=a,"login"==e&&modelHtml(),"newtab"==t&&"login"!=e&&appHeaderHtml(0)}function hasOwn(e,t){return Object.prototype.hasOwnProperty.call(e,t)}function setOptionElementTitle(e,t,s,n){Math.ceil(t.pxWidth(n))>s?e.attr("title",t):e.removeAttr("title")}function optionInitSelectBox(n,e){let t,s,i,o=(t=e.day,s=$("#"+n+"-dropdown option[value='"+t+"']").text(),setOptionElementTitle($("#"+n+" .chxkeep-sign"),s,105,13),e.switch);$$("dpmLogin").querySelector(".form-check.remind").checked=o,$("#"+n+"-dropdown").selectBox({mobile:!0}).change(async function(){let e="",t="",s;try{o=$$("dpmLogin").querySelector(".form-check.remind").checked,s=$("#"+n+"-dropdown option:selected").text(),setOptionElementTitle($("#"+n+" .chxkeep-sign"),s,105,13),o?(e=$("#"+n+"-dropdown").val(),t=$("#"+n+"-dropdown option[value='"+e+"']").attr("data-type"),await handle.sendMessage("SET_AUTOLOGINCFG",{switch:!0,day:t})):(e=$("#"+n+"-dropdown").val(),t=$("#"+n+"-dropdown option[value='"+e+"']").attr("data-type"),await handle.sendMessage("SET_AUTOLOGINCFG",{switch:!1,day:t}))}catch(e){}}),new SelectBox($("#"+n+"-dropdown")).setValue(t),$("#loginkeepsign-dropdown option").each(function(){i=$("#"+n+"-dropdown option[value='"+$(this).val()+"']").text(),setOptionElementTitle($(".selectBox-dropdown-menu li").eq($("#"+n+"-dropdown option[value='"+$(this).val()+"']").index()).find("a"),i,130,12)}),$("#"+n+"-dropdown").attr("data-type",t),$(".login-body .form-check.remind").on("change",async function(e){try{(o=$$("dpmLogin").querySelector(".form-check.remind").checked)?(keepsendval=$("#"+n+"-dropdown").val(),keepsendtype=$("#"+n+"-dropdown option[value='"+keepsendval+"']").attr("data-type"),await handle.sendMessage("SET_AUTOLOGINCFG",{switch:!0,day:keepsendtype})):(keepsendval=$("#"+n+"-dropdown").val(),keepsendtype=$("#"+n+"-dropdown option[value='"+keepsendval+"']").attr("data-type"),await handle.sendMessage("SET_AUTOLOGINCFG",{switch:!1,day:keepsendtype}))}catch(e){}})}function debounce(e,t=3e3){var s=null;return function(){clearTimeout(s),s=setTimeout(()=>{e.apply(this,arguments)},t)}}function chxkeepHintShowYesOrNo(){var t=null;$("body").on("mouseenter mouseleave",".loglock-keep",function(e){"mouseenter"==e.type?(clearTimeout(t),t=setTimeout(()=>{$(".chxkeep-hint").show()},300)):"mouseleave"==e.type&&(clearTimeout(t),t=setTimeout(()=>{$(".chxkeep-hint").hide()},300))})}function loinlogKeepSignHtml(e){return`
        <div class="loglock-keep">
		    <div class="login-check login-keep" style="opacity: 1;">
			    <input spellcheck="false" autocomplete="off" class="form-check remind" name="loginremind" checked type="checkbox"
				    value="" id="${e}OptionCheckDefault">
			    <label class="form-label remind" for="${e}OptionCheckDefault">
				    ${getMessage("Checkbox_Keep_signed")}
			    </label>
			    <i class="keepsign-icon"></i>
		    </div>
		    <div id="${e}" class="keepsign-menu">
			    <select id="${e}-dropdown" name="${e}-dropdown" class="chxkeep-sign">
				    <option value="7" data-type="7" data-minute="7">${getMessage("sevenDays")}</option>
				    <option value="14" data-type="14" data-minute="14">${getMessage("fourteenDays")}</option>
				    <option value="30" data-type="30" data-minute="30">${getMessage("thirtyDays")}</option>
				    <option value="60" data-type="60" data-minute="60">${getMessage("sixtyDays")}</option>
				    <option value="90" data-type="90" data-minute="90">${getMessage("ninetyDays")}</option>
				    <option value="-1" selected="selected" data-type="-1" data-minute="4">${getMessage("until_sign_out")}</option>
			    </select>
		    </div>
	    </div>
	    <div class="chxkeep-hint" style="display: none;">${getMessage("Checkbox_Keep_signed_Hint")}</div>
    `}function loginHtml(){var e=usernameInput(),t=passwordInput(""),s=showhideEyes(),n=forgotPwdHtml(),i=inputTipsStr(),o=threeLoginHtml(),a=loinlogKeepSignHtml("loginkeepsign"),e=`
        <div id="ipsLogin" class="login-container app-container">
		    <main class="login-main">
			    <h2 class="login-title">${getMessage("signIn")}</h2>
			    <p class="login-desc">
				    <span>${getMessage("newUser")}</span>
				    <button type="button" class="button-link button-create">${getMessage("create_new_account")}</button>
			    </p>
			    <div class="input-container">
				    <div class="field-container">${e}</div>
				    <div class="field-container field-pass">${t+s}</div>
				    ${i}
			    </div>
			    <div class="action-container">
				    ${a}
				    <button  type="submit" class="button-css button-blue button-login" disabled>
					    <span class="login-txt">${getMessage("signIn")}</span>
                        ${logindot}
				    </button>
				    ${n}
			    </div>
			    ${o}
		    </main>
	    </div>
    `;appHeaderHtml(0),$$("dpmLogin").innerHTML=e,modelHtml()}function logintwoHtml(){var e=usernameInput(),t=lockBtnHtml(),s=passwordInput("ver"),n=showhideEyes(),i=forgotPwdHtml(),o=inputTipsStr(),a=loinlogKeepSignHtml("lockeepsign"),e=`
        <div id="ipsLogin" class="lock-container logintwo app-container">
		    <main class="login-main">
			    <h2 class="login-title">${getMessage("signIn")}</h2>
			    <div class="input-container">
				    <div class="field-main">
					    <div class="field-container">
						    <i class="icon-user"></i>
                            ${e}
					    </div>
					    ${t}
				    </div>
				    <div class="field-container field-pass">${s+n}</div>
				    ${o} 
			    </div>
			    <div class="action-container">
                    ${a}
				    <button  type="submit" class="button-css button-blue button-login" disabled>
					    <span class="login-txt">${getMessage("signIn")}</span>
                        ${logindot}
				    </button>
				    ${i}
			    </div>
		    </main>
	    </div>
    `;appHeaderHtml(0),$$("dpmLogin").innerHTML=e,$$("dpmLogin").querySelector(".signout-button").setAttribute("title",getMessage("exit")),modelHtml()}function lockHtml(e){var t=usernameInput(),s=lockBtnHtml(),n=passwordInput("ipsLock"),i=showhideEyes(),o=forgotPwdHtml(),a=inputTipsStr(),e=("newtab"==e&&appHeaderHtml(0),`
        <div id="ipsLock" class="lock-container app-container">
            ${"popup"==e?lockhead:""}
		    <main class="login-main">
			    <h2 class="login-title">${getMessage("unlock")}</h2>
			    <div class="input-container">
				    <div class="field-main">
					    <div class="field-container"><i class="icon-user"></i>${t}</div>${s}
				    </div>
				    <div class="field-container field-pass">${n+i}</div>
				    ${a} 
			    </div>
			    <div class="action-container">
				    <button  type="submit" class="button-css button-blue button-login" disabled>
					    <span class="login-txt">${getMessage("unlock")}</span>
                        ${logindot}
				    </button>
				    ${o}
			    </div>
		    </main>
	    </div>
    `);$$("dpmLogin").innerHTML=e}function setPassHtml(e){var t=usernameInput(),s=passwordInput("ipsSetPass"),n=passwordConfirmInput(),i=showhideEyes(),o=progresStr(),a=passTipsStr(),l=inputTipsStr(),c=passImportantTipsStr(),r=continueBtnHtml(),t=`
        <div id="ipsSetPass" class="set-container app-container ${"setMasterkey"==e?"":"set-noskip"}" data-cid="ipsSetPass"  data-canvas=''>
		    <main class="set-main">
			    <div class="inner-container">
                    <h2 class="set-title">${getMessage("set_master_title")}</h2>
			        <p class="set-desc">${getMessage("set_master_password_tips")}</p>
			        <div class="input-container">
				        <div class="field-container  set-user field-current">
					        <i class="icon-user"></i>
                            ${t}
				        </div>
				        <div class="field-container field-pass set-pass">${s+i+a}</div>
				        ${o}
				        <div class="field-container field-confirm">${n+i}</div>
				        ${l}
			        </div>
                </div>
			    <div class="action-container">
				    ${c}
				    ${r}
				    <button type="button" id="btnSkipNow" class="button-css button-link button-skip" style='display: ${"setMasterkey"==e?"inline-block":"none"}'>
					    ${getMessage("skip_for_now")}
				    </button>
			    </div>
		    </main>
	    </div>
    `;$$("dpmLogin").innerHTML=t,$$("ipsSetPass").querySelector(".input-tips").innerHTML=getMessage("match_change_pass"),"setMasterkey"==e?$$("ipsSetPass").querySelector(".set-tips").classList.remove("three"):$$("ipsSetPass").querySelector(".set-tips").classList.add("three"),appHeaderHtml(0)}function resetSetPassHtml(){var e=backBtnHtml(),t=(lockBtnHtml(),usernameInput()),s=passwordInput("ipsRmasterPass"),n=passwordConfirmInput(),i=showhideEyes(),o=progresStr(),a=passTipsStr(),l=inputTipsStr(),c=passImportantTipsStr(),r=continueBtnHtml(),e=`
        <div id="ipsRmasterPass" class="rmaster-container app-container" data-cid="ipsRmasterPass"  data-canvas=''>
		    <main class="rmaster-main">
                ${e}
			    <div class="inner-container">
                    <h2 class="rmaster-title">${getMessage("reset_master_title")}</h2>
			        <p class="rmaster-desc">${getMessage("set_master_password_tips")}</p>
			        <div class="input-container">
				        <div class="field-main">
					        <div class="field-container field-current"><i class="icon-user"></i> ${t}</div>
                        </div>
				        <div class="field-container field-pass set-pass">${s+i+a}</div>
				        ${o}
				        <div class="field-container field-confirm">${n+i}</div>
				        ${l}
			        </div>
                </div>
			    <div class="action-container">${c+r}</div>
		    </main>
	    </div>
    `;appHeaderHtml(0),$$("dpmLogin").innerHTML=e,$$("ipsRmasterPass").querySelector(".input-tips").innerHTML=getMessage("match_change_pass"),$$("ipsRmasterPass").querySelector(".button-back").querySelector("span").innerHTML=getMessage("back"),$$("ipsRmasterPass").querySelector(".button-continue").querySelector(".login-txt").innerHTML=getMessage("reset")}function changePassHtml(){var e=passwordCurrentInput(),t=passwordInput("ipsChangePass"),s=passwordConfirmInput(),n=showhideEyes(),i=progresStr(),o=passTipsStr(),a=inputTipsStr(),l=continueBtnHtml(),e=`
        <div id="ipsChangePass" class="change-container app-container" data-cid="ipsChangePass"  data-canvas=''>
		    <main class="change-main">
			    <div class="inner-container">
                    <h2 class="change-title">${getMessage("change_title")}</h2>
			        <div class="input-container">
				        <div class="field-container field-current">${e+n}</div>
				        <div class="field-container field-pass set-pass">
                            ${t+n+o}
				        </div>
                        ${i}
				        <div class="field-container field-confirm">${s+n}</div>
				        ${a}
			        </div>
                </div>
			    <div class="action-container">${l}</div>
		    </main>
	    </div>
    `;appHeaderHtml(0),$$("dpmLogin").innerHTML=e,$$("dpmLogin").querySelector(".button-continue").querySelector(".login-txt").innerHTML=getMessage("change_now")}function changePassSuccHtml(e){let t=successBtnHtml(e),s="";s=getMessage("set"==e?"set_success_desc":"reset_success_desc");e=`
        <div id="ipsResetSuccess" class="success-container app-container">
		    <main class="success-main">
			    <div class="success-image">
				    <img src="./images/icon_succeed.svg" width="114" height="114" alt="Success">
			    </div>
			    <h2 class="success-title">${getMessage("reset_success_title")}</h2>
			    <p class="success-desc">${s}</p>
			    <div class="action-container"> ${t}</div>
		    </main>
	    </div>
    `;appHeaderHtml(0),$$("dpmLogin").innerHTML=e}function verifyMasterPassHtml(){var e=passwordInput("ipsVerifyPass"),t=showhideEyes(),s=inputTipsStr(),n=continueBtnHtml(),e=`
        <div id="ipsVerifyPass" class="verify-container app-container">
		    <main class="code-main">
			    <div class="inner-container">
                    <h2 class="code-title">${getMessage("code_title")}</h2>
			        <p class="code-desc">${getMessage("code_desc")}</p>
			        <div class="input-container">
				        <div class="field-container field-pass">${e+t}</div>
                        ${s}
			        </div>
                </div>
			    <div class="action-container">${n}</div>
		    </main>
	    </div>
    `;appHeaderHtml(0),$$("dpmLogin").innerHTML=e,$$("dpmLogin").querySelector(".input-tips").innerHTML=getMessage("invalid_master_tips")}function saveRcCodeHtml(e){document.getElementsByTagName("body")[0].classList.add("noverhide");var t=`
            <button class="button-copy" type="button" title="${getMessage("copy")}"
                            data-bs-delay = '100'
                            data-bs-toggle="tooltip" data-bs-placement="top" data-bs-offset="0,0" data-bs-trigger="hover"></button>
        `,s=(toastHtml(),codeInput()),n=savepdfBtnHtml(),i=alreadyBtnHtml(),s=`
        <div id="ipsSaveCode" class="save-container app-container">
		    <main class="save-main">
			    <div class="inner-container">
                    <h2 class="save-title"></h2>
			        <p class="save-desc"></p>
			        <div class="input-container">
				        <div class="field-container  field-code">${s+t}</div>
			        </div>
                </div>
			    <div class="action-container">
				    <p class="save-tips" style="opacity: 1; visibility: visible;">${getMessage("save_code_tips")}</p>
                    ${n+i}
			    </div>
		    </main>
	    </div>
    `;appHeaderHtml(0),$$("dpmLogin").innerHTML=s,"savenew"==e?($$("dpmLogin").querySelector(".save-title").innerHTML=getMessage("save_code_new_title"),$$("dpmLogin").querySelector(".save-desc").innerHTML=getMessage("save_code_desc_options")):($$("dpmLogin").querySelector(".save-title").innerHTML=getMessage("save_code_title"),$$("dpmLogin").querySelector(".save-desc").innerHTML=getMessage("save_code_desc_login"))}function authWaitingHtml(){var e=`
        <div id="ipsAuth" class="auth-container app-container">
                <main class="auth-main">
                    ${backBtnHtml()}
			        <h2 class="auth-title">${getMessage("auth_title")}</h2>
			        <p class="auth-desc">${getMessage("auth_desc")}</p>
			        <h3 class="auth-subtitle">${getMessage("auth_subtitle")}</h3>
			        ${authbar}
			        <p class="auth-desc auth-bottom">${getMessage("auth_bottom_desc")}</p>
		    </main>
	    </div>
    `;appHeaderHtml(0),$$("dpmLogin").innerHTML=e,$$("dpmLogin").querySelector(".button-back").querySelector("span").innerHTML=getMessage("go_back_to_signin")}function resetPassHtml(e){let t=usernameInput(),s=backBtnHtml(),n=inputTipsStr(),i=continueBtnHtml(),o=signInBtnHtml();"newtab"===e?s=backBtnHtml():"popup"===e&&(s="");var a=`
        <div id="ipsResetPass" class="reset-container app-container reset-${e}">
		    <main class="reset-main">
                ${s}
			    <div class="inner-container">
                    <h2 class="reset-title">${getMessage("reset_title")}</h2>
			        <p class="reset-desc">${getMessage("reset_desc")}</p>
			        <div class="input-container">
				        <div class="field-container">${t}</div>
                        ${n}
			        </div>
                </div>
			    <div class="action-container">${i+o}</div>
		    </main>
	    </div>
    `;appHeaderHtml(0),$$("dpmLogin").innerHTML=a,"newtab"===e&&($$("dpmLogin").querySelector(".button-back").querySelector("span").innerHTML=getMessage("back")),$$("ipsResetPass").querySelector(".form-input[name='username']").setAttribute("placeholder",getMessage("reset_email_place")),$$("ipsResetPass").querySelector(".input-tips").innerHTML=getMessage("invalid_email")}function resetPassRcCodeHtml(){var e=usernameInput(),t=recoverycodeInput(),s=backBtnHtml(),n=inputTipsStr(),i=(lockBtnHtml(),continueBtnHtml()),o=codeNotBtnHtml(),s=`
        <div id="ipsResetCodePass" class="reset-container app-container recovery">
		    <main class="reset-main">
                ${s}
			    <div class="inner-container">
                    <h2 class="reset-title">${getMessage("reset_code_title")}</h2>
			        <p class="reset-desc">${getMessage("reset_code_desc")}</p>
			        <div  class="input-container">
                        <div class="field-main">
				            <div class="field-container"><i class="icon-user"></i> ${e}</div>
			            </div>
			            <div class="field-container field-pass recode-field">${t}</div>
                        <p class="example-tips">e.g.: DPMR-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF</p>
                        ${n}
                    </div>
                </div>
			    <div class="action-container">${i+o}</div>
		</main>
	</div>
    `;appHeaderHtml(0),$$("dpmLogin").innerHTML=s,$$("dpmLogin").querySelector(".button-back").querySelector("span").innerHTML=getMessage("back"),$$("ipsResetCodePass").querySelector(".input-tips").innerHTML=getMessage("Invalid_Recovery_Code_New")}function firstToUpper1(e){return e.trim().toLowerCase().replace(e[0],e[0].toUpperCase())}function OpenURL(e,t){0==t?window.location=e:1==t?window.open(e):2==t&&(window.open(e),self.focus())}function findAncestors(e,t){for(;null!=e;){if(t.call(null,e))return e;e=e.parentNode}return null}function isBlank(e){return null==e||"null"===e||""===e||void 0===e||"undefined"===e||"unknown"===e}function checkBlankSpace(e){return 0!=e.trim().length&&null!=e}function emptyVali(e){var t,s="";return $("#"+e+" .form-control").each(function(){(t=$(this).val())&&(s+=t)}),s}function clickStopPropagation(e){e=e||window.event;document.all?e.cancelBubble=!0:e.stopPropagation()}function queryVariable(e){var t;for(t of window.location.search.substring(1).split("&")){var s=t.split("=");if(s[0]==e)return s[1]}return""}function _throttle(s,n){var i=null;return function(){var e=this,t=arguments;i&&clearTimeout(i),i=setTimeout(function(){s.apply(e,t)},n)}}function lrtrim(e){return e.replace(/(^\s*)|(\s*$)/g,"")}function backVal(e){return"string"==typeof e?e:e.value}String.prototype.pxWidth=function(e){var t=(String.prototype.pxWidth.canvas||(String.prototype.pxWidth.canvas=document.createElement("canvas"))).getContext("2d");return t.font="normal "+e+"px Segoe UI",t.measureText(this).width};var regexs={numericRegex:/^[0-9]+$/,numRegex:/[0-9]/,specialRegex:/[`~!@#$%^&*()_\-+=<>?:"{}|,.\/;'\\[\]·~！@#￥%……&*（）——\-+={}|《》？：“”【】、；‘'，。、]/im};function max_length(e,t){return!!regexs.numericRegex.test(t)&&backVal(e).length<=parseInt(t,10)}function min_length(e,t){return!!regexs.numericRegex.test(t)&&backVal(e).length>=parseInt(t,10)}function isContains(e,t){return backVal(e)==t}function isNumber(e){return!!regexs.numRegex.test(e)}function isSpecial(e){return!!regexs.specialRegex.test(e)}function showPasswordsCheck(e){var e=e.target,t=findAncestors(e,function(e){return e.classList&&e.classList.contains("field-container")}).querySelector("input"),e=(e.classList.contains("on")?(e.classList.remove("on"),t.setAttribute("type","password"),e.setAttribute("title",getMessage("showPass"))):(e.classList.add("on"),t.setAttribute("type","text"),e.setAttribute("title",getMessage("hidePass"))),t.value);t.focus(),t.value="",t.value=e}function passwordShowOrHide(s,n){null!=s.querySelector(".showpassword")&&(s.querySelector(".showpassword").onclick=function(e){clickStopPropagation(e);var e=e.target,t=s.querySelector("input"),e=(("ipsChangePass"==n?$$("dpmLogin").querySelector(".form-input[name='current']"):$$("dpmLogin").querySelector(".form-input[name='username']")).parentNode.classList.remove("on"),"password"!=t.getAttribute("name")&&($$("dpmLogin").querySelector(".password-tip").style.display="none"),$$("dpmLogin").querySelector(".form-input[name='password']").parentNode.classList.remove("on"),$$("dpmLogin").querySelector(".form-input[name='confirm']").parentNode.classList.remove("on"),e.parentNode.classList.add("on"),e.classList.contains("on")?(e.classList.remove("on"),t.setAttribute("type","password"),e.setAttribute("title",getMessage("showPass"))):(e.classList.add("on"),t.setAttribute("type","text"),e.setAttribute("title",getMessage("hidePass"))),t.value);t.focus(),t.value="",t.value=e})}function clearPassChecklistClass(){$$("dpmLogin").querySelector(".pwd-checklist-item[key= 'length']").classList.remove("error","success"),$$("dpmLogin").querySelector(".pwd-checklist-item[key= 'number']").classList.remove("error","success"),$$("dpmLogin").querySelector(".pwd-checklist-item[key= 'symbol']").classList.remove("error","success")}function setPasswordCheck(e){return min_length(e,8)?$$("dpmLogin").querySelector(".pwd-checklist-item[key= 'length']").classList.add("success"):$$("dpmLogin").querySelector(".pwd-checklist-item[key= 'length']").classList.add("error"),isNumber(e)?$$("dpmLogin").querySelector(".pwd-checklist-item[key= 'number']").classList.add("success"):$$("dpmLogin").querySelector(".pwd-checklist-item[key= 'number']").classList.add("error"),isSpecial(e)?$$("dpmLogin").querySelector(".pwd-checklist-item[key= 'symbol']").classList.add("success"):$$("dpmLogin").querySelector(".pwd-checklist-item[key= 'symbol']").classList.add("error"),!!(min_length(e,8)&&isNumber(e)&&isSpecial(e))}function setPassComfirmCheck(e,t){return isContains(e,t)?$$("dpmLogin").querySelector(".input-tips").style.display="none":$$("dpmLogin").querySelector(".input-tips").style.display="block",!!isContains(e,t)}function inputOnfocusAndOnBlur(n){let i=document.querySelectorAll(".form-input");for(let s=0;s<i.length;s++){i[s].index=s;i[s].onfocus=function(e){var t=findAncestors(this,function(e){return e.classList&&e.classList.contains("field-container")});t&&"password"!=i[s].getAttribute("name")&&t.classList.add("on")},i[s].onblur=function(e){var t=findAncestors(this,function(e){return e.classList&&e.classList.contains("field-container")});t&&("password"!=i[s].getAttribute("name")&&t.classList.remove("on"),"recoverycode"==n)&&(t=$$("dpmLogin").querySelector(".form-input[name='recoverycode']").value.toUpperCase(),isBlank(t=getVerifyRCode(t))||($$("dpmLogin").querySelector(".form-input[name='recoverycode']").value=t))}}let t=$$("dpmLogin").querySelector(".field-pass");isBlank(t)||(unElementBindClick(".field-pass"),t.onclick=function(e){"recoverycode"==t.querySelector("input").getAttribute("name")?oneInputAddClass("recoverycode"):oneInputAddClass("password"),clickStopPropagation(e)}),document.onclick=function(e){isBlank(t)||("recoverycode"==t.querySelector("input").getAttribute("name")?oneInputAddClass("allrecoverycode"):oneInputAddClass("all"))}}function unDcoumentBindClick(){document.onclick=!1,document.onclick=null,document.onkeyup=!1,document.onkeyup=null,$("body").unbind("mousedown"),$("body").off("mousedown")}function unElementBindClick(e){$$("dpmLogin").querySelector(e).onclick=!1,$$("dpmLogin").querySelector(e).onclick=null}function inputFocusClass(e){let t=$$("dpmLogin").querySelectorAll(".form-input"),s="",n="";for(let e=0;e<t.length;e++)t[e].index=e,t[e].onfocus=function(e){s=$$("dpmLogin").querySelector(".form-input[name='username']").value,n=$$("dpmLogin").querySelector(".form-input[name='password']").value,""!=s&&""!=n?$$("dpmLogin").querySelector(".button-login").removeAttribute("disabled"):$$("dpmLogin").querySelector(".button-login").setAttribute("disabled",!0)},t[e].oninput=function(e){$$("dpmLogin").querySelector(".input-tips").style.display="none",s=$$("dpmLogin").querySelector(".form-input[name='username']").value,n=$$("dpmLogin").querySelector(".form-input[name='password']").value,""!=s&&""!=n?$$("dpmLogin").querySelector(".button-login").removeAttribute("disabled"):$$("dpmLogin").querySelector(".button-login").setAttribute("disabled",!0)},t[e].onblur=function(e){s=$$("dpmLogin").querySelector(".form-input[name='username']").value,n=$$("dpmLogin").querySelector(".form-input[name='password']").value,""!=s&&""!=n?$$("dpmLogin").querySelector(".button-login").removeAttribute("disabled"):$$("dpmLogin").querySelector(".button-login").setAttribute("disabled",!0)}}function allPwdNotEmpty(e,t,s){isBlank(e)||isBlank(t)||isBlank(s)?$$("dpmLogin").querySelector(".button-continue").disabled=!0:$$("dpmLogin").querySelector(".button-continue").disabled=!1}function isHide(e){return"none"===e.style.display||""===e.style.display||e.currentStyle&&"none"===e.currentStyle||window.getComputedStyle&&"none"===window.getComputedStyle(e,null).display}function threeInputAddClass(e){switch(e){case"current":$$("dpmLogin").querySelector(".form-input[name='current']").parentNode.classList.add("on"),$$("dpmLogin").querySelector(".form-input[name='password']").parentNode.classList.remove("on"),$$("dpmLogin").querySelector(".form-input[name='confirm']").parentNode.classList.remove("on");break;case"currentnone":$$("dpmLogin").querySelector(".form-input[name='password']").parentNode.classList.remove("on"),$$("dpmLogin").querySelector(".form-input[name='confirm']").parentNode.classList.remove("on");break;case"password":$$("dpmLogin").querySelector(".form-input[name='current']").parentNode.classList.remove("on"),$$("dpmLogin").querySelector(".form-input[name='password']").parentNode.classList.add("on"),$$("dpmLogin").querySelector(".form-input[name='confirm']").parentNode.classList.remove("on");break;case"passwordnone":$$("dpmLogin").querySelector(".form-input[name='password']").parentNode.classList.add("on"),$$("dpmLogin").querySelector(".form-input[name='confirm']").parentNode.classList.remove("on");break;case"confirm":$$("dpmLogin").querySelector(".form-input[name='current']").parentNode.classList.remove("on"),$$("dpmLogin").querySelector(".form-input[name='password']").parentNode.classList.remove("on"),$$("dpmLogin").querySelector(".form-input[name='confirm']").parentNode.classList.add("on");break;case"confirmnone":$$("dpmLogin").querySelector(".form-input[name='password']").parentNode.classList.remove("on"),$$("dpmLogin").querySelector(".form-input[name='confirm']").parentNode.classList.add("on");break;case"all":$$("dpmLogin").querySelector(".form-input[name='current']").parentNode.classList.remove("on"),$$("dpmLogin").querySelector(".form-input[name='password']").parentNode.classList.remove("on"),$$("dpmLogin").querySelector(".form-input[name='confirm']").parentNode.classList.remove("on");break;case"ipsRmasterPass":case"ipsSetPass":$$("dpmLogin").querySelector(".form-input[name='password']").parentNode.classList.remove("on"),$$("dpmLogin").querySelector(".form-input[name='confirm']").parentNode.classList.remove("on")}}function oneInputAddClass(e){switch(e){case"password":$$("dpmLogin").querySelector(".form-input[name='password']").parentNode.classList.add("on");break;case"recoverycode":$$("dpmLogin").querySelector(".form-input[name='recoverycode']").parentNode.classList.add("on");break;case"all":$$("dpmLogin").querySelector(".form-input[name='password']").parentNode.classList.remove("on");break;case"allrecoverycode":$$("dpmLogin").querySelector(".form-input[name='recoverycode']").parentNode.classList.remove("on")}}function resetPassInputFocusClass(t){let s=$$("dpmLogin").querySelectorAll(".form-input"),n="";for(let e=0;e<s.length;e++)s[e].index=e,s[e].onfocus=function(e){""!=(n=$$("dpmLogin").querySelector(".form-input[name='"+t+"']").value)?$$("dpmLogin").querySelector(".button-continue").removeAttribute("disabled"):$$("dpmLogin").querySelector(".button-continue").setAttribute("disabled",!0)},s[e].oninput=function(e){$$("dpmLogin").querySelector(".input-tips").style.display="none",""!=(n=$$("dpmLogin").querySelector(".form-input[name='"+t+"']").value)?$$("dpmLogin").querySelector(".button-continue").removeAttribute("disabled"):$$("dpmLogin").querySelector(".button-continue").setAttribute("disabled",!0)},s[e].onblur=function(e){""!=(n=$$("dpmLogin").querySelector(".form-input[name='"+t+"']").value)?$$("dpmLogin").querySelector(".button-continue").removeAttribute("disabled"):$$("dpmLogin").querySelector(".button-continue").setAttribute("disabled",!0)}}function ispError_Fun(e,t){switch(t){case"disabled":$$(e).querySelector(".input-tips").innerHTML=getMessage("account_blocked_disabled"),$$(e).querySelector(".input-tips").style.display="block";break;case"usernameorpassword":$$(e).querySelector(".input-tips").innerHTML=getMessage("emailOrPassIncorrect"),$$(e).querySelector(".input-tips").style.display="block";break;case"invalidemail":$$(e).querySelector(".input-tips").innerHTML=getMessage("invalid_email"),$$(e).querySelector(".input-tips").style.display="block";break;case"password":$$(e).querySelector(".input-tips").innerHTML=getMessage("passIncorrect"),$$(e).querySelector(".input-tips").style.display="block";break;case"masterpassIncorrect":$$(e).querySelector(".input-tips").innerHTML=getMessage("masterpassIncorrect"),$$(e).querySelector(".input-tips").style.display="block";break;case"network":$$(e).querySelector(".input-tips").innerHTML=getMessage("networkError"),$$(e).querySelector(".input-tips").style.display="block";break;case"timeout":$$(e).querySelector(".input-tips").innerHTML=getMessage("signInTimeout"),$$(e).querySelector(".input-tips").style.display="block";break;case"locked":$$(e).querySelector(".input-tips").innerHTML=getMessage("signInLocked"),$$(e).querySelector(".input-tips").style.display="block";break;case"rcodeinvaild":$$(e).querySelector(".input-tips").innerHTML=getMessage("Invalid_Recovery_Code_New"),$$(e).querySelector(".input-tips").style.display="block";break;case"errpassword":$$(e).querySelector(".input-tips").innerHTML=getMessage("invalid_master_tips"),$$(e).querySelector(".input-tips").style.display="block";break;case"incorrectpassword":$$(e).querySelector(".input-tips").innerHTML=getMessage("masterpassIncorrect"),$$(e).querySelector(".input-tips").style.display="block";break;case"samepwd":$$(e).querySelector(".input-tips").innerHTML=getMessage("password_same"),$$(e).querySelector(".input-tips").style.display="block"}"dpmLogin"!=e&&($$(e).querySelector(".button-login").removeAttribute("disabled"),$$(e).querySelector(".form-input[name='password']").focus(),$$(e).querySelector(".form-input[name='password']").setSelectionRange(0,-1))}function isLoginLoading_Fun(e){$$(e).querySelector(".button-login").classList.add("button-loading"),$$(e).classList.add("login-loading")}function errLoginLoading_fun(e){$$(e)&&($$(e).querySelector(".button-login").classList.remove("button-loading"),$$(e).classList.remove("login-loading"),$$(e).querySelector(".form-input[name='username']").removeAttribute("disabled"),$$(e).querySelector(".form-input[name='password']").removeAttribute("disabled"))}function modalBackdropClickEvent(t){document.querySelector(".modal-backdrop").addEventListener("click",function(e){$(t).addClass("modal-static"),setTimeout(()=>{$(t).removeClass("modal-static")},300)},!1)}function setDeviceTipsInfo(e){let t="";t="extension"==e.devname.toLowerCase()?getMessage("extension"):(e.devname.toLowerCase(),getMessage("desktop")),document.querySelector(".device-out-tips").querySelector(".device-title").innerHTML=e.system+" - "+t,document.querySelector(".device-out-tips").querySelector(".device-time").innerHTML=e.Last,$$("devicePopovers").querySelector(".popup-ok").addEventListener("mouseover",function(e){$(".device-out-tips").addClass("on")},!1),$$("devicePopovers").querySelector(".popup-ok").addEventListener("mouseout",function(e){$(".device-out-tips").removeClass("on")},!1),document.querySelector(".device-out-tips").onmouseover=function(e){document.querySelector(".device-out-tips").classList.add("on"),clickStopPropagation(e)},document.querySelector(".device-out-tips").onmouseout=function(e){clickStopPropagation(e),document.querySelector(".device-out-tips").classList.remove("on")}}function devicelimitIcon(e){let t="";switch(e){case"ext-edg":t="../skin/common/logo_edge.svg";break;case"ext-chr":t="../skin/common/logo_google.svg";break;case"ext-opr":t="../skin/common/logo_opera.svg";break;case"ext-ffx":t="../skin/common/logo_firefox.svg";break;case"ext-bra":t="../skin/common/logo_brave.svg";break;default:t="../skin/common/icon_equipment_limit_40.png"}return t}function devicelimitPopupPurchase(e,t){var s=e.browser_pop_btn.text.replaceAll("1%",'<b style="display: inline-block;padding: 0 4px;">'+e.browser_pop_btn.price+"</b>"),n=`
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content device-content">
                <div div class="popup devicelimit" >
		        <div class="pop-images"><img draggable="false" src="../popup/images/purchase/icon_equipment_limit_140.png" width="140" height="140" alt="icon_equipment_limit_140"></div>
		        <h2 class="pop-title">${getMessage("device_limit_title")}</h2>
		        <p class="pop-desc">${getMessage("device_limit_desc")}</p>
		        <ul class="pop-list">
			        <li><i class="pop-icon"></i> <span>${getMessage("purchase_Dark_Web_Monitor")}</span></li>
			        <li><i class="pop-icon"></i> <span>${getMessage("comprehensive_pwd_Desc")}</span></li>
			        <li><i class="pop-icon"></i> <span>${getMessage("purchase_Unlimited_Devices")}</span></li>
                    <li><i class="pop-icon"></i> <span>${getMessage("emergency_contact")}</span></li>
		        </ul>
		        <div class="pop-footer">
			        <button type="button" id="devicelimitUpgradeBtn" class="button-css button-yellow popup-button devicelimit-btn">${getMessage("upgradeNowBtn")}</button>
                    <button id="deviceOK"  type="button" class="button-css button-blue popup-button popup-ok">
				        ${getMessage("continue_sign_in")}
			        </button>
		        </div>
		        <button type="button" class="btn popup-close" title='${getMessage("close")}'></button>
                <div class="device-out-tips" style='display: none;'>
                    <div class="device-tips-desc">${getMessage("device_limit_tips")}</div>
                    <div class="device-info-container">
                        <div class="device-info-image"><img src="${devicelimitIcon(e.lastDevice.icon)}" width="40" height="40"  alt="device"></div>
                        <div class="device-info-content">
                            <p class="device-title">Unknown - Desktop</p>
                            <p class="device-subtitle">${getMessage("signIn")+getMessage("comma")} <em class="device-time">2022/10/31</em></p>
                        </div>
                    </div>
                </div>
	        </div>
        </div>
    </div>
    `;$("#devicePopovers").html(n),$("#devicelimitUpgradeBtn").html(s),$("#devicePopovers").modal("show"),setTimeout(function(){$(".popup.devicelimit").addClass("active"),useOfStatistical("521"),errLoginLoading_fun("ipsLogin"),setDeviceTipsInfo(e.lastDevice)},300),$(".popup.devicelimit .popup-close").off("click").on("click",function(){$(".popup.devicelimit").removeClass("active"),$("#devicePopovers").modal("hide"),t&&t()}),$$("devicelimitUpgradeBtn").onclick=e=>{!async function(){try{useOfStatistical("522"),await sendMsg({TYPE:"APPGOTO",appgoto:"GoPremium3"}),$("#devicePopovers").modal("hide"),t&&t(),$("#devicePopovers .modal-content").html("")}catch(e){}}()},modalBackdropClickEvent("#devicePopovers")}let timer=null,show=!1;function getCountdownTime(e){timer?(show=!0,clearInterval(timer),timer=null,$$("ipsSaveCode").querySelector(".send-email").classList.remove("send")):(show=!1,timer=setInterval(()=>{1<e?(e--,$$("ipsSaveCode").querySelector(".send-email").setAttribute("disabled",!0),$$("ipsSaveCode").querySelector(".send-email").classList.add("down"),$$("ipsSaveCode").querySelector(".send-email").innerHTML=e+"s"):(show=!0,clearInterval(timer),timer=null,$$("ipsSaveCode").querySelector(".send-email").removeAttribute("disabled"),$$("ipsSaveCode").querySelector(".send-email").classList.remove("down"),$$("ipsSaveCode").querySelector(".send-email").classList.remove("send"),$$("ipsSaveCode").querySelector(".send-email").innerHTML="")},1e3))}async function setSendEmailTime(){try{await handle.sendMessage("SEND_RCODEREADY",{})}catch(e){}}async function getSendEmailTime(){try{var e=await handle.sendMessage("SEND_RCODEREADY",{});e.succ&&getCountdownTime(e.remain)}catch(e){}}function sendReCodeToEmail(e){var t={sending:{img:"./images/bg_send_email_in.svg",stitle:getMessage("sending_title"),sdesc:getMessage("sending_desc"),sbtn:'<i class="login-icon"></i>'},emailvery:{img:"./images/bg_send_email_in.svg",stitle:"",sdesc:getMessage("enter_email_desc"),sbtn:getMessage("send")},succ:{img:"./images/bg_send_email_success.svg",stitle:getMessage("sent_succ_title"),sdesc:getMessage("sent_succ_desc"),sbtn:getMessage("ok")},failed:{img:"./images/bg_send_email_failure.svg",stitle:getMessage("failed_send_title"),sdesc:getMessage("failed_send_desc"),sbtn:getMessage("resend")}},t=`
        <div class="modal-dialog modal-dialog-centered">
				<div class="modal-content send-content">
						<div class="send-popup">
							<div class="send-image" style="margin-bottom: ${"emailvery"==e?"12px":"24px"};">
								<img src="${t[e].img}" width="200" height="90" alt="send_email" draggable="false">
							</div>
							<h2 class="send-title" style="display: ${"emailvery"==e?"none":"block"};">${t[e].stitle}</h2>
							<p class="send-desc" style="min-height: ${"emailvery"==e?"0":"80px"};">${t[e].sdesc}</p>
                            <div class="send-form" style="display: ${"emailvery"==e?"block":"none"};">
                                <input class="form-control placeholder-css form-code" spellcheck="false" autocomplete="off" maxlength="255" type="text" placeholder="${getMessage("Enter_your_email")}" value="" name="email">
                                ${inputTipsStr()}
                            </div>
							<button type="button" class="button-css button-blue send-btn ${"sending"==e?"loading":""}"
                                ${"emailvery"==e?"disabled":""}>
                                ${t[e].sbtn}
                                </button>
							<button type="button" class="btn popup-close send-close" title='${getMessage("close")}'></button>
						</div>
				</div>
	    </div>
    `;$("#sendEmailPopovers").html(t),$("#sendEmailPopovers .input-tips").html(getMessage("enter_email_tips")),$("#sendEmailPopovers").modal("show"),document.getElementById("sendEmailPopovers");setTimeout(function(){$(".send-popup").addClass("active"),isBlank($("#sendEmailPopovers .form-code[name = 'email']").val())?setTimeout(()=>{$(".form-code[name='email']").focus()},300):setTimeout(()=>{$(".form-code[name='email']").blur()},300),"succ"==e&&$$("sendEmailPopovers").querySelector(".send-btn").addEventListener("click",function(e){$(".send-popup").removeClass("active"),$("#sendEmailPopovers").modal("hide"),$$("ipsSaveCode").querySelector(".button-already").removeAttribute("disabled"),getSendEmailTime()},!1)},300),$(".send-popup .popup-close").off("click").on("click",function(){isBlank(timer)&&$(".send-email").removeClass("send"),$(".send-popup").removeClass("active"),$("#sendEmailPopovers").modal("hide"),$$("ipsSaveCode").querySelector(".button-already").removeAttribute("disabled"),"succ"==e&&getSendEmailTime()}),modalBackdropClickEvent("#sendEmailPopovers")}!function(){var e=document.documentElement;e.dir=getMessage("dir"),e.lang=getMessage("lang"),document.title=getMessage("appName"),-1!==document.getElementsByTagName("body")[0].className.indexOf("succbody")&&document.querySelectorAll("[data-properties]").forEach(function(e){var t=e.getAttribute("data-properties");e.innerHTML=getMessage(t)})}();