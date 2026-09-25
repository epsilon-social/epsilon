# frozen_string_literal: true

# Fixes account search ranking pathologies for young instances
# (see upstream issue mastodon/mastodon#35968):
#
# - The native score is `text relevance * log10(followers + 1)`, so an
#   account with zero followers scores exactly zero no matter how well its
#   name matches the query. Switching the follower boost to additive
#   (`boost_mode: 'sum'`) keeps popularity as a tie-breaker instead of a
#   hard gate.
# - Multi-word queries matched each word independently (OR), burying the
#   full-name match under thousands of accounts matching a single stopword
#   (e.g. "a"). The `combined_fields` clause with `operator: 'and'` requires
#   every term to match, adapted from Gargron's draft PR mastodon/mastodon#37403.
# - The search results page only matched whole tokens, so "presidentielle"
#   could not find @presidentielle2027. Prefix matching is enabled by
#   querying the edge_ngram subfields already present in the accounts index,
#   adapted from upstream PR mastodon/mastodon#40627. No reindex needed.
module Epsilon
  module AccountSearchRankingExtension
    module QueryBuilder
      def build
        AccountsIndex.query(
          bool: {
            must: {
              function_score: {
                query: {
                  bool: {
                    must: must_clauses,
                    must_not: must_not_clauses,
                  },
                },

                functions: [
                  followers_score_function,
                ],

                boost_mode: 'sum',
              },
            },

            should: should_clauses,
          }
        )
      end
    end

    module FullQueryBuilder
      private

      def core_query
        {
          dis_max: {
            queries: [
              {
                multi_match: {
                  fields: %w(username username.edge_ngram),
                  query: @query,
                  analyzer: 'word_join_analyzer',
                },
              },

              {
                multi_match: {
                  fields: %w(display_name display_name.edge_ngram),
                  query: @query,
                  analyzer: 'word_join_analyzer',
                },
              },

              {
                combined_fields: {
                  query: @query,
                  fields: %w(username^2 display_name^2 text),
                  operator: 'and',
                },
              },
            ],

            tie_breaker: 0.5,
          },
        }
      end
    end
  end
end
