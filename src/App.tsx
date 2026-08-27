import { useEffect, useState, useRef } from "react";

// Interface definitions moved to vite-env.d.ts

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-7.58-7-12a7 7 0 0 1 14 0c0 4.42-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" fill={filled ? "var(--bg)" : "none"} />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function App() {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  // Load items from DB
  const refreshItems = async () => {
    try {
      const history = await window.electronAPI.getHistory();
      setItems(history);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  useEffect(() => {
    refreshItems();

    // Listen for clipboard changes
    // returns a cleanup function
    const unsubscribeClipboard = window.electronAPI.onClipboardChange((_) => {
      refreshItems();
    });

    const unsubscribeSettings = window.electronAPI.onSettingsChanged(() => {
      refreshItems();
    });

    const unsubscribeWindowHidden = window.electronAPI.onWindowHidden(() => {
      setSearch("");
      setSelectedIndex(-1);
    });

    return () => {
      unsubscribeClipboard();
      unsubscribeSettings();
      unsubscribeWindowHidden();
    };
  }, []);

  // Filter items - only show text items when searching, but always show images
  const filteredItems = items.filter((item) => {
    if (item.content_type === 'image') {
      return true; // Always show images regardless of search
    }
    return item.content.toLowerCase().includes(search.toLowerCase());
  });

  const handleSelectItem = async (item: ClipboardItem) => {
    try {
      // Pass the item ID to the main process
      // The main process will handle both text and image copying logic
      await window.electronAPI.copyToClipboard(item.id);

      if (!item.pinned) {
        // Delete the item from history after copying
        // The clipboard monitor will detect the re-written content,
        // re-insert it at the top, and fire onClipboardChange which
        // triggers refreshItems() automatically.
        await window.electronAPI.deleteHistoryItem(item.id);
      }
      // Pinned items stay put — deleting would lose their pinned state.

      const settings = await window.electronAPI.getSettings();
      if (settings.autoCloseOnSelect) {
        await window.electronAPI.hideWindow();
      }
    } catch (err) {
      console.error("Failed to select item:", err);
    }
  };

  const handleTogglePin = async (item: ClipboardItem) => {
    try {
      await window.electronAPI.togglePin(item.id);
      await refreshItems();
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all clipboard history? Pinned items will be kept.")) {
      return;
    }
    try {
      await window.electronAPI.clearHistory();
      await refreshItems();
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  };

  const handleDeleteItem = async (id: number) => {
    try {
      await window.electronAPI.deleteHistoryItem(id);
      await refreshItems();
      // Adjust selection if it was the last item
      setSelectedIndex((prev) => {
        if (prev >= filteredItems.length - 1) {
          return Math.max(-1, filteredItems.length - 2);
        }
        return prev;
      });
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  // Handle Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (prev === -1) return 0;
          return Math.min(prev + 1, filteredItems.length - 1);
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (prev === -1) return filteredItems.length - 1;
          return Math.max(prev - 1, 0);
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          handleSelectItem(item);
        }
      } else if (e.key === "Delete") {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          handleDeleteItem(item.id);
        }
      } else if (e.key === "Escape") {
        await window.electronAPI.hideWindow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, selectedIndex]);

  // Scroll current item into view
  useEffect(() => {
    if (listRef.current && selectedIndex !== -1) {
      const el = listRef.current.children[selectedIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-screen w-full bg-gnome-bg text-gnome-text flex flex-col overflow-hidden font-sans">
      <div className="p-3 flex flex-col flex-1 overflow-hidden">
        <div className="mb-4 p-1 flex items-center gap-2">
          <input
            type="text"
            className="flex-1 min-w-0 bg-gnome-input border border-gnome-border rounded-lg p-2.5 text-gnome-text focus:outline-none focus:ring-2 focus:ring-gnome-accent/50 transition-all shadow-sm"
            placeholder="Search clipboard history..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(-1);
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={handleClearAll}
            title="Clear all (keeps pinned items)"
            className="shrink-0 self-stretch aspect-square p-2 flex items-center justify-center rounded-lg border border-gnome-border text-gnome-text-dim hover:text-gnome-text hover:bg-gnome-surface transition-colors"
          >
            <TrashIcon />
          </button>
        </div>

        <ul ref={listRef} className="flex-1 overflow-y-auto space-y-1.5">
          {filteredItems.map((item, index) => (
            <li
              key={item.id}
              className={`p-2 mr-2 rounded-lg cursor-pointer transition-all break-words border ${index === selectedIndex
                ? "outline-2 -outline-offset-2 outline-orange-500 border-transparent shadow-md bg-gnome-surface"
                : "bg-gnome-surface hover:bg-gnome-surface/80 text-gnome-text-dim border-gnome-border/50"
                }`}
              onClick={() => handleSelectItem(item)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="relative">
                {item.content_type === 'image' ? (
                  <img
                    src={item.content}
                    alt="Clipboard image"
                    className="max-w-full h-auto rounded"
                  />
                ) : (
                  <>
                    <div className="text-sm font-medium line-clamp-4 break-all text-gnome-text whitespace-pre-wrap pr-5">
                      {item.content}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(item);
                      }}
                      title={item.pinned ? "Unpin" : "Pin to top"}
                      className={`absolute top-0 right-0 p-0.5 rounded transition-colors ${item.pinned ? "text-gnome-accent" : "text-gnome-text-dim/50 hover:text-gnome-text-dim"
                        }`}
                    >
                      <PinIcon filled={!!item.pinned} />
                    </button>
                  </>
                )}
                <span className={`absolute ${item.content_type === 'image' ? 'bottom-1' : '-bottom-1'} -right-1 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded flex align-center leading-none`}>
                  {formatSize(item.content_size)}
                </span>
              </div>
            </li>
          ))}
          {filteredItems.length === 0 && (
            <div className="text-center text-gnome-text-dim mt-10">
              No items found.
            </div>
          )}
        </ul>

        <div className="mt-4 text-[10px] text-gnome-text-dim flex justify-center flex-wrap gap-2 uppercase tracking-wider font-semibold opacity-70">
          <span className="whitespace-nowrap"><span className="bg-gnome-border/70 px-1.5 py-0.5 rounded mx-1">Arrows</span> navigate</span>
          <span className="whitespace-nowrap"><span className="bg-gnome-border/70 px-1.5 py-0.5 rounded mx-1">Enter</span> select</span>
          <span className="whitespace-nowrap"><span className="bg-gnome-border/70 px-1.5 py-0.5 rounded ml-1">Canc</span> delete</span>
        </div>
      </div>
    </div>
  );
}

export default App;
