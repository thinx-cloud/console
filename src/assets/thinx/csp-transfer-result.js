$( document ).ready( function() {
  $.urlParam = function( name ) {
    var results = new RegExp( "[\\?&]" + name + "=([^&#]*)" ).exec( window.location.href );
    if ( results == null ) {
      return null;
    } else {
      return decodeURI( results[ 1 ] ) || 0;
    }
  };

  if ( $.urlParam( "success" ) == "true" ) {
    $( ".msg-error" ).hide();
    $( ".device-transfer-reason" ).text( $.urlParam( "reason" ) );
  } else {
    $( ".msg-success" ).hide();
  }
} );
