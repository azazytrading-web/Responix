var poupBottom=new Popup;async function ClearLoginGPwdList(e){try{var t=getMessage("cleared_successfully"),a=(ClearLoginCopyToast(t),CreateGPwdNoneList(),await handle.sendMessage("CLEAR_PWDHIST",{id:e}));a.succ&&poupBottom.initPopup("login-panel")}catch(e){}}function tabTitleClickEvent(){let t;$("#ipsContacts .tab-title").off("click").on("click",function(e){clickStopPropagation(e),t=$(this).attr("data-anchor"),$(".tab-container[data-anchor='"+t+"']").hasClass("show")?($(".tab-container[data-anchor='"+t+"']").removeClass("show"),$(this).removeClass("show"),"type"==t&&$(".tab-container.tags-container").addClass("sheight")):($(".tab-container[data-anchor='"+t+"']").addClass("show"),$(this).addClass("show"),"type"==t&&$(".tab-container.tags-container").removeClass("sheight"))})}function getStyle(e,t=null){e=window.getComputedStyle(e,null);return t?e[t]:e}$("#clearAllPassPopovers .clear-all-btn").off("click").on("click",function(e){var t=$("#passwordHistory").attr("data-type");0<$("#passwordHistory .hist-row").length&&(0==t?(ClearGPwdList(),useOfStatistical("607")):ClearLoginGPwdList($(this).attr("controls-id")))}),$$("options-tab").addEventListener("click",function(e){e.target.getAttribute("controls");var t,e=e.target,e=findAncestors(e,function(e){return e.classList&&e.classList.contains("options-item")});e&&("tags-panel"==e.getAttribute("data-type")?($("#tags-panel").attr("data-anchor",e.getAttribute("data-anchor")),t=e.getAttribute("name"),$("#options-tab .options-item").removeClass("selected"),poupBottom.initPopup("tags-panel"),$("#tags-panel").attr("data-index",t)):($("#tags-panel").attr("data-anchor",""),$("#options-tab .options-item").removeClass("selected"),e.classList.add("selected")),$("#headerSearchInput").val(""),chagePageByName(e),$("#no-container").addClass("fade").addClass("hidden"),"suggestion-panel"==e.getAttribute("controls")&&0<$("#ipsContainer .hist-tips").length?$(".sortbox").css("top",$("#ipsContainer .hist-tips").outerHeight()+8):$(".sortbox").css("top",8))}),$(function(){tabTitleClickEvent()});const showOverflowHiddenText=e=>{e=document.querySelectorAll(e);const n=document.createRange().getBoundingClientRect().width;e.forEach((e,t)=>{var a,s=(parseInt(getStyle(e,"paddingLeft"),10)||0)+(parseInt(getStyle(e,"paddingRight"),10)||0);n+s>e.offsetWidth||e.scrollWidth>e.offsetWidth?(s=e.innerHTML,(a=document.createElement("div")).innerHTML=s,s=a.innerText||a.textContent,e.setAttribute("title",s)):e.removeAttribute("title")})};function checkHtml(e){return/<[^>]+>/g.test(e)}function onExcludeValueCheck(){$(".form-exclude").on("input propertychange keyup change",function(e){checkBlankSpace($(".form-exclude").val())&&!checkHtml($(".form-exclude").val())?$(".exclude-add").removeAttr("disabled"):$(".exclude-add").attr("disabled","disabled")})}onExcludeValueCheck();const excludeItemHmtl=`
<div class="exclude__list_item">
	<div class="exclude__list_info">
		<b class="exclude__list_number"></b>
		<a class="exclude__list_web" href=""></a>
	</div>
	<div class="exclude__list_action">
		<button type="button" class="action-button exclude-button" title="${getMessage("delete")}">
			<i class="svg-css  svg-delete"></i>
		</button>
	</div>
</div>
`,excludenoneHtml=`
<div id="no-exclude" class="exclude__none">
    <div class="exclude__none_inner">
        <div>
            <img src="./images/icon_item_empty.png" alt="">
                <p class="no-tips">${getMessage("no_excluded_websites")}</p>
        </div>
    </div>
</div>
`;class ExcludeWebList{constructor(){this._data=[],this._initDate(),this.bindEvents()}async onAddBlackList(){try{var e=$(".form-exclude").val();checkBlankSpace(e)&&($("#ExcludeModal").modal("hide"),(await handle.sendMessage("ADD_BLACKLIST",{hostname:getHost(e)})).succ)&&(this._initDate(),$(".exclude-body").scrollTop(0),$(".form-exclude").val(""))}catch(e){}}async onDeleteBlackList_Event(e){try{var t=await handle.sendMessage("RM_BLACKLIST",{id:e});t.succ&&this._initDate()}catch(e){}}bindEvents(){let s=this;document.querySelector(".exclude-add").addEventListener("click",function(e){s.onAddBlackList()}),document.onkeydown=function(e){e=window.event||e;13==(e.keyCode||e.which||e.charCode)&&s.onAddBlackList()},document.querySelector(".exclude-body").addEventListener("click",async function(e){var t=e.target,t=findAncestors(t,function(e){return e.classList&&e.classList.contains("exclude-button")});if(t){t.disabled=!0;try{var a=await handle.sendMessage("RM_BLACKLIST",{id:t.getAttribute("data-id")});a.succ&&(s._initDate(),t.disabled=!1)}catch(e){t.disabled=!1}}}),document.querySelector(".exclude-body").addEventListener("click",async function(e){var t=e.target,t=findAncestors(t,function(e){return e.classList&&e.classList.contains("exclude__list_web")});if(t)try{await handle.sendMessage("OPEN_URL",{url:t.innerHTML})}catch(e){}})}async _initDate(){try{var t=await handle.sendMessage("GET_BLACKLIST",{});t.succ?this._data=t.list.map((e,t)=>({...e,_key:t})):this._data=[];let e="";if(0<this._data.length){for(var a in this._data)e+=`
                    <div class="exclude__list_item">
                        <div class="exclude__list_info">
                            <b class="exclude__list_number">${this._data[a]._key+1}</b>
                            <a class="exclude__list_web" target="_blank" href="javascript: void(0);">${this._data[a].hostname}</a>
                        </div>
                        <div class="exclude__list_action">
                            <button data-id="${this._data[a].id}" type="button" class="action-button exclude-button" title="${getMessage("delete")}">
                                <i class="svg-css  svg-delete"></i>
                            </button>
                        </div>
                    </div>
                    `;$(".exclude-body .exclude__list").removeClass("exclude__none"),$(".exclude-body .exclude__list").html(e),showOverflowHiddenText(".exclude__list_web")}else $(".exclude-body .exclude__list").html(excludenoneHtml),$(".exclude-body .exclude__list").addClass("exclude__none")}catch(e){}}}var excludeebist=new ExcludeWebList;$$("buttonExclude").addEventListener("mousedown",function(e){excludeebist._initDate()});const excludeModal=document.getElementById("ExcludeModal"),excludeOffcanvas=(excludeModal.addEventListener("shown.bs.modal",e=>{$(".form-exclude[name = 'website']").focus()}),document.getElementById("offcanvasExclude"));excludeOffcanvas.addEventListener("hidden.bs.offcanvas",e=>{$(".exclude-body .exclude__list").html("")});