import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PixelPet from './PixelPet.jsx';

describe('PixelPet', () => {
  it('renders variant pets through their base sprite without crashing', () => {
    expect(() => render(<PixelPet petId="hamster" stage="adult" size={32} animate={false} />)).not.toThrow();
  });
});
