describe('Navigation', () => {
  it('visiting about renders the page successfully', () => {
    cy.visit('http://localhost:3000')

    cy.get('a[href*="about"]').first().click()

    cy.url().should('include', '/about')

    cy.get('h1').contains('About')
    cy.get('h3').contains('Liam Sorsby')
    cy.get('div').contains('Principal Site Reliability Engineer')
  })

  it('visiting blog renders the page successfully', () => {
    cy.visit('http://localhost:3000')

    cy.get('a[href*="blog"]').first().click()

    cy.url().should('include', '/blog')

    cy.get('h1').contains('All Posts')
  })

  it('visiting tags renders the page successfully', () => {
    cy.visit('http://localhost:3000')

    cy.get('a[href*="tags"]').first().click()

    cy.url().should('include', '/tags')

    cy.get('h1').contains('Tags')
  })

  it('visiting Projects renders the page successfully', () => {
    cy.visit('http://localhost:3000')

    cy.get('a[href*="projects"]').first().click()

    cy.url().should('include', '/projects')

    cy.get('h1').contains('Projects')
    cy.get('h2').contains('Website')
    cy.get('h2').contains('Infrastructure As Code (IoC)')
  })
})
