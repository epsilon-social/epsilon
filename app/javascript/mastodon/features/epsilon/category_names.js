export const categoryDisplayName = (intl, category) => {
  const translations = category.name_translations;

  if (translations) {
    const { locale } = intl;

    return (
      translations[locale] ||
      translations[locale.split(/[-_]/)[0]] ||
      translations.en ||
      category.name
    );
  }

  return category.name;
};
