# frozen_string_literal: true

module Admin
  module Epsilon
    # Moderation audit/analytics page. Every figure is a DB-side aggregation over
    # the epsilon_moderation_events log (indexed on created_at / decision) -- rows
    # are never loaded into Ruby except the paginated detail feed. A time range
    # and an account search drive a single scope, so every table is dynamic.
    class ModerationHistoriesController < Admin::BaseController
      PER_PAGE     = 50
      TOP_ACCOUNTS = 15
      RANGES       = %w(day week month year all).freeze

      def show
        authorize :epsilon_ai_moderation_setting, :show?

        @range    = params[:range].presence_in(RANGES) || 'all'
        @decision = params[:decision].presence_in(::Epsilon::ModerationEvent.decisions.keys) || 'all'
        @query    = params[:q].to_s.strip

        @totals          = scope.group(:decision).count
        @grand_total     = @totals.values.sum
        @sensitive_total = scope.where(sensitive: true).count

        @buckets      = build_buckets
        @top_accounts = scope.where.not(acct: nil).group(:acct).order(count_all: :desc).limit(TOP_ACCOUNTS).count
        @events       = scope.order(created_at: :desc).page(params[:page]).per(PER_PAGE)

        # Two grouped lookups (not N+1) so each event row can link to the still-
        # existing status and, where one exists, to its report.
        status_ids            = @events.filter_map(&:status_id)
        @existing_status_ids  = Status.unscoped.where(id: status_ids).pluck(:id).to_set
        @reports_by_status_id = reports_by_status_id(status_ids)
      end

      private

      # Current filter state, ready to pass to the path helper; overrides let a
      # link flip one facet while preserving the others.
      def history_filters(overrides = {})
        { range: @range, decision: @decision, q: @query.presence }.merge(overrides).compact
      end
      helper_method :history_filters

      def scope
        @scope ||= begin
          relation = ::Epsilon::ModerationEvent.all
          relation = relation.where(created_at: range_start..) if range_start
          relation = relation.where(decision: @decision) unless @decision == 'all'
          relation = relation.search_acct(@query) if @query.present?
          relation
        end
      end

      def range_start
        case @range
        when 'day'   then 1.day.ago
        when 'week'  then 7.days.ago
        when 'month' then 1.month.ago
        when 'year'  then 1.year.ago
        end
      end

      def bucket_unit
        case @range
        when 'day' then 'hour'
        when 'week', 'month' then 'day'
        else 'month'
        end
      end

      def bucket_format
        case bucket_unit
        when 'hour' then '%Y-%m-%d %H:00'
        when 'day'  then '%Y-%m-%d'
        else '%Y-%m'
        end
      end

      # One row per time bucket, granularity following the selected range, with
      # per-decision counts, the sensitive (CW) count and the average peak
      # severity -- the "is the flagged content getting worse?" trend. Severity is
      # the max of the three criteria (violence / vulgarity / sexual), which is
      # what drives the verdict, so it is not tied to a single axis.
      # Single scan: total, avg severity, sensitive (CW) and every decision count
      # per bucket via conditional aggregation, instead of 7 separate GROUP BY
      # scans. bucket_unit / decision values are internal, not user input.
      def build_buckets
        trunc     = "date_trunc('#{bucket_unit}', created_at)"
        decisions = ::Epsilon::ModerationEvent.decisions

        columns = [trunc, 'COUNT(*)', 'AVG(GREATEST(violence_score, vulgarity_score, sexual_score))', 'COUNT(*) FILTER (WHERE sensitive)']
        columns.concat(decisions.values.map { |value| "COUNT(*) FILTER (WHERE decision = #{value})" })

        scope.group(Arel.sql(trunc)).order(Arel.sql("#{trunc} DESC")).pluck(Arel.sql(columns.join(', '))).map do |row|
          time, total, avg_severity, sensitive, *by_decision = row
          {
            label: time.strftime(bucket_format),
            total: total,
            avg_severity: avg_severity,
            sensitive: sensitive.to_i,
            by_decision: decisions.keys.zip(by_decision.map(&:to_i)).to_h,
          }
        end
      end

      def reports_by_status_id(status_ids)
        return {} if status_ids.empty?

        map = {}
        ::Report.where('status_ids && ARRAY[?]::bigint[]', status_ids).find_each do |report|
          report.status_ids.each do |sid|
            sid = sid.to_i
            map[sid] ||= report if status_ids.include?(sid)
          end
        end
        map
      end
    end
  end
end
