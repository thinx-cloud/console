var Login = ( function() {

  var urlBase = "<ENV::apiBaseUrl>";

  var handleLogin = function() {
    $( ".login-form" ).validate( {
      errorElement: "span", //default input error message container
      errorClass: "help-blockx", // default input error message class
      focusInvalid: false, // do not focus the last invalid input
      rules: {
        username: {
          required: true
        },
        password: {
          required: true
        },
        remember: {
          required: false
        }
      },
      messages: {
        username: {
          required: "Please enter username"
        },
        password: {
          required: "Please enter uassword"
        }
      },

      invalidHandler: function( event, validator ) { // display error alert on form submit
        $( "#login-error" ).show();
      },

      highlight: function( element ) { // hightlight error inputs
        $( element )
        .closest( ".form-group" ).addClass( "has-error" ); // set error class to the control group
      },

      success: function( label ) {
        label.closest( ".form-group" ).removeClass( "has-error" );
        label.remove();
      },

      errorPlacement: function( error, element ) {
        error.insertAfter( element.closest( ".input-icon" ) );
      },

      submitHandler: function( form, event ) {
        event.preventDefault();

        var data = {
          username: $( "input[name=username]" ).val(),
          password: $( "input[name=password]" ).val(),
          remember: false
        };

        $.ajax( {
          url: urlBase + "/login",
          xhrFields: {
            withCredentials: urlBase.indexOf( "localhost" ) !== -1 ? false : true
          },
          data: JSON.stringify( data ),
          type: "POST",
          dataType: "json",
          contentType: "application/json",
          success: function( response, status, xhr ) {
            console.log( "-- login response --", { response } );
            if ( typeof( response ) !== "undefined" ) {
              if ( typeof( response.redirectURL ) !== "undefined" ) {
                console.log( "-- Succes! Redirecting to \"" + response.redirectURL + "\"--" );
                window.location = response.redirectURL;
              } else {
                console.log( "-- Error!" );
                if ( response.response == "password_mismatch" ) {
                  $( "#login-error" ).text( "Username or password does not match" );
                } else if ( response.response == "user_not_found" ) {
                  $( "#login-error" ).text( "User not found." );
                } else if ( response.response == "activated_user_not_found" ) {
                  $( "#login-error" ).text( "Activated User not found." );
                } else if ( response.response == "user_account_deactivated" ) {
                  $( "#login-error" ).text( "User account deactivated." );
                } else {
                  $( "#login-error" ).text( "Unknown Error: " + response.status );
                }
                $( "#login-error" ).show();
              }
            }
          },
          error: function( xdata, status, xhr ) {
            console.log( "--login or server failure--", xdata );
            var response = xdata.responseJSON;
            if ( response.response == "unauthorized" ) {
              $( "#login-error" ).text( "Username or password does not match" );
            } else if ( response.response == "user_not_found" ) {
              $( "#login-error" ).text( "User not found." );
            } else if ( response.response == "activated_user_not_found" ) {
              $( "#login-error" ).text( "Activated User not found." );
            } else if ( response.response == "user_account_deactivated" ) {
              $( "#login-error" ).text( "User account deactivated." );
            } else {
              $( "#login-error" ).text( "Connection failed" );
            }
            $( "#login-error" ).show();
            console.log( xdata );
          }
        } );
      }
    } );

    $( ".login-form input" ).keypress( function( e ) {
      if ( e.which == 13 ) {
        if ( $( ".login-form" ).validate().form() ) {
          $( ".login-form" ).submit(); //form validation success, call ajax form submit
        }
        return false;
      }
    } );
  };

  var handleForgetPassword = function() {
    $( ".forget-form" ).validate( {
      errorElement: "span", //default input error message container
      errorClass: "help-blockx", // default input error message class
      focusInvalid: false, // do not focus the last invalid input
      errorLabelContainer: "#forget-error",
      ignore: "",
      rules: {
        email: {
          required: true,
          email: true
        }
      },
      messages: {
        email: {
          required: "Please enter e-mail"
        }
      },

      invalidHandler: function( event, validator ) {
        // display error alert on form submit
        $( "#forget-error" ).show();
      },

      highlight: function( element ) {
        // highlight error inputs
        // set error class to the control group
        $( element ).closest( ".form-group" ).addClass( "has-error" );
      },

      success: function( label ) {
        label.closest( ".form-group" ).removeClass( "has-error" );
        label.remove();
      },

      errorPlacement: function( error, element ) {
        error.insertAfter( element.closest( ".input-icon" ) );
      },

      submitHandler: function( form, event ) {
        event.preventDefault();

        $.ajax( {
          url: urlBase + "/user/password/reset",
          data: { email: $( ".forget-form input[name=email]" ).val() }, //parameters go here in object literal form
          type: "POST",
          dataType: "json",
          success: function( data ) {
            console.log( "--password reset request success--" );

            var response = data;
            
            try {
              response = JSON.parse( data );
            } catch ( e ) {
              console.log( e );
            }

            if ( typeof( response ) !== "undefined" ) {
              console.log( response );
              if ( response.success ) {
                if ( response.response == "email_sent" ) {
                  $( ".msg-error", $( ".forget-form" ) ).hide();
                  $( ".forget-form" ).hide();
                  $( ".msg-reset-success" ).show();
                }
              } else {
                if ( response.response == "email_not_found" ) {
                  $( ".msg-error", $( ".forget-form" ) ).text( "Email not found." );
                  $( ".msg-error", $( ".forget-form" ) ).show();
                }
              }
            }

          },
          error: function( data ) {
            console.log( "--password reset request failure--" );
            console.log( data );
            $( ".msg-error" ).text( "Server error, try again later." );
            $( ".msg-error" ).show();
          }
        } );
      }
    } );

    $( ".forget-form input" ).keypress( function( e ) {
      if ( e.which == 13 ) {
        if ( $( ".forget-form" ).validate().form() ) {
          $( ".forget-form" ).submit();
        }
        return false;
      }
    } );

    jQuery( "#forget-password" ).click( function() {
      history.pushState( {}, null, "/#" );
      jQuery( ".login-form" ).hide();
      jQuery( ".forget-form" ).show();
    } );

    jQuery( "#back-btn" ).click( function() {
      jQuery( ".login-form" ).show();
      jQuery( ".forget-form" ).hide();
    } );

  };

  var handleRegister = function() {

    $( ".register-form" ).validate( {
      errorElement: "span", //default input error message container
      errorClass: "help-blockx", // default input error message class
      focusInvalid: false, // do not focus the last invalid input
      ignore: "",
      errorLabelContainer: "#register-error",
      rules: {
        first_name: {
          required: true
        },
        last_name: {
          required: true
        },
        email: {
          required: true,
          email: true
        },
        owner: {
          required: true
        },
        tnc: {
          required: true
        }
      },

      messages: { // custom messages for radio buttons and checkboxes
        tnc: {
          required: "Please accept Terms of Service first"
        }
      },

      invalidHandler: function( event, validator ) { //display error alert on form submit
        $( "#register-error" ).show();
      },

      highlight: function( element ) { // hightlight error inputs
        $( element )
        .closest( ".form-group" ).addClass( "has-error" ); // set error class to the control group
      },

      success: function( label ) {
        label.closest( ".form-group" ).removeClass( "has-error" );
        label.remove();
      },

      errorPlacement: function( error, element ) {
        if ( element.attr( "name" ) == "tnc" ) { // insert checkbox errors after the container
          error.insertAfter( $( "#register_tnc_error" ) );
        } else if ( element.closest( ".input-icon" ).size() === 1 ) {
          error.insertAfter( element.closest( ".input-icon" ) );
        } else {
          error.insertAfter( element );
        }
      },

      submitHandler: function( form, event ) {
        event.preventDefault();

        $.ajax( {
          url: urlBase + "/user/create",
          data: {
            first_name: $( ".register-form input[name=first_name]" ).val(),
            last_name: $( ".register-form input[name=last_name]" ).val(),
            email: $( ".register-form input[name=email]" ).val(),
            owner: $( ".register-form input[name=owner]" ).val()
          }, //parameters go here in object literal form

          type: "POST",
          dataType: "json",
          success: function( response ) {
            console.log( "--user create response--" );

            if ( typeof(response.success) !== 'undefined' && response.success ) {
              if ( response.response == "email_sent" ) {
                $( ".msg-error", $( ".register-form" ) ).hide();
                $( ".register-form" ).hide();

                $( ".msg-success .form-subtitle" ).text( "Check your email or spam folder for activation link." );
                $( ".msg-success" ).show();
              }
            } else {
              if ( response.response == "activation_failed" ) {
                $( ".msg-error", $( ".register-form" ) ).text( "Registration failed." );
                $( ".msg-error", $( ".register-form" ) ).show();
              }
              if ( response.response == "email_already_exists" ) {
                $( ".msg-error", $( ".register-form" ) ).text( "Email already exists." );
                $( ".msg-error", $( ".register-form" ) ).show();
              }
              if ( response.response == "username_already_exists" ) {
                $( ".msg-error", $( ".register-form" ) ).text( "Username already exists." );
                $( ".msg-error", $( ".register-form" ) ).show();
              }
            }

          },
          error: function( response ) {
            console.log( "--user create request failure--" );
            console.log( response );
            $( ".msg-error", $( ".register-form" ) ).text( "Registration failed. Please try again later." );
            $( ".msg-error", $( ".register-form" ) ).show();
          }
        } );
      }
    } );

    $( ".register-form input" ).keypress( function( e ) {
      if ( e.which == 13 ) {
        if ( $( ".register-form" ).validate().form() ) {
          $( ".register-form" ).submit();
        }
        return false;
      }
    } );

    jQuery( "#register-btn" ).click( function() {
      history.pushState( {}, null, "/#" );
      jQuery( ".login-form" ).hide();
      jQuery( ".register-form" ).show();
    } );

    jQuery( "#register-back-btn" ).click( function() {
      jQuery( ".login-form" ).show();
      jQuery( ".register-form" ).hide();
    } );
  };

  return {
    //main function to initiate the module
    init: function() {
      handleLogin();
      handleForgetPassword();
      handleRegister();
    }

  };

} )();

jQuery( document ).ready( function() {
  Login.init();
} );
