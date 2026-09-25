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

  // shown when a CSRF rejection survives the one automatic retry (21-REVIEW WR-05)
  var REJECTED_MESSAGE = "Session security check failed. Reload the page and try again.";

  // true when a failed jqXHR is the API's 403 {"success":false,"response":"csrf_token_invalid"}
  var isRejection = function( xhr ) {
    return !!xhr && xhr.status === 403 && !!xhr.responseJSON &&
      xhr.responseJSON.response === "csrf_token_invalid";
  };

  // best-effort Rollbar signal (csp-rollbar.js); never includes token values
  var reportRejection = function( route ) {
    try {
      if ( window.Rollbar && typeof window.Rollbar.warning === "function" ) {
        window.Rollbar.warning( "CSRF rejection after retry", { route: route } );
      }
    } catch ( e ) {
      // reporting must never break the page
    }
  };

  // $.ajax() for a CSRF-protected call. On a csrf_token_invalid rejection it re-primes and
  // retries ONCE, sending the token the server echoes back (the cookie value it actually
  // parsed). success/error/complete fire once, for the final attempt only.
  var ajax = function( options ) {
    var route = ( options.type || "GET" ) + " " + String( options.url ).replace( urlBase, "" );
    var send = function( token, isRetry ) {
      var attempt = $.extend( {}, options );
      if ( token ) {
        attempt.beforeSend = function( xhr ) {
          xhr.setRequestHeader( "X-XSRF-TOKEN", token );
        };
      }
      if ( !isRetry ) {
        attempt.complete = null;
        attempt.success = function( data, textStatus, xhr ) {
          if ( options.success ) {
            options.success.apply( this, arguments );
          }
          if ( options.complete ) {
            options.complete.call( this, xhr, textStatus );
          }
        };
        attempt.error = function( xhr, textStatus ) {
          if ( isRejection( xhr ) ) {
            prime().always( function( body ) {
              send( body && body.csrf_token, true );
            } );
            return;
          }
          if ( options.error ) {
            options.error.apply( this, arguments );
          }
          if ( options.complete ) {
            options.complete.call( this, xhr, textStatus );
          }
        };
      } else {
        attempt.error = function( xhr ) {
          if ( isRejection( xhr ) ) {
            reportRejection( route );
          }
          if ( options.error ) {
            options.error.apply( this, arguments );
          }
        };
      }
      return $.ajax( attempt );
    };
    return send( null, false );
  };

  return {
    getCsrfCookie: getCsrfCookie,
    syncHiddenFields: syncHiddenFields,
    prime: prime,
    ajax: ajax,
    isRejection: isRejection,
    REJECTED_MESSAGE: REJECTED_MESSAGE
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
