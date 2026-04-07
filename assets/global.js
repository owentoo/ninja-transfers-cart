//#########  Set Reset Cookie value  ##########
function getCook(cookiename) {
	var cookiestring = RegExp("" + cookiename + "[^;]+").exec(document.cookie);
	return decodeURIComponent(!!cookiestring ? cookiestring.toString().replace(/^[^=]+./, "") : "");
}

function setCookie(name, value, days) {
  let expires = "";

  if (typeof days === "number" && days > 0) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  } else if (days === "session") {
    expires = "";
  } else {
    console.warn("Invalid 'days' parameter. Use a number for days or 'session' for session-based cookies.");
  }
  document.cookie = `${name}=${value || ""}${expires}; path=/; SameSite=None; Secure; domain=${window.location.hostname};`;
}


function findObjectByKey(array, key, value, multiple) {
  try {
    let rtn = [];
    for (var i = 0; i < array.length; i++) {
      if (array[i][key] === value) {
        if ( multiple ) {
          rtn.push( array[i] );
        } else {
          return array[i];
        }
      }
    }
    if ( multiple && rtn.length > 0 ) {
      return rtn;
    } else {
      return null;
    }
  }
  catch ( err ) {
    console.log( `ERROR findObjectByKey`, err.message );
  }
}

function ElementAvailibility ( selectorIs, functionName, timer, args='' ) {
  try {
    var divCheckingInterval                   =   setInterval( function() {
      if ( document.querySelector( selectorIs ) ) {
        clearInterval( divCheckingInterval );
        if ( typeof functionName !== 'undefined' && functionName ) {
          window[functionName]( args ? args : '' );
        }
        return true;
      }
    }, timer != '' ? timer : 250);
    return false;
  } catch ( err ) {
    console.log( `ERROR checkingElement`, err.message );
  }
}

function getParam( paramIs ) {
  try {
    const url = location.href;
    const objURL = new URL(url);
    const c = objURL.searchParams.get( paramIs );
    return c;
  }
  catch ( err ) {
    console.log ( 'ERROR getParam', err.message );
  }
}


function cartStickyFunc() {
  setTimeout(function(){
    if($(window).outerHeight() > 600){
      $("#site-cart-sidebar").addClass("enable_cart_sticky");
    }else{
      $("#site-cart-sidebar").removeClass("enable_cart_sticky");
    }
  })
}

$(function () {
  cartStickyFunc();
  $(window).resize(function(){
    cartStickyFunc();
  });
  
  if($(".order-tab").length){
    $(".order-tab").click(function() {
      var _index = $(this).index();
      $(".order-tab").removeClass("active");
      $(".orderlist_block").addClass("nodisplay");
      $(".order-tab").eq(_index).addClass("active");
      $(".orderlist_block").eq(_index).removeClass("nodisplay");
    })
  }
})

async function getRequest( url ) {
  try {
    let productObject;
    await fetch( url )
    .then(response => response.json())
    .then(data => {
      productObject               =   data;
    });
    return productObject;
  }
  catch ( err ) {
    console.log ( 'Error getRequest', err.message );
  }
}

document.addEventListener("DOMContentLoaded", function() {
    const popupOverlay = document.querySelector('.popup-overlay');
    const closeButton = document.querySelector('.close-button');
    if (closeButton){
      closeButton.addEventListener('click', function() {
          popupOverlay.classList.add('popup-overlay-hidden')
      });
    }
});

var addDelay = ms => new Promise(res => setTimeout(res, ms));

function toast( title, msg, color='green', timer=5000 ) {
  try {
    $( `.toast` ).remove();
    $( `body` )
      .append( `
        <div class="toast ${ color }">
          <div class="toast-content">
            <svg class="fas fa-solid fa-check check" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M9 22l-10-10.598 2.798-2.859 7.149 7.473 13.144-14.016 2.909 2.806z"/></svg>
              <div class="message">
              <span class="text text-1">${ title }</span>
              <span class="text text-2">${ msg }</span>
            </div>
          </div>
          <svg class="fa-solid fa-xmark close" width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6L18 18" stroke="#000" stroke-linecap="round"></path><path d="M18 6L6.00001 18" stroke="#000" stroke-linecap="round"></path></svg>

          <div class="progress active"></div>
        </div>
        ` );

        setTimeout(() => {
          $( `.toast` ).addClass( `active` );
        }, 50);

    setTimeout(() => {
      $( `.toast` ).removeClass( `active` );
    }, timer);
  } catch ( err ) {
    console.log( `ERROR `, err.message );
  }
}

function createThumbnail(imageUrl, thumbnailWidth, callback) {
  const img = new Image();
  img.crossOrigin = 'Anonymous'; // This is important for cross-origin images
  img.onload = function() {
    const aspectRatio = img.height / img.width;
    const thumbnailHeight = thumbnailWidth * aspectRatio;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set the canvas dimensions to the thumbnail size
    canvas.width = thumbnailWidth;
    canvas.height = thumbnailHeight;

    // Draw the image onto the canvas, scaling it to fit the thumbnail dimensions
    ctx.drawImage(img, 0, 0, thumbnailWidth, thumbnailHeight);

    // Get the data URL of the thumbnail image
    const thumbnailUrl = canvas.toDataURL('image/png');

    // Call the callback function with the thumbnail URL
    callback(thumbnailUrl);
  };
  img.src = imageUrl;
}

// gtag file_upload function triggered

