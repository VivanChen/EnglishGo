import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WordIllustrations from './WordIllustrations.jsx';
import { getLocalWordIllustrations, loadWordIllustrations } from '../data/wordIllustrations.js';

describe('vocabulary illustrations', () => {
  it('shows the two under situations, readable captions, navigation, and speech', () => {
    const speak = vi.fn();
    render(<WordIllustrations level="elementary" word="under" speak={speak}/>);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByText('貓在桌子下面。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一張插畫' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一張插畫' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '朗讀插畫例句：The bag is under the chair.' }));
    expect(speak).toHaveBeenCalledWith('The bag is under the chair.');
  });
  it('retains local pictures on a database outage and ignores a late response for another word', async () => {
    let resolve;
    const fetchIllustrations = vi.fn(() => new Promise(r => { resolve = r; }));
    const view = render(<WordIllustrations level="elementary" word="under" fetchIllustrations={fetchIllustrations}/>);
    await waitFor(() => expect(fetchIllustrations).toHaveBeenCalled());
    view.rerender(<WordIllustrations level="elementary" word="apple" fetchIllustrations={async () => { throw Error('offline'); }}/>);
    resolve(getLocalWordIllustrations('elementary', 'under'));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
    expect(screen.getByRole('img')).toHaveAttribute('alt', '一顆帶有綠葉的紅蘋果。');
    const client = { from: () => { throw Error('offline'); } };
    expect(await loadWordIllustrations(client, 'elementary', 'apple')).toHaveLength(1);
  });
  it('falls back from a failed cloud image to the bundled illustration, then to its explanation', async () => {
    const item = { ...getLocalWordIllustrations('elementary', 'apple')[0], image_url: 'https://example.com/apple.webp' };
    render(<WordIllustrations level="elementary" word="apple" fetchIllustrations={async () => [item]}/>);
    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', item.image_url));
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveAttribute('src', item.local_path);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('一顆帶有綠葉的紅蘋果。');
  });
  it('does not use elementary meanings for junior cards or invent pictures for uncovered words', () => {
    const { container } = render(<WordIllustrations level="junior" word="apple"/>);
    expect(container).toBeEmptyDOMElement();
    expect(getLocalWordIllustrations('elementary', 'unknown')).toEqual([]);
  });
});
