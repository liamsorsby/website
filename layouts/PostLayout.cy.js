import React from 'react'
import PostLayout from './PostLayout'

describe('<PostLayout />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(<PostLayout />)
  })
})
