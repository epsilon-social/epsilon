# frozen_string_literal: true

class Epsilon::Categorization::CategorizeStatusWorker
  include Sidekiq::Worker

  sidekiq_options queue: 'default', retry: 3

  HASHTAG_WEIGHT = 10
  WORD_WEIGHT = 2
  MIN_SCORE = 4
  MAX_CATEGORIES = 3
  CONFIDENCE_THRESHOLD = 50

  DISTRIBUTION_BATCH_SIZE = 1_000

  def perform(status_id)
    status = Status.find_by(id: status_id)

    return unless status
    return if status.reblog?

    @validated_category_ids = []

    run_categorization_cascade(status)

    # ==========================================
    # EPSILON : CATEGORIZATION SYSTEM
    distribute_to_subscribers(status, @validated_category_ids)
    # ==========================================
  end

  private

  def run_categorization_cascade(status)
    # --- CASCADE NIVEAU 1 : LES HASHTAGS ET MOTS CLES ---
    if categorize_by_hashtag_and_content(status)
      Rails.logger.info("[Categorization] Status #{status.id} catégorisé par HASHTAG")
    # --- CASCADE NIVEAU 2 : LA WHITELIST AUTEUR ---
    elsif categorize_by_author(status)
      Rails.logger.info("[Categorization] Status #{status.id} catégorisé par AUTHOR")
    # --- CASCADE NIVEAU 3 : FALLBACK ---
    else
      Rails.logger.info("[Categorization] Status #{status.id} non classé (en attente Crowdsourcing)")
    end
  end

  def categorize_by_hashtag_and_content(status)
    tag_names = status.tags.pluck(:name).map(&:downcase)

    return false if tag_names.empty?

    sanitizer = Rails::Html::FullSanitizer.new
    clean_text = sanitizer.sanitize(status.text).to_s.downcase
    words = clean_text.scan(/\b\p{L}+\b/) - tag_names

    scores = Hash.new(0)
    accumulate_scores(tag_names, words, scores)

    valid_scores = scores.select { |_id, score| score >= MIN_SCORE }
    return false if valid_scores.empty?

    top_categories = valid_scores.sort_by { |_id, score| -score }.first(MAX_CATEGORIES)

    top_categories.each do |category_id, score|
      confidence = [(score.to_f / HASHTAG_WEIGHT) * 100, 100.0].min.round

      save_categorization(status.id, category_id, confidence)
    end

    true
  end

  def accumulate_scores(tag_names, words, scores)
    if tag_names.any?
      Epsilon::Categorization::HashtagMapping
        .where(hashtag: tag_names)
        .find_each { |mapping| scores[mapping.category_master_id] += HASHTAG_WEIGHT }
    end

    return if words.empty?

    Epsilon::Categorization::HashtagMapping
      .where(hashtag: words)
      .find_each { |mapping| scores[mapping.category_master_id] += WORD_WEIGHT }
  end

  def max_score_candidates(scores)
    max = scores.values.max
    scores.select { |_id, score| score == max }.keys
  end

  def finalize_categorization(status, scores)
    final_candidates = max_score_candidates(scores)

    return false if final_candidates.size > 1

    dominant_category_id = final_candidates.first
    total_score = scores.values.sum.to_f
    confidence = ((scores[dominant_category_id] / total_score) * 100).round

    save_categorization(status.id, dominant_category_id, confidence)
    true
  end

  def save_categorization(status_id, category_id, confidence)
    categorization = Epsilon::Categorization::LocalPostCategorization.find_or_create_by!(
      status_id: status_id,
      category_master_id: category_id
    ) do |record|
      record.source = 'NLP_CLUSTER'
      record.confidence_score = confidence
      record.is_validated = confidence >= CONFIDENCE_THRESHOLD
    end

    @validated_category_ids << category_id if categorization.previously_new_record? && categorization.is_validated?

    categorization
  end

  def categorize_by_author(status)
    override = Epsilon::Categorization::AccountCategoryOverride.find_by(account_id: status.account_id)
    return false unless override

    categorization = Epsilon::Categorization::LocalPostCategorization.find_or_create_by!(
      status: status,
      category_master: override.category_master
    ) do |record|
      record.source = 'AUTHOR'
      record.confidence_score = 100
      record.is_validated = true
    end

    @validated_category_ids << categorization.category_master_id if categorization.previously_new_record? && categorization.is_validated?

    true
  end

  # ==========================================
  # EPSILON : CATEGORIZATION SYSTEM
  def distribute_to_subscribers(status, category_ids)
    category_ids = Array(category_ids).uniq
    return if category_ids.empty?

    subscriber_account_ids(status, category_ids).each_slice(DISTRIBUTION_BATCH_SIZE) do |account_ids|
      FeedInsertWorker.push_bulk(account_ids) do |account_id|
        [status.id, account_id, 'home']
      end
    end
  end

  def subscriber_account_ids(status, category_ids)
    already_following = Follow.where(target_account_id: status.account_id).select(:account_id)

    Epsilon::Categorization::CategorySubscription
      .where(category_master_id: category_ids)
      .where.not(account_id: status.account_id)
      .where.not(account_id: already_following)
      .joins(:account)
      .merge(Account.local)
      .distinct
      .pluck(:account_id)
  end
  # ==========================================
end