/*
document.addEventListener("DOMContentLoaded", () => {
    const dropZoneElement = document.querySelector("#dropZoon");
    if (dropZoneElement) {
        dropZoneElement.addEventListener("click", () => {
            if (typeof gtag === 'function') {
                gtag('event', 'file_upload', {
                    event_category: 'User Actions',
                });
                console.log("GA event 'file_upload' triggered.");
            } else {
                console.error("gtag is not defined. Google Analytics is not set up.");
            }
            if (window.dataLayer && Array.isArray(window.dataLayer)) {
                // console.log("Current dataLayer entries:");
                window.dataLayer.forEach(item => {
                    // console.log(item);
                });
                // console.log("Last dataLayer entry:", window.dataLayer[window.dataLayer.length - 1]);
            }
        });
    }
});
*/

$(function () {
  $(".openmodalbox").click(function () {
    var _tnode = $(this).attr("data-target");
    $(_tnode).show();
  })
  
  $(".focuselement").click(function(){
      var target = $(this).data("tnode");
    console.log("target: ",target)
      if ($(target).length) {
          $('html, body').animate({
              scrollTop: $(target).offset().top
          }, 500);
      }
  });
  
  $(document).on(`click`, `.customTabelPopup__close`, function( e ) {
    try {
      e.stopImmediatePropagation();
      $(this).parents(".customTabelPopup__overlay").fadeOut();
    } catch ( err ) {
      console.log( `ERROR .customTabelPopup__close`, err.message );
    }
  })

  $(document).on(`click`, `.preview-modal:not(.cartPropertyImg)`,function () {
    var _tnode = $(this).attr("data-target");
    var _previmg = $(this).attr("data-src");
    var bgtype = $(this).attr("data-bgtype");
    $(_tnode).removeClass("prv")
    $(_tnode).find(".previewimg").attr("src",_previmg);
    if(bgtype == "yes"){
      $(_tnode).addClass("prv");
    }
    if(_previmg != ""){
      $(_tnode).show();
    }
  })
  .on(`click`, `.preview-modal.cartPropertyImg`, function( e ) {
    try {
      e.stopImmediatePropagation();
      const getTarget = $( this ).attr( `data-target` );
      let parentEle = $( this ).closest( `.cart-form-item` );
      if ( parentEle.length == 0 ) {
        parentEle = $( this ).closest( `.cart-item` );
      }
      let getImg = parentEle.find( `.preview-modal img` ).attr( `src` );
      if ( typeof getImg !== 'undefined' && getImg ) {
        const urlObj = new URL( getImg );
        urlObj.searchParams.delete( 'w' );
        urlObj.searchParams.delete( 'h' );
        getImg = urlObj.toString();
        $( this ).attr( `data-src`, `${ getImg }&w=2000` );
      }

      var _tnode = $( this ).attr( `data-target` );
      var _previmg = $( this ).attr( `data-src` );
      var bgtype = $( this ).attr( `data-bgtype` );
      $( _tnode ).removeClass( `prv` )
      $( _tnode ).find( `.previewimg` ).attr( `src`, _previmg );
      if ( bgtype == `yes` ) {
        $( _tnode ).addClass( `prv` );
      }
      if ( _previmg != `` ) {
        $( _tnode ).show();
      }
    } catch ( err ) {
      console.log( `ERROR .preview-modal.cartPropertyImg`, err.message );
    }
  });
  $('.hide_overlay').on('click', function(e) {
      if (!$(e.target).closest('.customTabelPopup').length) {
          $('.customTabelPopup__overlay').hide();
      }
  });
})

$( document )
.mouseup(function( e ) {
  try {
    const container		=		$( `#site-cart-sidebar` );
    if ( !container.is( e.target ) && container.has( e.target ).length === 0 ) {
      const cartStatus = container.hasClass( `sidebar--opened` );
      if ( cartStatus ) {
        container.find( `.sidebar__header .sidebar__close` ).click();
      }
    }
  } catch ( err ) {
    console.log( `ERROR `, err.message );
  }
});
document.addEventListener('DOMContentLoaded', function () {
  const frames = document.querySelectorAll('.scroll-pinned-frame');
  const triggerOffset = window.innerHeight * 0.3;

  function updateActiveFrame() {
    frames.forEach((frame, index) => {
      const rect = frame.getBoundingClientRect();
      if (rect.top <= triggerOffset && rect.bottom >= triggerOffset) {
        frame.classList.add('active');
      } else {
        frame.classList.remove('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveFrame);
  updateActiveFrame();

  $(".nav-transfer-cta").click(function(e){
    e.preventDefault();
    e.stopImmediatePropagation();
    $(".grt-c-submenu-drawer").toggleClass("grt-c-active");
  })

});

function globalModal( modalContent, modalWidth = 650 ) {
  try {
    const modalHTML = `
      <div class="globalModal active">
        <div class="globalModal_overlay" onclick="$(this).closest('.globalModal').remove();"></div>
        <div class="globalModal_content setWidth_${ modalWidth }">
          <div class="globalModal_close" onclick="$(this).closest('.globalModal').remove();">&times;</div>

          ${ modalContent }
        </div>
      </div>
    `;
    $( `body` ).append( modalHTML );
  } catch ( err ) {
    console.log( `ERROR `, err.message );
  }
}

function getMatchingVariantBySqInches(variants, sqInches) {
  if (!Array.isArray(variants) || isNaN(sqInches)) return null;

  sqInches = Number(sqInches);

  for (const variant of variants) {
    if (!variant.option1) continue;

    // Extract numbers from "Style #4465–4608" or "Style #4465-4608"
    const match = variant.option1.match(/(\d+)\s*[–-]\s*(\d+)/);

    if (!match) continue;

    const min = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);

    if (sqInches >= min && sqInches <= max) {
      return variant; // ✅ FOUND
    }
  }

  return null; // ❌ No match
}


