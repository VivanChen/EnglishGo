export function paginateByHeight(blocks, measuredHeights, capacity, gap = 0) {
  if (!blocks.length) return [];
  const pageCapacity = Math.max(1, Number(capacity) || 1);
  const blockGap = Math.max(0, Number(gap) || 0);
  const pages = [];
  let current = [];
  let used = 0;

  blocks.forEach((block, index) => {
    const height = Math.max(1, Number(measuredHeights[index]) || 1);
    const required = current.length ? blockGap + height : height;
    if (current.length && used + required > pageCapacity) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(block);
    used += (current.length > 1 ? blockGap : 0) + height;
  });

  if (current.length) pages.push(current);
  return pages;
}

export function spreadStartForPage(page, visiblePageCount) {
  const count = Math.max(1, Number(visiblePageCount) || 1);
  const safePage = Math.max(0, Number(page) || 0);
  return Math.floor(safePage / count) * count;
}

export function nextSpreadStart(page, pageCount, visiblePageCount) {
  const count = Math.max(1, Number(visiblePageCount) || 1);
  const last = Math.max(0, Number(pageCount) - 1 || 0);
  return Math.min(spreadStartForPage(page, count) + count, spreadStartForPage(last, count));
}

export function previousSpreadStart(page, visiblePageCount) {
  const count = Math.max(1, Number(visiblePageCount) || 1);
  return Math.max(0, spreadStartForPage(page, count) - count);
}

export function findPageForBlock(pages, blockIndex) {
  const found = pages.findIndex(page => page.some(block => block.i === blockIndex));
  return found < 0 ? 0 : found;
}
