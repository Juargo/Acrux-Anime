import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
import { useWindowWidth } from './hooks';
import type { CatalogItem } from './items';

const GAP = 12;
const SIDE_PADDING = 16;
const MAX_WIDTH = 1200;
const TITLE_HEIGHT = 48;

// Figma M03 shows three covers per row on a phone; wider screens fit more.
function columnsFor(width: number): number {
  if (width < 640) return 3;
  if (width < 1024) return 4;
  return 6;
}

/**
 * Presentational: a virtualized grid of franchise covers (Figma M03 28:122, D03 32:652).
 * Only the rows near the viewport are in the DOM; reaching the last row asks for more.
 */
export function CatalogGrid(props: {
  items: CatalogItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  // One tap marks the franchise as seen, or unmarks a seen one (RNF-01).
  onToggle?: ((item: CatalogItem) => void) | undefined;
  pendingRootId?: number | undefined;
}) {
  const { items, hasMore, loadingMore, onLoadMore, onToggle, pendingRootId } = props;
  const listRef = useRef<HTMLUListElement>(null);
  const width = useWindowWidth();
  const columns = columnsFor(width);
  const innerWidth = Math.min(width, MAX_WIDTH) - SIDE_PADDING * 2;
  const cardWidth = (innerWidth - GAP * (columns - 1)) / columns;
  const rowHeight = Math.round(cardWidth * 1.5 + TITLE_HEIGHT);
  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => rowHeight + GAP,
    overscan: 2,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });
  const rows = virtualizer.getVirtualItems();
  const lastRow = rows.at(-1)?.index ?? -1;

  useEffect(() => {
    if (lastRow >= rowCount - 1 && hasMore && !loadingMore) onLoadMore();
  }, [lastRow, rowCount, hasMore, loadingMore, onLoadMore]);

  return (
    <ul
      ref={listRef}
      className="catalog-grid"
      aria-label="Catálogo"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {rows.flatMap((row) =>
        items.slice(row.index * columns, (row.index + 1) * columns).map((item, column) => (
          <li
            key={item.rootId}
            className={item.dimmed ? 'catalog-card catalog-card--seen' : 'catalog-card'}
            style={{
              width: cardWidth,
              height: rowHeight,
              transform: `translate(${column * (cardWidth + GAP)}px, ${
                row.start - virtualizer.options.scrollMargin
              }px)`,
            }}
          >
            {onToggle ? (
              <button
                className="catalog-card__button"
                type="button"
                aria-pressed={item.dimmed}
                disabled={item.rootId === pendingRootId}
                onClick={() => onToggle(item)}
              >
                <CardContent item={item} />
              </button>
            ) : (
              <>
                <CardContent item={item} />
                {item.dimmed && <span className="visually-hidden"> (vista)</span>}
              </>
            )}
          </li>
        )),
      )}
    </ul>
  );
}

// The cover is decorative: the title names the card.
function CardContent({ item }: { item: CatalogItem }) {
  return (
    <>
      {item.coverUrl ? (
        <img
          className="catalog-card__cover"
          src={item.coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="catalog-card__cover catalog-card__cover--empty" />
      )}
      <span className="catalog-card__title">{item.title}</span>
    </>
  );
}
