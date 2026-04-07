if ( typeof CartForm !== 'function' ) {
	class CartForm extends HTMLElement {
		constructor(){
			super();
			this.ajaxifyCartItems();
		}

		ajaxifyCartItems(){

			this.form = this.querySelector('form');

			this.querySelectorAll('[data-js-cart-item]').forEach(item=>{

				const remove = item.querySelector('.remove');
				if ( remove ) {
					remove.dataset.href = remove.getAttribute('href');
					remove.setAttribute('href', '');
					remove.addEventListener('click', (e)=>{
						e.preventDefault();
						this.updateCartQty(item, 0);
					})
				}

				const qty = item.querySelector('.qty');
				if ( qty ) {
					qty.addEventListener('input', debounce(e=>{
						e.preventDefault();
						e.target.blur();
						this.updateCartQty(item, parseInt(qty.value));
					}, 2000));
					qty.addEventListener('click', (e)=>{
						e.target.select();
					})
				}

				const upsell = item.querySelector('._upsell_cta');
				if ( upsell ) {
					upsell.addEventListener('click', (e)=>{
						var el = e.target;
						console.log(upsell.dataset,"upsell")
						var _index = parseInt(upsell.dataset.line) - 1;
						var pNode = el.closest("._upsell_parent_block");
						var qtyNode = pNode.querySelector("._discount-list")
						var qty_value = qtyNode.dataset.min
						this.updateUpsell(item, parseInt(qty_value));
					})
				}
			})
            if (typeof _upsell_check === 'function') {
              _upsell_check();
            }
		}


		updateUpsell(item, newQty){
			let alert = null;
			this.form.classList.add('processing');
			if ( this.querySelector('.alert') ) {
				this.querySelector('.alert').remove();
			}

			var propitems = item.querySelector(".propitems")
			var order_properties =  $.trim($(propitems).val());
			var _json_prop = {};
			if(order_properties != ""){
				_json_prop = JSON.parse(order_properties);
				$.each(_json_prop, function(key, value) {
					if(key == "_discount_name"){
						_json_prop[key] = decodeURIComponent(value);
					}
					if(key == "_discount_input"){
						_json_prop[key] = decodeURIComponent(value);
					}
					if(value.indexOf("https%3A%2F%2F") > -1){
						_json_prop[key] = decodeURIComponent(value);
					}
				});
			}
			console.log(_json_prop," :_json_prop: ");
			const body = JSON.stringify({
				id: item.dataset.id,
				quantity: newQty,
				properties : _json_prop
			});

			fetch(KROWN.settings.routes.cart_change_url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Accept': 'application/javascript' },
				body
				})
				.then(response => response.json())
				.then(response => {
					if ( response.status == 422 ) {
						// wrong stock logic alert
						alert = document.createElement('span');
						alert.classList.add('alert', 'alert--error');
						if ( typeof response.description === 'string' ) {
							alert.innerHTML = response.description;
						} else {
							alert.innerHTML = response.message;
						}
					}
					return fetch('?section_id=helper-cart');
				})
				.then(response => response.text())
				.then(text => {

					const sectionInnerHTML = new DOMParser().parseFromString(text, 'text/html');
					const cartFormInnerHTML = sectionInnerHTML.getElementById('AjaxCartForm').innerHTML;
					const cartSubtotalInnerHTML = sectionInnerHTML.getElementById('AjaxCartSubtotal').innerHTML;

					const cartItems = document.getElementById('AjaxCartForm');
					cartItems.innerHTML = cartFormInnerHTML;
					cartItems.ajaxifyCartItems();

					document.querySelectorAll('[data-header-cart-count]').forEach(elm=>{
						//elm.textContent = cartItems.querySelector('[data-cart-count]').textContent;
						let _cartno = cartItems.querySelector('[data-cart-count]').textContent;
						elm.textContent = _cartno;
						elm.setAttribute("data-count",_cartno);
					});
					document.querySelectorAll('[data-header-cart-total').forEach(elm=>{
						elm.textContent = cartItems.querySelector('[data-cart-total]').textContent;
					});

					if ( alert !== null ) {
						this.form.prepend(alert);
					}

					document.getElementById('AjaxCartSubtotal').innerHTML = cartSubtotalInnerHTML;

					const event = new Event('cart-updated');
					this.dispatchEvent(event);

				})
				.catch(e => {
					console.log(e);
					let alert = document.createElement('span');
					alert.classList.add('alert', 'alert--error');
					alert.textContent = KROWN.settings.locales.cart_general_error;
					this.form.prepend(alert);
				})
				.finally(() => {
					this.form.classList.remove('processing');
					_saving_update();
                    if (typeof _upsell_check === 'function') {
                      _upsell_check();
					}
				});
      }


			updateCartQty(item, newQty){

				let alert = null;

				this.form.classList.add('processing');
				if ( this.querySelector('.alert') ) {
					this.querySelector('.alert').remove();
				}

				const body = JSON.stringify({
					id: item.dataset.id,
					quantity: newQty
				});

				fetch(KROWN.settings.routes.cart_change_url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'Accept': 'application/javascript' },
					body
				})
				.then(response => response.json())
				.then(response => {
					if ( response.status == 422 ) {
						// wrong stock logic alert
						alert = document.createElement('span');
						alert.classList.add('alert', 'alert--error');
						if ( typeof response.description === 'string' ) {
							alert.innerHTML = response.description;
						} else {
							alert.innerHTML = response.message;
						}
					}
					return fetch('?section_id=helper-cart');
				})
				.then(response => response.text())
				.then(text => {

					const sectionInnerHTML = new DOMParser().parseFromString(text, 'text/html');
					const cartFormInnerHTML = sectionInnerHTML.getElementById('AjaxCartForm').innerHTML;
					const cartSubtotalInnerHTML = sectionInnerHTML.getElementById('AjaxCartSubtotal').innerHTML;

					const cartItems = document.getElementById('AjaxCartForm');
					cartItems.innerHTML = cartFormInnerHTML;
					cartItems.ajaxifyCartItems();

					document.querySelectorAll('[data-header-cart-count]').forEach(elm=>{
						//elm.textContent = cartItems.querySelector('[data-cart-count]').textContent;
						let _cartno = cartItems.querySelector('[data-cart-count]').textContent;
						elm.textContent = _cartno;
						elm.setAttribute("data-count",_cartno);
						//console.log("======= cartItems === 191 ",_cartno)
					});
					document.querySelectorAll('[data-header-cart-total').forEach(elm=>{
						elm.textContent = cartItems.querySelector('[data-cart-total]').textContent;
					});

					if ( alert !== null ) {
						this.form.prepend(alert);
					}

					document.getElementById('AjaxCartSubtotal').innerHTML = cartSubtotalInnerHTML;
					if ( typeof reCalculateFreeShippingModule === 'function' ) {
						reCalculateFreeShippingModule();
					}
					const event = new Event('cart-updated');
					this.dispatchEvent(event);

				})
				.catch(e => {
					console.log(e);
					let alert = document.createElement('span');
					alert.classList.add('alert', 'alert--error');
					alert.textContent = KROWN.settings.locales.cart_general_error;
					this.form.prepend(alert);
				})
				.finally(() => {
					this.form.classList.remove('processing');
					_saving_update();
                    if (typeof _upsell_check === 'function') {
                      _upsell_check();
					}
				});
			}

		}


		if ( typeof customElements.get('cart-form') == 'undefined' ) {
			customElements.define('cart-form', CartForm);
		}

}

