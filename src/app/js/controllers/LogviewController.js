/* Notification frames come off the websocket and are device-supplied: a
 * device's current owner, or a transferred device's previous one, writes
 * body, title and nid. toastr renders its message and title as HTML, so
 * every frame field is escaped (or validated, for nid) before it is used in
 * markup, ids or selectors, and toastr is only called through its four
 * display methods. The frame itself stays unchanged. */
var THINX_HTML_ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;", "`": "&#96;" };
var THINX_TOAST_METHODS = [ "info", "success", "warning", "error" ];
var THINX_NID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function thinxEscapeHtml( value ) {
  if ( value === null || typeof( value ) === "undefined" ) {
    return "";
  }
  return String( value ).replace( /[&<>"'`]/g, function( c ) {
    return THINX_HTML_ENTITIES[ c ];
  } );
}

// toastr method for a frame type, or null; never indexes toastr with frame data
function thinxToastMethod( type ) {
  return THINX_TOAST_METHODS.indexOf( type ) !== -1 ? type : null;
}

// nid safe for ids, names and jQuery selectors, or null
function thinxSafeNid( nid ) {
  if ( typeof( nid ) !== "string" && typeof( nid ) !== "number" ) {
    return null;
  }
  nid = String( nid );
  return THINX_NID_PATTERN.test( nid ) ? nid : null;
}

