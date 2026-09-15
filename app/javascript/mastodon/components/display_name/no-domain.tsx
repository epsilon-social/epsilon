import type { ComponentPropsWithoutRef, FC } from 'react';

import classNames from 'classnames';

import { EpsilonBadges } from '@/mastodon/epsilon/components/epsilon_badges';

import { AnimateEmojiProvider } from '../emoji/context';
import { EmojiHTML } from '../emoji/html';
import { Skeleton } from '../skeleton';

import type { DisplayNameProps } from './index';

export const DisplayNameWithoutDomain: FC<
  Omit<DisplayNameProps, 'variant'> & ComponentPropsWithoutRef<'span'>
> = ({ account, className, children, localDomain: _, ...props }) => {
  return (
    <AnimateEmojiProvider
      {...props}
      as='span'
      className={classNames('display-name', className)}
    >
      <bdi>
        {account ? (
          <EmojiHTML
            className='display-name__html'
            htmlString={account.get('display_name_html')}
            as='strong'
            extraEmojis={account.get('emojis')}
          />
        ) : (
          <strong className='display-name__html'>
            <Skeleton width='10ch' />
          </strong>
        )}
      </bdi>
      {/* EPSILON : CERTIFIED ACCOUNTS / BADGES — right after the name text */}
      <EpsilonBadges account={account} variant='compact' />
      {children}
    </AnimateEmojiProvider>
  );
};
