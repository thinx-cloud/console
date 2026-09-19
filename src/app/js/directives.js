/***
GLobal Directives
***/

// Route State Load Spinner(used on page or content load)
// eslint-disable-next-line  no-undef
RTM.directive( "ngSpinnerBar", [ "$rootScope", "$state",
function( $rootScope, $state ) {
  return {
    link: function( scope, element, attrs ) {
      // by defult hide the spinner bar
      element.addClass( "hide" ); // hide spinner bar by default

      // display the spinner bar whenever the route changes(the content part started loading)
      $rootScope.$on( "$stateChangeStart", function() {
        element.removeClass( "hide" ); // show spinner bar
      } );

      // hide the spinner bar on rounte change success(after the content loaded)
      $rootScope.$on( "$stateChangeSuccess", function( event ) {
        element.addClass( "hide" ); // hide spinner bar
        $( "body" ).removeClass( "page-on-load" ); // remove page loading indicator
        Layout.setAngularJsSidebarMenuActiveLink( "match", null, event.currentScope.$state ); // activate selected link in the sidebar menu

        // auto scroll to page top
        if ( $rootScope.settings.layout.pageAutoScrollOnLoad > 0 ) {
          setTimeout( function() {
            App.scrollTop(); // scroll to the top on content load
          }, $rootScope.settings.layout.pageAutoScrollOnLoad );
        }

      } );

      // handle errors
      $rootScope.$on( "$stateNotFound", function() {
        element.addClass( "hide" ); // hide spinner bar
      } );

      // handle errors
      $rootScope.$on( "$stateChangeError", function() {
        element.addClass( "hide" ); // hide spinner bar
      } );
    }
  };
}
] );

// Handle global LINK click
// eslint-disable-next-line  no-undef
RTM.directive( "a", function() {
  return {
    restrict: "E",
    link: function( scope, elem, attrs ) {
      if ( attrs.ngClick || attrs.href === "" || attrs.href === "#" ) {
        elem.on( "click", function( e ) {
          e.preventDefault(); // prevent link click for above criteria
        } );
      }
    }
  };
} );

// Handle Dropdown Hover Plugin Integration
// eslint-disable-next-line  no-undef
RTM.directive( "dropdownMenuHover", function() {
  return {
    link: function( scope, elem ) {
      elem.dropdownHover();
    }
  };
} );

// Handle ui-sref click events inside other clickable elements
// eslint-disable-next-line  no-undef
RTM.directive( "stopEvent", function() {
  return {
    restrict: "A",
    link: function( scope, element, attr ) {
      element.bind( "click", function( e ) {
        e.stopPropagation();
      } );
    }
  };
} );

// Run view plugins after Angular links the template and release delegated listeners
// when the route goes away. Clipboard's selector also handles later ng-if/ng-repeat nodes.
// eslint-disable-next-line no-undef
RTM.directive( "thinxViewInit", [ "$timeout", "$window", function( $timeout, $window ) {
  return {
    restrict: "A",
    link: function( scope, element, attrs ) {
      var clipboard;
      var plugins = attrs.thinxViewInit.split( /\s+/ );
      var pending = $timeout( function() {
        if ( plugins.indexOf( "clipboard" ) !== -1 ) {
          clipboard = new $window.Clipboard( ".copy-btn" );
        }
        if ( plugins.indexOf( "profile" ) !== -1 ) {
          $window.Profile.init();
        }
      }, 0, false );
      scope.$on( "$destroy", function() {
        $timeout.cancel( pending );
        if ( clipboard ) {
          clipboard.destroy();
        }
      } );
    }
  };
} ] );

// Route-local replacement for QuickNav.init(), whose document handler had no teardown.
// eslint-disable-next-line no-undef
RTM.directive( "thinxQuickNav", [ "$document", function( $document ) {
  return {
    restrict: "A",
    link: function( scope, element ) {
      function toggle( event ) {
        event.preventDefault();
        element.toggleClass( "nav-is-visible" );
      }
      function close( event ) {
        if ( !$( event.target ).closest( element.find( ".quick-nav-trigger" ) ).length ) {
          element.removeClass( "nav-is-visible" );
        }
      }
      element.on( "click", ".quick-nav-trigger", toggle );
      $document.on( "click", close );
      scope.$on( "$destroy", function() {
        element.off( "click", ".quick-nav-trigger", toggle );
        $document.off( "click", close );
      } );
    }
  };
} ] );

// processAvatar owns its synchronous and FileReader digest updates. Calling it
// inside $apply here would nest digests and break file selection.
// eslint-disable-next-line no-undef
RTM.directive( "thinxAvatarChange", function() {
  return {
    restrict: "A",
    link: function( scope, element ) {
      function change() {
        scope.processAvatar();
      }
      element.on( "change", change );
      scope.$on( "$destroy", function() {
        element.off( "change", change );
      } );
    }
  };
} );
