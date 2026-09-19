window.addEventListener( "popstate", function( event ) {
  jQuery( ".login-form" ).show();
  jQuery( ".register-form" ).hide();
  jQuery( ".forget-form" ).hide();
} );

// Keep action links inert while their existing handlers switch login forms.
jQuery( "#register-btn, #forget-password" ).on( "click", function( event ) {
  event.preventDefault();
} );