if ( typeof CartProductQuantity !== 'function' ) {

	class CartProductQuantity extends HTMLElement {
		constructor(){
			super();
			this.querySelector('.qty-minus').addEventListener('click', this.changeCartInput.bind(this));
			this.querySelector('.qty-plus').addEventListener('click', this.changeCartInput.bind(this));
		}
		changeCartInput(){
			setTimeout(()=>{
				document.getElementById('AjaxCartForm').updateCartQty(this.closest('[data-js-cart-item]'), parseInt(this.querySelector('.qty').value));
			}, 50);
		}
	}

  if ( typeof customElements.get('cart-product-quantity') == 'undefined' ) {
		customElements.define('cart-product-quantity', CartProductQuantity);
	}

}

// method for apps to tap into and refresh the cart

if ( ! window.refreshCart ) {

	window.refreshCart = ( cartAct ) => {

		fetch('?section_id=helper-cart')
			.then(response => response.text())
			.then(text => {

			const sectionInnerHTML = new DOMParser().parseFromString(text, 'text/html');
			const cartFormInnerHTML = sectionInnerHTML.getElementById('AjaxCartForm').innerHTML;
			const cartSubtotalInnerHTML = sectionInnerHTML.getElementById('AjaxCartSubtotal').innerHTML;

			const cartItems = document.getElementById('AjaxCartForm');
			cartItems.innerHTML = cartFormInnerHTML;
			cartItems.ajaxifyCartItems();

			document.querySelectorAll('[data-header-cart-count]').forEach(elm=>{
				elm.textContent = cartItems.querySelector('[data-cart-count]').textContent;
			});
			document.querySelectorAll('[data-header-cart-total').forEach(elm=>{
				elm.textContent = cartItems.querySelector('[data-cart-total]').textContent;
			})

			document.getElementById('AjaxCartSubtotal').innerHTML = cartSubtotalInnerHTML;
			if ( cartAct != 'notOpen' ) {
				document.querySelector('[data-js-site-cart-sidebar]').show();
			}

			if ( document.querySelector('cart-recommendations') ) {
				document.querySelector('cart-recommendations').innerHTML = '';
				document.querySelector('cart-recommendations').generateRecommendations();
			}
			_saving_update();
            if (typeof _upsell_check === 'function') {
              _upsell_check();
            }
		})

		if ( typeof reCalculateFreeShippingModule === 'function' ) {
			// console.log ( 'chaaa',  );
			reCalculateFreeShippingModule();
		}
	}

}


