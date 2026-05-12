import { FormattedMessage } from 'react-intl';

import { InlineFollowSuggestions } from 'mastodon/features/home_timeline/components/inline_follow_suggestions';

export const EpsilonHomeEmptyState: React.FC = () => (
  <div className='epsilon-home-empty-state'>
    <div className='epsilon-empty-message-intro'>
      <FormattedMessage
        id='epsilon.home.empty_message'
        defaultMessage='Your news feed is empty. Here are some account suggestions to fill it:'
      />
    </div>
    <InlineFollowSuggestions />
  </div>
);
