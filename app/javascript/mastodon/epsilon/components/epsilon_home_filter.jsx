import { useCallback, useId, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from 'mastodon/store';
import { changeSetting } from 'mastodon/actions/settings';
import { FormattedMessage } from 'react-intl';
import Overlay from 'react-overlays/esm/Overlay';

import { Toggle } from 'mastodon/components/form_fields';
import { Icon } from 'mastodon/components/icon';
import TuneIcon from '@/material-icons/400-24px/tune.svg?react';
import classNames from 'classnames';


export const EpsilonHomeFilter = () => {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const containerRef = useRef(null);
  const accessibleId = useId();

  const showsReblogs = useAppSelector((state) => state.settings.getIn(['home', 'shows', 'reblog']));
  const showsReplies = useAppSelector((state) => state.settings.getIn(['home', 'shows', 'reply']));
  const showsQuotes = useAppSelector((state) => state.settings.getIn(['home', 'shows', 'quote'], true));
  const stacksEnabled = useAppSelector((state) => state.settings.getIn(['home', 'epsilon', 'stacks'], true));

  const handleClick = useCallback(() => setOpen(true), []);
  const handleHide = useCallback(() => setOpen(false), []);

  const handleChange = useCallback((event) => {
    const { name, checked } = event.target;
    dispatch(changeSetting(['home', 'shows', name], checked));
  }, [dispatch]);

  const handleStacksChange = useCallback((event) => {
    dispatch(changeSetting(['home', 'epsilon', 'stacks'], event.target.checked));
  }, [dispatch]);

  return (
    <div className='epsilon-home-filter' ref={containerRef}>
      <button
        type='button'
        className={classNames('epsilon-filter-btn', { active: open })}
        ref={buttonRef}
        onClick={handleClick}
        aria-expanded={open}
        aria-controls={`${accessibleId}-wrapper`}
      >
        <Icon id='filter' icon={TuneIcon} />
        <FormattedMessage id='epsilon.home.filter' defaultMessage='Filtres' />
      </button>

      <Overlay
        show={open}
        target={buttonRef}
        placement='bottom-end'
        rootClose
        onHide={handleHide}
        container={containerRef}
      >
        {({ props }) => (
          <div
            {...props}
            id={`${accessibleId}-wrapper`}
            className='epsilon-filter-dropdown'
          >
            <div className='epsilon-filter-dropdown__row'>
              <label htmlFor={`${accessibleId}-reblogs`}>
                <FormattedMessage id='home.column_settings.show_reblogs' defaultMessage='Show boosts' />
              </label>
              <Toggle
                name='reblog'
                checked={showsReblogs}
                onChange={handleChange}
                id={`${accessibleId}-reblogs`}
              />
            </div>

            <div className='epsilon-filter-dropdown__row'>
              <label htmlFor={`${accessibleId}-quotes`}>
                <FormattedMessage id='home.column_settings.show_quotes' defaultMessage='Show quotes' />
              </label>
              <Toggle
                name='quote'
                checked={showsQuotes}
                onChange={handleChange}
                id={`${accessibleId}-quotes`}
              />
            </div>

            <div className='epsilon-filter-dropdown__row'>
              <label htmlFor={`${accessibleId}-replies`}>
                <FormattedMessage id='home.column_settings.show_replies' defaultMessage='Show replies' />
              </label>
              <Toggle
                name='reply'
                checked={showsReplies}
                onChange={handleChange}
                id={`${accessibleId}-replies`}
              />
            </div>

            <div className='epsilon-filter-dropdown__row'>
              <label htmlFor={`${accessibleId}-stacks`}>
                <FormattedMessage id='epsilon.home.filter.stacks' defaultMessage='Group posts' />
              </label>
              <Toggle
                name='stacks'
                checked={stacksEnabled}
                onChange={handleStacksChange}
                id={`${accessibleId}-stacks`}
              />
            </div>
          </div>
        )}
      </Overlay>
    </div>
  );
};
