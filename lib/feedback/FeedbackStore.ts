import type { FeedbackItem } from '@/types';

export class FeedbackStore {
  private items: FeedbackItem[] = [];

  add(item: FeedbackItem): void {
    this.items.push(item);
  }

  update(id: string, partial: Partial<FeedbackItem>): void {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx !== -1) {
      this.items[idx] = { ...this.items[idx], ...partial };
    }
  }

  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
  }

  getAll(): FeedbackItem[] {
    return [...this.items];
  }

  clear(): void {
    this.items = [];
  }
}

export const feedbackStore = new FeedbackStore();
