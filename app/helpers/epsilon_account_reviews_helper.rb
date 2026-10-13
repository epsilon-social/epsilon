# frozen_string_literal: true

module EpsilonAccountReviewsHelper
  # Flattens the signup reason and the review payload into the lines shown in
  # the hover tooltip of the admin accounts review column.
  def epsilon_review_infos(account, review)
    infos = []

    reason = account.user&.invite_request&.text.presence
    infos << "#{t('admin.epsilon.account_reviews.reason')} : #{reason}" if reason

    review&.payload&.each do |key, value|
      infos << "#{key} : #{value.is_a?(Enumerable) ? value.to_a.join(', ') : value}"
    end

    infos
  end

  def epsilon_review_status_filter_options
    statuses = ::Epsilon::AccountReview.statuses.keys.map do |status|
      [t("admin.epsilon.account_reviews.statuses.#{status}"), status]
    end

    statuses << [t('admin.epsilon.account_reviews.statuses.none'), 'none']
  end

  # One clean tab-separated line per account for the clipboard copy button on
  # the admin accounts index.
  def epsilon_account_copy_line(account)
    user = account.user

    state =
      if account.suspended?
        'suspended'
      elsif user&.pending?
        'pending'
      else
        'active'
      end

    [account.acct, user&.email, user&.sign_up_ip, state, user&.invite_request&.text&.squish]
      .map { |part| part.presence || '-' }
      .join("\t")
  end
end
