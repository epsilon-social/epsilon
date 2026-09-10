import PropTypes from 'prop-types';
import { cloneElement, Component } from 'react';

import getRectFromEntry from '../../features/ui/util/get_rect_from_entry';
import scheduleIdleTask from '../../features/ui/util/schedule_idle_task';
import { Article } from './components';

// Diff these props in the "unrendered" state
const updateOnPropsForUnrendered = ['id', 'index', 'listLength', 'cachedHeight'];

// ==========================================
// EPSILON : SCROLL — VIRTUALISATION DÉSACTIVÉE EN IN-APP
// En scroll-page iOS (coque WKWebView), l'IntersectionObserver tourne sans
// rootMargin (bindToDocument → connect({})), donc chaque post est remplacé par
// un placeholder invisible dès qu'il quitte le viewport. iOS n'ayant pas
// d'overflow-anchor pour compenser, ça provoque un saut à chaque post, et des
// écrans blancs / gels sous scroll rapide (l'observer ne suit pas l'inertie).
// On garde donc tous les items montés en in-app. Le web conserve la
// virtualisation (le navigateur a l'ancrage natif).
// ==========================================
const EPSILON_IN_APP =
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('epsilon-in-app');

export default class IntersectionObserverArticle extends Component {

  static propTypes = {
    intersectionObserverWrapper: PropTypes.object.isRequired,
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    index: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    listLength: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    saveHeightKey: PropTypes.string,
    cachedHeight: PropTypes.number,
    onHeightChange: PropTypes.func,
    children: PropTypes.node,
  };

  state = {
    isHidden: false, // set to true in requestIdleCallback to trigger un-render
  };

  shouldComponentUpdate (nextProps, nextState) {
    // EPSILON : in-app, jamais virtualisé → rendu normal (voir en-tête)
    if (EPSILON_IN_APP) {
      return true;
    }

    const isUnrendered = !this.state.isIntersecting && (this.state.isHidden || this.props.cachedHeight);
    const willBeUnrendered = !nextState.isIntersecting && (nextState.isHidden || nextProps.cachedHeight);
    if (!!isUnrendered !== !!willBeUnrendered) {
      // If we're going from rendered to unrendered (or vice versa) then update
      return true;
    }
    // If we are and remain hidden, diff based on props
    if (isUnrendered) {
      return !updateOnPropsForUnrendered.every(prop => nextProps[prop] === this.props[prop]);
    }
    // Else, assume the children have changed
    return true;
  }

  componentDidMount () {
    const { intersectionObserverWrapper, id } = this.props;

    this.componentMounted = true;

    // EPSILON : pas de virtualisation in-app → on n'observe pas (voir en-tête)
    if (EPSILON_IN_APP) {
      return;
    }

    intersectionObserverWrapper.observe(
      id,
      this.node,
      this.handleIntersection,
    );
  }

  componentWillUnmount () {
    const { intersectionObserverWrapper, id } = this.props;
    intersectionObserverWrapper.unobserve(id, this.node);

    this.componentMounted = false;
  }

  handleIntersection = (entry) => {
    this.entry = entry;

    scheduleIdleTask(this.calculateHeight);
    this.setState(this.updateStateAfterIntersection);
  };

  updateStateAfterIntersection = (prevState) => {
    if (prevState.isIntersecting !== false && !this.entry.isIntersecting) {
      scheduleIdleTask(this.hideIfNotIntersecting);
    }
    return {
      isIntersecting: this.entry.isIntersecting,
      isHidden: false,
    };
  };

  calculateHeight = () => {
    const { onHeightChange, saveHeightKey, id } = this.props;
    // save the height of the fully-rendered element (this is expensive
    // on Chrome, where we need to fall back to getBoundingClientRect)
    this.height = getRectFromEntry(this.entry).height;

    if (onHeightChange && saveHeightKey) {
      onHeightChange(saveHeightKey, id, this.height);
    }
  };

  hideIfNotIntersecting = () => {
    if (!this.componentMounted) {
      return;
    }

    // When the browser gets a chance, test if we're still not intersecting,
    // and if so, set our isHidden to true to trigger an unrender. The point of
    // this is to save DOM nodes and avoid using up too much memory.
    // See: https://github.com/mastodon/mastodon/issues/2900
    this.setState((prevState) => ({ isHidden: !prevState.isIntersecting }));
  };

  handleRef = (node) => {
    this.node = node;
  };

  render () {
    const { children, id, index, listLength, cachedHeight } = this.props;
    const { isIntersecting, isHidden } = this.state;

    // EPSILON : in-app, on ne masque jamais (pas de placeholder invisible)
    if (!EPSILON_IN_APP && !isIntersecting && (isHidden || cachedHeight)) {
      return (
        <Article
          ref={this.handleRef}
          aria-posinset={index + 1}
          aria-setsize={listLength}
          style={{ height: `${this.height || cachedHeight}px`, opacity: 0, overflow: 'hidden' }}
          data-id={id}
        >
          {children && cloneElement(children, { hidden: true })}
        </Article>
      );
    }

    return (
      <Article ref={this.handleRef} aria-posinset={index + 1} aria-setsize={listLength} data-id={id}>
        {children && cloneElement(children, { hidden: false })}
      </Article>
    );
  }

}
