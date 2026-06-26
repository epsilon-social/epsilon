# frozen_string_literal: true

require 'rails_helper'

RSpec.describe StatusLengthValidator do
  subject { Fabricate.build :status }

  # ==========================================
  # EPSILON : EXTENDED POST LIMITS
  before { stub_const("#{described_class}::MAX_CHARS", 9000) } # Example values below are relative to this baseline
  # ==========================================

  let(:over_limit_text) { 'a' * described_class::MAX_CHARS * 2 }

  context 'when status is remote' do
    before { subject.update! account: Fabricate(:account, domain: 'host.example') }

    it { is_expected.to allow_value(over_limit_text).for(:text) }
    it { is_expected.to allow_value(over_limit_text).for(:spoiler_text).against(:text) }
  end

  context 'when status is a local reblog' do
    before { subject.update! reblog: Fabricate(:status) }

    it { is_expected.to allow_value(over_limit_text).for(:text) }
    it { is_expected.to allow_value(over_limit_text).for(:spoiler_text).against(:text) }
  end

  context 'when text is over character limit' do
    it { is_expected.to_not allow_value(over_limit_text).for(:text).with_message(too_long_message) }
  end

  context 'when content warning text is over character limit' do
    it { is_expected.to_not allow_value(over_limit_text).for(:spoiler_text).against(:text).with_message(too_long_message) }
  end

  context 'when text and content warning combine to exceed limit' do
    # ==========================================
    # EPSILON : EXTENDED POST LIMITS
    before { subject.text = 'a' * 4500 }

    it { is_expected.to_not allow_value('a' * 4505).for(:spoiler_text).against(:text).with_message(too_long_message) }
  end

  context 'when text has space separated linkable URLs' do
    let(:text) { [starting_string, example_link].join(' ') }

    it { is_expected.to allow_value(text).for(:text) }
  end

  context 'when text has non-separated URLs' do
    let(:text) { [starting_string, example_link].join }

    it { is_expected.to_not allow_value(text).for(:text).with_message(too_long_message) }
  end

  context 'with excessively long URLs' do
    # ==========================================
    # EPSILON : EXTENDED POST LIMITS
    let(:text) { "http://example.com/valid?#{'#foo?' * 2000}" }
    # ==========================================

    it { is_expected.to_not allow_value(text).for(:text).with_message(too_long_message) }
  end

  context 'when remote account usernames cause limit excess' do
    # ==========================================
    # EPSILON : EXTENDED POST LIMITS
    let(:text) { ('a' * 8975) + " @alice@#{'b' * 30}.com" }
    # ==========================================

    it { is_expected.to allow_value(text).for(:text) }
  end

  context 'when remote usernames are attached to long domains' do
    # ==========================================
    # EPSILON : EXTENDED POST LIMITS
    let(:text) { "@alice@#{'b' * 9000}.com" }
    # ==========================================

    it { is_expected.to_not allow_value(text).for(:text).with_message(too_long_message) }
  end

  context 'with special character strings' do
    let(:multibyte_emoji) { '✨' * described_class::MAX_CHARS }
    let(:zwj_sequence) { '🏳️‍⚧️' * described_class::MAX_CHARS }

    it { is_expected.to allow_values(multibyte_emoji, zwj_sequence).for(:text) }
  end

  private

  def too_long_message
    I18n.t('statuses.over_character_limit', max: described_class::MAX_CHARS)
  end

  def starting_string
    # ==========================================
    # EPSILON : EXTENDED POST LIMITS
    'a' * 8976
    # ==========================================
  end

  def example_link
    "http://#{'b' * 30}.com/example"
  end
end
