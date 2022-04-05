const data = require('../fixtures/thinx')

describe('Headless draft', function() {

  it('Should create owner account', function() {
    createOwner(data, serverUrl);
    cy.get('@createOwnerResponse').then(createOwnerResponse => {
      expect(createOwnerResponse).to.have.property('token');
    });
  });

});
