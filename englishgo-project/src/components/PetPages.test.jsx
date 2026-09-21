import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PetPages from './PetPages.jsx';

const resize = width => act(() => { window.innerWidth = width; window.dispatchEvent(new Event('resize')); });
afterEach(() => resize(1024));
describe('pet screen pagination', () => {
  it('keeps every card reachable on a phone and clamps after a collection shrinks', () => {
    resize(390);
    const cards = ['蘋果', '香蕉', '胡蘿蔔'].map(name => <button key={name}>{name}</button>);
    const { rerender } = render(<PetPages label="食物" columns={3}>{cards}</PetPages>);
    expect(screen.getByRole('button', { name: '食物上一頁' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '食物下一頁' }));
    expect(screen.getByRole('button', { name: '香蕉' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '食物下一頁' }));
    expect(screen.getByRole('button', { name: '胡蘿蔔' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '食物下一頁' })).toBeDisabled();
    rerender(<PetPages label="食物" columns={3}>{cards.slice(0, 1)}</PetPages>);
    expect(screen.getByRole('button', { name: '蘋果' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
  it('reflows a collection when the viewport changes without an empty page', () => {
    resize(390);
    render(<PetPages label="夥伴" columns={3}>{[1, 2, 3, 4].map(n => <button key={n}>夥伴 {n}</button>)}</PetPages>);
    for (let n = 0; n < 3; n++) fireEvent.click(screen.getByRole('button', { name: '夥伴下一頁' }));
    resize(1440);
    expect(screen.getByRole('button', { name: '夥伴 4' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '夥伴上一頁' }));
    for (const n of [1, 2, 3]) expect(screen.getByRole('button', { name: `夥伴 ${n}` })).toBeInTheDocument();
  });
});
