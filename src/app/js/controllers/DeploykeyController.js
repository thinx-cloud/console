/* Setup blank page controller */
angular.module( "RTM" ).controller( "DeploykeyController", [ "$rootScope", "$scope", "settings", function( $rootScope, $scope, settings ) {
  $scope.$on( "$viewContentLoaded", function() {
    // initialize core components
    App.initAjax();

    // set default layout mode
    $rootScope.settings.layout.pageContentWhite = true;
    $rootScope.settings.layout.pageBodySolid = false;
    $rootScope.settings.layout.pageSidebarClosed = false;

    Thinx.init( $rootScope, $scope );

    Thinx.deploykeyList()
    .done( function( data ) {
      $scope.$emit( "updateDeploykeys", data );
    } )
    .fail( error => $scope.$emit( "xhrFailed", error ) );

    $scope.resetModal();
    $scope.searchText = "";
  } );

  $scope.searchText = "";

  // Deploy key names (v1.18 Phase 48, D-09, UI-C18, 35 IN-03/IN-04). The sentences mirror
  // vue/src/utils/keyNames.js word for word (src/test/deploykey.cjs D10 compares them); the
  // server (RSAKey.validateKeyName) stays the authority, this check only saves a round trip.
  var KEY_NAME_MAX = 120;
  var KEY_NAME_MESSAGES = {
    empty: "Enter a name for the key.",
    too_long: "The name is longer than 120 characters.",
    control_chars: "The name contains a control character, such as a tab or a line break.",
    line_separator: "The name contains a hidden line or paragraph separator.",
    bidi: "The name contains a hidden direction-override character.",
    invisible: "The name contains an invisible character, such as a zero-width space.",
    reserved: "This name is reserved for the key's default label. Choose a different name."
  };
  var KEY_NAME_FALLBACK = "This name is not allowed. Choose a different name.";
  var CREATE_FAILED = "Could not generate the deploy key. Try again.";

  // The reason the trimmed name is refused before sending, or null.
  // Code units are compared as numbers on purpose: a regular expression with a
  // control-character class trips Codacy no-control-regex (quick 261012-r9z).
  function keyNameProblem( name ) {
    for ( var i = 0; i < name.length; i++ ) {
      var c = name.charCodeAt( i );
      if ( c < 0x20 || c === 0x7F ) {
        return "control_chars";
      }
    }
    if ( name.length > KEY_NAME_MAX ) {
      return "too_long";
    }
    return null;
  }

  // The fixed sentence for a refusal reason; never the reason code itself.
  function keyNameSentence( reason ) {
    if ( typeof reason === "string" && Object.prototype.hasOwnProperty.call( KEY_NAME_MESSAGES, reason ) ) {
      return KEY_NAME_MESSAGES[ reason ];
    }
    return KEY_NAME_FALLBACK;
  }

  // One fixed sentence, written as text (toastr renders HTML, so no reply field goes in).
  function showCreateError( sentence ) {
    $( ".msg-warning" ).text( sentence );
    $( ".msg-warning" ).show();
    toastr.error( sentence, "<ENV::loginPageTitle>", { timeOut: 5000 } );
  }

  $scope.createDeploykey = function() {

    console.log( "--creating deploy key--" );

    if ($scope.creatingDeploykey || !$scope.deploykeyName || !$scope.deploykeyName.trim()) return;
    var name = $scope.deploykeyName.trim();
    var problem = keyNameProblem( name );
    if ( problem !== null ) {
      showCreateError( keyNameSentence( problem ) );
      return;
    }
    $scope.creatingDeploykey = true;
    Thinx.createDeploykey( name )
    .done( function( response ) {
      // jQuery does not wrap .done callbacks: a throw here would skip .always, so the
      // reset lives in finally as well (35 IN-03).
      try {
        if ( response && response.success ) {
          var key = response.response || response.status;
          if ( !key || typeof key !== "object" || !key.pubkey ) {
            showCreateError( CREATE_FAILED );
          } else {
            toastr.success( "Key created.", "<ENV::loginPageTitle>", { timeOut: 5000 } );

            $scope.deploykeyCreated = key.date || key.name;
            $scope.deploykeyValue = key.pubkey;

            Thinx.deploykeyList()
            .done( function( data ) {
              $scope.$emit( "updateDeploykeys", data );
            } )
            .fail( error => $scope.$emit( "xhrFailed", error ) );
          }
        } else if ( response && response.response === "invalid_key_name" ) {
          showCreateError( keyNameSentence( response.reason ) );
        } else {
          showCreateError( CREATE_FAILED );
        }
      } catch ( e ) {
        showCreateError( CREATE_FAILED );
      } finally {
        $scope.creatingDeploykey = false;
        $scope.$applyAsync();
      }
    } )
    .fail( function( jqXHR ) {
      var body = jqXHR && jqXHR.responseJSON;
      if ( body && body.response === "invalid_key_name" ) {
        showCreateError( keyNameSentence( body.reason ) );
      } else {
        showCreateError( CREATE_FAILED );
      }
      $scope.$emit( "xhrFailed", jqXHR );
    } )
    .always(function() {
      $scope.creatingDeploykey = false;
      $scope.$applyAsync();
    });

  };


  function revokeDeploykeys( filenames ) {
    console.log( "--deleting deploy keys " + filenames.length + "--" );

    Thinx.revokeDeploykeys( filenames )
    .done( function( data ) {
      if ( data.success ) {
        console.log( "Success:", data );
        toastr.success( "Deleted.", "<ENV::loginPageTitle>", { timeOut: 5000 } );

        $scope.selectedItems = [];

        Thinx.deploykeyList()
        .done( function( data ) {
          $scope.$emit( "updateDeploykeys", data );
        } )
        .fail( error => $scope.$emit( "xhrFailed", error ) );

      } else {
        toastr.error( "Revocation failed.", "<ENV::loginPageTitle>", { timeOut: 5000 } );
      }
    } )
    .fail( error => $scope.$emit( "xhrFailed", error ) );
  }

  $scope.revokeDeploykeys = function() {
    console.log( "-- processing selected items --" );
    console.log( $scope.selectedItems );

    var selectedToRevoke = $scope.selectedItems.slice();
    if ( selectedToRevoke.length > 0 ) {
      revokeDeploykeys( selectedToRevoke );
    } else {
      toastr.warning( "Nothing selected.", "<ENV::loginPageTitle>", { timeOut: 1000 } );
    }
  };

  $scope.checkItem = function( filename ) {
    console.log( "### toggle item in selectedItems" );
    var index = $scope.selectedItems.indexOf( filename );
    if ( index > -1 ) {
      console.log( "splicing on ", index, " value ", $scope.selectedItems[ index ] );
      $scope.selectedItems.splice( index, 1 );
    } else {
      $scope.selectedItems.push( filename );
    }
  };

  $scope.resetModal = function() {
    $scope.deploykeyName = "";
    $scope.creatingDeploykey = false;
    $scope.deploykeyCreated = null;
    $scope.deploykeyValue = null;
    $scope.selectedItems = [];
  };

} ] );
