import { describe, it, expect } from 'vitest';
import {
  MEAL_CHOICES, choicesForMeal, knownChoices, choiceLabel,
} from '@/lib/data/meal-choices';

describe('meal choices', () => {
  it('inherits the template when the meal says nothing', () => {
    expect(choicesForMeal(null, ['vegetarian']).map((c) => c.key)).toEqual(['vegetarian']);
    expect(choicesForMeal(undefined, ['vegetarian']).map((c) => c.key)).toEqual(['vegetarian']);
  });

  // The distinction the whole feature rests on. An empty array is a
  // deliberate "do not ask for this meal"; null is "whatever the template
  // says". Collapsing them turns one into the other.
  it('treats an empty array on the meal as off, not as inherit', () => {
    expect(choicesForMeal([], ['vegetarian', 'gluten_free'])).toEqual([]);
  });

  it('lets a meal offer less than the template', () => {
    expect(choicesForMeal(['vegetarian'], ['vegetarian', 'gluten_free', 'vegan'])
      .map((c) => c.key)).toEqual(['vegetarian']);
  });

  it('lets a meal offer something the template does not', () => {
    expect(choicesForMeal(['vegan'], ['vegetarian']).map((c) => c.key)).toEqual(['vegan']);
  });

  it('switches the question off everywhere when the template is empty', () => {
    expect(choicesForMeal(null, [])).toEqual([]);
    expect(choicesForMeal(null, null)).toEqual([]);
  });

  it('drops a key nothing in the app understands', () => {
    // A key left behind by an older draft must not reach the form, where it
    // would render as a blank radio button with no label.
    expect(knownChoices(['vegetarian', 'paleo', ''])).toEqual(['vegetarian']);
    expect(choicesForMeal(['paleo'], ['vegetarian'])).toEqual([]);
  });

  it('every catalogue entry has both languages', () => {
    for (const c of MEAL_CHOICES) {
      expect(c.label.he, c.key).toBeTruthy();
      expect(c.label.en, c.key).toBeTruthy();
    }
  });

  it('keys are unique and stable-looking', () => {
    const keys = MEAL_CHOICES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z_]+$/);
  });

  it('labels an answer for the kitchen sheet', () => {
    expect(choiceLabel('vegetarian')).toBe('צמחוני');
    expect(choiceLabel(null)).toBe('');
    // An unknown answer is shown as-is rather than hidden: a guest asked
    // for something and the kitchen should see it.
    expect(choiceLabel('paleo')).toBe('paleo');
  });
});
