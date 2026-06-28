const data = require( "../fixtures/thinx" );

describe( "Headless draft", function() {

  it( "Should create owner account", function() {
    cy.createOwner( data, data.serverUrl );
    cy.get( "@createOwnerResponse" ).then( createOwnerResponse => {
      expect( createOwnerResponse ).to.have.property( "token" );
    } );
  } );

} );
