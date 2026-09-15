# frozen_string_literal: true

module Admin
  module Epsilon
    class BadgesController < Admin::BaseController
      before_action :set_badge, only: [:show, :edit, :update, :destroy, :assign_account, :remove_account, :import_csv, :remove_pending_grant]

      BADGES_PER_PAGE = 25
      HOLDERS_PER_PAGE = 50
      PENDING_PER_PAGE = 50

      def index
        authorize ::Epsilon::Badge, :index?

        @badges = ::Epsilon::Badge.in_display_order.page(params[:page]).per(BADGES_PER_PAGE)
      end

      def show
        authorize @badge, :show?

        @holders = @badge.account_badges.includes(:account).order(created_at: :desc).page(params[:page]).per(HOLDERS_PER_PAGE)
        @pending_grants = @badge.pending_grants.order(:email).page(params[:pending_page]).per(PENDING_PER_PAGE)
      end

      def new
        authorize ::Epsilon::Badge, :create?

        @badge = ::Epsilon::Badge.new(color: '#800082', icon: 'license-fill')
      end

      def edit
        authorize @badge, :update?
      end

      def create
        authorize ::Epsilon::Badge, :create?

        @badge = ::Epsilon::Badge.new(badge_params)
        @badge.name = primary_name(@badge.name_translations)
        @badge.slug = unique_badge_slug(@badge.name) if @badge.slug.blank?

        if @badge.save
          redirect_to admin_epsilon_badge_path(@badge), notice: t('admin.epsilon.badges.created', name: @badge.display_name)
        else
          render :new
        end
      end

      def update
        authorize @badge, :update?

        @badge.assign_attributes(badge_params)
        @badge.name = primary_name(@badge.name_translations)

        if @badge.save
          redirect_to admin_epsilon_badge_path(@badge), notice: t('admin.epsilon.badges.updated', name: @badge.display_name)
        else
          render :edit
        end
      end

      def destroy
        authorize @badge, :destroy?

        @badge.destroy!
        redirect_to admin_epsilon_badges_path, notice: t('admin.epsilon.badges.deleted', name: @badge.name)
      end

      def assign_account
        authorize @badge, :update?

        acct = params[:acct].to_s.strip

        case grant_to_identifier(acct)
        when :assigned, :skipped
          redirect_to admin_epsilon_badge_path(@badge), notice: t('admin.epsilon.badges.assigned', acct: acct)
        when :pending
          redirect_to admin_epsilon_badge_path(@badge), notice: t('admin.epsilon.badges.assigned_pending', email: acct)
        else
          redirect_to admin_epsilon_badge_path(@badge), alert: t('admin.epsilon.badges.account_not_found', acct: acct)
        end
      end

      def remove_account
        authorize @badge, :update?

        @badge.account_badges.where(account_id: params[:account_id]).destroy_all
        redirect_to admin_epsilon_badge_path(@badge), notice: t('admin.epsilon.badges.removed')
      end

      def remove_pending_grant
        authorize @badge, :update?

        @badge.pending_grants.where(id: params[:grant_id]).destroy_all
        redirect_to admin_epsilon_badge_path(@badge), notice: t('admin.epsilon.badges.pending_removed')
      end

      def import_csv
        authorize @badge, :update?

        file = params[:file]

        if file.blank?
          redirect_to admin_epsilon_badge_path(@badge), alert: t('admin.epsilon.badges.csv.missing_file')
          return
        end

        result = assign_from_csv(file)
        redirect_to admin_epsilon_badge_path(@badge), notice: csv_summary(result)
      end

      private

      def set_badge
        @badge = ::Epsilon::Badge.find(params[:id])
      end

      def badge_params
        permitted = params.require(:epsilon_badge).permit(
          :color, :icon, :position, :is_active,
          name_translations: ::Epsilon::Badge::TRANSLATED_LOCALES,
          description_translations: ::Epsilon::Badge::TRANSLATED_LOCALES
        )

        # Return a plain hash: reassigning into the Parameters object would
        # re-wrap the nested hashes as unpermitted params and break mass-assign.
        permitted.to_h.merge(
          'name_translations' => clean_translations(permitted[:name_translations]),
          'description_translations' => clean_translations(permitted[:description_translations])
        )
      end

      def clean_translations(raw)
        (raw || {}).to_h.transform_values { |value| value.to_s.strip }.compact_blank
      end

      def primary_name(translations)
        translations['en'].presence || translations.values.find(&:present?).to_s
      end

      # Resolves a single identifier (email or local username, with or without a
      # leading @) to a LOCAL account. Remote accounts never carry badges.
      def resolve_local_account(identifier)
        value = identifier.to_s.strip.delete_prefix('@')
        return nil if value.blank?

        if value.include?('@')
          User.find_by(email: value.downcase)&.account
        else
          Account.find_local(value)
        end
      end

      # Grants the badge to whatever the identifier resolves to:
      # - a local account       => assigned / skipped (already had it)
      # - an unknown email       => pending (granted automatically on sign-up)
      # - an unknown username    => not_found
      def grant_to_identifier(identifier)
        account = resolve_local_account(identifier)

        if account
          @badge.account_badges.find_or_create_by!(account: account).previously_new_record? ? :assigned : :skipped
        elsif email_like?(identifier)
          @badge.pending_grants.find_or_create_by!(email: identifier).previously_new_record? ? :pending : :skipped
        else
          :not_found
        end
      end

      def email_like?(identifier)
        identifier.to_s.strip.delete_prefix('@').include?('@')
      end

      def assign_from_csv(file)
        result = Hash.new(0)

        csv_identifiers(file).each do |identifier|
          outcome = grant_to_identifier(identifier)
          outcome = :not_found_count if outcome == :not_found
          result[outcome] += 1
        end

        result
      end

      # Accepts a plain list (one identifier per line) or a CSV whose first
      # column holds the identifier. Blank rows are ignored.
      def csv_identifiers(file)
        CSV.parse(file.read).filter_map { |row| row.first.to_s.strip.presence }
      rescue CSV::MalformedCSVError
        []
      end

      def csv_summary(result)
        t(
          'admin.epsilon.badges.csv.summary',
          assigned: result[:assigned],
          skipped: result[:skipped],
          pending: result[:pending],
          not_found: result[:not_found_count]
        )
      end

      def unique_badge_slug(source)
        base = source.to_s.parameterize.presence&.first(50) || 'badge'
        slug = base
        suffix = 2

        while ::Epsilon::Badge.exists?(slug: slug)
          tail = "-#{suffix}"
          slug = "#{base.first(50 - tail.length)}#{tail}"
          suffix += 1
        end

        slug
      end
    end
  end
end
