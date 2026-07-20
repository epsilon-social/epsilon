import { categoryDisplayName } from '../category_names';

const category = {
  name: 'Science',
  name_translations: { en: 'Science', fr: 'Sciences' },
};

describe('categoryDisplayName', () => {
  test('returns the translation for the current locale', () => {
    expect(categoryDisplayName({ locale: 'fr' }, category)).toBe('Sciences');
  });

  test('matches the base locale when the locale has a region', () => {
    expect(categoryDisplayName({ locale: 'fr-FR' }, category)).toBe('Sciences');
  });

  test('falls back to English when the locale has no translation', () => {
    expect(categoryDisplayName({ locale: 'es' }, category)).toBe('Science');
  });

  test('falls back to the canonical name when no translation matches', () => {
    const withoutEnglish = { name: 'Culture', name_translations: { de: 'Kultur' } };

    expect(categoryDisplayName({ locale: 'fr' }, withoutEnglish)).toBe('Culture');
  });

  test('returns the name when there are no translations', () => {
    const untranslated = { name: 'Culture' };

    expect(categoryDisplayName({ locale: 'fr' }, untranslated)).toBe('Culture');
  });
});
