( function( window, document ) {
  window.GoogleAnalyticsObject = "ga";
  window.ga = window.ga || function() {
    ( window.ga.q = window.ga.q || [] ).push( arguments );
  };
  window.ga.l = 1 * new Date();
  var script = document.createElement( "script" );
  var firstScript = document.getElementsByTagName( "script" )[ 0 ];
  script.async = 1;
  script.src = "https://www.google-analytics.com/analytics.js";
  firstScript.parentNode.insertBefore( script, firstScript );
} )( window, document );
window.ga( "create", "<ENV::googleTrackingCode>", "auto" );
window.ga( "send", "pageview" );
