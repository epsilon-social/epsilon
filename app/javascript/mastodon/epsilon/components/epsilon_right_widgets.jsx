import { useIntl, defineMessages } from 'react-intl';

const messages = defineMessages({
  suggestionsTitle: { id: 'epsilon.widgets.suggestions.title', defaultMessage: 'Suggestions à suivre' },
  viewAll: { id: 'epsilon.widgets.view_all', defaultMessage: 'Voir tous' },
  relevanceTitle: { id: 'epsilon.widgets.relevance.title', defaultMessage: 'Améliorer la pertinence des contenus proposés' },
  relevanceDesc: { id: 'epsilon.widgets.relevance.desc', defaultMessage: 'Choisissez les sujets à mettre davantage en avant dans le fil.' },
  followBtn: { id: 'epsilon.widgets.follow', defaultMessage: 'Suivre' },
  validateBtn: { id: 'epsilon.widgets.validate', defaultMessage: 'Valider' }
});

const EpsilonRightWidgets = () => {
  const intl = useIntl();

  return (
    <div className='epsilon-right-widgets'>

      <section className='epsilon-widget epsilon-widget--suggestions'>
        <header className='epsilon-widget__header'>
          <h3>{intl.formatMessage(messages.suggestionsTitle)}</h3>
          <a href='/explore' className='epsilon-widget__link'>{intl.formatMessage(messages.viewAll)}</a>
        </header>

        <div className='epsilon-widget__body'>
          <div className='epsilon-suggestion-card'>
            <div className='epsilon-suggestion-card__avatar' />
            <div className='epsilon-suggestion-card__info'>
              <strong>Aman Gupta</strong>
              <span>@aman</span>
            </div>
            <button className='epsilon-btn epsilon-btn--light'>
              {intl.formatMessage(messages.followBtn)}
            </button>
          </div>
        </div>
      </section>

      <section className='epsilon-widget epsilon-widget--dark'>
        <header className='epsilon-widget__header'>
          <h3>{intl.formatMessage(messages.relevanceTitle)}</h3>
        </header>
        <div className='epsilon-widget__body'>
          <p>{intl.formatMessage(messages.relevanceDesc)}</p>

          <div className='epsilon-tags-grid'>
            <button className='epsilon-tag'>Politique</button>
            <button className='epsilon-tag'>Science</button>
            <button className='epsilon-tag'>Climat</button>
          </div>

          <div className='epsilon-widget__actions'>
            <button className='epsilon-btn epsilon-btn--primary'>
              {intl.formatMessage(messages.validateBtn)}
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};

export default EpsilonRightWidgets;
