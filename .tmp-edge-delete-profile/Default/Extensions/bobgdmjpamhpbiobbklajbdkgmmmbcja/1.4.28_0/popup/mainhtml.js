let tagshtml=`
    <div class="from-all-text from-tags">
        <input class="tags-input"  value ="" autofocus placeholder="${getMessage("new_tag_number")}" style="opacity: 0;">
    </div>
`,pwstrengthHtml=`
    <div class="pwstrength-inner d-flex justify-content-between logineditcanvac" style="display: none;">
        <div class="pwstrengthCanvas-inner">
            <div class="canvas-container">
                <canvas class="pwstrength-canvas" id="logineditPwstrengthCanvas" width="20" height="20"></canvas>
            </div>
            <span class="canvas-verdict hidden"
                    aria-weak="${getMessage("weak")}" 
                    aria-average="${getMessage("average")}"
                    aria-strong="${getMessage("strong")}" 
                    aria-secure="${getMessage("secure")}">
            </span>
        </div>
    </div>         
`,sugTipsHtml=`
    <div class="hist-tips sug-tips" style="display: none;">
        <p class="tips">${getMessage("suggestion_tips")}</p>
        <button class="sug-btn sug-close" type="button" title="${getMessage("close")}">
           <i class="sug-icon"></i>
        </button>
    </div>
`;const alloptions={threshold:.1,location:10,keys:["base.titlename","login.websites.website","login.username","login.notes","notes.text","payment.cardholderName","payment.cardtype","payment.number","payment.notes","personal.firstName","personal.middleName","personal.lastName","personal.email","personal.phone","personal.address","personal.city","personal.country","personal.notes","personal.postalCode","personal.state"]};async function addCategoryList(e,a){var s,l=registeredPages[e.toLowerCase()],t="";$("#addSaveToastShowButton").attr("disabled","disabled"),this.offcanvasAdd.setAttribute("controls",e),this.offcanvasAdd.setAttribute("controls-id",l),$$("offcanvasAdd").querySelector(".listWrapper").scrollTop=0;$("#offcanvasAdd").removeClass("persionl-info-panel");let o=getMessage("notes_placeholder");switch(o=o.replace("%s","5000"),$$("offcanvasAdd").querySelector(".offcanvas-body").innerHTML="",l){case 1:t=`
                    <div class="avatar-container add-avatar">
                        <div id="addloginicon" class="avatar-icon website-icon" style="background-image: url('../skin/common/icon_login.png');"></div>
                    </div>
                        <form novalidate="" id="offcanvasAddfrom">
                    <div class="from-all-container from-verify">
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("title")}${getMessage("comma")}</span><font class="label-point">*</font></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control form-send all-input placeholder-css" 
                                    type="text"
                                    placeholder='${getMessage("title_placeholder")}'
                                    data-must='${getMessage("title_placeholder")}'
                                    data-please='${getMessage("title_placeholder")}'
                                    autocomplete="off"
                                    id="addlogintitle"
                                    name="titlename" value="">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <ul class="add-website-container">
                                <li>
                                    <label class="fromAllContainer"><span class="label-text">${getMessage("Website")+" "}1${getMessage("comma")}</span></label>
                                    <div class="from-all-text">
                                        <input spellcheck="false"  autocomplete="off"  maxlength="2000" class="form-control form-send all-input placeholder-css" 
                                            type="text"
                                            placeholder="https://domain.com" value="" name="website" id="activetabinfo" autocomplete="off">
                                        <div class="ui-components">
                                            <button class="inputButton website-delete" type="button" title='${getMessage("delete")}' style="display: inline-block;"></button>
                                        </div>
                                    </div>
                                </li>
                            </ul>
                            <button class="button-css  button-website add-website" type="button">
                                <span class="svg-css svg-website">
                                    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
                                        <path d="M9.25 2H10.75V18H9.25V2Z"></path>
                                        <path d="M2 11V9.5H18V11H2Z"></path>
                                    </svg>
                                </span>
                                <span class="add-text">${getMessage("add_new_website")}</span>
                            </button>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("username")+getMessage("comma")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control form-send all-input placeholder-css"
                                    type="text"
                                    placeholder="${getMessage("username_placeholder")}" name="username" autocomplete="off">
                            </div>
                        </div>
                        <div id="addLoginPasswordContainer" class="from-all-inner addLoginPasswordContainer">
                            <div class="from-inner">
                                <label class="fromAllContainer d-flex justify-content-between align-items-center">
                                    <span class="label-text">${getMessage("password")+getMessage("comma")}</span>
                                    <span class="text-center linkText link-color suggested-generator">
                                            ${getMessage("Suggested_password_Case")}
                                    </span>
                                </label>
                                <div class="from-all-text">
                                    <input spellcheck="false"  autocomplete="off"  maxlength="250"
                                        class="form-control form-send all-input placeholder-css remind-input password_on zxcvbn-main-result"
                                        id="addLoginPassword"
                                        type="password"
                                        placeholder="${getMessage("password")}"
                                        data-canvas="logineditPwstrengthCanvas"
                                        data-master="addMeter"
                                        data-cid="offcanvasAdd"
                                        autocomplete="off"
                                        name="password">
                                        <div class="ui-components">
                                            <button class="inputButton showpassword" type="button" title="${getMessage("showPass")}"></button>
                                        </div>
                                </div>
                                <div class="strongMeter" style="display: none;">
                                    <meter class="meter hidden" id="addMeter" min="0" max="12" low="4" high="8" optimum="10" value="0"></meter>
                                    <div class="progress">
                                        <div class="progress-bar" style="display: none;"></div>
                                        <span class="score-segment"></span>
                                        <span class="score-segment"></span>
                                        <span class="score-segment"></span>
                                        <span class="score-segment"></span>
                                    </div>
                                </div>
                            </div>
                            ${pwstrengthHtml}
                        </div>
                        <div class="from-all-inner">
                            <div class="from-inner">
                                <div class="form-check form-main-check">
                                    <input spellcheck="false"  autocomplete="off"  autocomplete="off" 
                                        class="form-control form-check-input form-send remind" 
                                        name="passwordremind"
                                        checked
                                        disabled
                                        type="checkbox" value="" id="flexCheckDefault">
                                    <label class="form-check-label remind disabled" for="flexCheckDefault">
                                        ${getMessage("remind_password")}
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <div class="from-inner">
                                <div class="fromAllContainer d-flex justify-content-between">
                                    <span class="label-text">${getMessage("one_time_Password")+getMessage("comma")}</span>
                                    <button id="addLearnmore" class="learnmore" type="button">${getMessage("learn_more")}</button>
                                </div>
                                <div class="from-all-text">
                                     <input spellcheck="false"  autocomplete="off"
                                            type="text"
                                            maxlength="2000"
                                            class="form-control all-input placeholder-css form-send input-scan"
                                            name="totp"  type="checkbox" value="" id="addLoginOneTimePwd"
                                            placeholder="${getMessage("TOTP_placeholder")}">
                                        <div class="ui-components">
                                            <button class="inputButton btn-scan dpmtooltip" type="button" title="${getMessage("scan_web_page_QRCode")}"></button>
                                        </div>
                                </div>
                            </div>
                            <div class="otpauth-tips" style="opacity: 0;">${getMessage("invalid_secret_key")}</div>
                        </div>
                        <div class="from-all-inner  from-none">
                            <label class="fromAllContainer">
                                <span class="label-text">${getMessage("notes")+getMessage("comma")}</span>
                                <textarea spellcheck="false"  autocomplete="off"  class="form-control form-send label-textarea text-textarea  placeholder-css"
                                    id="addLoginArea" name="notes" spellcheck="false" 
                                    placeholder="${o}"
                                    autocomplete="off"
                                    maxlength="5000"></textarea>
                                <div class="characters-tips hidden">${getMessage("notes_characters_tips")}</div>
                            </label>
                        </div>
                        <div class="from-all-inner  from-none">
                            <label class="fromAllContainer from-tags-label"><span class="label-text">${getMessage("tags")+getMessage("comma")}</span></label>
                            ${tagshtml}
                        </div>
                    </div>
                    </form>
                `,$$("offcanvasAdd").querySelector(".offcanvas-body").innerHTML="",$$("offcanvasAdd").querySelector(".offcanvas-body").innerHTML=t,$("#offcanvasAdd .operateAddText").html(getMessage("add_Login")),$("#offcanvasAdd input[name='titlename']").removeClass("is-invalid");var n=GET_LOGIN;PasswordGeneratorShow("addLoginPassword","#offcanvasAdd",l,n),AddNewWebsite("#offcanvasAdd"),showPasswordsCheck(),popupTooltip(),btnScanClickEvent("offcanvasAdd");try{var i=await sendMsg({TYPE:"GET_ACTIVETABINFO"});isBlank(i)||(isBlank(i.url)?$("#addListButton").attr("data-activeweb",!1):($("#activetabinfo").val(i.url),$("#addlogintitle").val(i.title),$("#addCancelToastCloseButton,#addButtonReturnClose").addClass("hidden"),$("#addButtonReturnCanel,#addCancelToastShowButton").removeClass("hidden"),$("#offcanvasAdd input[name='titlename']").removeClass("is-invalid"),$$("addSaveToastShowButton").removeAttribute("disabled"),$("#addListButton").attr("data-activeweb",!0)))}catch(e){}await 0,$$("addLearnmore").onclick=e=>{!async function(){try{await sendMsg({TYPE:"APPGOTO",appgoto:"LearnMoreTOTP"})}catch(e){}}()},$("#offcanvasAdd .offcanvas-body  .form-control[name='totp']").attr("data-invalid",!1),$("#offcanvasAdd .offcanvas-body  .form-control[name='totp']").on("input propertychange keyup change",function(e){isBlank($(this).val())?($(this).attr("data-invalid",!1),$("#offcanvasAdd .offcanvas-body  .otpauth-tips").css("opacity","0")):checkTotp($(this).val())?($("#offcanvasAdd .offcanvas-body  .otpauth-tips").css("opacity","0"),$(this).attr("data-invalid",!0)):($("#offcanvasAdd .offcanvas-body  .otpauth-tips").css("opacity","1"),$(this).attr("data-invalid",!1))});break;case 2:let e=getMessage("secure_notes_placeholder");e=e.replace("%s","5000"),t=`
                    <div class="avatar-container add-avatar">
                        <div class="avatar-icon website-icon" style="background-image: url(./images/icon_security_notes.png);"></div>
						</div>
                    <form novalidate="">
                    <div class="from-all-container from-verify">
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("title")+getMessage("comma")}</span><font class="label-point">*</font></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control form-send all-input placeholder-css" 
                                    id="addNotesTitle" type="text"
                                    placeholder='${getMessage("title_placeholder")}'
                                    data-must='${getMessage("title_placeholder")}'
                                    data-please='${getMessage("title_placeholder")}'
                                    name="titlename" value="">
                            </div>
                        </div>
                        <div class="from-all-inner  from-none">
                            <label class="fromAllContainer">
                                <span class="label-text">${getMessage("notes")+getMessage("comma")}</span>
                                <textarea spellcheck="false"  autocomplete="off"  class="form-control form-send label-textarea text-textarea  placeholder-css"
                                    id="addNotesArea" spellcheck="false"  autocomplete="off" 
                                    placeholder="${e}"
                                     maxlength="5000" name="text"></textarea>
                                <div class="characters-tips hidden">${getMessage("notes_characters_tips")}</div>
                            </label>
                        </div>

                        <div class="from-all-inner  from-none">
                            <label class="fromAllContainer from-tags-label"><span class="label-text">${getMessage("tags")+getMessage("comma")}</span></label>
                            ${tagshtml}
                        </div>
                    </div>
                    </form>
                `,$("#offcanvasAdd .operateAddText").html(getMessage("add_secure_note")),$$("offcanvasAdd").querySelector(".offcanvas-body").innerHTML=t,$("#addNotesTitle").val(s);break;case 3:t=`
                    <div class="avatar-container add-avatar">
                        <div class="avatar-icon website-icon" style="background-image: url('../skin/common/icon_cardtype_other_64.png');"></div>
						</div>
                        <form novalidate="">
                    <div class="from-all-container from-verify">
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("title")+getMessage("comma")}</span><font class="label-point">*</font></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control form-send all-input placeholder-css" 
                                    id="addPaymentTitle" type="text"
                                    placeholder='${getMessage("title_placeholder")}'
                                    data-must='${getMessage("title_placeholder")}'
                                    data-please='${getMessage("title_placeholder")}'
                                    name="titlename" value="">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("cardholderName")+getMessage("comma")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="250" 
                                    class="form-control form-send all-input placeholder-css" 
                                    id="addPaymentCard" type="text"
                                    placeholder="${getMessage("cardholderName")}"
                                    name="cardholderName">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("cardNumber")+getMessage("comma")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="50" class="form-control form-send all-input placeholder-css" 
                                    id="addPaymentNumber" type="text"
                                    placeholder="${getMessage("cardNumber")}" name="number">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("cardType")+getMessage("comma")}</span></label>
                            <div id="addCardType" class="from-all-text  editable-card" data-name="offcanvasAdd">
                                <input type="text" autocomplete="off"
                                        class="form-control form-select form-send editable-select es-input"
                                        name="cardtype"
                                        maxlength="100"
                                        spellcheck="false"
                                        data-value = ''
                                        placeholder="${getMessage("cardType_placeholder")}" value="">
                                    <ul class="es-list" style="display: none;"></ul>
                                    <ul class="es-list-none"  style="display: none;">
                                        <li class="list-none-inner">${getMessage("noResult")}</li>
                                    </ul>
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("securityCode")+getMessage("comma")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="20" class="form-control form-send all-input placeholder-css" id="addPaymentCVV" type="text"
                                    placeholder="${getMessage("securityCode")}" name="securitycode">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("expOptionDate")+getMessage("comma")}</span></label>
                            <div class="from-all-text d-flex justify-content-between">
                                <select id="expYear" name="expYear" class="form-select form-control form-send placeholder-css"
                                    aria-label=".form-select-lg example" data-name='${getMessage("year")}' data-type="0" style="color: #A9B2CB;"></select>
                                <select id="expMonth" name="expMonth" class="form-select form-control  form-send placeholder-css"
                                    aria-label=".form-select-lg example" data-name='${getMessage("month")}' style="color: #A9B2CB;"></select>
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <div class="from-inner">
                                <div class="form-check form-main-check">
                                    <input spellcheck="false"  autocomplete="off"
                                        class="form-control form-send  form-check-input remind"
                                        name="expdateremind" type="checkbox" value=""
                                        checked
                                        disabled
                                        id="expCheckDefault">
                                    <label class="form-check-label remind disabled" for="expCheckDefault">
                                        ${getMessage("remindExpirationDate")}
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="from-all-inner  from-none">
                            <label class="fromAllContainer">
                                <span class="label-text">${getMessage("notes")+getMessage("comma")}</span>
                                <textarea spellcheck="false"  autocomplete="off"  class="form-control form-send label-textarea text-textarea  placeholder-css"
                                    id="addNotesArea" spellcheck="false"  autocomplete="off"
                                     maxlength="5000" placeholder="${o}" name="notes"></textarea>
                                <div class="characters-tips hidden">${getMessage("notes_characters_tips")}</div>
                            </label>
                        </div>
                        <div class="from-all-inner  from-none">
                            <label class="fromAllContainer from-tags-label"><span class="label-text">${getMessage("tags")+getMessage("comma")}</span></label>
                            ${tagshtml}
                        </div>
                    </div>
                    </form>
                `,$("#offcanvasAdd .operateAddText").html(getMessage("add_Payment_Info_Case")),$$("offcanvasAdd").querySelector(".offcanvas-body").innerHTML=t,$("#addPaymentTitle").val(s),$("#offcanvasAdd input[name='titlename']").removeClass("is-invalid");n=CardTypeOption();$("#addCardType .es-list").html(n),CardTypeData("#addCardType",0,0),new YMDselect("expYear","expMonth"),GET_PAYMENT;break;case 4:GET_PERSONSAL;$("#offcanvasAdd .operateAddText").html(getMessage("add_Personal_Info_Case")),t=`
                    <div class="avatar-container add-avatar">
                        <div class="avatar-icon website-icon" style="background-image: url('../skin/common/icon_persionl_info.svg');"></div>
					</div>
                    <form novalidate="">
                    <div class="from-all-container from-verify">
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("title")+getMessage("comma")}</span><font class="label-point">*</font></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control form-send all-input placeholder-css"
                                    id="addPersionlTitle" type="text"
                                    name="titlename"
                                    placeholder='${getMessage("title_placeholder")}'
                                    data-must='${getMessage("title_placeholder")}'
                                    data-please='${getMessage("title_placeholder")}'>
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("name")+getMessage("comma")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="100" class="form-control form-send all-input placeholder-css"
                                    id="addPersionlFirstName" type="text"
                                    placeholder='${getMessage("firstName")}' name="firstName">
                                <input spellcheck="false"  autocomplete="off"  maxlength="100" class="form-control form-send all-input placeholder-css"
                                    id="addPersionlMiddleName" type="text"
                                    placeholder='${getMessage("middleName")}' name="middleName">
                                <input spellcheck="false"  autocomplete="off"  maxlength="100" class="form-control form-send all-input placeholder-css"
                                    id="addPersionlLastName" type="text"
                                    placeholder='${getMessage("lastName")}'  name="lastName">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("gender")+getMessage("comma")}</span></label>
                            <div class="from-all-text">
                                <select id="addPersionlGender" class="form-select one-select form-send  placeholder-css"
                                    aria-label=".form-select-lg example" name="gender" style="color: #A9B2CB;">
                                    <option value=''>${getMessage("genderNone")}</option>
                                    <option value="1">${getMessage("genderMale")}</option>
                                    <option value="2">${getMessage("genderFemale")}</option>
                                    <option value="3">${getMessage("genderOther")}</option>
                                </select>
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("birthday")+getMessage("comma")}</span></label>
                            <div class="from-all-text d-flex justify-content-between">
                                <select id="birthdayYear" name="birthdayYear" class="form-select form-send  three-select placeholder-css"
                                    aria-label=".form-select-lg example" data-name='${getMessage("year")}' data-type="1" style="color: #A9B2CB;"></select>
                                <select id="birthdayMonth" name="birthdayMonth" class="form-select form-send three-select placeholder-css"
                                    aria-label=".form-select-lg example" data-name='${getMessage("month")}' style="color: #A9B2CB;"></select>
                                <select id="birthdayDay" name="birthdayDay" class="form-select form-send  three-select placeholder-css"
                                    aria-label=".form-select-lg example" data-name='${getMessage("day")}' style="color: #A9B2CB;"></select>
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("emailAddress")+getMessage("comma")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="100" 
                                    class="form-control form-send all-input placeholder-css" id="addPersionlEmail" type="text"
                                    placeholder='${getMessage("emailAddress")}' name="email">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("phoneNumber")+getMessage("comma")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="50" class="form-control form-send all-input placeholder-css" id="addPersionlPhone" type="text"
                                    placeholder='${getMessage("phoneNumber")}' name="phone">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("address")+getMessage("comma")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control form-send all-input placeholder-css" id="addPersionlAddress" type="text"
                                    placeholder="${getMessage("address")}" name="address">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("cityTown")+getMessage("comma")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control form-send all-input placeholder-css" id="addPersionlCity" type="text"
                                    placeholder="${getMessage("cityTown")}" name="city">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("state")+getMessage("comma")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control form-send all-input placeholder-css" id="addPPersionlState" type="text"
                                    placeholder="${getMessage("state")}" name="state">
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("countryRegion")+getMessage("comma")}</span></label>
                            <div id="addCountryType" class="from-all-text  editable-country" data-name="offcanvasAdd">
                                <input type="text" autocomplete="off"
                                        class="form-control form-select form-send editable-select es-input" name="country" maxlength="250" spellcheck="false"
                                        placeholder="${getMessage("countryRegion_placeholder")}" data-value="" value="">
                                    <ul class="es-list" style="display: none;"></ul>
                                    <ul class="es-list-none"  style="display: none;"><li class="list-none-inner">${getMessage("noResult")}</li></ul>
                            </div>
                        </div>
                        <div class="from-all-inner">
                            <label class="fromAllContainer"><span class="label-text">${getMessage("zipPostalCode")+getMessage("comma")}</span></label>
                            <div class="from-all-text">
                                <input spellcheck="false"  autocomplete="off"  maxlength="100" class="form-control all-input form-send placeholder-css" id="addPPersionlZIP" type="text"
                                    placeholder="${getMessage("zipPostalCode")}" name="postalCode">
                            </div>
                        </div>
                        <div class="from-all-inner  from-none">
                            <label class="fromAllContainer">
                                <span class="label-text">${getMessage("notes")+getMessage("comma")}</span>
                                <textarea spellcheck="false"  autocomplete="off"  class="form-control form-send label-textarea text-textarea  placeholder-css"
                                    id="addPersionlArea" spellcheck="false"  autocomplete="off" 
                                     maxlength="5000" placeholder="${o}" name="notes"></textarea>
                                <div class="characters-tips hidden">${getMessage("notes_characters_tips")}</div>
                            </label>
                        </div>
                        <div class="from-all-inner  from-none">
                            <label class="fromAllContainer from-tags-label"><span class="label-text">${getMessage("tags")+getMessage("comma")}</span></label>
                            ${tagshtml}
                        </div>
                    </div>
                    </form>
                `,$("#offcanvasAdd .offcanvas-body").html(t),$("#addPersionlTitle").val(s),$("#offcanvasAdd").addClass("show"),$("#offcanvasAdd").removeClass("hide"),CountriesData("#addCountryType",0,0),new YMDselect("birthdayYear","birthdayMonth","birthdayDay")}}function viewNotesHtml(e,a,s,l,t,o){return`
		<div id="${e}notesCont" class="avatar-container">
			<div class="avatar-icon website-icon" style="background-image: url('../skin/common/icon_security_notes.png')"></div>
		    <div class="avatar-details">
				<span id="${e}viewNotesTitle" class="avatar-text">${isBlank(a.base.titlename)?"-":a.base.titlename}</span>
			</div>
		</div>
        <form novalidate="">
		<div class="from-container">
			<div class="from-view from-inner  from-none"  style="display: ${isBlank(a.notes.text)?"none":"flex"}">
				<div class="fromInputContainer notes-container">
					<span class="label-text">${getMessage("notes")}</span>
		            <textarea class="label-textarea view-textarea notes-textarea"  disabled readonly style="resize:none;"></textarea>
		        </div>
		    </div>

            <div class="from-all-inner  from-none">
                <label class="fromAllContainer from-tags-label" style="display: none;"><span class="label-text">${getMessage("tags")}</span></label>
                ${tagshtml}
            </div>
        </div>
		<div class="from-tips">
			<p style="display: ${s?" block":"none"}">
				${l+getMessage("comma")+" "+t}
			</p>
			<p style="display:
			${""==a.base.createDate||isBlank(a.base.createDate)||0==a.base.createDate?"none":" block"}">
      	${getMessage("createdAt")+getMessage("comma")+" "+o}
			</p>
		</div>
        </form>
	`}function viewPaymentHtml(e,a,s,l,t,o){var n=a.payment.cardtype.trim().replace(/\s/gi,"").toLowerCase();return`
        <div id="${e}paymentCont" class="avatar-container">
		    <div class="avatar-icon website-icon" style='background-image: ${cardType(n)}'></div>
		    <div id="${e}viewPaymentTitle" class="avatar-details">
				<span class="avatar-text">${isBlank(a.base.titlename)?"-":a.base.titlename}</span>
			</div>
		</div>
        <form novalidate="">
		<div class="from-container">
			<div class="from-view from-inner  from-copy from-copy-none"  style="display: ${isBlank(a.payment.cardholderName)?"none":"flex"}">
				<label class="fromInputContainer" for="${e}cardholderName">
					<span class="label-text"  data-copy-desc="${getMessage("cardholder_name_copied")}">${getMessage("cardholderName")}</span>
					<input spellcheck="false"  autocomplete="off"
                                    id="${e}cardholderName" class="label-input text-css" type="text"
                                    name="cardholdername"
                                    value=""
									disabled="disabled" readonly="true">
				</label>
				<div class="actionList">
					<button type="button" class="button-copy css-opacity dpmtooltip" title="${getMessage("copy")}"></button>
				</div>
			</div>
            <div class="from-view from-inner password-hover  from-copy from-copy-none" style="display: ${isBlank(a.payment.number)?"none":" flex"}" >
				<label class="fromInputContainer" for="${e}-cardNumber">
				    <span class="label-text"  data-copy-desc="${getMessage("card_number_copied")}">${getMessage("cardNumber")}</span>
                    <input spellcheck="false" autocomplete="off" name="number" id="${e}-cardNumber" class="label-input text-css password_on"
                                    type="text"
									value="" disabled="disabled" readonly="true">
				</label>
				<div class="actionList">
					<button type="button" class="button-copy  css-opacity dpmtooltip" title="${getMessage("copy")}"></button>
				</div>
			</div>
			<div class="from-view from-inner  from-copy from-copy-none" id="${e}pwd-container"   style="display: ${isBlank(a.payment.cardtype)?"none":"flex"}" >
				<label class="fromInputContainer" for="${e}ipsVISA">
					<span class="label-text"  data-copy-desc="${getMessage("card_type_copied")}">${getMessage("cardType")}</span>
					<input spellcheck="false"  autocomplete="off"  id="${e}ipsVISA" 
                                    class="label-input text-css" type="text"
                                    value=""
                                    name="cardtype"
									disabled="disabled" readonly="true">
				</label>
				<div class="actionList">
					<button type="button" class="button-copy dpmtooltip css-opacity" title="${getMessage("copy")}"></button>
				</div>
			</div>
            <div class="from-view from-inner from-copy  password-hover pwd-from" style="display: ${isBlank(a.payment.securitycode)?"none":" flex"}" >
                <label class="fromInputContainer" for="${e}ipsCVV">
                    <span class="label-text"  data-copy-desc="${getMessage("security_code_copied")}">${getMessage("securityCode")}</span>
                    <input spellcheck="false"  autocomplete="off"  id="${e}ipsCVV" class="label-input text-css password_on payment_password_on" type="password"
                                    name="securitycode"
                                    disabled="disabled" readonly="true">
                </label>
                <div class="actionList">
                    <button type="button" class="button-copy dpmtooltip css-opacity" title="${getMessage("copy")}"></button>
                    <button class="inputButton showpassword showpasswordDefault dpmtooltip" type="button" 
                                    title="${getMessage("showCode")}"></button>
                </div>
			</div>
            <div class="from-view from-inner  from-copy from-copy-none" style="display: ${isBlank(a.payment.expirationdate)?"none":" flex"}" >
				<label class="fromInputContainer" for="${e}expDate">
					<span class="label-text" data-copy-desc="${getMessage("expiration_date_copied")}">${getMessage("expOptionDate")}</span>
					<input spellcheck="false"  autocomplete="off"  id="${e}expDate" class="label-input text-css" type="text"
                                    name="expirationdate"
									disabled="disabled" readonly="true">
				</label>
				<div class="actionList">
					<button type="button" class="button-copy dpmtooltip css-opacity" title="${getMessage("copy")}"></button>
				</div>
			</div>
            <div class="from-view from-inner  from-none" style="display: ${isBlank(a.payment.notes)?"none":" flex"}" >
                <div class="fromInputContainer">
                    <span class="label-text">${getMessage("notes")}</span>
                    <textarea class="label-textarea view-textarea" disabled  readonly style="resize:none;"></textarea>
                </div>
			</div>
            <div class="from-all-inner  from-none">
                <label class="fromAllContainer from-tags-label" style="display: none;"><span class="label-text">${getMessage("tags")}</span></label>
                ${tagshtml}
            </div>
		</div>
        <div class="from-view from-tips">
		    <p style="display: ${s?" block":"none"}">
                    ${l+getMessage("comma")+" "+t}
            </p>
            <p style="display: 
                                ${""==a.base.createDate||isBlank(a.base.createDate)||0==a.base.createDate?"none":" block"}">
                ${getMessage("createdAt")+getMessage("comma")+" "+o}
            </p>
		</div>
        </form>
    `}function viewPersonalHtml(e,a,s,l,t,o,n){let i=0;if(isBlank(a.personal.gender))i=0;else if(void 0===generTypeText[a.personal.gender]||"undefined"===generTypeText[a.personal.gender])switch(a.personal.gender){case"m":case"MME":case"MLLE":case"MS":case"Female":i=1;break;case"MR":case"f":case"Male":i=2;break;case"o":i=3;break;case"MX":case"NONE_OF_THESE":i=0}else i=a.personal.gender;let c=!1;return c=""!=a.personal.address||""!=a.personal.city||""!=a.personal.state||""!=a.personal.postalCode||""!=n,`
        <div id="${e}viewTitleCont" class="avatar-container">
		    <div class="avatar-icon website-icon" style="background-image: url('../skin/common/icon_persionl_info.svg')"></div>
		    <div class="avatar-details">
				<span id="${e}viewPersonalTitle" class="avatar-text">
                    ${isBlank(a.base.titlename)?"-":a.base.titlename}
                </span>
			</div>
		</div>
        <form novalidate="">
        <div class="from-container">
            <div class="from-view from-inner  from-copy from-copy-none" 
                    style="display: 
                                ${isBlank(a.personal.firstName)&&isBlank(a.personal.middleName)&&isBlank(a.personal.lastName)?"none":"flex"}">
                <label class="fromInputContainer" for="${e}allName">
                    <span class="label-text" data-copy-desc="${getMessage("name_copied")}">${getMessage("name")}</span>
                    <input spellcheck="false"  autocomplete="off"  id="${e}allName" class="label-input text-css" type="text"
                                    value=""
                                    disabled="disabled" readonly="true" name="allName">
                </label>
                <div class="actionList">
                    <button type="button" class="button-copy dpmtooltip css-opacity" title="${getMessage("copy")}"></button>
                </div>
            </div>
            <div class="from-view from-inner  from-copy from-copy-none"  style="display: ${isBlank(a.personal.gender)?"none":"flex"}">
                <label class="fromInputContainer" for="${e}ipsGender">
                    <span class="label-text" data-copy-desc="${getMessage("gender_copied")}">${getMessage("gender")}</span>
                    <input spellcheck="false"  autocomplete="off"  id="${e}ipsGender" class="label-input text-css" type="text"
                                    value="${generTypeText[i]}"
                                    disabled="disabled" readonly="true">
                </label>
                <div class="actionList">
                    <button type="button" class="button-copy dpmtooltip css-opacity" title="${getMessage("copy")}"></button>
                </div>
            </div>
            <div class="from-view from-inner  from-copy from-copy-none"  style="display: ${isBlank(a.personal.birthday)?"none":"flex"}">
                <label class="fromInputContainer" for="${e}ipsBirthday">
                    <span class="label-text" data-copy-desc="${getMessage("birthday_copied")}">${getMessage("birthday")}</span>
                    <input spellcheck="false"  autocomplete="off"  id="${e}ipsBirthday" class="label-input text-css" type="text"
                                value="${isBlank(a.personal.birthday)?"-":a.personal.birthday}"
                                    disabled="disabled" readonly="true">
                </label>
                <div class="actionList">
                    <button type="button" class="button-copy css-opacity dpmtooltip" title="${getMessage("copy")}"></button>
                </div>
            </div>
            <div class="from-view from-inner  from-copy from-copy-none"  style="display: ${isBlank(a.personal.email)?"none":"flex"}">
                <label class="fromInputContainer" for="${e}ipsPersionlEmail">
                    <span class="label-text" data-copy-desc="${getMessage("email_address_copied")}">${getMessage("emailAddress")}</span>
                    <input spellcheck="false"  autocomplete="off"  id="${e}ipsPersionlEmail" class="label-input text-css" type="text"
                                    value=""
                                    name="persionlemail"
                                    disabled="disabled" readonly="true">
                </label>
                <div class="actionList">
                    <button type="button" class="button-copy dpmtooltip css-opacity" title="${getMessage("copy")}"></button>
                </div>
            </div>
            <div class="from-view from-inner  from-copy from-copy-none"  style="display: ${isBlank(a.personal.phone)?"none":"flex"}">
                <label class="fromInputContainer" for="${e}ipsPersionlPhone">
                    <span class="label-text" data-copy-desc="${getMessage("phone_number_copied")}">${getMessage("phoneNumber")}</span>
                    <input spellcheck="false"  autocomplete="off"  id="${e}ipsPersionlPhone" class="label-input text-css" type="text"
                                    name="persionlphone"
                                    value=""
                                    disabled="disabled" readonly="true">
                </label>
                <div class="actionList">
                    <button type="button" class="button-copy dpmtooltip css-opacity" title="${getMessage("copy")}"></button>
                </div>
            </div>
            <div class="from-view from-inner  from-copy from-copy-none from-copy-area" style="display: ${0==c?"none":"flex"}">
                <label class="fromInputContainer">
                    <span class="label-text" data-copy-desc="${getMessage("address_copied")}">${getMessage("address")}</span>
                    <div class="label-textarea viewTextareaAds">
                        <textarea spellcheck="false"  autocomplete="off"  type="text"
                                    value=""
                                    name="address"
                                    disabled="disabled"
                                    readonly="true"
                                    class="hidden address-textarea"></textarea>
                        <p class="address">${isBlank(a.personal.address)?"":a.personal.address}</p>
                        <p class="city">${isBlank(a.personal.city)?"":a.personal.city}</p>
                        <p class="postalcode">
                            <span  style="display: ${isBlank(a.personal.state)?"none":"inline"}">
                                                ${isBlank(a.personal.state)?"":a.personal.state}&nbsp;
                            </span>
                            <span  style="display: ${isBlank(a.personal.postalCode)?"none":"inline"}">
                                ${isBlank(a.personal.postalCode)?"":a.personal.postalCode}
                            </span>
                        </p>
                        <p class="country">${isBlank(n)?"":n}</p>
                    </div>
                </label>
                <div class="actionList">
                    <button type="button" class="button-copy css-opacity dpmtooltip" title="${getMessage("copy")}"></button>
                </div>
            </div>
            <div class="from-view from-inner  from-none"  style="display: ${isBlank(a.personal.notes)?"none":"flex"}">
                <label class="fromInputContainer">
                     <span class="label-text">${getMessage("notes")}</span>
                    <textarea class="label-textarea view-textarea"  disabled readonly style="resize:none;"></textarea>
                </label>
            </div>

            <div class="from-all-inner  from-none">
                <label class="fromAllContainer from-tags-label" style="display: none;"><span class="label-text">${getMessage("tags")}</span></label>
                ${tagshtml}
            </div>
        </div>
        <div class="from-view from-tips">
		    <p style="display: ${s?" block":"none"}">
                                ${l+getMessage("comma")+" "+t}
            </p>
            <p style="display: 
                                ${""==a.base.createDate||isBlank(a.base.createDate)||0==a.base.createDate?"none":" block"}">
                ${getMessage("createdAt")+getMessage("comma")+" "+o}
            </p>
		</div>
        </form>
    `}function editNotesHtml(){let e=getMessage("secure_notes_placeholder");return e=e.replace("%s","5000"),`
        <div id="editNotesDate"  class="avatar-container edit-avatar">
            <div class="avatar-icon website-icon" style="background-image: url('../skin/common/icon_security_notes.png')"></div>
        </div>
        <form novalidate="">
        <div class="from-all-container">
            <div class="from-all-inner">
                <label class="fromEditContainer"><span class="label-text">${getMessage("title")+getMessage("comma")}</span><font class="label-point">*</font></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css" id="ipsEditTitle" 
                            type="text"
                            name="titlename" data-type="base"
                            placeholder='${getMessage("title_placeholder")}'
                            data-must='${getMessage("title_placeholder")}'
                            data-please='${getMessage("title_placeholder")}'
                            value="">
                </div>
            </div>
            <div class="from-all-inner  from-none">
                <label class="fromAllContainer">
                    <span class="label-text">${getMessage("notes")+getMessage("comma")}</span>
                    <textarea spellcheck="false"  autocomplete="off"  class="form-control label-textarea text-textarea  placeholder-css"
                                id="editNotesArea" name="text" spellcheck="false"  autocomplete="off" data-type="notes" ]
                                 maxlength="5000" placeholder="${e}"></textarea>
                    <div class="characters-tips hidden">${getMessage("notes_characters_tips")}</div>
                </label>
            </div>

            <div class="from-all-inner  from-none">
                <label class="fromAllContainer from-tags-label"><span class="label-text">${getMessage("tags")+getMessage("comma")}</span></label>
                ${tagshtml}
            </div>
        </div>
        </form>
    `}function editPaymentHtml(e,a,s,l){a=a.payment.cardtype.trim().replace(/\s/gi,"").toLowerCase();return`
        <div id="editPaymentDate"  class="avatar-container add-avatar">
            <div class="avatar-icon website-icon" style='background-image: ${cardType(a)}'></div>
        </div>
        <form novalidate="">
        <div class="from-edit-container">
            <div class="from-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("title")+getMessage("comma")}</span><font class="label-point">*</font></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css" id="editPaymentTitle" type="text"
                                placeholder='${getMessage("title_placeholder")}'
                                data-must='${getMessage("title_placeholder")}'
                                data-please='${getMessage("title_placeholder")}'
                                name="titlename" data-type="base"
                                value="">
                </div>
            </div>
            <div class="from-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("cardholderName")+getMessage("comma")}</span></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css" id="editPaymentCard" type="text"
                            placeholder="${getMessage("cardholderName")}" name="cardholderName" data-type="payment"
                            value="">
                </div>
            </div>
            <div class="from-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("cardNumber")+getMessage("comma")}</span></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="50" class="form-control all-input placeholder-css" id="editPaymentNumber" type="text"
                            placeholder="${getMessage("cardNumber")}" name="number" data-type="payment" value="">
                </div>
            </div>
            <div class="from-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("cardType")+getMessage("comma")}</span></label>
                <div id="editCardType" class="from-all-text  editable-card" data-name=""#offcanvasEdit"${s}">
                    <input type="text" autocomplete="off" 
                                        class="form-control form-select form-send editable-select es-input" 
                                        name="cardtype"
                                        maxlength="100" 
                                        spellcheck="false" 
                                        data-value = ''
                                        placeholder="${getMessage("cardType_placeholder")}" data-value="" value="">
                    <ul class="es-list" style="display: none;"></ul>
                    <ul class="es-list-none"  style="display: none;"><li class="list-none-inner">${getMessage("noResult")}</li></ul>
                </div>
            </div>
            <div class="from-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("securityCode")+getMessage("comma")}</span></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="20" name="securitycode" class="form-control all-input placeholder-css" id="editPaymentCVV" type="text"
                            placeholder="${getMessage("securityCode")}" data-type="payment" value="">
                </div>
            </div>
            <div class="from-inner from-all-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("expOptionDate")+getMessage("comma")}</span></label>
                <div class="from-all-text d-flex justify-content-between" name="expirationdate">
                    <select id="expYearEdit" name="expYearEdit" class="form-control form-select placeholder-css" aria-label=".form-select-lg example"
                            data-name='${getMessage("year")}' data-type="0" form-name="expirationdate"></select>
                    <select id="expMonthEdit" name="expMonthEdit" class="form-control form-select placeholder-css"
                            aria-label=".form-select-lg example" data-name='${getMessage("month")}' form-name="expirationdate"></select>
                </div>
            </div>
            <div class="from-all-inner">
                <div class="from-inner">
                    <div class="form-check form-main-check">
                        <input spellcheck="false"  autocomplete="off"
                                    class="form-control form-check-input remind editexpcheckdefault"
                                    name="expdateremind"
                                    data-type="payment"
                                    type="checkbox"
                                    value=""
                                    id="${e}editExpCheckDefault">
                        <label class="form-check-label remind" for="${e}editExpCheckDefault">${getMessage("remindExpirationDate")}</label>
                    </div>
                </div>
            </div>
            <div class="from-inner from-none">
                <label class="fromAllContainer">
                    <span class="label-text">${getMessage("notes")+getMessage("comma")}</span>
                    <textarea spellcheck="false"  autocomplete="off"
                            class="form-control label-textarea text-textarea  placeholder-css" id="editNotesArea"
                            name="notes" spellcheck="false"  autocomplete="off"
                            data-type="payment"  maxlength="5000" placeholder="${l}"></textarea>
                    <div class="characters-tips hidden">${getMessage("notes_characters_tips")}</div>
                </label>
            </div>

            <div class="from-all-inner  from-none">
                <label class="fromAllContainer from-tags-label"><span class="label-text">${getMessage("tags")+getMessage("comma")}</span></label>
                ${tagshtml}
            </div>
        </div >
        </form>
    `}function editPersonalHtml(e,a,s){return`
        <div id="editPersonalDate"  class="avatar-container edit-avatar">
            <div class="avatar-icon website-icon" style="background-image: url('../skin/common/icon_persionl_info.svg')"></div>
        </div>
        <form novalidate="">
        <div class="from-all-container">
            <div class="from-all-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("title")+getMessage("comma")}</span><font class="label-point">*</font></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css" id="editPersionlTitle" type="text"
                            placeholder='${getMessage("title_placeholder")}'
                                    data-must='${getMessage("title_placeholder")}'
                                    data-please='${getMessage("title_placeholder")}' data-type="base" value="" name="titlename">
                </div>
            </div>
             <div class="from-all-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("name")+getMessage("comma")}</span></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="100" class="form-control all-input placeholder-css" id="editPersionlFirstName" type="text"
                            placeholder='${getMessage("firstName")}' data-type="personal" value="" name="firstName">
                    <input spellcheck="false"  autocomplete="off"  maxlength="100" class="form-control all-input placeholder-css" id="editPersionlMiddleName" type="text"
                            placeholder='${getMessage("middleName")}' data-type="personal" value="" name="middleName">
                    <input spellcheck="false"  autocomplete="off"  maxlength="100" class="form-control all-input placeholder-css" id="editPersionlLastName" type="text"
                            placeholder='${getMessage("lastName")}' data-type="personal" value="" name="lastName">
                </div>
            </div>
            <div class="from-all-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("gender")+getMessage("comma")}</span></label>
                <div class="from-all-text">
                    <select id="editPersionlGender" class="form-control form-select one-select  placeholder-css"
                            aria-label=".form-select-lg example" name="gender" data-type="personal">
                        <option value=''>${getMessage("genderNone")}</option>
                        <option value="1">${getMessage("genderMale")}</option>
                        <option value="2">${getMessage("genderFemale")}</option>
                        <option value="3">${getMessage("genderOther")}</option>
                    </select>
                </div>
            </div>
            <div class="from-all-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("birthday")+getMessage("comma")}</span></label>
                <div class="from-all-text d-flex justify-content-between">
                    <select id="birthdayYearEdit" name="birthdayYearEdit" class="form-control form-select three-select placeholder-css"
                            aria-label=".form-select-lg example" data-name='${getMessage("year")}' data-type="1"></select>
                    <select id="birthdayMonthEdit" name="birthdayMonthEdit" class="form-control form-select three-select placeholder-css"
                            aria-label=".form-select-lg example" data-name='${getMessage("month")}'></select>
                    <select id="birthdayDayEdit" name="birthdayDayEdit" class="form-control form-select  three-select placeholder-css"
                            aria-label=".form-select-lg example" data-name='${getMessage("day")}'>
                        <option value="0">Day</option>
                    </select>
                </div>
            </div>
            <div class="from-all-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("emailAddress")+getMessage("comma")}</span></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="100" class="form-control all-input placeholder-css" id="editPersionlEmail" type="text"
                            placeholder='${getMessage("emailAddress")}' data-type="personal" value="" name="email">
                </div>
            </div>
            <div class="from-all-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("phoneNumber")+getMessage("comma")}</span></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="50" class="form-control all-input placeholder-css" id="editPersionlPhone" type="text"
                            placeholder='${getMessage("phoneNumber")}' data-type="personal" value="" name="phone">
                </div>
            </div>
            <div class="from-all-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("address")+getMessage("comma")}</span></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css" id="editPersionlAddress" type="text"
                            placeholder="${getMessage("address")}" data-type="personal" value="" name="address">
                </div>
            </div>
            <div class="from-all-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("cityTown")+getMessage("comma")}</span></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css" id="editPersionlCity" type="text"
                            placeholder="${getMessage("cityTown")}" data-type="personal" value="" name="city">
                </div>
            </div>
            <div class="from-all-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("state")+getMessage("comma")}</span></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="250" class="form-control all-input placeholder-css" id="editPPersionlState" type="text"
                            placeholder="${getMessage("state")}" data-type="personal" value="" name="state">
                </div>
            </div>
            <div class="from-all-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("countryRegion")+getMessage("comma")}</span></label>
                <div id="editCountryType" class="from-all-text  editable-country" data-name="offcanvasEdit${e}">
                    <input type="text" autocomplete="off" 
                                class="form-control form-select form-send editable-select es-input" name="country" maxlength="250" spellcheck="false" 
                                placeholder="${getMessage("countryRegion_placeholder")}" data-value="${a}" value="">
                    <ul class="es-list" style="display: none;"></ul>
                    <ul class="es-list-none"  style="display: none;"><li class="list-none-inner">${getMessage("noResult")}</li></ul>
                </div>
            </div>
            <div class="from-all-inner">
                <label class="fromAllContainer"><span class="label-text">${getMessage("zipPostalCode")+getMessage("comma")}</span></label>
                <div class="from-all-text">
                    <input spellcheck="false"  autocomplete="off"  maxlength="100" class="form-control all-input placeholder-css" id="editPPersionlZIP" type="text"
                            placeholder="${getMessage("zipPostalCode")}" data-type="personal" value=""  name="postalCode">
                </div>
             </div>
            <div class="from-all-inner  from-none">
                <label class="fromAllContainer">
                    <span class="label-text">${getMessage("notes")+getMessage("comma")}</span>
                    <textarea spellcheck="false"  autocomplete="off"  class="form-control label-textarea text-textarea  placeholder-css"
                            id="editPersionlArea" spellcheck="false" placeholder="${s}"
                            autocomplete="off"  maxlength="5000" name="notes" data-type="personal"></textarea>
                    <div class="characters-tips hidden">${getMessage("notes_characters_tips")}</div>
                </label>
            </div>

            <div class="from-all-inner  from-none">
                <label class="fromAllContainer from-tags-label"><span class="label-text">${getMessage("tags")+getMessage("comma")}</span></label>
                ${tagshtml}
            </div>
        </div>
        </form>
    `}