import { md5 } from "js-md5";
import { Highlight } from "./model";

export function reviewDay(time = Date.now()) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
export function reviewGoal(value = 5) {
  return Number.isFinite(value)
    ? Math.max(1, Math.min(50, Math.floor(value)))
    : 5;
}
export function reviewQueue(items: Highlight[], size = 5, time = Date.now()) {
  const start = reviewDay(time),
    goal = reviewGoal(size);
  const reviewed = items.filter(
    (h) =>
      (h.review?.lastReviewed || 0) >= start &&
      (h.review?.lastReviewed || 0) <= time,
  ).length;
  const eligible = items.filter(
    (h) => !h.archived && h.frequency !== 0 && h.text.trim(),
  );
  const due = eligible.filter(
    (h) =>
      (h.review?.nextReview || 0) <= time &&
      (h.review?.lastReviewed || 0) < start,
  );
  const rank = new Map(due.map((h) => [h.id, md5(start + h.id)]));
  due.sort(
    (a, b) =>
      (a.review?.count || 0) / (a.frequency || 1) -
        (b.review?.count || 0) / (b.frequency || 1) ||
      rank.get(a.id)!.localeCompare(rank.get(b.id)!),
  );
  // Give both books and articles a place without excluding short Japanese passages.
  const diverse: Highlight[] = [];
  for (const category of ["books", "articles"]) {
    const item = due.find((h) => (h.category || "books") === category);
    if (item) diverse.push(item);
  }
  const remaining = Math.max(0, goal - reviewed);
  const cards = [...diverse, ...due.filter((h) => !diverse.includes(h))].slice(
    0,
    remaining,
  );
  return {
    cards,
    goal,
    reviewed,
    remaining,
    due: due.length,
    total: eligible.length,
  };
}
export function reviewedHighlight(
  item: Highlight,
  days: number,
  time = Date.now(),
): Highlight {
  if (!Number.isFinite(days))
    throw new Error("Choose a valid review interval.");
  if ((item.review?.lastReviewed || 0) >= reviewDay(time)) return item;
  const next = new Date(time);
  next.setDate(next.getDate() + Math.max(1, Math.min(365, Math.floor(days))));
  next.setHours(0, 0, 0, 0);
  return {
    ...item,
    review: {
      count: (item.review?.count || 0) + 1,
      lastReviewed: time,
      nextReview: next.getTime(),
    },
  };
}
