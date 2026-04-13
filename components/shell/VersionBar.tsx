'use client';

import type { VersionEntry } from '@/types';

interface VersionBarProps {
  versions: VersionEntry[];
  currentIndex: number; // -1 = latest
  onSelect: (index: number) => void;
  onRestore: (index: number) => void;
}

export function VersionBar({ versions, currentIndex, onSelect, onRestore }: VersionBarProps) {
  if (versions.length === 0) return null;

  return (
    <div
      data-testid="version-bar"
      className="border-t border-neutral-200 dark:border-neutral-800 px-3 py-2 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          Versions
        </p>
        {currentIndex !== -1 && (
          <button
            data-testid="restore-btn"
            onClick={() => onRestore(currentIndex)}
            className="text-xs font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
          >
            Restore v{versions[currentIndex]?.version}
          </button>
        )}
      </div>
      <div className="flex gap-1 flex-wrap">
        {versions.map((v, idx) => {
          const isSelected = currentIndex === idx || (currentIndex === -1 && idx === versions.length - 1);
          const isLatest = idx === versions.length - 1 && currentIndex === -1;
          return (
            <button
              key={v.version}
              data-testid="version-item"
              title={v.prompt.length > 60 ? v.prompt.slice(0, 60) + '…' : v.prompt}
              onClick={() => onSelect(idx)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                isSelected
                  ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-neutral-900 dark:border-neutral-100'
                  : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
              }`}
            >
              v{v.version}
              {isLatest ? ' ●' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
