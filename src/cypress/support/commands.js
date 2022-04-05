// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

let LOCAL_STORAGE_MEMORY = {};

Cypress.Commands.add("saveLocalStorage", () => {
  Object.keys(localStorage).forEach(key => {
    LOCAL_STORAGE_MEMORY[key] = localStorage[key];
  });
});

Cypress.Commands.add("restoreLocalStorage", () => {
  Object.keys(LOCAL_STORAGE_MEMORY).forEach(key => {
    localStorage.setItem(key, LOCAL_STORAGE_MEMORY[key]);
  });
});

Cypress.Commands.add("createOwner", (ownerData, url) => {
      cy.request({
          method: 'POST',
          failOnStatusCode: true,
          url: url + '/login',
          body: ownerData,
      }).then(
          (response) => {
              if (response.status === 200) { 
                  expect(response.body).to.have.property('orgId');
                  cy.log('createOrganization: Created organization with orgId', response.body.orgId);

                  let orgMeta = {
                      orgId: response.body.orgId,
                      email: createSeedBody.org.email,
                      emailPrefix: createSeedBody.org.createUsers.prefix,
                      emailSuffix: createSeedBody.org.createUsers.emailSuffix,
                      passwordPrefix: createSeedBody.org.createUsers.passwordPrefix,
                      userIds: response.body.userIds,
                      baseURL: response.body.baseURL,
                      sysUserInvitationToken: response.body.sysUserInvitationToken
                  };

                  cy.task('setOrgMeta', orgMeta).then(result => {
                      cy.log("createOrganization: DEBUG orgMeta", JSON.stringify(result));
                      cy.task('getOrgUsers').then(orgUsers => {
                          cy.log('createOrganization: Organization USERS', orgUsers);
                      });
                  });
              } else {
                  cy.log('createOrganization: Created organization ERROR', JSON.stringify(response.body.error));
              }

              cy.wrap(response.body).as('createResponse');
          }
      )
});