$(function () {
  var cartWrappingForm = document.getElementById('cart-wrapping');
  $(document).on("click","#cart-gift-wrapping",function(){
    var _ischecked = $(this).is(":checked");
    console.log($(this).is(":checked")," ==checked###################################");
    if ( document.getElementById('site-cart-sidebar') ) {
      document.getElementById('site-cart-sidebar').scrollTo({top: 0, behavior: 'smooth'});
    }

    if ( _ischecked ) {
			const isVariantAvailable = $( `#cart-wrapping #add-to-cart- form [name="id"]` ).length;
			let vid = '';
			if ( isVariantAvailable == 0 ) {
				const getTempData = $( `#cart-wrapping #add-to-cart- form template` ).html();
				if ( typeof getTempData !== 'undefined' && getTempData ) {
					$( `#cart-wrapping #add-to-cart- form` ).append( getTempData );
				}
			}
			vid = $( `#cart-wrapping #add-to-cart- form [name="id"]` ).val() * 1;
			if ( typeof vid !== 'undefined' && vid ) {
				const items = [{
					id: vid,
					quantity: 1
				}];
				$.post(`/cart/add.js`, {items}, function ( r ) {
					const isCartDrawer = $( `sidebar-drawer#site-cart-sidebar` ).hasClass( `sidebar--opened` );
					if ( isCartDrawer ) {
						refreshCart();
					} else {
						location.reload();
					}
				},"json");
			}

      // $("#cart-wrapping #product-form- [data-js-product-add-to-cart]").trigger("click");
      //cartWrappingForm.querySelector('[data-js-product-add-to-cart]').trigger("click");
    } else {
      if(document.querySelector('.cart-item--gift-wrapping') ) {
        $('.cart-item--gift-wrapping .remove').get(0).click();

        console.log("----remove@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@",$(".cart-item--gift-wrapping .remove"))
        $(".cart-item--gift-wrapping .product__quantity").val(0).trigger("blur");
        //document.querySelector('.cart-item--gift-wrapping .remove').click();
      }
    }
  })
})