/* Setup blank page controller */
angular.module( "RTM" ).controller( "LogviewController", [ "$rootScope", "$scope", "settings", function( $rootScope, $scope, settings ) {
  $scope.$on( "$viewContentLoaded", function() {
    // Open websocket to for log & notifications transfer
    // User profile has to be initialised first
    if ( typeof( $rootScope.profile.owner ) !== "undefined" ) {
      openSocket( "log" );
    }
  } );

  // not implemented yet
  //var actionNotifications = [];

  if ( typeof( $rootScope.initWebsocketListener ) === "undefined" ) {
    $rootScope.initWebsocketListener = $rootScope.$on( "initWebsocket", function( event, owner_id ) {
      event.stopPropagation();
      openSocket( "log" );
    } );
  }

  function openSocket( scope ) {
    if ( "WebSocket" in window ) {
      if ( typeof( $rootScope.wss ) === "undefined" ) {
        // open websocket
        $rootScope.wss = new WebSocket( "<ENV::wssUrl>/" + $rootScope.profile.owner );

        $rootScope.wss.onopen = function() {
          if ( typeof( $rootScope.modalBuildId ) !== "undefined" ) {
            $rootScope.wsstailLog( $rootScope.modalBuildId );
          } else {
            $rootScope.wssinit();
          }
        };
        $rootScope.wss.onmessage = function( message ) {
          // quick check before parsing
          var msgType = message.data.substr( 2, 12 );
          if ( msgType == "notification" ) {
            parseNotification( message.data );
          } else {
            // save build data to build buffer
            // - convert line endings
            let adapted_data = message.data.replace( /\r\n|\n\t|\r|\n/g, "\n" );
            adapted_data = adapted_data.split( /\n/g );

            // update currently observed logview
            if ( typeof( $rootScope.modalBuildId ) !== "undefined" ) {
              for ( let i in adapted_data ) {
                $rootScope.logdata[ $rootScope.modalBuildId ] = $rootScope.logdata[ $rootScope.modalBuildId ] +
                "\n" + adapted_data[ i ];
              }
            }
            // unused
            // $rootScope.logdata.buffer = $rootScope.logdata.buffer + "\n" + adapted_data.join("\n");
          }
        };
        $rootScope.wss.onclose = function() {};

        $rootScope.wsslog = new WebSocket( "<ENV::wssUrl>/" + $rootScope.profile.owner + "/" + new Date().getTime() );

        $rootScope.wsslog.onopen = function() {
          $rootScope.wsstailLog( $rootScope.modalBuildId );
        };
        $rootScope.wsslog.onmessage = function( message ) {
          // quick check before parsing
          var msgType = message.data.substr( 2, 12 );

          // save build data to build buffer
          // - convert line endings
          let adapted_data = message.data.replace( /\r\n|\n\t|\r|\n/g, "\n" );
          adapted_data = adapted_data.split( /\n/g );

          // update currently observed logview
          if ( typeof( $rootScope.modalBuildId ) !== "undefined" ) {
            for ( let i in adapted_data ) {
              $rootScope.logdata[ $rootScope.modalBuildId ] = $rootScope.logdata[ $rootScope.modalBuildId ] +
                "\n" + adapted_data[ i ];
            }
          }
          // unused
          // $rootScope.logdata.buffer = $rootScope.logdata.buffer + "\n" + adapted_data.join("\n");

        };
        $rootScope.wsslog.onclose = function() {};
      }
    } else {
      // The browser doesn't support WebSocket
      toastr.error( "Error", "WebSocket NOT supported by your Browser!", { timeOut: 5000 } );
    }
  }

  if ( typeof( $rootScope.showLogOverlayListener ) === "undefined" ) {
    $rootScope.showLogOverlayListener = $rootScope.$on( "showLogOverlay", function( event, build_id ) {
      event.stopPropagation();
      $rootScope.showLog( build_id );
    } );
  }

  $rootScope.wsstailLog = function( build_id ) {
    var message = {
      logtail: {
        owner_id: $rootScope.profile.owner,
        build_id: build_id
      }
    };
    // $rootScope.logdata.buffer[$rootScope.modalBuildId] = "";
    $rootScope.logdata[ build_id ] = "";
    $rootScope.modalBuildId = build_id;
    $rootScope.wss.send( JSON.stringify( message ) );
  };

  $rootScope.wssinit = function() {
    var message = {
      init: $rootScope.profile.owner
    };
    $rootScope.wss.send( JSON.stringify( message ) );
  };

  $rootScope.hideLogOverlay = function( build_id ) {
    $( ".log-view-overlay-conatiner" ).fadeOut();
    clearInterval( $rootScope.logdata.watchers[ build_id ] );
  };


  $rootScope.showLog = function( build_id ) {
    $( ".log-view-overlay-conatiner" ).fadeIn();

    // start auto refresh
    $rootScope.logdata.watchers[ build_id ] = setInterval( function() {
      $rootScope.$digest();
    }, 500 );

    $rootScope.modalBuildId = build_id;

    if ( typeof( $rootScope.wss ) !== "undefined" ) {
      $rootScope.wsstailLog( build_id );
    } else {
      openSocket( "notification" );
    }
  };

  $rootScope.switchWrap = function() {
    $( ".log-view-body" ).toggleClass( "force-word-wrap" );
    $( ".icon-frame" ).toggleClass( "overlay-highlight" );
  };

  $scope.toastrCancel = function() {
    alert( "test" );
  };

  function parseNotification( data ) {
    var msgBody = JSON.parse( data );
    var msg = msgBody.notification;

    if ( typeof( $rootScope.meta.notifications ) !== "undefined" ) {
      $rootScope.meta.notifications.push( msg );

      // TODO: process specific build notifications

      // MESSAGES
      // fetching_git
      // build_running
      // build_completed

      // ERRORS
      // error_api_key_list_failed
      // error_io_failed
      // error_platform_unknown
      // error_configuring_build
      // error_starting_build

      // $rootScope.meta.deviceStatus[msg.udid].push({
      // });
    }

    // perform device build notification updates
    if ( typeof( msg.udid ) !== "undefined" ) {
        if (
            msg.body == "Pulling repository" ||
            msg.body == "Building..." ||
            msg.body == "Completed"
        ) {

          let nowTime = new Date().getTime();

          let buildRecord = {
            build_id: msg.build_id,
            last_update: nowTime,
            start_time: nowTime,
            state: msg.type,
            timestamp: nowTime
          };

          // prepare user metadata for particular device
          $rootScope.meta.deviceBuilds[ msg.udid ].push( buildRecord );
          $scope.$apply();

          Thinx.deviceList().done( function( data ) {
            $scope.$emit( "updateDevices", data );
          } )
          .fail( error => $scope.$emit( "xhrFailed", error ) );

          Thinx.getBuildHistory().done( function( data ) {
            $scope.$emit( "updateBuildHistory", data );
          } )
          .fail( error => $scope.$emit( "xhrFailed", error ) );

        }
    }

    // determine what to do based on message type
    if ( typeof( msg.type ) !== "undefined" ) {

      // show toast with action dialog
      if ( msg.type == "actionable" ) {

        // nid ends up in ids, names and selectors; anything else is not ours
        var nid = thinxSafeNid( msg.nid );
        if ( nid === null ) {
          return;
        }
        var actionBody = thinxEscapeHtml( msg.body );
        var actionTitle = thinxEscapeHtml( msg.title );

        // YES/NO
        if ( msg.response_type == "bool" ) {
          toastr.info(
            actionBody + "<br><br>" +
            nid + "<br><br>" +
            "<div><button type=\"button\" id=\"okBtn-" + nid +
            "\" class=\"btn btn-success toastr-ok-btn\">Yes</button>" +
            "<button type=\"button\" id=\"cancelBtn-" + nid +
            "\" class=\"btn btn-danger toastr-cancel-btn\" style=\"margin: 0 8px 0 8px\">No</button></div>",
            actionTitle,
            {
              timeOut: 0,
              extendedTimeOut: 0,
              tapToDismiss: false,
              closeButton: true,
              closeMethod: "fadeOut",
              closeDuration: 300,
              closeEasing: "swing"
            }
          );

          $( "#okBtn-" + nid ).on( "click", function( e ) {
            $( this ).parent().slideToggle( 500 );
            $scope.$emit( "submitNotificationResponse", true );
          } );

          $( "#cancelBtn-" + nid ).on( "click", function( e ) {
            $( this ).parent().slideToggle( 500 );
            $scope.$emit( "submitNotificationResponse", false );
          } );
        }

        // INPUT string
        if ( msg.response_type == "string" ) {
          toastr.warning(
            actionBody + "<br><br>" +
            nid + "<br><br>" +
            "<div><input class=\"toastr-input\" name=\"reply-" + nid + "\" value=\"\"/></div><br>" +
            "<div><button type=\"button\" id=\"sendBtn-" + nid +
            "\" class=\"btn btn-success toastr-send-btn\">Send</button></div>",
            actionTitle,
            {
              timeOut: 0,
              extendedTimeOut: 0,
              tapToDismiss: false,
              closeButton: true,
              closeMethod: "fadeOut",
              closeDuration: 300,
              closeEasing: "swing"
            }
          );

          $( "#sendBtn-" + nid ).on( "click", function( e ) {
            $( this ).parent().slideToggle( 500 );
            $scope.$emit( "submitNotificationResponse", $( "input[name=reply-" + nid + "]" ).val() );
          } );
        }

        return;
      }

      // Supported msg.types by Toastr: "error", "info", "success", "warning"
      var toastMethod = thinxToastMethod( msg.type );
      if ( toastMethod === null ) {
        return;
      }

      // JSON.stringify does not escape markup
      var toastBody = thinxEscapeHtml( JSON.stringify( msg.body ) );

      // non-actionable status notification
      if ( msg.body !== null && typeof( msg.body ) !== "undefined" && typeof( msg.body.status ) !== "undefined" ) {

        var msgTitle = "Device Status Update";

        // process status message
        toastr[ toastMethod ](
          toastBody,
          msgTitle,
          {
            timeOut: 8000,
            tapToDismiss: true,
            closeButton: true,
            closeMethod: "fadeOut",
            closeDuration: 0, // 500,
            closeEasing: "swing",
            progressBar: true
          }
        );

        Thinx.deviceList().done( function( data ) {
          $scope.$emit( "updateDevices", data );
        } )
        .fail( error => $scope.$emit( "xhrFailed", error ) );

        Thinx.getBuildHistory().done( function( data ) {
          $scope.$emit( "updateBuildHistory", data );
        } )
        .fail( error => $scope.$emit( "xhrFailed", error ) );

        // non-actionable notification without status
      } else {

        toastr[ toastMethod ](
          toastBody,
          thinxEscapeHtml( msg.title ),
          {
            timeOut: 20000,
            extendedTimeOut: 0,
            progressBar: true,
            closeButton: true,
            closeMethod: "fadeOut",
            closeDuration: 300,
            closeEasing: "swing"
          } );
      }

    } else {
      return;
    }
  }

} ] );
