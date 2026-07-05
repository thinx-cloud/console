var Csrf = ( function() {

  var urlBase = "<ENV::apiBaseUrl>";

  // reads document.cookie for XSRF-TOKEN, returns the decoded value or an empty string
  var getCsrfCookie = function() {
    var match = document.cookie.match( /(?:^|; )XSRF-TOKEN=([^;]*)/ );
    return match ? decodeURIComponent( match[ 1 ] ) : "";
  };

  // syncs every hidden _csrf field on the current page to the live cookie value
  var syncHiddenFields = function() {
    $( ".csrf-token-field" ).val( getCsrfCookie() );
  };

  // mints the XSRF-TOKEN cookie for a cold session via Plan 21-01's GET /csrf-token endpoint
  var prime = function() {
    return $.ajax( {
      url: urlBase + "/csrf-token",
      type: "GET",
      dataType: "json",
      xhrFields: {
        withCredentials: urlBase.indexOf( "localhost" ) !== -1 ? false : true
      },
      complete: syncHiddenFields
    } );
  };

  return {
    getCsrfCookie: getCsrfCookie,
    syncHiddenFields: syncHiddenFields,
    prime: prime
  };

} )();

// global default: echo the XSRF-TOKEN cookie as X-XSRF-TOKEN on every subsequent $.ajax() call
// made on this page (login.js, password.js, auth.js all inherit this without any per-call edit)
$.ajaxSetup( {
  beforeSend: function( xhr ) {
    var token = Csrf.getCsrfCookie();
    if ( token ) {
      xhr.setRequestHeader( "X-XSRF-TOKEN", token );
    }
  }
} );

// kick off the prime immediately and expose the promise so an immediate-on-load caller
// (auth.js's auto-login branch) can await the cookie landing before its own POST
window.__csrfReady = Csrf.prime();

jQuery( document ).ready( function() {
  Csrf.syncHiddenFields();
} );
