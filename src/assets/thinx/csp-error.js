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
  } else {
    $( ".msg-success" ).hide();
    if ( $.urlParam( "reason" ) !== undefined ) {
      $( ".error-reason" ).text( $.urlParam( "reason" ) );
    }
    if ( $.urlParam( "title" ) != undefined ) {
      $( ".error-title" ).text( $.urlParam( "title" ) );
    }
  }
} );
