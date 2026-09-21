import { useState, useMemo, useCallback, createRef } from 'react';

import { useIntl, defineMessages, FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import { Helmet } from '@unhead/react/helmet';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import { updateAccount } from 'mastodon/actions/accounts';
import { showAlertForError } from 'mastodon/actions/alerts';
import { closeOnboarding } from 'mastodon/actions/onboarding';
import { Button } from 'mastodon/components/button';
import { CalloutInline } from 'mastodon/components/callout_inline';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import {
  TextAreaField,
  TextInputField,
  Toggle,
} from 'mastodon/components/form_fields';
import type { FieldStatus } from 'mastodon/components/form_fields/form_field_wrapper';
import { Icon } from 'mastodon/components/icon';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { me } from 'mastodon/initial_state';
import { useAppSelector, useAppDispatch } from 'mastodon/store';
import { unescapeHTML } from 'mastodon/utils/html';

const messages = defineMessages({
  title: {
    id: 'onboarding.profile.title',
    defaultMessage: 'Profile setup',
  },
  uploadHeader: {
    id: 'onboarding.profile.upload_header',
    defaultMessage: 'Upload profile header',
  },
  uploadAvatar: {
    id: 'onboarding.profile.upload_avatar',
    defaultMessage: 'Upload profile picture',
  },
  imageTooLarge: {
    id: 'onboarding.profile.image_too_large',
    defaultMessage: 'This image is too large. The maximum size is {limit} MB.',
  },
});

// Mirrors AVATAR_LIMIT / HEADER_LIMIT (8.megabytes) enforced server-side.
const IMAGE_SIZE_LIMIT_MB = 8;
const IMAGE_SIZE_LIMIT = IMAGE_SIZE_LIMIT_MB * 1024 * 1024;

// ==========================================
// EPSILON : DEFAULT AVATAR VERSIONING
// The default avatar/header URL is now versioned (missing.png?v=N) to bust
// the static asset cache, so match by substring instead of suffix.
// ==========================================
const nullIfMissing = (path: string) =>
  path.includes('missing.png') ? null : path;

interface ApiAccountErrors {
  display_name?: unknown;
  note?: unknown;
  avatar?: unknown;
  header?: unknown;
}

// Extract a human-readable string from a field error, which is either a
// client-side message (string) or the server's `details` entry (an array of
// `{ error, description }` objects returned by ValidationErrorFormatter).
const errorMessage = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    const [first] = value as unknown[];
    if (
      first &&
      typeof first === 'object' &&
      'description' in first &&
      typeof (first as { description: unknown }).description === 'string'
    ) {
      return (first as { description: string }).description;
    }
  }
  return undefined;
};

// Turn a field error into the `status` prop accepted by the form fields:
// a full callout when we have a message, otherwise a bare error state.
const fieldStatus = (value: unknown): FieldStatus | 'error' | undefined => {
  if (!value) {
    return undefined;
  }
  const message = errorMessage(value);
  return message ? { variant: 'error', message } : 'error';
};

