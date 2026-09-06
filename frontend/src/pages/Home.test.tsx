import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import Home from './Home'

describe('Home', () => {
  it('renderiza o título Elder Web', () => {
    render(<Home />)

    expect(screen.getByText('Elder Web')).toBeInTheDocument()
  })
})