/*
const cartWrappingForm = document.getElementById('cart-wrapping');
document.querySelector('[data-js-cart-wrapping-checkbox]').addEventListener('click', e=>{
  console.log(e.target.checked," ===e.target.checked")
  if ( document.getElementById('site-cart-sidebar') ) {
    document.getElementById('site-cart-sidebar').scrollTo({top: 0, behavior: 'smooth'});
  }
  if ( e.target.checked ) {
    cartWrappingForm.querySelector('[data-js-product-add-to-cart]').click();
  } else {
    if ( document.querySelector('.cart-item--gift-wrapping') ) {
      document.querySelector('.cart-item--gift-wrapping .remove').click();
    }
  }
})
*/
function _saving_update() {
  var _totalsaving = "- " + $("#moneySaved").val();
  var _savingnum = parseInt($("#moneySaved").attr("data"));
  if(_savingnum <= 0){
    setTimeout(function () {
      $("#_total_saving").parents(".cart__details--row").hide();
      $(".cart__total.cart__details--row").addClass("blank-row");
      $("#_total_saving").html(_totalsaving);
    },500)
  }else{
    setTimeout(function () {
      $("#_total_saving").parents(".cart__details--row").css("display","flex");
      $(".cart__total.cart__details--row").removeClass("blank-row");
      $("#_total_saving").html(_totalsaving);
    },500)
  }
  if(typeof cart__reward_func != "undefined"){
    //console.log("cart__reward_func");
    cart__reward_func();
  }
  
  if (typeof recheckcart === 'function') {
    recheckcart();
  }
  if (typeof cartStickyFunc === 'function') {
  	cartStickyFunc();
  }
  
  if (typeof cart__productblank === 'function') {
  	cart__productblank();
  }

  if (
    document.body &&
    document.body.classList.contains('template-cart') &&
    typeof window.refreshGRTUpsellBlocks === 'function'
  ) {
    try { window.refreshGRTUpsellBlocks(); } catch (e) {}
    setTimeout(function () {
      try { window.refreshGRTUpsellBlocks(); } catch (e) {}
    }, 200);
  }

  if (typeof updateCartItemCount === 'function') {
  	updateCartItemCount();
  }
  positionCartPageMobileFreeShipping();
}

function cart__productblank(){
	if($("#productblank").length > 0){
		var __productblank = $("#productblank").val() * 1;
		if(__productblank > 0){
			$(".grt__cartsection-suggetionblock").addClass("cartsection-suggetionblock");
		}else{
			$(".grt__cartsection-suggetionblock").removeClass("cartsection-suggetionblock");
		}
	}
}

_saving_update();


function positionCartPageMobileFreeShipping() {
	if (
		!document.body ||
		!document.body.classList.contains('template-cart') ||
		window.innerWidth >= 768
	) {
		return;
	}

	const repositionElement = document.querySelector('.grt-cart-reposition');
	const repositionBlock = repositionElement ? repositionElement.closest('.sidebar-widget') : null;
	const lineItemContainer = document.querySelector('.grt-cart-line-item-container');
	if (!repositionBlock || !lineItemContainer || !lineItemContainer.parentNode) {
		return;
	}

	if (lineItemContainer.nextElementSibling === repositionBlock) {
		repositionBlock.style.order = '-1';
		return;
	}

	lineItemContainer.insertAdjacentElement('afterend', repositionBlock);
	repositionBlock.style.order = '-1';
}