export const Profile: React.FC<{
  multiColumn?: boolean;
}> = ({ multiColumn }) => {
  const account = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );
  const [displayName, setDisplayName] = useState(account?.display_name ?? '');
  const [note, setNote] = useState(account ? unescapeHTML(account.note) : '');
  const [avatar, setAvatar] = useState<File>();
  const [header, setHeader] = useState<File>();
  const [discoverable, setDiscoverable] = useState(
    account?.discoverable ?? true,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ApiAccountErrors>();
  const avatarFileRef = createRef<HTMLInputElement>();
  const headerFileRef = createRef<HTMLInputElement>();
  const dispatch = useAppDispatch();
  const intl = useIntl();

  const maxDisplayNameLength = useAppSelector(
    (state) =>
      state.server.server.item?.configuration.accounts.max_display_name_length,
  );

  const handleDisplayNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDisplayName(e.target.value);
      setErrors((prev) =>
        prev?.display_name ? { ...prev, display_name: undefined } : prev,
      );
    },
    [],
  );

  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNote(e.target.value);
      setErrors((prev) => (prev?.note ? { ...prev, note: undefined } : prev));
    },
    [],
  );

  const handleDiscoverableChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDiscoverable(e.target.checked);
    },
    [setDiscoverable],
  );

  const handleAvatarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.size > IMAGE_SIZE_LIMIT) {
        setErrors((prev) => ({
          ...prev,
          avatar: intl.formatMessage(messages.imageTooLarge, {
            limit: IMAGE_SIZE_LIMIT_MB,
          }),
        }));
        e.target.value = '';
        return;
      }
      setErrors((prev) =>
        prev?.avatar ? { ...prev, avatar: undefined } : prev,
      );
      setAvatar(file);
    },
    [intl],
  );

  const handleHeaderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.size > IMAGE_SIZE_LIMIT) {
        setErrors((prev) => ({
          ...prev,
          header: intl.formatMessage(messages.imageTooLarge, {
            limit: IMAGE_SIZE_LIMIT_MB,
          }),
        }));
        e.target.value = '';
        return;
      }
      setErrors((prev) =>
        prev?.header ? { ...prev, header: undefined } : prev,
      );
      setHeader(file);
    },
    [intl],
  );

  const avatarPreview = useMemo(
    () =>
      avatar
        ? URL.createObjectURL(avatar)
        : nullIfMissing(account?.avatar ?? 'missing.png'),
    [avatar, account],
  );
  const headerPreview = useMemo(
    () =>
      header
        ? URL.createObjectURL(header)
        : nullIfMissing(account?.header ?? 'missing.png'),
    [header, account],
  );

  const handleSubmit = useCallback(() => {
    setIsSaving(true);

    dispatch(
      updateAccount({
        displayName,
        note,
        avatar,
        header,
        discoverable,
        indexable: discoverable,
      }),
    )
      .then(() => {
        /* ========================================== */
        /* EPSILON : CATEGORIZATION SYSTEM            */
        window.location.href = '/home';
        /* ========================================== */
        dispatch(closeOnboarding());
        return '';
      })
      // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
      .catch((err) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (err.response) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const { details }: { details: ApiAccountErrors } = err.response.data;
          setErrors(details);
        }

        // EPSILON: updateAccount is a legacy thunk that rejects without a
        // *_FAIL action, so it never reaches the global errorsMiddleware.
        // Surface a toast here so upload/validation failures (incl. a 413 with
        // no `details` payload) are never silent.
        dispatch(showAlertForError(err));

        setIsSaving(false);
      });
  }, [dispatch, displayName, note, avatar, header, discoverable]);

  const avatarError = errorMessage(errors?.avatar);
  const headerError = errorMessage(errors?.header);
  // Block submission while any field is in error so the user can't skip past a
  // rejected upload (e.g. an oversized image) and get redirected to /home.
  const hasErrors = !!errors && Object.values(errors).some(Boolean);

  return (
    <Column
      className='epsilon-onboarding-column'
      bindToDocument={!multiColumn}
      label={intl.formatMessage(messages.title)}
    >
      <ColumnHeader
        className='epsilon-onboarding-header'
        title={intl.formatMessage(messages.title)}
        icon='person'
        iconComponent={PersonIcon}
        multiColumn={multiColumn}
        showBackButton
      />

      {/* EPSILON: onboarding new UI — surface card wrapper (title = native ColumnHeader above) */}
      <div className='epsilon-onboarding'>
        <div className='epsilon-onboarding__card'>
          <div className='scrollable scrollable--flex'>
            <div className='simple_form app-form'>
              <div className='onboarding__profile'>
                <label
                  className={classNames('app-form__header-input', {
                    selected: !!headerPreview,
                    invalid: !!errors?.header,
                  })}
                  title={intl.formatMessage(messages.uploadHeader)}
                >
                  <input
                    type='file'
                    hidden
                    ref={headerFileRef}
                    accept='image/*'
                    onChange={handleHeaderChange}
                  />

                  {headerPreview && <img src={headerPreview} alt='' />}

                  <Icon
                    id=''
                    icon={headerPreview ? EditIcon : AddPhotoAlternateIcon}
                  />
                </label>

                <label
                  className={classNames('app-form__avatar-input', {
                    selected: !!avatarPreview,
                    invalid: !!errors?.avatar,
                  })}
                  title={intl.formatMessage(messages.uploadAvatar)}
                >
                  <input
                    type='file'
                    hidden
                    ref={avatarFileRef}
                    accept='image/*'
                    onChange={handleAvatarChange}
                  />

                  {avatarPreview && <img src={avatarPreview} alt='' />}

                  <Icon
                    id=''
                    icon={avatarPreview ? EditIcon : AddPhotoAlternateIcon}
                  />
                </label>
              </div>

              {headerError && (
                <CalloutInline variant='error' message={headerError} />
              )}
              {avatarError && (
                <CalloutInline variant='error' message={avatarError} />
              )}

              <div className='fields-group'>
                <TextInputField
                  maxLength={maxDisplayNameLength ?? 40}
                  label={
                    <FormattedMessage
                      id='onboarding.profile.display_name'
                      defaultMessage='Display name'
                    />
                  }
                  hint={
                    <FormattedMessage
                      id='onboarding.profile.display_name_hint'
                      defaultMessage='Your full name or your fun name…'
                    />
                  }
                  value={displayName}
                  onChange={handleDisplayNameChange}
                  status={fieldStatus(errors?.display_name)}
                  id='display_name'
                />
              </div>

              <div className='fields-group'>
                <TextAreaField
                  maxLength={500}
                  label={
                    <FormattedMessage
                      id='onboarding.profile.note'
                      defaultMessage='Bio'
                    />
                  }
                  hint={
                    <FormattedMessage
                      id='onboarding.profile.note_hint'
                      defaultMessage='You can @mention other people or #hashtags…'
                    />
                  }
                  value={note}
                  onChange={handleNoteChange}
                  status={fieldStatus(errors?.note)}
                  id='note'
                />
              </div>

              <label className='app-form__toggle'>
                <div className='app-form__toggle__label'>
                  <strong>
                    <FormattedMessage
                      id='onboarding.profile.discoverable'
                      defaultMessage='Make my profile discoverable'
                    />
                  </strong>{' '}
                  <span className='recommended'>
                    <FormattedMessage
                      id='recommended'
                      defaultMessage='Recommended'
                    />
                  </span>
                  <span className='hint'>
                    <FormattedMessage
                      id='onboarding.profile.discoverable_hint'
                      defaultMessage='When you opt in to discoverability on Epsilon, your posts may appear in search results and trending, and your profile may be suggested to people with similar interests to you.'
                    />
                  </span>
                </div>

                <div className='app-form__toggle__toggle'>
                  <div>
                    <Toggle
                      checked={discoverable}
                      onChange={handleDiscoverableChange}
                    />
                  </div>
                </div>
              </label>
            </div>

            <div className='spacer' />

            <div className='column-footer'>
              <Button
                block
                onClick={handleSubmit}
                disabled={isSaving || hasErrors}
              >
                {isSaving ? (
                  <LoadingIndicator />
                ) : (
                  <FormattedMessage
                    id='onboarding.profile.finish'
                    defaultMessage='Finish'
                  />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* /EPSILON */}

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default Profile;
