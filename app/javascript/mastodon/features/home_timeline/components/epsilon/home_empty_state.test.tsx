import { IntlProvider } from 'react-intl';

import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { EpsilonHomeEmptyState } from './home_empty_state';

vi.mock(
  'mastodon/features/home_timeline/components/inline_follow_suggestions',
  () => ({
    InlineFollowSuggestions: () => (
      <div data-testid='mock-inline-follow-suggestions' />
    ),
  }),
);

describe('EpsilonHomeEmptyState', () => {
  it('renders the Epsilon welcome message and the native suggestions component', () => {
    const { getByText, getByTestId } = render(
      <IntlProvider locale='en'>
        <EpsilonHomeEmptyState />
      </IntlProvider>,
    );

    expect(
      getByText(
        /Your news feed is empty. Here are some account suggestions to fill it:/i,
      ),
    ).toBeDefined();
    expect(getByTestId('mock-inline-follow-suggestions')).toBeDefined();
  });
});
